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
  DailyComment,
  DailySpot,
  DailySpotWithAuthor,
  Favorite,
  Rating,
  Spot,
  SpotType,
} from "./types";

export const qk = {
  spots: ["spots", "approved"] as const,
  pendingSpots: ["spots", "pending"] as const,
  spot: (id: string) => ["spot", id] as const,
  comments: (id: string) => ["comments", id] as const,
  userRating: (spotId: string, userId: string) => ["rating", spotId, userId] as const,
  feed: ["daily-feed"] as const,
  dailySpot: (id: string) => ["daily-spot", id] as const,
  dailyLikes: (id: string, userId: string) => ["daily-likes", id, userId] as const,
  dailyComments: (id: string) => ["daily-comments", id] as const,
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

/** Daily "moments" from the last 7 days (the schema has no expires_at column). */
export function useDailyFeed(): UseQueryResult<DailySpot[]> {
  return useQuery({
    queryKey: qk.feed,
    queryFn: async () => {
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
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

// ---------- daily feed: single post, likes & comments ----------

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

/** Like count for a daily post plus whether the current user has liked it. */
export function useDailyLikes(
  id: string,
  userId: string | undefined,
): UseQueryResult<{ count: number; liked: boolean }> {
  return useQuery({
    queryKey: qk.dailyLikes(id, userId ?? "anon"),
    queryFn: async () => {
      const { count, error } = await supabase
        .from("daily_spot_likes")
        .select("*", { count: "exact", head: true })
        .eq("daily_spot_id", id);
      if (error) throw error;
      let liked = false;
      if (userId) {
        const { data } = await supabase
          .from("daily_spot_likes")
          .select("user_id")
          .eq("daily_spot_id", id)
          .eq("user_id", userId)
          .maybeSingle();
        liked = !!data;
      }
      return { count: count ?? 0, liked };
    },
    enabled: !!id,
  });
}

export function useToggleDailyLike() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { dailySpotId: string; userId: string; liked: boolean }) => {
      if (vars.liked) {
        const { error } = await supabase
          .from("daily_spot_likes")
          .delete()
          .eq("daily_spot_id", vars.dailySpotId)
          .eq("user_id", vars.userId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("daily_spot_likes")
          .insert({ daily_spot_id: vars.dailySpotId, user_id: vars.userId });
        if (error) throw error;
      }
    },
    onSuccess: (_d, vars) =>
      qc.invalidateQueries({ queryKey: ["daily-likes", vars.dailySpotId] }),
  });
}

/** Comments on a daily post, oldest first, with each author's profile embedded. */
export function useDailyComments(id: string): UseQueryResult<DailyComment[]> {
  return useQuery({
    queryKey: qk.dailyComments(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_spot_comments")
        .select("id,daily_spot_id,author_id,body,created_at,author:users(display_name,avatar_url)")
        .eq("daily_spot_id", id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as DailyComment[];
    },
    enabled: !!id,
  });
}

export function useAddDailyComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { dailySpotId: string; authorId: string; body: string }) => {
      const { error } = await supabase
        .from("daily_spot_comments")
        .insert({ daily_spot_id: vars.dailySpotId, author_id: vars.authorId, body: vars.body });
      if (error) throw error;
    },
    onSuccess: (_d, vars) =>
      qc.invalidateQueries({ queryKey: qk.dailyComments(vars.dailySpotId) }),
  });
}

/** Like + comment counts for a set of daily posts, keyed by post id. */
export function useDailyFeedCounts(
  ids: string[],
): UseQueryResult<Record<string, { likes: number; comments: number }>> {
  return useQuery({
    queryKey: ["daily-feed-counts", [...ids].sort().join(",")],
    enabled: ids.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const [likesRes, commentsRes] = await Promise.all([
        supabase.from("daily_spot_likes").select("daily_spot_id").in("daily_spot_id", ids),
        supabase.from("daily_spot_comments").select("daily_spot_id").in("daily_spot_id", ids),
      ]);
      const counts: Record<string, { likes: number; comments: number }> = {};
      for (const id of ids) counts[id] = { likes: 0, comments: 0 };
      for (const r of likesRes.data ?? []) {
        const k = (r as { daily_spot_id: string }).daily_spot_id;
        if (counts[k]) counts[k].likes += 1;
      }
      for (const r of commentsRes.data ?? []) {
        const k = (r as { daily_spot_id: string }).daily_spot_id;
        if (counts[k]) counts[k].comments += 1;
      }
      return counts;
    },
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
