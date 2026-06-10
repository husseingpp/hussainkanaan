import { useMemo } from "react";
import { FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import Feather from "@expo/vector-icons/Feather";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Screen } from "@/components/Screen";
import { StateView } from "@/components/StateView";
import { useDailyFeed, useDailyFeedCounts } from "@/lib/db";
import { colors, space } from "@/theme/theme";

const GAP = 2;

export default function FeedScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { data, isLoading, error } = useDailyFeed();
  const ids = useMemo(() => (data ?? []).map((d) => d.id), [data]);
  const { data: counts } = useDailyFeedCounts(ids);

  // Edge-to-edge thumbnail grid, like Instagram's explore/FYP.
  const cols = width >= 1100 ? 6 : width >= 700 ? 5 : 3;
  const tile = Math.floor((width - GAP * (cols - 1)) / cols);

  const camera = (
    <Pressable
      style={({ pressed }) => [styles.cameraBtn, pressed && styles.cameraPressed]}
      onPress={() => router.push("/add-daily?pick=1")}
    >
      <Feather name="camera" size={20} color="#fff" />
    </Pressable>
  );

  return (
    <Screen title="Daily" accent="Feed" subtitle="From the last 24 hours" center right={camera} edges={[]}>
      {isLoading ? (
        <StateView loading />
      ) : error ? (
        <StateView message="Couldn't load the feed." />
      ) : !data || data.length === 0 ? (
        <StateView message="No moments yet. Be the first to share one!" />
      ) : (
        <FlatList
          key={cols}
          data={data}
          keyExtractor={(d) => d.id}
          numColumns={cols}
          columnWrapperStyle={{ gap: GAP }}
          contentContainerStyle={styles.grid}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const c = counts?.[item.id];
            const showMeta = !!c && (c.likes > 0 || c.comments > 0);
            return (
              <Pressable
                onPress={() => router.push(`/daily/${item.id}`)}
                style={({ pressed }) => [{ width: tile, height: tile }, pressed && styles.tilePressed]}
              >
                <Image source={{ uri: item.photo_url }} style={styles.tileImg} contentFit="cover" transition={150} />
                {showMeta ? (
                  <View style={styles.tileMeta} pointerEvents="none">
                    {c!.likes > 0 ? (
                      <>
                        <Ionicons name="heart" size={11} color="#fff" />
                        <Text style={styles.tileMetaText}>{c!.likes}</Text>
                      </>
                    ) : null}
                    {c!.comments > 0 ? (
                      <>
                        <Feather name="message-circle" size={11} color="#fff" />
                        <Text style={styles.tileMetaText}>{c!.comments}</Text>
                      </>
                    ) : null}
                  </View>
                ) : null}
              </Pressable>
            );
          }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { gap: GAP, paddingBottom: 130 },
  tilePressed: { opacity: 0.8 },
  tileImg: { width: "100%", height: "100%", backgroundColor: colors.bg2 },
  tileMeta: {
    position: "absolute",
    left: 6,
    bottom: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(0,0,0,0.4)",
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  tileMetaText: { color: "#fff", fontSize: 10.5, fontWeight: "700", marginRight: 2 },
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
