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
| `tanzil/translation.en.qarai.txt` | The bundled translation: Ali Quli Qara'i (English). **Check redistribution rights with the translator/publisher before a store release;** Tanzil's copy doesn't state a license |
| `qul/words-*.json` | Quran Foundation API (api.quran.com v4): word text, QCF v1 glyphs, word-by-word English, v1 page/line layout |
| `qul/words-root.json` | Word roots, converted from `vendor/qul-word-root.db.zip` (QUL morphology; committed because QUL downloads need a sign-in). **Check its license before release:** QUL's morphology derives from the Quranic Arabic Corpus, whose data has its own terms |
| `qcf-v1/p<n>.ttf` | The 604 per-page QCF v1 fonts from static.qurancdn.com. **Not bundled** (~95 MB): the ingest proves each page's glyphs exist in its font and records size + sha256 in `qcf_fonts`, and the app downloads them on request |
| `segments/<slug>.json` | Word timing, cleaned from `quran-com/recitation-<id>.json` |
| `calendar/events.json` | The calendar event pack (see below) |

Deliberate corrections to upstream data live in `overrides.json` (committed), each with a reason.

Always use Tanzil's **XML** export for the Quran text. The `.txt` export glues the bismillah onto ayah 1 of every surah, and the ingest rejects that.

When an upstream source changes, `ingest.py` refuses to build. Review the change, then re-pin with `--update-lock` and commit `sources.lock.json`.

## What the real data showed (2026-09-29)

- **Word timing (Tier A).** Quran Foundation segments exist for 12 recitations. They're clean for 98.7–99.5% of ayahs in murattal recordings and 89–91% in mujawwad ones, because mujawwad repeats phrases. Defective ayahs are dropped whole and never repaired: missing or out-of-range word numbers (often around muqatta'at letters), zero-length words, or overlaps. Each dropped ayah and the reason is listed in `sources/quran-com/<slug>.report.json`. A reciter is Tier A at 98% or more coverage, and ayahs without word timing fall back to whole-ayah highlight. Result: 10 reciters are Tier A. The two mujawwad recitations and Parhizgar are Tier B.
- **Timing only matches its own audio.** The segments are cut against specific files: `verses.quran.com/<Reciter>/mp3/` for 9 recitations, and everyayah folders (via a quranicaudio.com mirror) for Husary 64kbps, Husary Muallim and Tablawi. `reciters.json` plays exactly those files, and `fetch_sources.py` refuses a mismatch. **Still to verify:** that the everyayah.com copies are byte-identical to the mirror the timings were made against.
- **Word text vs Tanzil.** The API's word split agrees with Tanzil's ayah text on every ayah except four, all known Madani spelling conventions: 2:181, 8:6 and 13:37 write "بعد ما" as one word, and 37:130 writes "إل ياسين" as one word. Follow Mode should render from `words`, and the Reading View from `ayahs.text_uthmani`.
- **Word roots.** 50,298 words have a root. The other 27,131 are particles and pronouns, which have none. QUL numbers words the Quranic Arabic Corpus way, which splits "بعد ما" in two, so in 2:181, 8:6 and 13:37 every root after it was one word off. `fetch_sources.py` realigns those ayahs, and only ayahs whose roots run past the last word. 5:52 and 37:130 also contain a written break but were already aligned, and are left alone.
- **Sajdas.** Tanzil marks 4 obligatory and 11 recommended, and puts Fussilat's obligatory sajda at 41:38. Following Shia references (project owner's decision, 2026-09-29), `overrides.json` moves it to **41:37**. The ingest fails if Tanzil ever stops having a sajda at 41:38, so the correction can't silently go stale.

## Calendar pack

`calendar/events.json` has the shape exercised in `tests/fixtures/sources/calendar/events.json`. Each event has one or more dates with `variant` labels, `span_days` for periods such as Muharram 1–10, and a'maal with a `source_note` and optional ayah ranges. The ingest refuses a pack without `"reviewed": true` unless `--allow-unreviewed-calendar` is passed. **No real dataset is included.** It must be compiled from a scholarly source and reviewed by someone qualified (BLUEPRINT §9). That work can run in parallel with Phases 1–5.

## Tests

```bash
python3 -m unittest discover -s tool/ingest/tests
```

The fixtures are Al-Fatiha and Al-Ikhlas in the real Tanzil/QUL shapes, with synthetic page, juz and timing data. `--partial` skips the whole-mus'haf counts (114 surahs, 6236 ayahs, 604 pages, 30 juz, 240 quarters, 15 sajdas), which only fixtures need.
