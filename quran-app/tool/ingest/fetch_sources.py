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
                                  XML, not .txt: the .txt export glues the
                                  bismillah onto ayah 1 of every surah
Location-keyed (see sources.py):
  qul/words-uthmani.json          word text, end-of-ayah markers excluded
  qul/words-qcf-v1.json           QCF v1 glyphs; the ayah's end marker is position n+1
  qul/words-translation-en.json   word-by-word English
  qul/words-layout-v1.json        {"page": p, "line": l} per word (Page View, v1 mus'haf)
  quran-com/recitation-<id>.json  raw segments + audio paths as served
  segments/<slug>.json            clean, fully word-timed ayahs only (for reciters.json
                                  entries with "quran_com_recitation")
  quran-com/<slug>.report.json    every dropped ayah and why

Upstream segments are ~99% clean for murattal recordings. An ayah whose
timing is defective (missing or out-of-range word numbers, zero-length or
overlapping words) is dropped whole, never repaired: Follow Mode then shows
whole-ayah highlight for it, which is honest, where a guessed repair isn't.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.parse
import urllib.request
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
            req = urllib.request.Request(url, headers={"User-Agent": "quran-app-ingest/1.0", "Accept": "application/json"})
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
                if w["char_type_name"] == "word":
                    uthmani[loc] = w["text_uthmani"]
                    layout[loc] = {"page": w["v1_page"], "line": w["line_number"]}
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


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--out", type=Path, default=HERE / "sources")
    p.add_argument("--offline", action="store_true", help="skip downloads; rebuild segments from cached raw files")
    args = p.parse_args()
    reciters = json.loads((HERE / "reciters.json").read_text(encoding="utf-8"))
    if not args.offline:
        fetch_tanzil(args.out)
        fetch_words(args.out)
        for r in reciters:
            if r.get("quran_com_recitation") is not None:
                fetch_recitation(r["quran_com_recitation"], args.out)
    prepare(reciters, args.out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
