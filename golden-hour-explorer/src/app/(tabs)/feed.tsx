import { useMemo } from "react";
import { FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import Feather from "@expo/vector-icons/Feather";
import { useQuery } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import { Screen } from "@/components/Screen";
import { StateView } from "@/components/StateView";
import { useDailyFeed } from "@/lib/db";
import { supabase } from "@/lib/supabase";
import { colors, fonts, radius, space } from "@/theme/theme";
import type { DailySpot } from "@/lib/types";

type Author = { id: string; display_name: string | null; avatar_url: string | null };

/** A moment posted in the last few hours gets the "LIVE" badge. */
function isLive(createdAt: string): boolean {
  return Date.now() - new Date(createdAt).getTime() < 3 * 60 * 60 * 1000;
}

function Avatar({ author, size = 40 }: { author?: Author; size?: number }) {
  const initial = (author?.display_name ?? "S").trim().charAt(0).toUpperCase() || "S";
  if (author?.avatar_url) {
    return (
      <Image
        source={{ uri: author.avatar_url }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        contentFit="cover"
      />
    );
  }
  return (
    <View style={[styles.avatarFallback, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={styles.avatarInitial}>{initial}</Text>
    </View>
  );
}

function MomentCard({ item, author, width }: { item: DailySpot; author?: Author; width: number }) {
  const live = isLive(item.created_at);
  const name = author?.display_name || item.location_name || "Golden Hour";
  return (
    <View style={[styles.card, { width }]}>
      <View style={styles.cardHeader}>
        <Avatar author={author} />
        <View style={{ flex: 1 }}>
          <Text style={styles.author} numberOfLines={1}>
            {name}
          </Text>
          <Text style={styles.date}>
            {format(new Date(item.created_at), "MMM d, h:mm a").toUpperCase()}
          </Text>
        </View>
        {live ? (
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        ) : (
          <Text style={styles.ago}>
            {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
          </Text>
        )}
      </View>
      <Image
        source={{ uri: item.photo_url }}
        style={{ width, height: Math.round(width * 1.2) }}
        contentFit="cover"
        transition={200}
      />
      {item.caption ? <Text style={styles.caption}>{item.caption}</Text> : null}
      {item.location_name ? (
        <View style={styles.placeRow}>
          <Feather name="map-pin" size={12} color={colors.accent} />
          <Text style={styles.place}>{item.location_name}</Text>
        </View>
      ) : null}
    </View>
  );
}

export default function FeedScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { data, isLoading, error } = useDailyFeed();
  const fw = Math.min(width - 32, 520);

  // Resolve author names/avatars with one extra public read (users SELECT is open).
  const authorIds = useMemo(
    () => [...new Set((data ?? []).map((d) => d.author_id).filter((x): x is string => !!x))],
    [data],
  );
  const { data: authors } = useQuery({
    queryKey: ["daily-authors", authorIds.slice().sort().join(",")],
    enabled: authorIds.length > 0,
    queryFn: async () => {
      const { data: u, error: e } = await supabase
        .from("users")
        .select("id,display_name,avatar_url")
        .in("id", authorIds);
      if (e) throw e;
      return (u ?? []) as Author[];
    },
    staleTime: 300_000,
  });
  const authorMap = useMemo(
    () => new Map((authors ?? []).map((a) => [a.id, a])),
    [authors],
  );

  const camera = (
    <Pressable
      style={({ pressed }) => [styles.cameraBtn, pressed && styles.cameraPressed]}
      onPress={() => router.push("/add-daily")}
    >
      <Feather name="camera" size={20} color="#fff" />
    </Pressable>
  );

  return (
    <Screen
      title="Daily"
      accent="Feed"
      subtitle="Updates from the last 7 days"
      center
      right={camera}
      edges={[]}
    >
      {isLoading ? (
        <StateView loading />
      ) : error ? (
        <StateView message="Couldn't load the feed." />
      ) : !data || data.length === 0 ? (
        <StateView message="No moments yet. Be the first to share one!" />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(d) => d.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <MomentCard
              item={item}
              author={item.author_id ? authorMap.get(item.author_id) : undefined}
              width={fw}
            />
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { alignItems: "center", paddingTop: space.sm, paddingBottom: 130, gap: space.lg },
  card: {
    borderRadius: radius.lg,
    overflow: "hidden",
    backgroundColor: colors.bg2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  avatarFallback: { alignItems: "center", justifyContent: "center", backgroundColor: colors.accent },
  avatarInitial: { color: "#2a160c", fontWeight: "800", fontSize: 16 },
  author: { color: colors.text, fontSize: 14, fontWeight: "800", letterSpacing: -0.2 },
  date: { color: colors.textFaint, fontSize: 10.5, fontWeight: "700", letterSpacing: 0.6, marginTop: 1 },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: "rgba(240,146,47,0.16)",
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent },
  liveText: { color: colors.accent, fontSize: 10, fontWeight: "800", letterSpacing: 0.8 },
  ago: { color: colors.textFaint, fontSize: 11, fontWeight: "600" },
  caption: { color: colors.text, fontSize: 14, lineHeight: 20, paddingHorizontal: space.md, paddingTop: space.sm },
  placeRow: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: space.md, paddingTop: 6, paddingBottom: space.md },
  place: { color: colors.textMuted, fontSize: 12.5, fontWeight: "600" },
  cameraBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#f0922f",
    shadowOpacity: 0.6,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  cameraPressed: { opacity: 0.9, transform: [{ scale: 0.96 }] },
});
