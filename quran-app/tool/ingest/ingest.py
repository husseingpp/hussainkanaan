#!/usr/bin/env python3
"""Phase 0: build the bundled content DB from pinned upstream sources.

    python3 tool/ingest/ingest.py                 # sources/ -> assets/db/content.db
    python3 tool/ingest/ingest.py --update-lock   # after deliberately changing a source

One command, no network, no third-party packages. The same inputs always
produce a byte-identical DB (sorted inserts, no timestamps, VACUUM), and
sources.lock.json pins every input by sha256 so "same inputs" is checkable.

The build fails loudly on any inconsistency rather than shipping a DB that
is subtly wrong: nothing downstream can be trusted if the data isn't.
See README.md in this directory for where each source comes from.
"""

from __future__ import annotations

import argparse
import bisect
import hashlib
import json
import os
import sqlite3
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
APP_ROOT = HERE.parent.parent
sys.path.insert(0, str(HERE))

from normalize import normalize  # noqa: E402
from ttf_cmap import FontError, codepoints  # noqa: E402
from sources import (  # noqa: E402
    SourceError,
    parse_ayah_text,
    parse_metadata,
    parse_segments,
    parse_word_layout,
    parse_word_values,
)

# Bump together with ContentDb.schemaVersion in lib/data/content_db.dart.
SCHEMA_VERSION = 1

# The canonical Madani (Hafs) mus'haf. Checked in strict mode only, so the
# test fixtures can be a couple of surahs.
CANON = {"surahs": 114, "ayahs": 6236, "pages": 604, "juz": 30, "quarters": 240, "sajdas": 15}

# A reciter is Tier A when this share of ayahs has clean word timing. Upstream
# segment data is ~99% clean for murattal recordings; the defective ayahs are
# dropped by fetch_quran_com.py and fall back to whole-ayah highlight, which
# per-ayah audio files give for free. Never interpolated (BLUEPRINT §4).
MIN_WORD_TIMING_COVERAGE = 0.98

BISMILLAH = "بسم الله الرحمن الرحيم"

CALENDAR_CATEGORIES = {"mourning", "birth", "martyrdom", "eid", "blessed_night", "fast", "other"}


class BuildError(Exception):
    pass


def check(cond: bool, msg: str) -> None:
    if not cond:
        raise BuildError(msg)


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def pick(directory: Path, stem: str, required: bool = True) -> Path | None:
    """Tanzil files come as .xml or .txt; accept either, never both."""
    found = [p for p in (directory / f"{stem}.xml", directory / f"{stem}.txt") if p.exists()]
    check(len(found) <= 1, f"both .xml and .txt present for {directory / stem}")
    check(bool(found) or not required, f"missing source: {directory / stem}.xml|.txt")
    return found[0] if found else None


class SourceSet:
    """Resolves the fixed on-disk layout of the sources directory."""

    def __init__(self, root: Path):
        self.root = root
        tanzil, qul = root / "tanzil", root / "qul"
        self.metadata = tanzil / "quran-data.xml"
        check(self.metadata.exists(), f"missing source: {self.metadata}")
        self.uthmani = pick(tanzil, "quran-uthmani")
        self.simple_clean = pick(tanzil, "quran-simple-clean")
        translations = sorted(tanzil.glob("translation.*.txt")) + sorted(tanzil.glob("translation.*.xml"))
        check(len(translations) <= 1, "bundle exactly one translation (BLUEPRINT §6); found several")
        self.translation = translations[0] if translations else None
        self.words_uthmani = qul / "words-uthmani.json"
        check(self.words_uthmani.exists(), f"missing source: {self.words_uthmani}")
        self.words_qcf = self._opt(qul / "words-qcf-v1.json")
        self.words_translation = self._opt(qul / "words-translation-en.json")
        self.words_root = self._opt(qul / "words-root.json")
        self.words_layout = self._opt(qul / "words-layout-v1.json")
        self.segments = sorted((root / "segments").glob("*.json"))
        self.calendar = self._opt(root / "calendar" / "events.json")
        self.audio_probe = self._opt(root / "audio" / "probe.json")
        self.qcf_fonts = sorted((root / "qcf-v1").glob("p*.ttf"), key=lambda p: int(p.stem[1:]))

    @staticmethod
    def _opt(p: Path) -> Path | None:
        return p if p.exists() else None

    def files(self) -> list[Path]:
        fs = [self.metadata, self.uthmani, self.simple_clean, self.translation, self.words_uthmani,
              self.words_qcf, self.words_translation, self.words_root, self.words_layout, self.calendar,
              self.audio_probe, *self.segments, *self.qcf_fonts]
        return sorted(f for f in fs if f is not None)

    def fingerprint(self) -> dict[str, str]:
        return {f.relative_to(self.root).as_posix(): sha256(f) for f in self.files()}


def marker_lookup(markers: list[tuple[int, int, int]], name: str):
    """Tanzil gives the (surah, ayah) where each juz/page/quarter starts."""
    idx = [m[0] for m in markers]
    check(idx == list(range(1, len(idx) + 1)), f"{name} markers are not numbered 1..n contiguously")
    starts = [(m[1], m[2]) for m in markers]
    check(starts == sorted(starts) and len(set(starts)) == len(starts), f"{name} markers out of order")
    check(starts[0] == (1, 1) if starts else False, f"first {name} must start at 1:1")

    def lookup(key: tuple[int, int]) -> int:
        return bisect.bisect_right(starts, key)

    return lookup


def apply_sajda_overrides(sajdas: dict[tuple[int, int], str], overrides: list[dict]) -> None:
    for o in overrides:
        src_key = tuple(int(x) for x in o["from"].split(":"))
        dst_key = tuple(int(x) for x in o["to"].split(":"))
        check(src_key in sajdas, f"sajda override: upstream has no sajda at {o['from']} any more; re-check it")
        check(dst_key not in sajdas, f"sajda override: {o['to']} already has a sajda")
        check(o["type"] in ("recommended", "obligatory") and o.get("reason"), f"sajda override {o}: type and reason")
        del sajdas[src_key]
        sajdas[dst_key] = o["type"]


def build(src: SourceSet, out: Path, *, strict: bool, allow_unreviewed_calendar: bool,
          reciters_path: Path = HERE / "reciters.json", overrides_path: Path = HERE / "overrides.json") -> dict:
    meta = parse_metadata(src.metadata)
    overrides = json.loads(overrides_path.read_text(encoding="utf-8")) if overrides_path.exists() else {}
    apply_sajda_overrides(meta.sajdas, overrides.get("sajdas", []))
    surahs = meta.surahs

    # ---- metadata self-consistency
    for a, b in zip(surahs, surahs[1:]):
        if b.id == a.id + 1:
            check(b.start == a.start + a.ayah_count, f"surah {b.id} start offset disagrees with surah {a.id}")
    keys = [(s.id, n) for s in surahs for n in range(1, s.ayah_count + 1)]
    ayah_id = {(s.id, n): s.start + n for s in surahs for n in range(1, s.ayah_count + 1)}

    for name, markers in (("page", meta.page_starts), ("juz", meta.juz_starts), ("quarter", meta.quarter_starts)):
        bad = [m for m in markers if (m[1], m[2]) not in ayah_id]
        check(not bad, f"{name} markers point at unknown ayahs: {bad[:3]}")
    page_of = marker_lookup(meta.page_starts, "page")
    juz_of = marker_lookup(meta.juz_starts, "juz")
    quarter_of = marker_lookup(meta.quarter_starts, "hizb quarter")
    for (s, a) in meta.sajdas:
        check((s, a) in ayah_id, f"sajda at unknown ayah {s}:{a}")
    check(all(t in ("recommended", "obligatory") for t in meta.sajdas.values()), "unknown sajda type")

    if strict:
        check(len(surahs) == CANON["surahs"], f"expected {CANON['surahs']} surahs, got {len(surahs)}")
        check(len(keys) == CANON["ayahs"], f"expected {CANON['ayahs']} ayahs, got {len(keys)}")
        check(len(meta.page_starts) == CANON["pages"], f"expected {CANON['pages']} pages")
        check(len(meta.juz_starts) == CANON["juz"], f"expected {CANON['juz']} juz")
        check(len(meta.quarter_starts) == CANON["quarters"], f"expected {CANON['quarters']} hizb quarters")
        check(len(meta.sajdas) == CANON["sajdas"], f"expected {CANON['sajdas']} sajdas")
        check([s.id for s in surahs] == list(range(1, CANON["surahs"] + 1)), "surah ids are not 1..114")

    # ---- ayah text: must match the metadata exactly, no gaps, no extras
    def load_text(path: Path, label: str) -> dict[tuple[int, int], str]:
        text = parse_ayah_text(path)
        missing = [k for k in keys if k not in text]
        extra = sorted(set(text) - set(keys))
        check(not missing, f"{label}: {len(missing)} ayahs missing, first {missing[:3]}")
        check(not extra, f"{label}: {len(extra)} ayahs not in metadata, first {extra[:3]}")
        empty = [k for k in keys if not text[k].strip()]
        check(not empty, f"{label}: empty text at {empty[:3]}")
        return text

    uthmani = load_text(src.uthmani, "uthmani text")
    simple = load_text(src.simple_clean, "simple-clean text")
    translation = load_text(src.translation, "translation") if src.translation else None
    # Tanzil's .txt export glues the bismillah onto ayah 1 of every surah; the
    # XML export keeps it in an attribute. Only Al-Fatiha's first ayah is it.
    glued = [s.id for s in surahs if s.id != 1 and normalize(uthmani[(s.id, 1)]).startswith(BISMILLAH)]
    check(not glued, f"uthmani text has the bismillah inside ayah 1 of surahs {glued[:5]}…; "
                     "use Tanzil's XML export, which keeps it separate")

    # ---- words: positions 1..n per ayah, every ayah covered
    words = parse_word_values(src.words_uthmani)
    by_ayah: dict[tuple[int, int], list[int]] = {}
    for (s, a, w) in words:
        check((s, a) in ayah_id, f"word {s}:{a}:{w} belongs to no ayah")
        by_ayah.setdefault((s, a), []).append(w)
    word_count = {}
    for k in keys:
        pos = sorted(by_ayah.get(k, []))
        check(pos == list(range(1, len(pos) + 1)) and pos, f"words for {k[0]}:{k[1]}: positions {pos[:5]}… not 1..n")
        word_count[k] = len(pos)

    def load_word_extra(path: Path | None, label: str, allow_end_marker: bool = False):
        if path is None:
            return {}
        values = parse_word_values(path)
        for (s, a, w) in values:
            n = word_count.get((s, a))
            check(n is not None, f"{label}: {s}:{a}:{w} belongs to no ayah")
            # QCF encodes the ayah-number medallion as one more glyph after the last word.
            check(1 <= w <= n + (1 if allow_end_marker else 0), f"{label}: {s}:{a}:{w} out of range (ayah has {n} words)")
        return values

    qcf = load_word_extra(src.words_qcf, "QCF glyphs", allow_end_marker=True)
    wbw = load_word_extra(src.words_translation, "word translation")
    roots = load_word_extra(src.words_root, "word roots")
    layout = {}
    if src.words_layout:
        layout = parse_word_layout(src.words_layout)
        # Positions 1..n are words; n+1 is the ayah's end-of-ayah medallion.
        bad = [loc for loc in layout if loc[:2] not in word_count or not 1 <= loc[2] <= word_count[loc[:2]] + 1]
        check(not bad, f"word layout: unknown words {bad[:3]}")
        missing = [(s, a, w) for (s, a), n in word_count.items() for w in range(1, n + 2) if (s, a, w) not in layout]
        check(not missing, f"word layout missing for {len(missing)} words, first {missing[:3]}")
    page_lines = build_page_lines(layout, surahs, word_count, strict) if layout else {}
    if layout:
        wrong = [k for k in keys if layout[(*k, 1)][0] != page_of(k)]
        check(not wrong, f"word layout and Tanzil disagree on the page of {len(wrong)} ayahs, first {wrong[:3]}")
    if qcf:
        missing = [(s, a, w) for (s, a), n in word_count.items() for w in range(1, n + 1) if (s, a, w) not in qcf]
        check(not missing, f"QCF glyphs missing for {len(missing)} words, first {missing[:3]}")

    # ---- reciters + timing segments; tier is derived, never declared
    reciters = json.loads(reciters_path.read_text(encoding="utf-8"))
    slugs = [r["slug"] for r in reciters]
    check(len(set(slugs)) == len(slugs), "duplicate reciter slug in reciters.json")
    timings: dict[str, dict] = {}
    for path in src.segments:
        slug = path.stem
        check(slug in slugs, f"segments/{path.name}: no reciter {slug!r} in reciters.json")
        segs = parse_segments(path)
        for (s, a), rows in segs.items():
            n = word_count.get((s, a))
            check(n is not None, f"segments/{path.name}: unknown ayah {s}:{a}")
            positions = [r[0] for r in rows]
            check(len(set(positions)) == len(positions), f"{slug} {s}:{a}: duplicate word position")
            word_rows = [r for r in rows if r[0] >= 1]
            check(all(p <= n for p in positions), f"{slug} {s}:{a}: word position beyond {n} words")
            check(all(0 <= r[1] < r[2] for r in rows), f"{slug} {s}:{a}: segment with end <= start")
            # Words may not overlap or run backwards: Follow Mode binary-searches this list.
            for x, y in zip(word_rows, word_rows[1:]):
                check(y[1] >= x[2], f"{slug} {s}:{a}: word {y[0]} starts before word {x[0]} ends")
            # Each ayah is either fully word-timed or a single whole-ayah span:
            # a half-timed ayah would highlight some words and skip others.
            got = sorted(r[0] for r in word_rows)
            check(not got or got == list(range(1, n + 1)),
                  f"{slug} {s}:{a}: word timings cover {len(got)}/{n} words; drop the ayah instead")
        word_timed = sum(1 for rows in segs.values() if any(r[0] >= 1 for r in rows))
        timings[slug] = {"segments": segs, "word_timed": word_timed,
                         "ayah_spans": all(k in segs for k in keys)}

    def tier(r: dict) -> str:
        t = timings.get(r["slug"], {})
        if t.get("word_timed", 0) >= MIN_WORD_TIMING_COVERAGE * len(keys):
            return "A"
        # A per-ayah file *is* the ayah's timing: the file playing is the ayah.
        return "B" if r["audio"] == "per_ayah" or t.get("ayah_spans") else "C"

    for r in reciters:
        check(r.get("audio") in ("per_ayah", "per_surah"), f"reciter {r['slug']}: audio must be per_ayah|per_surah")

    probe = json.loads(src.audio_probe.read_text(encoding="utf-8")) if src.audio_probe else {}
    estimates = {r["slug"]: estimate_audio(r, timings.get(r["slug"], {}).get("segments", {}), timings, word_count,
                                           keys, probe) for r in reciters}

    fonts = check_qcf_fonts(src.qcf_fonts, layout, qcf, strict) if src.qcf_fonts else []

    calendar = load_calendar(src.calendar, ayah_id, allow_unreviewed_calendar) if src.calendar else None

    # ---- write
    tmp = out.with_suffix(".db.tmp")
    tmp.unlink(missing_ok=True)
    out.parent.mkdir(parents=True, exist_ok=True)
    try:
        db = sqlite3.connect(tmp)
        db.execute("PRAGMA page_size = 4096")
        db.executescript((APP_ROOT / "schema" / "content.sql").read_text(encoding="utf-8"))
        db.execute(f"PRAGMA user_version = {SCHEMA_VERSION}")

        fingerprint = src.fingerprint()
        meta_rows = {
            "schema_version": str(SCHEMA_VERSION),
            "sources": json.dumps(fingerprint, sort_keys=True),
            "strict": "1" if strict else "0",
            "overrides": json.dumps(overrides.get("sajdas", []), ensure_ascii=False, sort_keys=True),
        }
        if calendar:
            meta_rows["calendar_version"] = calendar["version"]
            meta_rows["calendar_reviewed"] = "1" if calendar.get("reviewed") else "0"
        db.executemany("INSERT INTO meta VALUES (?, ?)", sorted(meta_rows.items()))

        for s in surahs:
            db.execute(
                "INSERT INTO surahs VALUES (?,?,?,?,?,?,?,?)",
                (s.id, s.name_ar, s.name_en, s.name_translit, s.revelation_type, s.revelation_order,
                 s.ayah_count, page_of((s.id, 1))),
            )
        for k in keys:
            n = word_count[k]
            qcf_text = "".join(qcf[(*k, w)] for w in range(1, n + 2) if (*k, w) in qcf) or None
            end_page, end_line = layout.get((*k, n + 1), (None, None))
            db.execute(
                "INSERT INTO ayahs VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
                (ayah_id[k], k[0], k[1], uthmani[k], normalize(simple[k]), qcf_text,
                 page_of(k), juz_of(k), quarter_of(k), meta.sajdas.get(k), end_page, end_line),
            )
        word_id = 0
        for k in keys:
            for w in range(1, word_count[k] + 1):
                word_id += 1
                loc = (*k, w)
                page, line = layout.get(loc, (None, None))
                db.execute(
                    "INSERT INTO words VALUES (?,?,?,?,?,?,?,?,?)",
                    (word_id, ayah_id[k], w, words[loc], qcf.get(loc), wbw.get(loc), roots.get(loc) or None,
                     page, line),
                )
        db.execute("INSERT INTO ayahs_fts (ayahs_fts) VALUES ('rebuild')")
        db.executemany("INSERT INTO page_lines VALUES (?,?,?,?)",
                       [(p, ln, kind, sid) for (p, ln), (kind, sid) in sorted(page_lines.items())])

        for rid, r in enumerate(sorted(reciters, key=lambda r: r["slug"]), 1):
            est = estimates[r["slug"]]
            db.execute(
                "INSERT INTO reciters VALUES (?,?,?,?,?,?,?,?,?,?)",
                (rid, r["slug"], r["name"], r.get("name_ar"), r["style"], est["kbps"], r["base_url"],
                 r["audio"], tier(r), timings.get(r["slug"], {}).get("word_timed", 0)),
            )
            db.executemany(
                "INSERT INTO reciter_surahs VALUES (?,?,?,?)",
                [(rid, sid, ms, round(ms * est["kbps"] / 8)) for sid, ms in sorted(est["surah_ms"].items())],
            )
            segs = timings.get(r["slug"], {}).get("segments", {})
            for k in keys:
                for pos, start, end in segs.get(k, []):
                    db.execute("INSERT INTO ayah_timings VALUES (?,?,?,?,?)", (rid, ayah_id[k], pos, start, end))

        if translation:
            slug = src.translation.stem.removeprefix("translation.")
            db.execute(
                "INSERT INTO translations VALUES (1, ?, ?, ?, ?)",
                (slug, slug.split(".")[0], slug, f"Tanzil {src.translation.name}"),
            )
            db.executemany(
                "INSERT INTO translation_ayahs VALUES (1, ?, ?)", [(ayah_id[k], translation[k]) for k in keys]
            )

        db.executemany("INSERT INTO qcf_fonts VALUES (?,?,?,?)", fonts)
        if calendar:
            write_calendar(db, calendar)

        db.commit()
        problems = db.execute("PRAGMA foreign_key_check").fetchall()
        check(not problems, f"foreign key violations: {problems[:3]}")
        db.execute("VACUUM")
        db.close()
    except BaseException:
        tmp.unlink(missing_ok=True)
        raise
    os.replace(tmp, out)
    digest = sha256(out)
    # The app compares this sidecar with its installed copy to decide whether
    # to re-copy the asset, without hashing a large DB on every launch.
    out.with_name(out.name + ".sha256").write_text(digest + "\n", encoding="utf-8")

    return {
        "out": str(out),
        "sha256": digest,
        "surahs": len(surahs),
        "ayahs": len(keys),
        "words": word_id,
        "reciters": {r["slug"]: f"{tier(r)} ({timings.get(r['slug'], {}).get('word_timed', 0)} word-timed ayahs), "
                                f"{estimates[r['slug']]['kbps']} kbps, "
                                f"≈{sum(estimates[r['slug']]['surah_ms'].values()) * estimates[r['slug']]['kbps'] / 8e9:.2f} GB"
                     for r in sorted(reciters, key=lambda r: r["slug"])},
        "translation": src.translation.name if src.translation else None,
        "calendar": calendar["version"] if calendar else None,
    }


AYAH_TAIL_MS = 300   # silence after the last word in a per-ayah file
PROBE_AYAH = (2, 255)


def estimate_audio(r: dict, segs: dict, timings: dict, word_count: dict, keys: list, probe: dict) -> dict:
    """Per-surah duration and a bitrate, for size estimates.

    An ayah's duration is its last word's end (+ a short tail) where the
    timing data has it; otherwise the reciter's own average pace per word;
    and for a reciter with no timing at all, the average of the murattal
    reciters that have it. Bitrate is measured from the probed 2:255 file.
    """
    def ayah_ms(sg: dict, k) -> float | None:
        rows = [row for row in sg.get(k, []) if row[0] >= 1]
        return max(row[2] for row in rows) + AYAH_TAIL_MS if rows else None

    known = {k: ms for k in keys if (ms := ayah_ms(segs, k)) is not None}
    if known:
        pace = sum(ms - AYAH_TAIL_MS for ms in known.values()) / sum(word_count[k] for k in known)
        per_ayah = {k: known.get(k, pace * word_count[k] + AYAH_TAIL_MS) for k in keys}
    else:
        others = [t["segments"] for slug, t in timings.items() if t.get("word_timed")]
        per_ayah = {}
        for k in keys:
            vals = [v for sg in others if (v := ayah_ms(sg, k)) is not None]
            per_ayah[k] = sum(vals) / len(vals) if vals else 0.0

    kbps = r.get("bitrate")
    size = probe.get("002255", {}).get(r["slug"])
    # Measured duration if 2:255 is word-timed for this reciter, else estimated.
    if size and per_ayah.get(PROBE_AYAH):
        kbps = size * 8 / per_ayah[PROBE_AYAH]
    surah_ms: dict[int, float] = {}
    for (sid, _), ms in per_ayah.items():
        surah_ms[sid] = surah_ms.get(sid, 0) + ms
    return {"kbps": round(kbps or 64), "surah_ms": {s: round(ms) for s, ms in surah_ms.items()}}


MUSHAF_LINES = 15


def build_page_lines(layout: dict, surahs: list, word_count: dict, strict: bool) -> dict:
    """Account for every line of every page: ayat, a surah title, or the bismillah.

    A surah's title sits two lines above its first word and the bismillah one
    line above (Al-Fatiha's bismillah is its first ayah; At-Tawbah has none,
    so its title is directly above). When a surah starts on line 2, its title
    is the last line of the previous page, as in the printed mus'haf.
    """
    lines: dict[tuple[int, int], tuple[str, int | None]] = {}
    for (s, a, w), (p, ln) in layout.items():
        check(1 <= ln <= MUSHAF_LINES, f"layout: {s}:{a}:{w} on line {ln}")
        lines[(p, ln)] = ("ayat", None)

    def put(page: int, line: int, kind: str, sid: int) -> None:
        if line < 1:
            page, line = page - 1, MUSHAF_LINES + line
        check(page >= 1 and (page, line) not in lines,
              f"surah {sid}: its {kind} line {page}:{line} is already taken")
        lines[(page, line)] = (kind, sid)

    for surah in surahs:
        page, line = layout[(surah.id, 1, 1)]
        if surah.id in (1, 9):
            put(page, line - 1, "surah_name", surah.id)
        else:
            put(page, line - 1, "bismillah", surah.id)
            put(page, line - 2, "surah_name", surah.id)

    if strict:
        pages = sorted({p for p, _ in lines})
        check(pages == list(range(1, CANON["pages"] + 1)), "layout does not cover pages 1..604")
        for p in pages:
            used = sorted(ln for q, ln in lines if q == p)
            # Pages 1 and 2 are the short, centred opening pages.
            expected = list(range(1, used[-1] + 1)) if p <= 2 else list(range(1, MUSHAF_LINES + 1))
            check(used == expected, f"page {p}: lines {sorted(set(expected) - set(used))} unaccounted for")
    return lines


QCF_FONT_URL = "https://static.qurancdn.com/fonts/quran/hafs/v1/ttf/p{page}.ttf"


def check_qcf_fonts(paths: list[Path], layout: dict, qcf: dict, strict: bool) -> list[tuple]:
    """Every glyph code drawn on a page must exist in that page's font."""
    pages = [int(p.stem[1:]) for p in paths]
    if strict:
        check(pages == list(range(1, CANON["pages"] + 1)), f"QCF fonts: have {len(pages)} of 604 pages")
    need: dict[int, set[int]] = {}
    for loc, (page, _) in layout.items():
        if loc in qcf:
            need.setdefault(page, set()).update(ord(c) for c in qcf[loc])
    rows = []
    for page, path in zip(pages, paths):
        data = path.read_bytes()
        try:
            have = codepoints(data)
        except FontError as e:
            raise BuildError(f"QCF font p{page}: {e}") from e
        missing = sorted(need.get(page, set()) - have)
        check(not missing, f"QCF font p{page} lacks {len(missing)} glyphs used on its page, e.g. {missing[:3]}")
        rows.append((page, QCF_FONT_URL.format(page=page), len(data), hashlib.sha256(data).hexdigest()))
    return rows


def load_calendar(path: Path, ayah_id: dict, allow_unreviewed: bool) -> dict:
    cal = json.loads(path.read_text(encoding="utf-8"))
    check(isinstance(cal.get("version"), str), "calendar: missing version")
    check(cal.get("reviewed") is True or allow_unreviewed,
          "calendar: pack is not marked reviewed. BLUEPRINT §9 requires a qualified review before "
          "release; pass --allow-unreviewed-calendar for development builds only")
    slugs = set()
    for ev in cal["events"]:
        slug = ev["slug"]
        check(slug not in slugs, f"calendar: duplicate event {slug}")
        slugs.add(slug)
        check(ev["category"] in CALENDAR_CATEGORIES, f"calendar {slug}: unknown category {ev['category']!r}")
        check(ev["importance"] in (1, 2, 3), f"calendar {slug}: importance must be 1..3")
        check(len(ev["dates"]) >= 1, f"calendar {slug}: no dates")
        check(sum(1 for d in ev["dates"] if d.get("primary")) == 1, f"calendar {slug}: exactly one primary date")
        if len(ev["dates"]) > 1:
            check(all(d.get("variant") for d in ev["dates"]),
                  f"calendar {slug}: several dates need a variant label each")
        for d in ev["dates"]:
            check(1 <= d["month"] <= 12 and 1 <= d["day"] <= 30, f"calendar {slug}: bad date {d}")
        for am in ev.get("amaal", []):
            check(bool(am.get("source_note")), f"calendar {slug}: a'maal {am.get('title_ar')!r} has no source")
            for r in am.get("ayahs", []):
                check((r["surah"], r["from"]) in ayah_id and (r["surah"], r["to"]) in ayah_id
                      and r["to"] >= r["from"], f"calendar {slug}: bad ayah range {r}")
    return cal


def write_calendar(db: sqlite3.Connection, cal: dict) -> None:
    date_id = amaal_id = 0
    for eid, ev in enumerate(sorted(cal["events"], key=lambda e: e["slug"]), 1):
        db.execute(
            "INSERT INTO calendar_events VALUES (?,?,?,?,?,?,?,?)",
            (eid, ev["slug"], ev["name_ar"], ev["name_en"], ev["category"], ev["importance"],
             ev.get("significance"), 1 if ev.get("sighting_dependent") else 0),
        )
        for d in ev["dates"]:
            date_id += 1
            db.execute(
                "INSERT INTO event_dates VALUES (?,?,?,?,?,?,?)",
                (date_id, eid, d["month"], d["day"], d.get("span_days", 1), d.get("variant"),
                 1 if d.get("primary") else 0),
            )
        for am in ev.get("amaal", []):
            amaal_id += 1
            db.execute(
                "INSERT INTO event_amaal VALUES (?,?,?,?,?,?)",
                (amaal_id, eid, am["kind"], am["title_ar"], am.get("body_ar"), am["source_note"]),
            )
            for r in am.get("ayahs", []):
                db.execute("INSERT INTO event_amaal_ayahs VALUES (?,?,?,?)",
                           (amaal_id, r["surah"], r["from"], r["to"]))


def verify_lock(src: SourceSet, lock_path: Path, update: bool) -> None:
    current = src.fingerprint()
    if update:
        lock_path.write_text(json.dumps(current, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        print(f"wrote {lock_path}")
        return
    check(lock_path.exists(), f"{lock_path} missing: run once with --update-lock after reviewing the sources")
    locked = json.loads(lock_path.read_text(encoding="utf-8"))
    diffs = sorted(
        f"  {k}: locked {locked.get(k, '-')[:12]}, found {current.get(k, '-')[:12]}"
        for k in set(locked) | set(current)
        if locked.get(k) != current.get(k)
    )
    check(not diffs, "sources differ from sources.lock.json:\n" + "\n".join(diffs)
          + "\nIf the change is intended, re-run with --update-lock and commit the lock.")


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--sources", type=Path, default=HERE / "sources")
    p.add_argument("--out", type=Path, default=APP_ROOT / "assets" / "db" / "content.db")
    p.add_argument("--reciters", type=Path, default=HERE / "reciters.json")
    p.add_argument("--overrides", type=Path, default=HERE / "overrides.json")
    p.add_argument("--lock", type=Path, default=HERE / "sources.lock.json")
    p.add_argument("--update-lock", action="store_true", help="re-pin the sources' sha256 in the lock file")
    p.add_argument("--no-lock", action="store_true", help="skip the lock check (tests and experiments)")
    p.add_argument("--partial", action="store_true", help="skip the full-mus'haf counts (fixtures only)")
    p.add_argument("--allow-unreviewed-calendar", action="store_true")
    args = p.parse_args(argv)
    try:
        src = SourceSet(args.sources)
        if not args.no_lock:
            verify_lock(src, args.lock, args.update_lock)
        report = build(src, args.out, strict=not args.partial,
                       allow_unreviewed_calendar=args.allow_unreviewed_calendar, reciters_path=args.reciters,
                       overrides_path=args.overrides)
    except (BuildError, SourceError) as e:
        print(f"ingest failed: {e}", file=sys.stderr)
        return 1
    print(json.dumps(report, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
