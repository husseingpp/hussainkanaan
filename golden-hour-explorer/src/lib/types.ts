/**
 * Row types mirroring the EXISTING ("v1") Supabase schema this app is adapted
 * to. Notable points vs. a greenfield design:
 *  - `spots` stores plain `latitude`/`longitude` (no PostGIS) — distances are
 *    computed client-side (see geo.ts).
 *  - Ratings live in their own `ratings` table; a DB trigger recomputes
 *    `spots.average_rating` / `spots.ratings_count`.
 *  - `comments.body` (not `text`); bookmarks are `favorites`; stories are
 *    `daily_spots` (filtered to the last 24h client-side — no `expires_at`).
 */
export type SpotType = "sunrise" | "sunset" | "both";
export type SpotStatus = "pending" | "approved" | "rejected";

export interface Spot {
  id: string;
  name: string;
  description: string | null;
  latitude: number;
  longitude: number;
  type: SpotType;
  status: SpotStatus;
  best_months: string[] | null;
  photo_urls: string[] | null;
  author_id: string | null;
  average_rating: number | null;
  ratings_count: number;
  created_at: string;
  updated_at: string;
}

export interface Comment {
  id: string;
  spot_id: string;
  author_id: string | null;
  body: string;
  image_urls: string[] | null;
  created_at: string;
}

export interface Rating {
  id: string;
  spot_id: string;
  user_id: string;
  score: number;
  created_at: string;
  updated_at: string;
}

export interface Favorite {
  id: string;
  user_id: string;
  spot_id: string;
  created_at: string;
}

export interface DailySpot {
  id: string;
  author_id: string | null;
  photo_url: string;
  caption: string | null;
  latitude: number | null;
  longitude: number | null;
  location_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
}

/** A spot decorated with a client-computed distance (km) from the viewer. */
export type SpotWithDistance = Spot & { distanceKm: number | null };
