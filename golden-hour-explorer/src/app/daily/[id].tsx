import { useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import Feather from "@expo/vector-icons/Feather";
import Ionicons from "@expo/vector-icons/Ionicons";
import { format } from "date-fns";
import { StateView } from "@/components/StateView";
import { useAuth } from "@/lib/auth";
import {
  useAddDailyComment,
  useDailyComments,
  useDailyFeed,
  useDailyLikes,
  useDailySpot,
  useToggleDailyLike,
} from "@/lib/db";
import { colors, radius, space } from "@/theme/theme";
import type { AuthorRef, DailyComment, DailySpotWithAuthor } from "@/lib/types";

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

function CommentRow({ item }: { item: DailyComment }) {
  return (
    <View style={styles.commentRow}>
      <Avatar author={item.author ?? null} size={30} />
      <View style={styles.commentBody}>
        <Text style={styles.commentName}>{item.author?.display_name || "Explorer"}</Text>
        <Text style={styles.commentText}>{item.body}</Text>
      </View>
    </View>
  );
}

export default function DailyPostScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user, canContribute } = useAuth();

  // Stories-style navigation: keep the active post in state and page through the
  // cached feed so swiping/tapping doesn't refetch-flash.
  const { data: feed } = useDailyFeed();
  const [activeId, setActiveId] = useState(id);
  const { data: enriched, isLoading } = useDailySpot(activeId);
  const likes = useDailyLikes(activeId, user?.id);
  const toggleLike = useToggleDailyLike();
  const { data: comments } = useDailyComments(activeId);
  const addComment = useAddDailyComment();
  const [text, setText] = useState("");

  const feedPost = (feed ?? []).find((p) => p.id === activeId) ?? null;
  const post: DailySpotWithAuthor | null = enriched ?? feedPost;
  const index = (feed ?? []).findIndex((p) => p.id === activeId);

  function go(delta: number) {
    const list = feed ?? [];
    const ni = index + delta;
    if (ni < 0 || ni >= list.length) return;
    setActiveId(list[ni].id);
    setText("");
  }

  function onSwipe(tx: number) {
    if (tx <= -40) go(1);
    else if (tx >= 40) go(-1);
  }
  // Horizontal swipe to page between posts (only activates on a clear sideways
  // drag, so vertical scroll and the tap zones still work).
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

  const liked = likes.data?.liked ?? false;
  const likeCount = likes.data?.count ?? 0;
  const name = post.author?.display_name || post.location_name || "Golden Hour";

  function onLike() {
    if (!user) return router.push("/sign-in");
    if (!canContribute) return;
    toggleLike.mutate({ dailySpotId: activeId, userId: user.id, liked });
  }

  function onSend() {
    if (!user) return router.push("/sign-in");
    if (!canContribute || !text.trim()) return;
    addComment.mutate(
      { dailySpotId: activeId, authorId: user.id, body: text.trim() },
      { onSuccess: () => setText("") },
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Story-style photo with overlays */}
        <GestureDetector gesture={swipe}>
        <View style={styles.photoBlock}>
          <Image source={{ uri: post.photo_url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
          <View style={styles.scrimTop} pointerEvents="none" />
          <View style={styles.scrimBottom} pointerEvents="none" />

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
              <Text style={styles.date}>{format(new Date(post.created_at), "MMM d, h:mm a").toUpperCase()}</Text>
            </View>
            <Pressable onPress={() => router.back()} hitSlop={10} style={styles.close}>
              <Feather name="x" size={22} color="#fff" />
            </Pressable>
          </View>

          <View style={styles.captionWrap} pointerEvents="box-none">
            {post.caption ? <Text style={styles.caption}>{post.caption}</Text> : null}
            {post.location_name ? (
              <View style={styles.placeRow}>
                <Feather name="map-pin" size={13} color={colors.accent} />
                <Text style={styles.place}>{post.location_name}</Text>
              </View>
            ) : null}
          </View>
        </View>
        </GestureDetector>

        {/* Like + comments */}
        <View style={styles.panel}>
          <View style={styles.actions}>
            <Pressable onPress={onLike} hitSlop={8} style={styles.likeBtn}>
              <Ionicons
                name={liked ? "heart" : "heart-outline"}
                size={26}
                color={liked ? "#e0556b" : colors.text}
              />
              <Text style={styles.likeCount}>{likeCount}</Text>
            </Pressable>
            <Text style={styles.commentsHint}>
              {comments?.length ? `${comments.length} comment${comments.length === 1 ? "" : "s"}` : "No comments yet"}
            </Text>
          </View>

          <FlatList
            data={comments ?? []}
            keyExtractor={(c) => c.id}
            renderItem={({ item }) => <CommentRow item={item} />}
            contentContainerStyle={styles.commentList}
            ListEmptyComponent={
              <Text style={styles.empty}>Be the first to say something.</Text>
            }
            keyboardShouldPersistTaps="handled"
          />

          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder={canContribute ? "Add a comment…" : "Sign in to comment"}
              placeholderTextColor={colors.textFaint}
              value={text}
              onChangeText={setText}
              editable={!!canContribute}
              onSubmitEditing={onSend}
              returnKeyType="send"
            />
            <Pressable onPress={onSend} style={styles.send} disabled={addComment.isPending}>
              {addComment.isPending ? (
                <ActivityIndicator color="#2a160c" size="small" />
              ) : (
                <Feather name="send" size={18} color="#2a160c" />
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  flex: { flex: 1 },
  photoBlock: { flex: 1, justifyContent: "space-between", backgroundColor: colors.bg2 },
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
  panel: {
    backgroundColor: colors.bg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    maxHeight: "42%",
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.md,
    paddingTop: space.sm,
  },
  likeBtn: { flexDirection: "row", alignItems: "center", gap: 6 },
  likeCount: { color: colors.text, fontSize: 14, fontWeight: "700" },
  commentsHint: { color: colors.textFaint, fontSize: 12.5, fontWeight: "600" },
  commentList: { padding: space.md, gap: space.md, flexGrow: 1 },
  commentRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  commentBody: { flex: 1, gap: 1 },
  commentName: { color: colors.text, fontSize: 13, fontWeight: "800" },
  commentText: { color: colors.textMuted, fontSize: 14, lineHeight: 19 },
  empty: { color: colors.textFaint, fontSize: 13, textAlign: "center", paddingVertical: space.md },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    padding: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  input: {
    flex: 1,
    minHeight: 42,
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: colors.text,
  },
  send: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
});
