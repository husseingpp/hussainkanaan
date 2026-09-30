# Quran App

An offline-first Quran app for Android, iOS and desktop, built with Flutter. It has two core modes, **Listen** (sleep and background recitation) and **Follow** (word-synced reading). Jafari prayer times, qibla and a Shia calendar come later.

- **Plan:** [`BLUEPRINT.md`](BLUEPRINT.md)
- **Working rules:** [`CLAUDE.md`](CLAUDE.md)
- **Data pipeline:** [`tool/ingest/README.md`](tool/ingest/README.md)

## Status

- **Phase 0 (data pipeline): done.** The full mus'haf from Tanzil and the Quran Foundation: 6,236 ayahs, 77,429 words with roots, v1 layout for all 604 pages, Qara'i's English translation, and word timing for 12 reciters (10 of them Tier A).
- **Phase 1 (reader): done.**
  - Resume where you left off, the surah index, the juz index, and jump to a page.
  - The printed-page view, drawn with the original King Fahd Complex fonts after a one-time optional download, or Amiri Quran until then.
  - A resizable reading view with translation and sajda marks.
  - Night mode, and an About screen with credits.
- **Phase 2 (Listen Mode): built, needs the overnight phone test.**
  - 13 reciters, with downloads by surah and size estimates.
  - Gapless playback to the end of the Quran.
  - A sleep timer with fade-out, and a quiet-room volume.
  - Lock-screen controls, crash-safe resume, and battery-saver guidance.
- **Phase 3 (Follow Mode): built, needs the phone test.**
  - The recited word is lit as you read (word by word for 10 reciters).
  - Auto-scroll with a "return to recitation" button.
  - Tap an ayah to jump to it, and the screen stays on only in this mode.
  - A repeat engine for memorization.

Android test build: https://github.com/husseingpp/hussainkanaan/releases/tag/quran-app-android-latest

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
