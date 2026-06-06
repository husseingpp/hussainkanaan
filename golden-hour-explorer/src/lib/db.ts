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
import type { Comment, DailySpot, Favorite, Rating, Spot, SpotType } from "./types";

export const qk = {
  spots: ["spots", "approved"] as const,
  spot: (id: string) => ["spot", id] as const,
  comments: (id: string) => ["comments", id] as const,
  userRating: (spotId: string, userId: string) => ["rating", spotId, userId] as const,
  feed: ["daily-feed"] as const,
  favorites: (userId: string) => ["favorites", userId] as const,
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

/** Daily "moments" from the last 24h (the schema has no expires_at column). */
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
