# Quran App

An offline-first Quran app for Android, iOS and desktop, built with Flutter. It has two core modes, **Listen** (sleep and background recitation) and **Follow** (word-synced reading). Jafari prayer times, qibla and a Shia calendar come later.

- **Plan:** [`BLUEPRINT.md`](BLUEPRINT.md)
- **Working rules:** [`CLAUDE.md`](CLAUDE.md)
- **Data pipeline:** [`tool/ingest/README.md`](tool/ingest/README.md)

## Status

**Phase 0 (data pipeline) is nearly done.** The ingest builds the full mus'haf from Tanzil and the Quran Foundation API:

- 114 surahs, 6,236 ayahs and 77,429 words, with v1 page and line layout for all 604 pages
- Word timing for 12 reciters, 10 of them Tier A
- Search under 1 ms
- Byte-reproducible output, pinned by `sources.lock.json`

The bundled translation is Qara'i's English, and Fussilat's sajda is at 41:37 following Shia references. Word roots are in, from QUL. Still open: verifying the everyayah audio copies, and the calendar dataset. See [`tool/ingest/README.md`](tool/ingest/README.md).

## Run

```bash
cd quran-app
python3 tool/ingest/fetch_sources.py   # 1. download sources (~2 min)
python3 tool/ingest/ingest.py          #    build assets/db/content.db
# 2.
flutter run
```

Without step 1, the app starts and the surah index explains that the content DB isn't bundled yet.

## Test

```bash
python3 -m unittest discover -s tool/ingest/tests
flutter analyze && flutter test
```
