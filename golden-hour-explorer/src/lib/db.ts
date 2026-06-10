/**
 * Typed TanStack Query hooks over the existing Supabase schema.
 * Reads are offline-first: try the network, fall back to the SQLite cache, and
 * write fresh results back to the cache. Writes target the v1 tables directly
 * (ratings/comments/favorites/spots/daily_spots) and rely on the DB trigger to
 * recompute spot rating aggregates.
 */
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import { supabase } from "./supabase";
import { cacheSpots, dedupById, getCachedSpots } from "./cache";
import type {
  Comment,
  DailySpot,
  DailySpotWithAuthor,
  Favorite,
  Rating,
  Spot,
  SpotType,
  SpotWithDistance,
} from "./types";

export const qk = {
  spots: ["spots", "approved"] as const,
  pendingSpots: ["spots", "pending"] as const,
  spot: (id: string) => ["spot", id] as const,
  comments: (id: string) => ["comments", id] as const,
  userRating: (spotId: string, userId: string) => ["rating", spotId, userId] as const,
  feed: ["daily-feed"] as const,
  dailySpot: (id: string) => ["daily-spot", id] as const,
  favorites: (userId: string) => ["favorites", userId] as const,
  nearbySpots: (lat: number, lng: number) =>
    ["spots", "nearby", lat.toFixed(3), lng.toFixed(3)] as const,
};

const SPOT_COLS =
  "id,name,description,latitude,longitude,type,status,best_months,photo_urls,author_id,average_rating,ratings_count,created_at,updated_at";

async function fetchApprovedSpots(): Promise<Spot[]> {
  try {
    const { data, error } = await supabase
      .from("spots")
      .select(SPOT_COLS)
      .eq("status", "approved")
      .order("average_rating", { ascending: false });
    if (error) throw error;
    const spots = dedupById((data ?? []) as Spot[]);
    void cacheSpots(spots);
    return spots;
  } catch (e) {
    const cached = await getCachedSpots();
    if (cached.length) return cached;
    throw e;
  }
}

export function useApprovedSpots(): UseQueryResult<Spot[]> {
  return useQuery({ queryKey: qk.spots, queryFn: fetchApprovedSpots, staleTime: 60_000 });
}

/**
 * Approved spots ordered by distance from `coords`, computed server-side by the
 * `nearby_spots` PostGIS RPC (GiST KNN). Each row carries `distanceKm`. Only runs
 * when coords are known and `enabled` (e.g. the "Near me" sort is active).
 */
export function useNearbySpots(
  coords: { latitude: number; longitude: number } | null,
  opts?: { enabled?: boolean },
): UseQueryResult<SpotWithDistance[]> {
  return useQuery({
    queryKey: coords ? qk.nearbySpots(coords.latitude, coords.longitude) : ["spots", "nearby", "none"],
    enabled: !!coords && (opts?.enabled ?? true),
    staleTime: 60_000,
    queryFn: async (): Promise<SpotWithDistance[]> => {
      const { data, error } = await supabase.rpc("nearby_spots", {
        lat: coords!.latitude,
        lng: coords!.longitude,
      });
      if (error) throw error;
      return ((data ?? []) as (Spot & { distance_m: number })[]).map((r) => ({
        ...r,
        distanceKm: r.distance_m / 1000,
      }));
    },
  });
}

/** Spots awaiting moderation — for the admin queue. RLS SELECT is public, but
 * only admins are ever routed to the screen that calls this. Oldest first. */
export function usePendingSpots(): UseQueryResult<Spot[]> {
  return useQuery({
    queryKey: qk.pendingSpots,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("spots")
        .select(SPOT_COLS)
        .eq("status", "pending")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return dedupById((data ?? []) as Spot[]);
    },
    staleTime: 30_000,
  });
}

export function useSpot(id: string): UseQueryResult<Spot> {
  return useQuery({
    queryKey: qk.spot(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("spots")
        .select(SPOT_COLS)
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as Spot;
    },
    enabled: !!id,
  });
}

export function useSpotComments(spotId: string): UseQueryResult<Comment[]> {
  return useQuery({
    queryKey: qk.comments(spotId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comments")
        .select("id,spot_id,author_id,body,image_urls,created_at")
        .eq("spot_id", spotId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Comment[];
    },
    enabled: !!spotId,
  });
}

export function useUserRating(
  spotId: string,
  userId: string | undefined,
): UseQueryResult<Rating | null> {
  return useQuery({
    queryKey: qk.userRating(spotId, userId ?? "anon"),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ratings")
        .select("id,spot_id,user_id,score,created_at,updated_at")
        .eq("spot_id", spotId)
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return (data as Rating | null) ?? null;
    },
    enabled: !!spotId && !!userId,
  });
}

/** Daily "moments" from the last 24 hours — posts expire from the feed a day
 * after they're shared (the schema has no expires_at column, so we filter by
 * created_at on read). */
export function useDailyFeed(): UseQueryResult<DailySpot[]> {
  return useQuery({
    queryKey: qk.feed,
    queryFn: async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("daily_spots")
        .select("id,author_id,photo_url,caption,latitude,longitude,location_name,created_at,updated_at")
        .gte("created_at", since)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as DailySpot[];
    },
    staleTime: 30_000,
  });
}

export function useFavoriteSpots(userId: string | undefined): UseQueryResult<Spot[]> {
  return useQuery({
    queryKey: qk.favorites(userId ?? "anon"),
    queryFn: async () => {
      const { data: favs, error } = await supabase
        .from("favorites")
        .select("spot_id")
        .eq("user_id", userId!);
      if (error) throw error;
      const ids = (favs ?? []).map((f: Pick<Favorite, "spot_id">) => f.spot_id);
      if (ids.length === 0) return [];
      const { data: spots, error: sErr } = await supabase
        .from("spots")
        .select(SPOT_COLS)
        .in("id", ids);
      if (sErr) throw sErr;
      return dedupById((spots ?? []) as Spot[]);
    },
    enabled: !!userId,
  });
}

// ---------- mutations ----------

export function useRateSpot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { spotId: string; userId: string; score: number }) => {
      const { data: existing } = await supabase
        .from("ratings")
        .select("id")
        .eq("spot_id", vars.spotId)
        .eq("user_id", vars.userId)
        .maybeSingle();
      if (existing?.id) {
        const { error } = await supabase
          .from("ratings")
          .update({ score: vars.score })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("ratings")
          .insert({ spot_id: vars.spotId, user_id: vars.userId, score: vars.score });
        if (error) throw error;
      }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: qk.spot(vars.spotId) });
      qc.invalidateQueries({ queryKey: qk.spots });
      qc.invalidateQueries({ queryKey: qk.userRating(vars.spotId, vars.userId) });
    },
  });
}

export function useAddComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { spotId: string; authorId: string; body: string }) => {
      const { error } = await supabase
        .from("comments")
        .insert({ spot_id: vars.spotId, author_id: vars.authorId, body: vars.body });
      if (error) throw error;
    },
    onSuccess: (_d, vars) =>
      qc.invalidateQueries({ queryKey: qk.comments(vars.spotId) }),
  });
}

export function useToggleFavorite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { spotId: string; userId: string }) => {
      const { data: existing } = await supabase
        .from("favorites")
        .select("id")
        .eq("spot_id", vars.spotId)
        .eq("user_id", vars.userId)
        .maybeSingle();
      if (existing?.id) {
        const { error } = await supabase.from("favorites").delete().eq("id", existing.id);
        if (error) throw error;
        return false;
      }
      const { error } = await supabase
        .from("favorites")
        .insert({ spot_id: vars.spotId, user_id: vars.userId });
      if (error) throw error;
      return true;
    },
    onSuccess: (_d, vars) =>
      qc.invalidateQueries({ queryKey: qk.favorites(vars.userId) }),
  });
}

export type NewSpot = {
  name: string;
  description: string;
  latitude: number;
  longitude: number;
  type: SpotType;
  best_months: string[];
  photo_urls: string[];
  authorId: string;
};

export function useCreateSpot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: NewSpot) => {
      const { data, error } = await supabase
        .from("spots")
        .insert({
          name: vars.name,
          description: vars.description,
          latitude: vars.latitude,
          longitude: vars.longitude,
          type: vars.type,
          best_months: vars.best_months,
          photo_urls: vars.photo_urls,
          author_id: vars.authorId,
          // status defaults to 'pending' — awaits moderation before it goes public.
        })
        .select("id")
        .single();
      if (error) throw error;
      return data as { id: string };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.spots }),
  });
}

// ---------- admin mutations (RLS: spots_owner_or_admin_update / _admin_delete) ----------

/** Approve or reject a pending spot. Admin-only at the DB level via is_admin(). */
export function useModerateSpot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string; status: "approved" | "rejected" }) => {
      const { error } = await supabase
        .from("spots")
        .update({ status: vars.status })
        .eq("id", vars.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.pendingSpots });
      qc.invalidateQueries({ queryKey: qk.spots });
    },
  });
}

/** Share a daily "moment" — a photo with an optional caption/location. */
export function useCreateDailySpot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      authorId: string;
      photoUrl: string;
      caption: string;
      latitude: number | null;
      longitude: number | null;
      locationName: string;
    }) => {
      const { error } = await supabase.from("daily_spots").insert({
        author_id: vars.authorId,
        photo_url: vars.photoUrl,
        caption: vars.caption || null,
        latitude: vars.latitude,
        longitude: vars.longitude,
        location_name: vars.locationName || null,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.feed }),
  });
}

// ---------- daily feed: single post ----------

/** One daily moment with its author's public profile embedded. */
export function useDailySpot(id: string): UseQueryResult<DailySpotWithAuthor> {
  return useQuery({
    queryKey: qk.dailySpot(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_spots")
        .select(
          "id,author_id,photo_url,caption,latitude,longitude,location_name,created_at,updated_at,author:users(display_name,avatar_url)",
        )
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as unknown as DailySpotWithAuthor;
    },
    enabled: !!id,
  });
}

/** Replace a spot's whole photo_urls array (admin photo add/remove). */
export function useUpdateSpotPhotos() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string; photo_urls: string[] }) => {
      const { error } = await supabase
        .from("spots")
        .update({ photo_urls: vars.photo_urls })
        .eq("id", vars.id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: qk.spot(vars.id) });
      qc.invalidateQueries({ queryKey: qk.spots });
    },
  });
}
