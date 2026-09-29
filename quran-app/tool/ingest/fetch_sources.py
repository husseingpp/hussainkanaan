#!/usr/bin/env python3
"""Download every ingest source: Tanzil text + metadata, and word data and
timing segments from the Quran Foundation API.

    python3 tool/ingest/fetch_sources.py            # download everything (~2 min)
    python3 tool/ingest/fetch_sources.py --offline  # re-derive segments from the cached raw files

This is the only networked step, and it only writes into sources/. The ingest
never runs it: a plain `ingest.py` then checks the result against
sources.lock.json, so an upstream change can't slip into a build unnoticed.

Writes:
  tanzil/quran-data.xml, quran-uthmani.xml, quran-simple-clean.xml,
  tanzil/translation.en.qarai.txt
  qcf-v1/p<n>.ttf                 the 604 per-page QCF v1 fonts (not bundled; see ingest)
                                  XML, not .txt: the .txt export glues the
                                  bismillah onto ayah 1 of every surah
Location-keyed (see sources.py):
  qul/words-uthmani.json          word text, end-of-ayah markers excluded
  qul/words-qcf-v1.json           QCF v1 glyphs; the ayah's end marker is position n+1
  qul/words-translation-en.json   word-by-word English
  qul/words-layout-v1.json        {"page": p, "line": l} per word and end marker (n+1)
  quran-com/recitation-<id>.json  raw segments + audio paths as served
  segments/<slug>.json            clean, fully word-timed ayahs only (for reciters.json
                                  entries with "quran_com_recitation")
  quran-com/<slug>.report.json    every dropped ayah and why
  qul/words-root.json             converted from vendor/qul-word-root.db.zip (QUL
                                  downloads need a sign-in, so that file is committed)

Upstream segments are ~99% clean for murattal recordings. An ayah whose
timing is defective (missing or out-of-range word numbers, zero-length or
overlapping words) is dropped whole, never repaired: Follow Mode then shows
whole-ayah highlight for it, which is honest, where a guessed repair isn't.
"""

from __future__ import annotations

import argparse
import json
import re
import sqlite3
import sys
import tempfile
import time
import urllib.parse
import urllib.request
import zipfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

API = "https://api.quran.com/api/v4"
TANZIL = {
    "quran-data.xml": "https://tanzil.net/res/text/metadata/quran-data.xml",
    "quran-uthmani.xml": "https://tanzil.net/pub/download/index.php?quranType=uthmani&outType=xml&agree=true",
    "quran-simple-clean.xml":
        "https://tanzil.net/pub/download/index.php?quranType=simple-clean&outType=xml&agree=true",
}
# The one bundled translation: Ali Quli Qara'i. Tanzil's translation XML is
# not well-formed (its comment block contains "--"), so take the .txt.
TRANSLATION = ("translation.en.qarai.txt", "https://tanzil.net/trans/?transID=en.qarai&type=txt-2")
HERE = Path(__file__).resolve().parent


def download(url: str) -> bytes:
    for attempt in range(5):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "quran-app-ingest/1.0"})
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read()
        except Exception as e:  # noqa: BLE001 - retry anything transient
            if attempt == 4:
                raise RuntimeError(f"{url}: {e}") from e
            time.sleep(2 ** attempt)
    raise AssertionError


def get(path: str, **params) -> dict:
    return json.loads(download(f"{API}/{path}?{urllib.parse.urlencode(params)}"))


def fetch_tanzil(out: Path) -> None:
    (out / "tanzil").mkdir(parents=True, exist_ok=True)
    for name, url in TANZIL.items():
        (out / "tanzil" / name).write_bytes(download(url))
    (out / "tanzil" / TRANSLATION[0]).write_bytes(download(TRANSLATION[1]))
    print("tanzil: " + ", ".join([*TANZIL, TRANSLATION[0]]))


def paged(path: str, key: str, **params) -> list[dict]:
    out, page = [], 1
    while page:
        d = get(path, per_page=50, page=page, **params)
        out += d[key]
        page = d["pagination"]["next_page"]
    return out


def chapter_words(ch: int) -> list[dict]:
    return paged(f"verses/by_chapter/{ch}", "verses", words="true",
                 word_fields="text_uthmani,code_v1,line_number,v1_page", word_translation_language="en")


QCF_FONT = "https://static.qurancdn.com/fonts/quran/hafs/v1/ttf/p{page}.ttf"


def fetch_qcf_fonts(out: Path) -> None:
    """The 604 per-page QCF v1 fonts. Not bundled in the app: the ingest records
    each one's size and sha256 so the app can download and verify them."""
    (out / "qcf-v1").mkdir(parents=True, exist_ok=True)

    def one(page: int) -> None:
        (out / "qcf-v1" / f"p{page}.ttf").write_bytes(download(QCF_FONT.format(page=page)))

    with ThreadPoolExecutor(16) as pool:
        list(pool.map(one, range(1, 605)))
    print("qcf-v1: 604 fonts")


def fetch_words(out: Path) -> None:
    with ThreadPoolExecutor(8) as pool:
        chapters = list(pool.map(chapter_words, range(1, 115)))
    uthmani, qcf, wbw, layout = {}, {}, {}, {}
    for verses in chapters:
        for v in verses:
            key = v["verse_key"]
            words = sorted(v["words"], key=lambda w: w["position"])
            for w in words:
                loc = f"{key}:{w['position']}"
                qcf[loc] = w["code_v1"]
                # Layout covers the end-of-ayah medallion too (position n+1):
                # Page View has to know which line it sits on.
                layout[loc] = {"page": w["v1_page"], "line": w["line_number"]}
                if w["char_type_name"] == "word":
                    uthmani[loc] = w["text_uthmani"]
                    if (w.get("translation") or {}).get("text"):
                        wbw[loc] = w["translation"]["text"]
                elif w["char_type_name"] != "end":
                    raise RuntimeError(f"{loc}: unexpected char_type {w['char_type_name']!r}")
    (out / "qul").mkdir(parents=True, exist_ok=True)
    for name, data in [("words-uthmani", uthmani), ("words-qcf-v1", qcf),
                       ("words-translation-en", wbw), ("words-layout-v1", layout)]:
        (out / "qul" / f"{name}.json").write_text(
            json.dumps(data, ensure_ascii=False, sort_keys=True, indent=0) + "\n", encoding="utf-8")
    print(f"words: {len(uthmani)} words, {len(qcf) - len(uthmani)} end markers")


def fetch_recitation(rid: int, out: Path) -> None:
    def chapter(ch: int) -> list[dict]:
        return paged(f"recitations/{rid}/by_chapter/{ch}", "audio_files", fields="segments")

    with ThreadPoolExecutor(8) as pool:
        files = [f for chunk in pool.map(chapter, range(1, 115)) for f in chunk]
    (out / "quran-com").mkdir(parents=True, exist_ok=True)
    data = {f["verse_key"]: {"url": f["url"], "segments": f.get("segments") or []} for f in files}
    (out / "quran-com" / f"recitation-{rid}.json").write_text(
        json.dumps(data, sort_keys=True) + "\n", encoding="utf-8")
    print(f"recitation {rid}: {len(data)} ayahs")


def clean_segments(raw: dict, word_count: dict[str, int]) -> tuple[dict, dict]:
    kept, dropped = {}, {}
    for key, entry in sorted(raw.items()):
        n = word_count[key]
        try:
            # Some recitations serve the numbers as strings.
            segs = [[int(x) for x in seg] for seg in entry["segments"]]
        except (TypeError, ValueError):
            dropped[key] = "non-numeric segment"
            continue
        if not segs:
            dropped[key] = "no segments"
            continue
        if any(len(seg) != 4 for seg in segs):
            dropped[key] = "segment is not [index, word, start_ms, end_ms]"
            continue
        rows = sorted((seg[1], seg[2], seg[3]) for seg in segs)
        positions = [r[0] for r in rows]
        if positions != list(range(1, n + 1)):
            dropped[key] = f"word numbers {positions} for {n} words"
        elif any(start >= end for _, start, end in rows):
            dropped[key] = "zero-length or reversed word"
        elif any(b[1] < a[2] for a, b in zip(rows, rows[1:])):
            dropped[key] = "overlapping words"
        else:
            kept[key] = [list(r) for r in rows]
    return kept, dropped


def audio_base(url: str) -> str:
    base = url.rsplit("/", 1)[0].removeprefix("//").removeprefix("mirrors.quranicaudio.com/everyayah/")
    return base


def prepare(reciters: list[dict], out: Path) -> None:
    words = json.loads((out / "qul" / "words-uthmani.json").read_text(encoding="utf-8"))
    word_count: dict[str, int] = {}
    for loc in words:
        key = loc.rsplit(":", 1)[0]
        word_count[key] = word_count.get(key, 0) + 1
    (out / "segments").mkdir(parents=True, exist_ok=True)
    for r in reciters:
        rid = r.get("quran_com_recitation")
        if rid is None:
            continue
        raw = json.loads((out / "quran-com" / f"recitation-{rid}.json").read_text(encoding="utf-8"))
        # Timings only hold for the exact files they were cut against.
        bases = {audio_base(e["url"]) for e in raw.values()}
        if len(bases) != 1 or not r["base_url"].endswith("/" + bases.pop()):
            raise RuntimeError(f"{r['slug']}: segments were timed against {sorted(bases)} "
                               f"but reciters.json plays {r['base_url']}")
        kept, dropped = clean_segments(raw, word_count)
        (out / "segments" / f"{r['slug']}.json").write_text(
            json.dumps(kept, sort_keys=True) + "\n", encoding="utf-8")
        (out / "quran-com" / f"{r['slug']}.report.json").write_text(
            json.dumps({"kept": len(kept), "dropped": dropped}, indent=1, sort_keys=True) + "\n",
            encoding="utf-8")
        print(f"{r['slug']:<22} word-timed {len(kept):>4}/{len(raw)} ({100 * len(kept) / len(raw):.1f}%)")


ROOTS_ZIP = HERE / "vendor" / "qul-word-root.db.zip"
_LETTER = re.compile("[\u0621-\u064a\u0671-\u06d3]")


def align_roots(roots: dict[str, str], words: dict[str, str]) -> dict[str, str]:
    """Map QUL root locations onto the app's word numbering.

    QUL numbers words the Quranic Arabic Corpus way, which splits a few words
    the Madani mus'haf writes as one ("بَعْدَ مَا" in 2:181, 8:6 and 13:37).
    There the roots run one past the ayah's last word. Only in such an ayah,
    positions after the merged word shift back by one, and the root of its
    second half (a particle, which has none) is dropped.
    """
    count: dict[str, int] = {}
    for loc in words:
        key = loc.rsplit(":", 1)[0]
        count[key] = count.get(key, 0) + 1
    by_ayah: dict[str, dict[int, str]] = {}
    for loc, root in roots.items():
        key, pos = loc.rsplit(":", 1)
        if key not in count:
            raise RuntimeError(f"roots: unknown ayah {key}")
        by_ayah.setdefault(key, {})[int(pos)] = root
    out = {}
    for key, positions in sorted(by_ayah.items()):
        n = count[key]
        if max(positions) > n:
            merged = [w for w in range(1, n + 1)
                      if sum(1 for t in words[f"{key}:{w}"].split() if _LETTER.search(t)) == 2]
            if len(merged) != 1 or max(positions) != n + 1:
                raise RuntimeError(f"roots: can't align {key}: positions up to {max(positions)} for {n} words")
            k = merged[0]
            if positions.get(k + 1):
                raise RuntimeError(f"roots: {key}: second half of merged word {k} has a root")
            positions = {(p if p <= k else p - 1): r for p, r in positions.items() if p != k + 1}
        for pos, root in positions.items():
            out[f"{key}:{pos}"] = root
    return out


def convert_roots(out: Path) -> None:
    with zipfile.ZipFile(ROOTS_ZIP) as z, tempfile.TemporaryDirectory() as tmp:
        z.extract("word-root.db", tmp)
        db = sqlite3.connect(Path(tmp) / "word-root.db")
        rows = db.execute("SELECT w.word_location, r.arabic_trilateral FROM root_words w "
                          "JOIN roots r ON r.id = w.root_id").fetchall()
        db.close()
    roots = {}
    for loc, root in rows:
        if loc in roots:
            raise RuntimeError(f"roots: {loc} has two roots")
        roots[loc] = " ".join(root.split())  # upstream pads letters with runs of spaces
    words = json.loads((out / "qul" / "words-uthmani.json").read_text(encoding="utf-8"))
    aligned = align_roots(roots, words)
    (out / "qul" / "words-root.json").write_text(
        json.dumps(aligned, ensure_ascii=False, sort_keys=True, indent=0) + "\n", encoding="utf-8")
    print(f"roots: {len(aligned)} words")


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--out", type=Path, default=HERE / "sources")
    p.add_argument("--offline", action="store_true", help="skip downloads; rebuild segments from cached raw files")
    args = p.parse_args()
    reciters = json.loads((HERE / "reciters.json").read_text(encoding="utf-8"))
    if not args.offline:
        fetch_tanzil(args.out)
        fetch_words(args.out)
        fetch_qcf_fonts(args.out)
        for r in reciters:
            if r.get("quran_com_recitation") is not None:
                fetch_recitation(r["quran_com_recitation"], args.out)
    prepare(reciters, args.out)
    convert_roots(args.out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
