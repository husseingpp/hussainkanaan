-- ============================================================
-- zone_ranking.sql
-- Rank Beirut areas by average rating, average sentiment and
-- café density, using RANK() window functions.
-- One row per area, lowest overall_rank = strongest zone.
-- ============================================================

-- :name zone_ranking
WITH cafe_stats AS (
    -- Per-area aggregates straight from the cafes table:
    -- how many cafés we found there and how well they are rated.
    SELECT area,
           COUNT(*)                            AS cafe_count,
           ROUND(AVG(rating)::NUMERIC, 2)      AS avg_rating,
           ROUND(AVG(total_reviews)::NUMERIC)  AS avg_reviews
    FROM cafes
    GROUP BY area
),
sentiment_stats AS (
    -- Per-area average sentiment over every scored review.
    -- Kept separate from cafe_stats so review volume cannot
    -- skew the café-level averages above.
    SELECT c.area,
           ROUND(AVG(r.sentiment_score)::NUMERIC, 3) AS avg_sentiment
    FROM cafes c
    JOIN reviews r ON r.cafe_id = c.cafe_id
    WHERE r.sentiment_score IS NOT NULL
    GROUP BY c.area
),
ranked AS (
    -- RANK() on each metric independently: rank 1 = best.
    -- Density here is raw café count per area (areas are of
    -- comparable size in central Beirut).
    SELECT cs.area,
           cs.cafe_count,
           cs.avg_rating,
           cs.avg_reviews,
           ss.avg_sentiment,
           RANK() OVER (ORDER BY cs.avg_rating   DESC NULLS LAST) AS rating_rank,
           RANK() OVER (ORDER BY ss.avg_sentiment DESC NULLS LAST) AS sentiment_rank,
           RANK() OVER (ORDER BY cs.cafe_count   DESC)             AS density_rank
    FROM cafe_stats cs
    LEFT JOIN sentiment_stats ss ON ss.area = cs.area
)
SELECT area,
       cafe_count,
       avg_rating,
       avg_reviews,
       avg_sentiment,
       rating_rank,
       sentiment_rank,
       density_rank,
       -- Simple composite: lower sum of ranks = better all-rounder.
       RANK() OVER (ORDER BY rating_rank + sentiment_rank + density_rank) AS overall_rank
FROM ranked
ORDER BY overall_rank, area;
