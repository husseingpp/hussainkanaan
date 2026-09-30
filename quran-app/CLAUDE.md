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
One feature per session, with a hard QA gate between phases (BLUEPRINT §10).

- **Phase 0, data pipeline: done.** Full mus'haf from real sources, reproducible; see `tool/ingest/README.md`. Open: verifying the everyayah audio copies, and the calendar dataset.
- **Phase 1, reader: done, pending your test on a phone.** Index (resume, surahs, juz, jump to page), Page View, Reading View (resizable, translation, sajda marks), night mode, position saved as you read, and an About screen with credits. Page View draws each page with its King Fahd QCF v1 font once the user downloads the font pack (~95 MB from static.qurancdn.com, verified per file against `qcf_fonts` sizes and sha256 in the content DB). Until then it uses Amiri Quran, with the same lines. One letter size per page. Gate: the ingest proves every line of all 604 pages is accounted for and that every glyph exists in its page's font; `tool/screenshots/render_pages_test.dart` renders all 604 pages in both fonts at two widths with no overflow (also run in the Android workflow).
- **Phase 2, Listen Mode: built, awaiting the device gate.**
  - Reciter picker (tier + size), and per-reciter downloads by surah or all. Downloads are resumable (HTTP Range), each file is checked to be MP3 before it's kept, and ≈ sizes come from `reciter_surahs`. Files live at `audio/<slug>/SSSAAA.mp3`; the filesystem is the record.
  - Continuous playback from any ayah across surah boundaries, gapless, with the bismillah (the reciter's 1:1) before each surah except 1 and 9. It refuses to stream.
  - Sleep timer: minutes (playing time), end of surah, or after N surahs, with a 30 s fade. A quiet-room gain goes below the system volume.
  - Position is saved every 10 s, with a resume card.
  - An audio_service foreground service with lock-screen and notification controls; audio_session handles interruptions.
  - An OEM battery-exemption card.
  - Logic lives in `lib/features/listen/listen_session.dart` behind `AudioPort` (tests use a fake); `listen_audio.dart` is the just_audio / audio_service layer.
  - Not yet: desktop playback (tray, media keys: Phase 7), and downloads continuing while the app is closed.
  - **Gate (needs a person):** 8 hours of continuous playback, screen off, on a physical Android phone (Xiaomi or Samsung) with battery optimization ON.
- **Phase 3, Follow Mode: done.** Device gate (150 ms highlight timing) passed by the owner on 2026-09-30.
  - `FollowScreen` (from the reader's read-along button) draws the surah word by word from the `words` table and lights the recited word.
  - `FollowTracker` binary-searches the reciter's segments (loaded per surah) against the current file's position, streamed at about 60 ms. Timings are relative to each ayah file, so there is no drift to accumulate. Ayahs without word timing (Tier B reciters, dropped ayahs) light whole. Word positions are never interpolated.
  - Auto-scroll keeps the ayah in the upper part of the screen; a drag suspends it and shows «العودة إلى موضع التلاوة».
  - Tapping an ayah jumps there. The recitation follows into the next surah.
  - The wakelock is held only while the screen is open.
  - Repeat engine: `RepeatPlan` (ayah ×N, range ×M, then continue) is expressed as the queue itself, so there are no counters.
  - Follow and Listen share the one audio engine (`SessionMode`), with separate resume points.
  - Gate: highlight within 150 ms of the audio across a full 20-minute surah, including after seeking, pausing and backgrounding. Passed.
- **Phase 4, Study: in progress.**
  - Search (`SearchScreen`, from the index): Arabic is folded and undiacritized against `ayahs_fts`, anything else goes against the translation's `translation_fts`, with prefix matching on the last word and marked matches. «٢:٢٥٥»-style references jump.
  - Word study: tap a word in Page View, or the ayah's medallion. It shows the meaning, the root, and every occurrence (`words_root` index).
  - Ayah study: tap an ayah in Reading View, or long-press in Follow Mode. It shows the ayah, the Qara'i translation, and word-by-word meanings.
  - Gate: "search gate" in `tool/screenshots/render_pages_test.dart` checks correct results in under 100 ms on a cold DB (also run in CI).
  - Open: which tafsir(s) to offer. Quran Foundation's are all Sunni works, and Shia tafsirs need a sourced, licensed pack: the owner's decision. Also more translations as verified downloads.
  - Token search doesn't match a word with an attached clitic (ف، و، ب، ل), e.g. «ان» vs «فان». Known and deliberate for now.
  - Tafsir: deferred by the owner (2026-09-30).
- **Phase 5, Habit: built, awaiting the device gate.**
  - Khatmah (`lib/features/khatmah/`): plans by daily pages or by date range. Progress is the global ayah id read through, only ever moves forward, and is counted in pages (`KhatmahMath`, pure and tested). A date-range plan spreads the pages left over the days left. `khatmah_days` logs progress per day for the streak and for where today's wird started.
  - The reader takes `khatmah:`: turning one page forward, or «تمّت الصفحة», advances the plan to the end of that page.
  - Bookmarks (reader app bar, «العلامات» tab on the index).
  - Reminders (`reminders.dart`): a daily ayah (short ayahs, a 14-day window rescheduled at each launch) and per-plan wird reminders, via flutter_local_notifications, inexact (no exact-alarm permission). `syncReminders` never throws.
  - Backup (`lib/features/backup/`): all user tables as one JSON file, from the settings screen. Restore merges: newest `updated_at` wins per row, khatmah progress takes the max, only known columns are imported. No server (rule 2).
  - The user DB is at version 2; migrations live in `UserDb.migrations`.
  - **Gate (needs a phone):** reminders fire at the set time after a reboot; a backup exported on one device restores on another.



Eyeball screens with `flutter test tool/screenshots/render_pages_test.dart --dart-define=OUT=<dir>`; it writes PNGs from the real content DB.
