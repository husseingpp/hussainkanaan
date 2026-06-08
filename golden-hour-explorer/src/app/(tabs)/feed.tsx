import { Dimensions, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { formatDistanceToNow } from "date-fns";
import { Screen } from "@/components/Screen";
import { StateView } from "@/components/StateView";
import { Glass } from "@/components/Glass";
import { useDailyFeed } from "@/lib/db";
import { colors, space } from "@/theme/theme";
import type { DailySpot } from "@/lib/types";

const { width } = Dimensions.get("window");

function Moment({ item, captionBottom }: { item: DailySpot; captionBottom: number }) {
  return (
    <View style={[styles.page, { width }]}>
      <Image
        source={{ uri: item.photo_url }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        transition={200}
      />
      <View style={styles.scrim} />
      <Glass style={[styles.caption, { marginBottom: captionBottom }]}>
        {item.location_name ? <Text style={styles.place}>{item.location_name}</Text> : null}
        {item.caption ? <Text style={styles.text}>{item.caption}</Text> : null}
        <Text style={styles.time}>
          {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
        </Text>
      </Glass>
    </View>
  );
}

export default function FeedScreen() {
  const router = useRouter();
  const { data, isLoading, error } = useDailyFeed();
  const insets = useSafeAreaInsets();
  // Clear the floating dock (its top edge sits ~max(insets.bottom,12)+68 up).
  const fabBottom = insets.bottom + 88;
  const captionBottom = fabBottom + 56;

  let content: React.ReactNode;
  if (isLoading) {
    content = (
      <Screen title="Today's skies">
        <StateView loading />
      </Screen>
    );
  } else if (error) {
    content = (
      <Screen title="Today's skies">
        <StateView message="Couldn't load the feed." />
      </Screen>
    );
  } else if (!data || data.length === 0) {
    content = (
      <Screen title="Today's skies">
        <StateView message="No moments in the last 24 hours. Be the first to share one!" />
      </Screen>
    );
  } else {
    content = (
      <FlatList
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        data={data}
        keyExtractor={(d) => d.id}
        renderItem={({ item }) => <Moment item={item} captionBottom={captionBottom} />}
      />
    );
  }

  return (
    <View style={styles.root}>
      {content}
      <Pressable
        style={({ pressed }) => [styles.fab, { bottom: fabBottom }, pressed && styles.fabPressed]}
        onPress={() => router.push("/add-daily")}
      >
        <Text style={styles.fabText}>＋ Daily photo</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  page: { flex: 1, justifyContent: "flex-end" },
  scrim: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.28)",
  },
  caption: { margin: space.lg, gap: 4 },
  place: { color: colors.accent, fontWeight: "700", fontSize: 13 },
  text: { color: colors.text, fontSize: 16, lineHeight: 22 },
  time: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
  fab: {
    position: "absolute",
    right: 18,
    backgroundColor: colors.accent,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
    zIndex: 10,
  },
  fabPressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },
  fabText: { color: "#2a160c", fontWeight: "700", fontSize: 14 },
});
