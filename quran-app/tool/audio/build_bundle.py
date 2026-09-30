#!/usr/bin/env python3
"""Bundle one reciter into the app as compact Opus (CI step, needs ffmpeg).

Downloads the reciter's per-ayah MP3s (the same files its word timings were
cut against), re-encodes each to mono Ogg Opus at a low bitrate (recitation
is a single voice, so 16 kbps sounds close to the source at ~1/8 the size),
checks every file's duration against its source so the word timings still
line up, and writes:

  assets/audio/<slug>/SSSAAA.opus
  assets/audio/bundled.json       {slug, format, bitrate, files, bytes}

The app plays these straight from the APK (no second copy, no download).

  python3 tool/audio/build_bundle.py minshawi-murattal --kbps 16
"""
from __future__ import annotations

import argparse
import json
import shutil
import sqlite3
import subprocess
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RECITERS = ROOT / "tool" / "ingest" / "reciters.json"
CONTENT_DB = ROOT / "assets" / "db" / "content.db"
# Largest tolerated duration change per file. Timings are relative to each
# ayah's own file, so this bounds how far a highlight can drift.
MAX_DRIFT_S = 0.060


def files_for(db: Path) -> list[tuple[int, int]]:
    con = sqlite3.connect(db)
    return [(s, a) for s, n in con.execute("SELECT id, ayah_count FROM surahs ORDER BY id") for a in range(1, n + 1)]


def download(url: str, dest: Path) -> None:
    if dest.exists() and dest.stat().st_size > 0:
        return
    for attempt in range(6):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "quran-app-bundle/1.0"})
            with urllib.request.urlopen(req, timeout=60) as r:
                data = r.read()
            if not (data[:3] == b"ID3" or (len(data) > 1 and data[0] == 0xFF and data[1] & 0xE0 == 0xE0)):
                raise RuntimeError("not MP3")
            tmp = dest.with_suffix(".part")
            tmp.write_bytes(data)
            tmp.replace(dest)
            return
        except Exception as e:  # noqa: BLE001 - retry anything transient
            if attempt == 5:
                raise RuntimeError(f"{url}: {e}") from e
            time.sleep(2 ** attempt)


def duration(path: Path) -> float:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
        check=True, capture_output=True, text=True,
    ).stdout.strip()
    return float(out)


def encode(src: Path, dst: Path, kbps: int) -> float:
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", "-i", str(src), "-map_metadata", "-1", "-ac", "1",
         "-c:a", "libopus", "-b:a", f"{kbps}k", "-vbr", "on", "-application", "audio", str(dst)],
        check=True,
    )
    return duration(dst) - duration(src)


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("slug")
    p.add_argument("--kbps", type=int, default=16)
    p.add_argument("--work", type=Path, default=ROOT / "build" / "audio-src")
    p.add_argument("--out", type=Path, default=ROOT / "assets" / "audio")
    p.add_argument("--jobs", type=int, default=8)
    args = p.parse_args()

    reciter = next(r for r in json.loads(RECITERS.read_text(encoding="utf-8")) if r["slug"] == args.slug)
    files = files_for(CONTENT_DB)
    src_dir = args.work / args.slug
    out_dir = args.out / args.slug
    src_dir.mkdir(parents=True, exist_ok=True)
    out_dir.mkdir(parents=True, exist_ok=True)
    name = lambda s, a: f"{s:03d}{a:03d}"  # noqa: E731

    t0 = time.time()
    with ThreadPoolExecutor(args.jobs * 2) as pool:
        list(pool.map(lambda f: download(f"{reciter['base_url']}/{name(*f)}.mp3", src_dir / f"{name(*f)}.mp3"), files))
    print(f"downloaded {len(files)} files in {time.time() - t0:.0f}s", flush=True)

    t0 = time.time()
    with ThreadPoolExecutor(args.jobs) as pool:
        drifts = list(pool.map(lambda f: (name(*f), encode(src_dir / f"{name(*f)}.mp3", out_dir / f"{name(*f)}.opus", args.kbps)), files))
    print(f"encoded in {time.time() - t0:.0f}s", flush=True)

    worst = sorted(drifts, key=lambda d: -abs(d[1]))[:5]
    print("largest duration changes: " + ", ".join(f"{n} {d * 1000:+.0f} ms" for n, d in worst))
    bad = [(n, d) for n, d in drifts if abs(d) > MAX_DRIFT_S]
    if bad:
        print(f"{len(bad)} files changed length by more than {MAX_DRIFT_S * 1000:.0f} ms: {bad[:10]}", file=sys.stderr)
        return 1

    src_bytes = sum((src_dir / f"{name(*f)}.mp3").stat().st_size for f in files)
    out_bytes = sum((out_dir / f"{name(*f)}.opus").stat().st_size for f in files)
    manifest = {"slug": args.slug, "format": "opus", "bitrate": args.kbps, "files": len(files), "bytes": out_bytes}
    (args.out / "bundled.json").write_text(json.dumps(manifest, indent=1) + "\n", encoding="utf-8")
    print(f"{args.slug}: {len(files)} files, {src_bytes / 1e6:.0f} MB MP3 -> {out_bytes / 1e6:.0f} MB Opus {args.kbps} kbps")
    if "--keep-sources" not in sys.argv:
        shutil.rmtree(src_dir, ignore_errors=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
