# Lebanese Café Footfall Tracker ☕

An end-to-end data pipeline that ingests Beirut café data from the Google Places API, stores it in PostgreSQL, analyses it with window-function SQL, scores multilingual (English + Arabic) review sentiment, and exports a static interactive Plotly report that GitHub Pages serves straight from this repo. All processing happens locally in Python — the published report is a single self-contained `docs/index.html` with no runtime backend.

**Live report:** https://husseingpp.github.io/hussainkanaan/cafe-footfall-tracker/

---

## Setup

```bash
# 1. Clone and enter the project
git clone https://github.com/husseingpp/hussainkanaan.git
cd hussainkanaan/cafe-footfall-tracker

# 2. Install dependencies (Python 3.11)
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# 3. Configure secrets
cp .env.example .env        # then fill in GOOGLE_PLACES_API_KEY + DB_URL

# 4. Create the database and schema
createdb cafe_tracker
psql -d cafe_tracker -f sql/schema.sql

# 5. Run the pipeline
python src/ingest.py        # Google Places API → data/raw/*.json
python src/load.py          # raw JSON → Postgres (dedup + language detection)
python src/sentiment.py     # VADER + Arabic lexicon → sentiment columns
python src/export.py        # SQL → Plotly charts → docs/index.html
```

### Offline dry-run (no API key needed)

```bash
python src/mock_data.py     # writes 5 fictional cafés to data/raw/
python src/load.py && python src/sentiment.py && python src/export.py
```

---

## Deploying to GitHub Pages

This project lives inside a portfolio monorepo whose Pages site is built by
`.github/workflows/deploy.yml` at the repo root. The workflow copies
`cafe-footfall-tracker/docs/` into the published output, so deployment is just:

1. Run `python src/export.py` to regenerate `docs/index.html`.
2. Commit and push to `main` — the Pages workflow does the rest.

The report appears at `https://husseingpp.github.io/hussainkanaan/cafe-footfall-tracker/`.
(For a standalone repo instead: push the `docs/` folder and enable
**Settings → Pages → Deploy from branch → `main` / `/docs`**. The bundled
`docs/.nojekyll` stops GitHub from running the HTML through Jekyll.)

---

## Schema

```
┌─────────────────────┐       ┌──────────────────────┐
│       cafes         │       │    opening_hours     │
├─────────────────────┤       ├──────────────────────┤
│ cafe_id    UUID  PK │──┐    │ hour_id    SERIAL PK │
│ name       TEXT     │  ├───<│ cafe_id    UUID   FK │
│ area       TEXT     │  │    │ day_of_week INT      │  0=Mon … 6=Sun
│ lat / lng  FLOAT    │  │    │ open_time  TIME      │
│ price_level INT     │  │    │ close_time TIME      │
│ rating     FLOAT    │  │    │ is_open_24h BOOL     │
│ total_reviews INT   │  │    └──────────────────────┘
│ place_id   TEXT  UQ │  │    ┌──────────────────────┐
│ fetched_at TSTZ     │  │    │       reviews        │
└─────────────────────┘  │    ├──────────────────────┤
                         │    │ review_id  SERIAL PK │
┌─────────────────────┐  └───<│ cafe_id    UUID   FK │
│ area_summary (MV)   │       │ rating     INT       │
├─────────────────────┤       │ text       TEXT      │
│ area / cafe_count   │       │ language   TEXT      │
│ avg_rating          │       │ time_posted TSTZ     │
│ avg_reviews         │       │ sentiment_score FLOAT│
│ avg_sentiment       │       │ sentiment_label TEXT │
│ peak_day            │       └──────────────────────┘
└─────────────────────┘
```

`area_summary` is a materialised view; `src/analyse.py` refreshes it on every run.

## Analysis queries (`sql/`)

| File | Technique | Question answered |
|---|---|---|
| `zone_ranking.sql` | CTEs + `RANK() OVER` | Which area wins on rating, sentiment and café density? |
| `peak_hours.sql` | `generate_series` unpivot + window rank | When are the most cafés open simultaneously? |
| `underperformers.sql` | `AVG() OVER (PARTITION BY area)` | Which cafés trail their neighbourhood by > 0.5★? |
| `sentiment_vs_rating.sql` | Aggregate buckets + sign mismatch | Where does review text contradict the star rating? |

---

## Key findings

> _Placeholder — fill in after running the pipeline against the live API._

- **Top zone:** …
- **Peak window:** …
- **Most surprising contradiction:** …
- **Underperformers worth a second look:** …

---

## CV-ready project description

> Built an end-to-end data engineering and analytics pipeline in Python that ingests
> 100+ Beirut cafés from the Google Places API into PostgreSQL, models opening hours
> and reviews in a normalised schema, and analyses footfall patterns with
> window-function SQL (CTEs, `RANK()`, partitioned averages). Implemented multilingual
> sentiment analysis — VADER for English plus a custom Arabic lexicon scorer — to
> surface cafés whose review tone contradicts their star ratings, and shipped the
> results as a responsive, dark-mode interactive Plotly report deployed on GitHub Pages
> with zero runtime infrastructure.
