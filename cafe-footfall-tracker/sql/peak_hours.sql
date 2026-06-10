-- ============================================================
-- peak_hours.sql
-- Unpivot opening_hours into (day, hour) buckets to find when
-- the most cafés are open simultaneously.
--
-- Two result sets (split on the ":name" markers by analyse.py):
--   open_matrix — city-wide day_of_week × hour counts (heatmap)
--   area_peaks  — the single busiest day+hour slot per area
-- ============================================================

-- :name open_matrix
WITH hours AS (
    -- A bucket for every hour of the day, 0–23.
    SELECT generate_series(0, 23) AS hour_of_day
),
expanded AS (
    -- Unpivot: cross-join every opening_hours row with the 24 hour
    -- buckets and keep the buckets the café is actually open for.
    -- Three cases:
    --   * 24h cafés                  -> open every hour
    --   * normal rows (open < close) -> open in [open, close)
    --   * overnight rows (close <= open, e.g. 18:00–02:00)
    --     -> open from open_time to midnight; the after-midnight
    --        tail is attributed to the same weekday for simplicity.
    SELECT c.area,
           oh.day_of_week,
           h.hour_of_day,
           oh.cafe_id
    FROM opening_hours oh
    JOIN cafes c ON c.cafe_id = oh.cafe_id
    CROSS JOIN hours h
    WHERE oh.is_open_24h
       OR (
            oh.close_time IS NOT NULL
            AND oh.open_time IS NOT NULL
            AND CASE
                  WHEN oh.close_time > oh.open_time THEN
                       h.hour_of_day >= EXTRACT(HOUR FROM oh.open_time)
                       AND h.hour_of_day < EXTRACT(HOUR FROM oh.close_time)
                  ELSE -- overnight closing
                       h.hour_of_day >= EXTRACT(HOUR FROM oh.open_time)
                       OR h.hour_of_day < EXTRACT(HOUR FROM oh.close_time)
                END
          )
)
-- City-wide matrix: how many distinct cafés are open in each
-- (day, hour) bucket. Feeds the report heatmap.
SELECT day_of_week,
       hour_of_day,
       COUNT(DISTINCT cafe_id) AS open_cafes
FROM expanded
GROUP BY day_of_week, hour_of_day
ORDER BY day_of_week, hour_of_day;

-- :name area_peaks
WITH hours AS (
    SELECT generate_series(0, 23) AS hour_of_day
),
expanded AS (
    -- Same unpivot as open_matrix above, repeated because each named
    -- section must be a self-contained statement.
    SELECT c.area,
           oh.day_of_week,
           h.hour_of_day,
           oh.cafe_id
    FROM opening_hours oh
    JOIN cafes c ON c.cafe_id = oh.cafe_id
    CROSS JOIN hours h
    WHERE oh.is_open_24h
       OR (
            oh.close_time IS NOT NULL
            AND oh.open_time IS NOT NULL
            AND CASE
                  WHEN oh.close_time > oh.open_time THEN
                       h.hour_of_day >= EXTRACT(HOUR FROM oh.open_time)
                       AND h.hour_of_day < EXTRACT(HOUR FROM oh.close_time)
                  ELSE
                       h.hour_of_day >= EXTRACT(HOUR FROM oh.open_time)
                       OR h.hour_of_day < EXTRACT(HOUR FROM oh.close_time)
                END
          )
),
per_area AS (
    -- Count open cafés per area in each (day, hour) bucket, then
    -- rank buckets within each area: rank 1 = that area's peak slot.
    SELECT area,
           day_of_week,
           hour_of_day,
           COUNT(DISTINCT cafe_id) AS open_cafes,
           RANK() OVER (
               PARTITION BY area
               ORDER BY COUNT(DISTINCT cafe_id) DESC, day_of_week, hour_of_day
           ) AS slot_rank
    FROM expanded
    GROUP BY area, day_of_week, hour_of_day
)
SELECT area,
       (ARRAY['Monday','Tuesday','Wednesday','Thursday',
              'Friday','Saturday','Sunday'])[day_of_week + 1] AS peak_day,
       hour_of_day AS peak_hour,
       open_cafes
FROM per_area
WHERE slot_rank = 1
ORDER BY area;
