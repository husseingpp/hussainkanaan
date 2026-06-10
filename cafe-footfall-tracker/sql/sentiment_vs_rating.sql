-- ============================================================
-- sentiment_vs_rating.sql
-- Does the text of a review agree with the stars attached to it?
--
-- Two result sets (split on the ":name" markers by analyse.py):
--   bucket_sentiment — avg sentiment per star bucket (1–5)
--   contradictions   — cafés whose review sentiment disagrees
--                      with their overall star rating
-- ============================================================

-- :name bucket_sentiment
WITH scored AS (
    -- Only reviews that sentiment.py has scored and that carry a
    -- star rating; the review's own 1–5 stars are the bucket.
    SELECT r.rating          AS star_bucket,
           r.sentiment_score,
           r.language
    FROM reviews r
    WHERE r.sentiment_score IS NOT NULL
      AND r.rating BETWEEN 1 AND 5
)
SELECT star_bucket,
       COUNT(*)                                   AS review_count,
       ROUND(AVG(sentiment_score)::NUMERIC, 3)    AS avg_sentiment,
       -- How multilingual is each bucket? Useful sanity check on
       -- whether Arabic reviews skew differently from English.
       COUNT(*) FILTER (WHERE language = 'ar')    AS arabic_reviews,
       COUNT(*) FILTER (WHERE language = 'en')    AS english_reviews
FROM scored
GROUP BY star_bucket
ORDER BY star_bucket;

-- :name contradictions
WITH cafe_sentiment AS (
    -- Collapse each café's scored reviews into one sentiment figure.
    SELECT r.cafe_id,
           ROUND(AVG(r.sentiment_score)::NUMERIC, 3) AS avg_sentiment,
           COUNT(*)                                  AS scored_reviews
    FROM reviews r
    WHERE r.sentiment_score IS NOT NULL
    GROUP BY r.cafe_id
)
-- A contradiction is a café whose stars and review tone point in
-- opposite directions:
--   * rated well (>= 4.0) but reviews read negative (< -0.05), or
--   * rated poorly (<= 2.5) but reviews read positive (> 0.30).
SELECT c.name,
       c.area,
       c.rating,
       cs.avg_sentiment,
       cs.scored_reviews,
       CASE
           WHEN c.rating >= 4.0 AND cs.avg_sentiment < -0.05
               THEN 'high stars, negative reviews'
           ELSE 'low stars, positive reviews'
       END AS contradiction_type
FROM cafes c
JOIN cafe_sentiment cs ON cs.cafe_id = c.cafe_id
WHERE (c.rating >= 4.0 AND cs.avg_sentiment < -0.05)
   OR (c.rating <= 2.5 AND cs.avg_sentiment > 0.30)
ORDER BY c.rating DESC, cs.avg_sentiment;
