# Supabase schema (the app adapts to this existing "v1" schema)

The app targets the existing **`sunspot`** Supabase project
(`enaiwztlekfvcmsblltd`). The schema was **not** recreated — the app was written
to match it. Only one *additive* change was made: a `spot-images` Storage bucket
(see `migrations/0001_spot_images_bucket.sql`).

## Tables the app uses

| Table | Notable columns | App usage |
|---|---|---|
| `users` | `id`=auth uid, `email`, `display_name`, `avatar_url` | auto-filled by the `handle_new_user` trigger on signup |
| `profiles` | `user_id`, `is_admin` | profile metadata |
| `admins` | `id` | source of truth for `is_admin()` |
| `spots` | `name`, `description`, **`latitude`/`longitude`** (floats), `type` (sunrise/sunset/both), `status` (pending/approved/rejected), `best_months` (`text[]`), `photo_urls`, `author_id`, `average_rating`, `ratings_count` | map/explore/detail; new spots insert as `pending` |
| `ratings` | `spot_id`, `user_id`, `score` (1–5) | per-user rating; trigger recomputes spot aggregates |
| `comments` | `spot_id`, `author_id`, **`body`**, `image_urls` | reviews |
| `favorites` | `user_id`, `spot_id` | bookmarks (Saved tab) |
| `daily_spots` | `photo_url`, `caption`, `latitude`, `longitude`, `location_name` (no `expires_at`) | feed; filtered to last 24h client-side |
| `spot_photos`, `comment_likes`, `daily_spot_likes`, `user_preferences` | — | available; not all surfaced in the UI yet |

## Row Level Security (unchanged)

- **Reads:** `SELECT` is `USING (true)` on `spots`, `comments`, `ratings`,
  `daily_spots`, `profiles`, `users`, `spot_photos`, `*_likes`. The anon /
  publishable key can read them with no session. `favorites` and
  `user_preferences` are owner-only.
- **Writes:** every insert/update requires `author_id|user_id = auth.uid()`
  **and** `is_email_verified()`. Anonymous users (no email) cannot write — hence
  the "guest = read-only, contribute = confirmed email" model in the app.
- **Admin moderation:** `spots` additionally has
  `spots_owner_or_admin_update` (`USING author_id = auth.uid() OR is_admin()`) and
  `spots_admin_delete` (`USING is_admin()`), so an admin can approve/reject any
  spot and edit its `photo_urls`. `is_admin()` is `SECURITY DEFINER` and
  `EXECUTE`-granted to anon/authenticated, so the client detects admin status with
  `supabase.rpc('is_admin')` (same source of truth as RLS). Admins are rows in
  `admins(id=auth.uid, email, role)` — see `migrations/0002_bootstrap_admin.sql`.

## Helpers & triggers (unchanged)

- `is_admin()` — checks the `admins` table.
- `is_email_verified()` — `auth.users.email_confirmed_at IS NOT NULL`.
- `handle_new_user()` — mirrors new `auth.users` rows into `public.users`.
- `update_spot_rating_stats()` — `ratings_aggregate` trigger recomputes
  `spots.average_rating` / `spots.ratings_count` on rating insert/update/delete.

## Seed data

12 well-known approved spots (incl. several in Lebanon — Raouché, Harissa,
Batroun, the Cedars) were inserted so the map, Explore list and the portfolio's
live widget look alive out of the box.
