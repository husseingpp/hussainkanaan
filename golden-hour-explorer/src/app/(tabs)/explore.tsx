import { useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import * as Location from "expo-location";
import { Screen } from "@/components/Screen";
import { SpotCard } from "@/components/SpotCard";
import { StateView } from "@/components/StateView";
import { useApprovedSpots } from "@/lib/db";
import { haversineKm } from "@/lib/geo";
import { colors, radius, space } from "@/theme/theme";
import type { SpotWithDistance } from "@/lib/types";

type Sort = "rating" | "popular" | "nearest";
const SORTS: { key: Sort; label: string }[] = [
  { key: "rating", label: "Top rated" },
  { key: "popular", label: "Most rated" },
  { key: "nearest", label: "Nearest" },
];

export default function ExploreScreen() {
  const router = useRouter();
  const { data: spots, isLoading, error } = useApprovedSpots();
  const [sort, setSort] = useState<Sort>("rating");
  const [me, setMe] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locating, setLocating] = useState(false);

  async function locate() {
    setLocating(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) return;
      const pos = await Location.getCurrentPositionAsync({});
      setMe({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      setSort("nearest");
    } finally {
      setLocating(false);
    }
  }

  const data: SpotWithDistance[] = useMemo(() => {
    const list: SpotWithDistance[] = (spots ?? []).map((s) => ({
      ...s,
      distanceKm: me ? haversineKm(me, s) : null,
    }));
    if (sort === "rating") list.sort((a, b) => (b.average_rating ?? 0) - (a.average_rating ?? 0));
    else if (sort === "popular") list.sort((a, b) => b.ratings_count - a.ratings_count);
    else
      list.sort(
        (a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity),
      );
    return list;
  }, [spots, sort, me]);

  if (isLoading)
    return (
      <Screen title="Explore">
        <StateView loading message="Loading spots…" />
      </Screen>
    );
  if (error)
    return (
      <Screen title="Explore">
        <StateView message="Couldn't load spots." />
      </Screen>
    );

  return (
    <Screen title="Explore" subtitle="Find your next golden hour">
      <View style={styles.sorts}>
        {SORTS.map((s) => {
          const on = sort === s.key;
          return (
            <Pressable
              key={s.key}
              onPress={() => (s.key === "nearest" && !me ? locate() : setSort(s.key))}
              style={[styles.sort, on && styles.sortOn]}
            >
              <Text style={[styles.sortText, on && styles.sortTextOn]}>
                {s.key === "nearest" && locating ? "Locating…" : s.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <FlatList
        data={data}
        keyExtractor={(s) => s.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <SpotCard spot={item} onPress={() => router.push(`/spot/${item.id}`)} />
        )}
        ItemSeparatorComponent={() => <View style={{ height: space.sm }} />}
        ListEmptyComponent={<StateView message="No spots yet." />}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  sorts: { flexDirection: "row", gap: 8, paddingHorizontal: space.lg, paddingBottom: space.sm },
  sort: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  sortOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  sortText: { color: colors.textMuted, fontSize: 13, fontWeight: "600" },
  sortTextOn: { color: "#2a160c" },
  list: { padding: space.lg, paddingTop: space.sm },
});
