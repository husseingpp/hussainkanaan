-- ============================================================
-- underperformers.sql
-- For each café, compute its rating delta vs the average rating
-- of its area (window function — no self-join needed) and flag
-- cafés sitting more than 0.5 stars below their neighbourhood.
-- ============================================================

-- :name underperformers
WITH cafe_sentiment AS (
    -- Average scored sentiment per café, so the report can show
    -- whether reviews back up the weak star rating.
    SELECT cafe_id,
           ROUND(AVG(sentiment_score)::NUMERIC, 3) AS avg_sentiment,
           COUNT(*)                                AS scored_reviews
    FROM reviews
    WHERE sentiment_score IS NOT NULL
    GROUP BY cafe_id
),
with_delta AS (
    -- AVG(...) OVER (PARTITION BY area) puts each café next to its
    -- own area's mean rating without collapsing the rows.
    SELECT c.cafe_id,
           c.name,
           c.area,
           c.rating,
           c.total_reviews,
           ROUND(AVG(c.rating) OVER (PARTITION BY c.area)::NUMERIC, 2) AS area_avg_rating,
           ROUND((c.rating - AVG(c.rating) OVER (PARTITION BY c.area))::NUMERIC, 2) AS rating_delta
    FROM cafes c
    WHERE c.rating IS NOT NULL
)
SELECT wd.name,
       wd.area,
       wd.rating,
       wd.area_avg_rating,
       wd.rating_delta,
       wd.total_reviews,
       cs.avg_sentiment,
       -- Flag: more than half a star below the area average.
       (wd.rating_delta < -0.5) AS is_underperformer
FROM with_delta wd
LEFT JOIN cafe_sentiment cs ON cs.cafe_id = wd.cafe_id
WHERE wd.rating_delta < -0.5
ORDER BY wd.rating_delta ASC;
