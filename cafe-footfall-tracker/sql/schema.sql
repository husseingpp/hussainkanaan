-- ============================================================
-- Lebanese Café Footfall Tracker — database schema
-- Target: PostgreSQL 13+ (gen_random_uuid() is built in)
-- Apply with:  psql -d cafe_tracker -f sql/schema.sql
-- The script is idempotent: safe to re-run.
-- ============================================================

-- ------------------------------------------------------------
-- cafes: one row per unique Google place_id
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cafes (
    cafe_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          TEXT NOT NULL,
    area          TEXT NOT NULL,            -- e.g. 'Hamra', 'Achrafieh', 'Gemmayzeh'
    lat           FLOAT,
    lng           FLOAT,
    price_level   INT CHECK (price_level BETWEEN 1 AND 4),  -- Google's 1–4 scale
    rating        FLOAT CHECK (rating BETWEEN 0 AND 5),
    total_reviews INT,
    place_id      TEXT UNIQUE NOT NULL,     -- Google's place_id, used for dedup
    fetched_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cafes_area ON cafes (area);

-- ------------------------------------------------------------
-- opening_hours: one row per café per day-of-week period
-- day_of_week uses ISO-style 0=Monday … 6=Sunday
-- (Google's Places API uses 0=Sunday; src/load.py converts.)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS opening_hours (
    hour_id      SERIAL PRIMARY KEY,
    cafe_id      UUID NOT NULL REFERENCES cafes (cafe_id) ON DELETE CASCADE,
    day_of_week  INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    open_time    TIME,
    close_time   TIME,                      -- may be earlier than open_time for overnight closing
    is_open_24h  BOOL NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_opening_hours_cafe ON opening_hours (cafe_id);

-- ------------------------------------------------------------
-- reviews: individual Google reviews with sentiment columns
-- sentiment_score / sentiment_label start NULL and are filled
-- in by src/sentiment.py.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reviews (
    review_id       SERIAL PRIMARY KEY,
    cafe_id         UUID NOT NULL REFERENCES cafes (cafe_id) ON DELETE CASCADE,
    rating          INT CHECK (rating BETWEEN 1 AND 5),
    text            TEXT,
    language        TEXT,                   -- ISO 639-1 code from langdetect ('en', 'ar', …)
    time_posted     TIMESTAMPTZ,
    sentiment_score FLOAT,                  -- VADER compound, or Arabic lexicon score (-1 … 1)
    sentiment_label TEXT CHECK (sentiment_label IN ('positive', 'neutral', 'negative'))
);

CREATE INDEX IF NOT EXISTS idx_reviews_cafe ON reviews (cafe_id);

-- ------------------------------------------------------------
-- area_summary: materialised rollup per Beirut area.
-- Refresh after loading/scoring with:
--   REFRESH MATERIALIZED VIEW area_summary;
-- (src/analyse.py does this automatically.)
-- ------------------------------------------------------------
DROP MATERIALIZED VIEW IF EXISTS area_summary;

CREATE MATERIALIZED VIEW area_summary AS
WITH sentiment_per_area AS (
    -- Average review sentiment for every area (NULLs excluded, i.e.
    -- only reviews that sentiment.py has scored).
    SELECT c.area,
           AVG(r.sentiment_score) AS avg_sentiment
    FROM cafes c
    JOIN reviews r ON r.cafe_id = c.cafe_id
    WHERE r.sentiment_score IS NOT NULL
    GROUP BY c.area
),
open_per_day AS (
    -- How many cafés in each area are open on each day of the week.
    -- 24h cafés count for every day they have a row.
    SELECT c.area,
           oh.day_of_week,
           COUNT(DISTINCT oh.cafe_id) AS cafes_open
    FROM cafes c
    JOIN opening_hours oh ON oh.cafe_id = c.cafe_id
    GROUP BY c.area, oh.day_of_week
),
peak_day_per_area AS (
    -- Pick the single busiest day per area (most cafés open).
    SELECT DISTINCT ON (area)
           area,
           (ARRAY['Monday','Tuesday','Wednesday','Thursday',
                  'Friday','Saturday','Sunday'])[day_of_week + 1] AS peak_day
    FROM open_per_day
    ORDER BY area, cafes_open DESC, day_of_week
)
SELECT c.area,
       COUNT(*)::INT                       AS cafe_count,
       ROUND(AVG(c.rating)::NUMERIC, 2)::FLOAT        AS avg_rating,
       ROUND(AVG(c.total_reviews)::NUMERIC, 1)::FLOAT AS avg_reviews,
       ROUND(s.avg_sentiment::NUMERIC, 3)::FLOAT      AS avg_sentiment,
       p.peak_day
FROM cafes c
LEFT JOIN sentiment_per_area s ON s.area = c.area
LEFT JOIN peak_day_per_area  p ON p.area = c.area
GROUP BY c.area, s.avg_sentiment, p.peak_day;

-- A unique index lets us use REFRESH MATERIALIZED VIEW CONCURRENTLY later.
CREATE UNIQUE INDEX IF NOT EXISTS idx_area_summary_area ON area_summary (area);
