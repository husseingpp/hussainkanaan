# Quran App

An offline-first Quran app for Android, iOS and desktop, built with Flutter. It has two core modes, **Listen** (sleep and background recitation) and **Follow** (word-synced reading). Jafari prayer times, qibla and a Shia calendar come later.

- **Plan:** [`BLUEPRINT.md`](BLUEPRINT.md)
- **Working rules:** [`CLAUDE.md`](CLAUDE.md)
- **Data pipeline:** [`tool/ingest/README.md`](tool/ingest/README.md)

## Status

**Phase 0 (data pipeline) is in progress.** Done so far:

- Schemas for the content DB and the user DB
- The ingest, with validation, reproducible output and source pinning
- Shared search normalization
- An RTL app shell with responsive navigation
- The database layer, and a surah index read from the content DB

Still to do: run the ingest against the real Tanzil and QUL exports, confirm which reciters have Tier A timing data, and start sourcing the calendar dataset.

## Run

```bash
cd quran-app
# 1. put the sources in tool/ingest/sources/ (see tool/ingest/README.md), then:
python3 tool/ingest/ingest.py --update-lock   # first time only; commit the lock
python3 tool/ingest/ingest.py
# 2.
flutter run
```

Without step 1, the app starts and the surah index explains that the content DB isn't bundled yet.

## Test

```bash
python3 -m unittest discover -s tool/ingest/tests
flutter analyze && flutter test
```
