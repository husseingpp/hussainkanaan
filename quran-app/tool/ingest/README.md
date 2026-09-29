# Phase 0 — content ingest

Builds `assets/db/content.db` from pinned upstream sources in one command:

```bash
python3 tool/ingest/ingest.py
```

It uses the Python 3.11+ standard library only and never touches the network. The same sources always give a byte-identical DB. The build refuses anything inconsistent, including missing or extra ayahs, word-position gaps, overlapping or half-timed ayah timing, a bismillah glued into ayah 1, and an unreviewed calendar pack.

## Sources

```bash
python3 tool/ingest/fetch_sources.py   # downloads everything into sources/ (gitignored), ~2 min
python3 tool/ingest/ingest.py          # verifies against sources.lock.json, then builds
```

| Path | From |
| --- | --- |
| `tanzil/quran-data.xml` | Tanzil metadata: surahs, juz, hizb quarters, pages, sajdas |
| `tanzil/quran-uthmani.xml` | Tanzil Uthmani text (CC BY 3.0: the app must credit Tanzil) |
| `tanzil/quran-simple-clean.xml` | Tanzil Simple Clean text, the basis of `search_text` |
| `tanzil/translation.<id>.{txt,xml}` | Optional: exactly one bundled translation (not chosen yet) |
| `qul/words-*.json` | Quran Foundation API (api.quran.com v4): word text, QCF v1 glyphs, word-by-word English, v1 page/line layout |
| `qul/words-root.json` | Optional: word roots. Not in the public API; QUL's morphology download needs a sign-in |
| `segments/<slug>.json` | Word timing, cleaned from `quran-com/recitation-<id>.json` |
| `calendar/events.json` | The calendar event pack (see below) |

Always use Tanzil's **XML** export. The `.txt` export glues the bismillah onto ayah 1 of every surah, and the ingest rejects that.

When an upstream source changes, `ingest.py` refuses to build. Review the change, then re-pin with `--update-lock` and commit `sources.lock.json`.

## What the real data showed (2026-09-29)

- **Word timing (Tier A).** Quran Foundation segments exist for 12 recitations. They're clean for 98.7–99.5% of ayahs in murattal recordings and 89–91% in mujawwad ones, because mujawwad repeats phrases. Defective ayahs are dropped whole and never repaired: missing or out-of-range word numbers (often around muqatta'at letters), zero-length words, or overlaps. Each dropped ayah and the reason is listed in `sources/quran-com/<slug>.report.json`. A reciter is Tier A at 98% or more coverage, and ayahs without word timing fall back to whole-ayah highlight. Result: 10 reciters are Tier A. The two mujawwad recitations and Parhizgar are Tier B.
- **Timing only matches its own audio.** The segments are cut against specific files: `verses.quran.com/<Reciter>/mp3/` for 9 recitations, and everyayah folders (via a quranicaudio.com mirror) for Husary 64kbps, Husary Muallim and Tablawi. `reciters.json` plays exactly those files, and `fetch_sources.py` refuses a mismatch. **Still to verify:** that the everyayah.com copies are byte-identical to the mirror the timings were made against.
- **Word text vs Tanzil.** The API's word split agrees with Tanzil's ayah text on every ayah except four, all known Madani spelling conventions: 2:181, 8:6 and 13:37 write "بعد ما" as one word, and 37:130 writes "إل ياسين" as one word. Follow Mode should render from `words`, and the Reading View from `ayahs.text_uthmani`.
- **Sajdas: needs religious review.** Tanzil marks 4 obligatory (32:15, 41:38, 53:62, 96:19) and 11 recommended. Four obligatory sajdas matches Jafari fiqh, but Shia references commonly place the Fussilat sajda at **41:37**, where Tanzil has 41:38. Confirm it against the marja' the app follows before Phase 1 shows sajda markers.

## Calendar pack

`calendar/events.json` has the shape exercised in `tests/fixtures/sources/calendar/events.json`. Each event has one or more dates with `variant` labels, `span_days` for periods such as Muharram 1–10, and a'maal with a `source_note` and optional ayah ranges. The ingest refuses a pack without `"reviewed": true` unless `--allow-unreviewed-calendar` is passed. **No real dataset is included.** It must be compiled from a scholarly source and reviewed by someone qualified (BLUEPRINT §9). That work can run in parallel with Phases 1–5.

## Tests

```bash
python3 -m unittest discover -s tool/ingest/tests
```

The fixtures are Al-Fatiha and Al-Ikhlas in the real Tanzil/QUL shapes, with synthetic page, juz and timing data. `--partial` skips the whole-mus'haf counts (114 surahs, 6236 ayahs, 604 pages, 30 juz, 240 quarters, 15 sajdas), which only fixtures need.
