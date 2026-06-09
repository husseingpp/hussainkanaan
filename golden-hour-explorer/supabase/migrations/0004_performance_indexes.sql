-- Additive performance indexes for the app's hot read paths. All use
-- `create index if not exists`, so this migration is safe to re-run and a no-op
-- where an equivalent index already exists.
--
-- Postgres auto-creates indexes only for primary keys and UNIQUE constraints, so
-- foreign-key columns used in filters/joins (comments.spot_id,
-- daily_spot_likes.daily_spot_id, daily_spot_comments.daily_spot_id) are
-- unindexed by default — those are the main wins here.
--
-- Intentionally omitted:
--  * favorites(user_id): the Saved tab filters by user_id, already covered by the
--    favorites primary/unique key whose leading column is user_id.
--  * ratings(spot_id,user_id): covered by the existing per-user unique constraint.

-- useApprovedSpots(): where status='approved' order by average_rating desc
create index if not exists spots_status_rating_idx
  on public.spots (status, average_rating desc);

-- usePendingSpots(): where status='pending' order by created_at asc (admin queue)
create index if not exists spots_status_created_idx
  on public.spots (status, created_at);

-- useSpotComments(): where spot_id = ? order by created_at desc
create index if not exists comments_spot_created_idx
  on public.comments (spot_id, created_at desc);

-- useDailyFeed(): where created_at >= now()-7d order by created_at desc
create index if not exists daily_spots_created_idx
  on public.daily_spots (created_at desc);

-- useDailyLikes()/useDailyFeedCounts(): count + membership by daily_spot_id
create index if not exists daily_spot_likes_spot_idx
  on public.daily_spot_likes (daily_spot_id);

-- useDailyComments()/useDailyFeedCounts(): where daily_spot_id = ? order by created_at
create index if not exists daily_spot_comments_spot_created_idx
  on public.daily_spot_comments (daily_spot_id, created_at);
