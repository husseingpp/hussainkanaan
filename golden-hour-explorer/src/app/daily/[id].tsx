import { useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import Feather from "@expo/vector-icons/Feather";
import { format } from "date-fns";
import { StateView } from "@/components/StateView";
import { useDailyFeed, useDailySpot } from "@/lib/db";
import { colors, space } from "@/theme/theme";
import type { AuthorRef, DailySpotWithAuthor } from "@/lib/types";

function Avatar({ author, size = 36 }: { author: AuthorRef; size?: number }) {
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
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.avatarInitial, { fontSize: size * 0.42 }]}>{initial}</Text>
    </View>
  );
}

export default function DailyPostScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  // Stories-style navigation: keep the active post in state and page through the
  // cached feed so swiping/tapping doesn't refetch-flash.
  const { data: feed } = useDailyFeed();
  const [activeId, setActiveId] = useState(id);
  const { data: enriched, isLoading } = useDailySpot(activeId);

  const feedPost = (feed ?? []).find((p) => p.id === activeId) ?? null;
  const post: DailySpotWithAuthor | null = enriched ?? feedPost;
  const index = (feed ?? []).findIndex((p) => p.id === activeId);

  function go(delta: number) {
    const list = feed ?? [];
    const ni = index + delta;
    if (ni < 0 || ni >= list.length) return;
    setActiveId(list[ni].id);
  }

  function onSwipe(tx: number) {
    if (tx <= -40) go(1);
    else if (tx >= 40) go(-1);
  }
  // Horizontal swipe to page between posts (only activates on a clear sideways
  // drag, so the tap zones still work).
  const swipe = Gesture.Pan()
    .activeOffsetX([-20, 20])
    .failOffsetY([-15, 15])
    .onEnd((e) => {
      "worklet";
      runOnJS(onSwipe)(e.translationX);
    });

  if (!post) {
    return (
      <SafeAreaView style={styles.root} edges={["top"]}>
        {isLoading ? <StateView loading /> : <StateView message="This moment couldn't be loaded." />}
      </SafeAreaView>
    );
  }

  const name = post.author?.display_name || post.location_name || "Golden Hour";
  const hasCaption = !!post.caption || !!post.location_name;

  // A stripped-down, image-first viewer: the full uncropped photo on black, with
  // just a close control, paging between posts, and a subtle caption overlay.
  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <GestureDetector gesture={swipe}>
        <View style={styles.photoBlock}>
          <Image
            source={{ uri: post.photo_url }}
            style={StyleSheet.absoluteFill}
            contentFit="contain"
            transition={200}
          />
          <View style={styles.scrimTop} pointerEvents="none" />
          {hasCaption ? <View style={styles.scrimBottom} pointerEvents="none" /> : null}

          {/* Tap left/right to move between posts, like Instagram stories. */}
          {feed && feed.length > 1 ? (
            <>
              <Pressable style={styles.zoneLeft} onPress={() => go(-1)} />
              <Pressable style={styles.zoneRight} onPress={() => go(1)} />
              <View style={styles.progress} pointerEvents="none">
                {feed.map((p, i) => (
                  <View key={p.id} style={[styles.progressSeg, i === index && styles.progressSegOn]} />
                ))}
              </View>
            </>
          ) : null}

          <View style={styles.header} pointerEvents="box-none">
            <Avatar author={post.author ?? null} />
            <View style={styles.flex}>
              <Text style={styles.author} numberOfLines={1}>{name}</Text>
              <Text style={styles.date}>
                {format(new Date(post.created_at), "MMM d, h:mm a").toUpperCase()}
              </Text>
            </View>
            <Pressable onPress={() => router.back()} hitSlop={10} style={styles.close}>
              <Feather name="x" size={22} color="#fff" />
            </Pressable>
          </View>

          {hasCaption ? (
            <View style={styles.captionWrap} pointerEvents="none">
              {post.caption ? <Text style={styles.caption}>{post.caption}</Text> : null}
              {post.location_name ? (
                <View style={styles.placeRow}>
                  <Feather name="map-pin" size={13} color={colors.accent} />
                  <Text style={styles.place}>{post.location_name}</Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
      </GestureDetector>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  flex: { flex: 1 },
  photoBlock: { flex: 1, justifyContent: "space-between", backgroundColor: "#000" },
  scrimTop: { position: "absolute", top: 0, left: 0, right: 0, height: 110, backgroundColor: "rgba(0,0,0,0.45)" },
  scrimBottom: { position: "absolute", bottom: 0, left: 0, right: 0, height: 130, backgroundColor: "rgba(0,0,0,0.45)" },
  header: { flexDirection: "row", alignItems: "center", gap: 10, padding: space.md, paddingTop: 22 },
  zoneLeft: { position: "absolute", left: 0, top: 0, bottom: 0, width: "30%" },
  zoneRight: { position: "absolute", right: 0, top: 0, bottom: 0, width: "70%" },
  progress: { position: "absolute", top: 8, left: space.md, right: space.md, flexDirection: "row", gap: 4 },
  progressSeg: { flex: 1, height: 3, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.3)" },
  progressSegOn: { backgroundColor: "#fff" },
  avatar: { alignItems: "center", justifyContent: "center", backgroundColor: colors.accent },
  avatarInitial: { color: "#2a160c", fontWeight: "800" },
  author: { color: "#fff", fontSize: 15, fontWeight: "800", letterSpacing: -0.2 },
  date: { color: "rgba(255,255,255,0.7)", fontSize: 10.5, fontWeight: "700", letterSpacing: 0.6, marginTop: 1 },
  close: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  captionWrap: { padding: space.md, gap: 6 },
  caption: { color: "#fff", fontSize: 15, lineHeight: 21, fontWeight: "500" },
  placeRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  place: { color: "rgba(255,255,255,0.85)", fontSize: 12.5, fontWeight: "600" },
});
