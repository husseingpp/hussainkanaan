# Phase 0 — content ingest

Builds `assets/db/content.db` from pinned upstream sources in one command:

```bash
python3 tool/ingest/ingest.py
```

It uses the Python 3.11+ standard library only and never touches the network. The same sources always give a byte-identical DB. The build refuses anything inconsistent, including missing or extra ayahs, word-position gaps, overlapping timing segments, partial reciter coverage, and an unreviewed calendar pack.

## Sources

Download these by hand into `tool/ingest/sources/` (gitignored). **Read each asset's terms first** (BLUEPRINT §12). Recitations and many translations are not freely redistributable, and licensing is what gets these apps pulled at store review.

| Path | From | Required |
| --- | --- | --- |
| `tanzil/quran-data.xml` | Tanzil metadata: surahs, juz, hizb quarters, pages, sajdas | yes |
| `tanzil/quran-uthmani.{xml,txt}` | Tanzil Uthmani text | yes |
| `tanzil/quran-simple-clean.{xml,txt}` | Tanzil Simple Clean text (the basis of `search_text`) | yes |
| `tanzil/translation.<id>.{txt,xml}` | Exactly one Tanzil translation, e.g. `translation.en.sahih.txt` | no |
| `qul/words-uthmani.json` | QUL word-level Uthmani script | yes |
| `qul/words-qcf-v1.json` | QUL word-level QCF v1 glyph codes (Page View) | no |
| `qul/words-translation-en.json` | QUL word-by-word English translation | no |
| `qul/words-root.json` | QUL morphology: root per word | no |
| `segments/<reciter-slug>.json` | Timing segments for a reciter in `reciters.json` | no |
| `calendar/events.json` | The calendar event pack (see below) | no |

Word files are location-keyed JSON: `{"1:1:1": "…"}` or `{"1:1:1": {"text": "…"}}`. Segment files are `{"1:1": [[word_position, start_ms, end_ms], …]}`, with times relative to **that ayah's own audio file**. A whole-ayah span uses `word_position` 0. The parsers for all of these live in `sources.py`, so when an export's shape differs, adapt it there.

After placing or changing sources, review the diff and re-pin them:

```bash
python3 tool/ingest/ingest.py --update-lock   # writes sources.lock.json; commit it
```

## Things to verify against the real exports

The environment this was scaffolded in couldn't reach tanzil.net, qul.tarteel.ai or everyayah.com, so these points are **unverified**:

1. **QUL word-script shape.** Some QUL scripts include the ayah-number medallion as a final "word". `words-uthmani.json` must not include it (it would pass the contiguity check and be stored as a word). QCF may include it as position n+1, which the ingest handles.
2. **Which reciters have Tier A data.** This is the first-session question from BLUEPRINT §13. Segments must be timed against the **same per-ayah files** the app plays. Quran.com/QUL segment data for gapless *surah-level* recordings does not carry over to everyayah's per-ayah MP3s, even for the same reciter, because the edits differ. For each candidate reciter, record which audio files the segments were cut against.
3. **`reciters.json` folder names** on everyayah.com (and the bitrates) should be checked against the live index.

## Calendar pack

`calendar/events.json` has the shape exercised in `tests/fixtures/sources/calendar/events.json`. Each event has one or more dates with `variant` labels, `span_days` for periods such as Muharram 1–10, and a'maal with a `source_note` and optional ayah ranges. The ingest refuses a pack without `"reviewed": true` unless `--allow-unreviewed-calendar` is passed. **No real dataset is included.** It must be compiled from a scholarly source and reviewed by someone qualified (BLUEPRINT §9). That work can run in parallel with Phases 1–5.

## Tests

```bash
python3 -m unittest discover -s tool/ingest/tests
```

The fixtures are Al-Fatiha and Al-Ikhlas in the real Tanzil/QUL shapes, with synthetic page, juz and timing data. `--partial` skips the whole-mus'haf counts (114 surahs, 6236 ayahs, 604 pages, 30 juz, 240 quarters, 15 sajdas), which only fixtures need.
