import { useMemo, useState } from "react";
import { Dimensions, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { useQuery } from "@tanstack/react-query";
import * as Location from "expo-location";
import { Screen } from "@/components/Screen";
import { StateView } from "@/components/StateView";
import { WeatherHeader } from "@/components/WeatherHeader";
import { useApprovedSpots } from "@/lib/db";
import { haversineKm, formatDistance } from "@/lib/geo";
import { fetchWeather, skyScore, scoreLabel } from "@/lib/weather";
import { colors, radius, space, typeColor } from "@/theme/theme";
import type { SpotWithDistance } from "@/lib/types";

type Sort = "rating" | "popular" | "nearest";
const SORTS: { key: Sort; label: string }[] = [
  { key: "rating", label: "Top rated" },
  { key: "popular", label: "Most rated" },
  { key: "nearest", label: "Nearest" },
];

const GAP = space.sm;
const COLS = 2;

function SpotTile({
  spot,
  width,
  onPress,
}: {
  spot: SpotWithDistance;
  width: number;
  onPress: () => void;
}) {
  const photo = spot.photo_urls?.[0];
  // Round coords to ~10km so nearby spots share one cached forecast.
  const { data: weather } = useQuery({
    queryKey: ["spot-weather", spot.latitude.toFixed(1), spot.longitude.toFixed(1)],
    queryFn: () => fetchWeather(spot.latitude, spot.longitude),
    staleTime: 600_000,
    retry: 0,
  });
  const skyText = weather ? `${scoreLabel(skyScore(weather))} sky` : null;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.tile, { width }, pressed && styles.pressed]}
    >
      {photo ? (
        <Image source={{ uri: photo }} style={styles.photo} contentFit="cover" transition={150} />
      ) : (
        <View style={[styles.photo, styles.photoPlaceholder, { backgroundColor: typeColor[spot.type] }]}>
          <Text style={styles.photoEmoji}>🌄</Text>
        </View>
      )}
      <View style={styles.photoScrim} pointerEvents="none" />
      <Text style={styles.tileName} numberOfLines={1}>
        {spot.name}
      </Text>
      <View style={styles.tileMeta}>
        <Text style={styles.metaText} numberOfLines={1}>
          {spot.distanceKm != null ? `${formatDistance(spot.distanceKm)} away` : `★ ${(spot.average_rating ?? 0).toFixed(1)}`}
        </Text>
        {skyText ? <Text style={styles.skyText}>· {skyText}</Text> : null}
      </View>
    </Pressable>
  );
}

export default function ExploreScreen() {
  const router = useRouter();
  const { data: spots, isLoading, error } = useApprovedSpots();
  const [sort, setSort] = useState<Sort>("rating");
  const [me, setMe] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locating, setLocating] = useState(false);

  const tileWidth = useMemo(() => {
    const screen = Dimensions.get("window").width;
    const usable = Math.min(screen, 720) - space.lg * 2 - GAP * (COLS - 1);
    return Math.floor(usable / COLS);
  }, []);

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
    else list.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
    return list;
  }, [spots, sort, me]);

  return (
    <Screen title="Explore" subtitle="Find your next golden hour">
      <View style={styles.weather}>
        <WeatherHeader />
      </View>
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
      {isLoading ? (
        <StateView loading message="Loading spots…" />
      ) : error ? (
        <StateView message="Couldn't load spots." />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(s) => s.id}
          numColumns={COLS}
          columnWrapperStyle={styles.column}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <SpotTile
              spot={item}
              width={tileWidth}
              onPress={() => router.push(`/spot/${item.id}`)}
            />
          )}
          ListEmptyComponent={<StateView message="No spots yet." />}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  weather: { paddingHorizontal: space.lg, paddingBottom: space.sm },
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
  list: { padding: space.lg, paddingTop: space.sm, alignSelf: "center" },
  column: { gap: GAP, marginBottom: GAP },
  tile: {
    borderRadius: radius.md,
    overflow: "hidden",
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingBottom: 8,
  },
  pressed: { opacity: 0.75 },
  photo: { width: "100%", height: 150 },
  photoPlaceholder: { alignItems: "center", justifyContent: "center" },
  photoEmoji: { fontSize: 38 },
  photoScrim: {
    position: "absolute",
    top: 110,
    left: 0,
    right: 0,
    height: 40,
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  tileName: { color: colors.text, fontWeight: "700", fontSize: 14, paddingHorizontal: 10, marginTop: 8 },
  tileMeta: { flexDirection: "row", gap: 4, paddingHorizontal: 10, marginTop: 2, flexWrap: "wrap" },
  metaText: { color: colors.textMuted, fontSize: 12 },
  skyText: { color: colors.accent, fontSize: 12, fontWeight: "600" },
});
