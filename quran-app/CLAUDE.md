# CLAUDE.md

Guidance for Claude Code working in `quran-app/`.

## Project
An offline-first Quran app for Android, iOS, Windows, macOS and Linux. Two core modes define v1: **Listen Mode** (hours of background/sleep playback, screen off) and **Follow Mode** (audio plus word-by-word highlighted text, screen on). Companion features: Jafari-first prayer times, qibla, and a Shia religious calendar with a'maal linked into the reader.

**`BLUEPRINT.md` is the source of truth.** Read the sections relevant to a phase before starting it. If the code and the blueprint disagree, or the blueprint is ambiguous, stop and ask. Do not guess.

## Offline-first rules (BLUEPRINT §5), non-negotiable
1. **No feature in the reading, playback, prayer-time or qibla path may touch the network.** If a code path in Listen Mode or Follow Mode can `await` a request, it's a bug. Prayer times and qibla are computed locally from coordinates and never fetched from an API.
2. **v1 ships with no backend at all.** JSON export/import covers backup. Don't build auth before users ask for sync.
3. **Never host audio yourself.** The download manager pulls from existing free CDNs (everyayah.com, Quran Foundation).
4. **v2 sync covers user data only:** bookmarks, notes, khatmah, reciter and calculation preferences. Never content, never audio.
5. **Content packs are versioned downloads, not app updates:** tafsirs, translations and the calendar dataset.

## Stack
Flutter · Riverpod · SQLite (`sqflite` on mobile, `sqflite_common_ffi` on desktop) · Python 3 stdlib for the ingest.
Add phase dependencies (`just_audio`, `audio_service`, `wakelock_plus`, `dio`, `adhan`, `flutter_compass`, `geolocator`, `flutter_local_notifications`) in the phase that uses them, not before.

## Commands
```bash
# from quran-app/
python3 tool/ingest/fetch_sources.py                  # download sources (network; the only networked step)
python3 tool/ingest/ingest.py                         # build assets/db/content.db, checked against the lock
python3 -m unittest discover -s tool/ingest/tests     # ingest tests (fixtures, no real sources needed)
flutter analyze && flutter test                       # must pass before any commit
flutter run -d linux|macos|windows|<device>
```
The Dart tests shell out to `python3` to build the fixture DB, so both toolchains are needed.

## Structure
```
BLUEPRINT.md                       # the plan: read it
schema/
  content.sql                      # bundled, read-only content DB (written by the ingest)
  user.sql                         # on-device user DB (created by the app)
  search_normalization_vectors.json  # pins the Python and Dart normalizers together
tool/ingest/                       # Phase 0 pipeline (see its README for sources and licensing)
  fetch_sources.py ingest.py sources.py normalize.py reciters.json tests/
  sources.lock.json                # sha256 pins, created by the first --update-lock
assets/db/                         # ingest output, gitignored
lib/
  main.dart app.dart               # DB factory per platform; RTL root
  core/                            # arabic_normalizer, breakpoints
  data/                            # content_db, user_db, models, providers
  features/<feature>/              # shell, reader, listen, follow, prayer, qibla, calendar
```

## Conventions
- **Two databases.** Content (`content.sql`) is replaceable as a whole and never holds user data. User data (`user.sql`) references Quran positions by `(surah, ayah)`, never by content-DB row ids. Bump the schema version in `ingest.py` and `content_db.dart` together.
- **The ingest fails loudly.** Never loosen a validation to get a build through: fix the source or the parser. The same sources must produce a byte-identical DB, and `sources.lock.json` pins them.
- **Search normalization lives in two places** (`normalize.py`, `arabic_normalizer.dart`). Change both, and add a vector to the shared JSON.
- **Reciter `sync_tier` is derived from the timing data the ingest actually imported** (A = word segments for every ayah, B = ayah spans, C = none). Never hand-set it, and never interpolate word timings from ayah duration.
- **RTL is the default at the app root.** LTR is the exception (e.g. Latin-only strings).
- **Layout is chosen by width** (`LayoutSize`: <600, 600–1000, >1000), never by platform checks.
- **Wakelocks:** Follow Mode acquires one and must release it the instant the mode exits. Listen Mode never keeps the screen awake.
- **Religious content** (prayer parameters, calendar dates, a'maal) needs review by someone qualified, not just tests. Computed dates for obligations (Ramadan, the Eids) always carry a "subject to local sighting" note.
- **No ads, no tracking.** Crash reporting only.
- **Location permission** is requested when prayer times or qibla are first opened, with a plain explanation, never at launch. Manual city entry is a first-class alternative.

## Phases
One feature per session, with a hard QA gate between phases (BLUEPRINT §10). Current: **Phase 0, data pipeline**. The ingest builds the full mus'haf from the real sources (114 surahs, 6236 ayahs, 77,429 words, 604 pages, 10 Tier A reciters), reproducibly. Bundled translation: Qara'i (English). Upstream corrections live in `tool/ingest/overrides.json`. Still open: word roots, verifying the everyayah audio copies, and the calendar dataset. See `tool/ingest/README.md`.
