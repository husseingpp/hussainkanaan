import { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import Feather from "@expo/vector-icons/Feather";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as Location from "expo-location";
import { Screen } from "@/components/Screen";
import { StateView } from "@/components/StateView";
import { useApprovedSpots, useFavoriteSpots, useNearbySpots, useToggleFavorite } from "@/lib/db";
import { useAuth } from "@/lib/auth";
import { haversineKm } from "@/lib/geo";
import { colors, fonts, radius, space, typeColor } from "@/theme/theme";
import type { Spot, SpotType, SpotWithDistance } from "@/lib/types";

type TypeFilter = "all" | SpotType;
const TYPE_FILTERS: { key: TypeFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "sunrise", label: "Sunrise" },
  { key: "sunset", label: "Sunset" },
  { key: "both", label: "Both" },
];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const TYPE_LABEL: Record<SpotType, string> = {
  sunrise: "Sunrise",
  sunset: "Sunset",
  both: "Sunrise & sunset",
};

const ZOOM_TRANSITION =
  Platform.OS === "web"
    ? ({
        transitionProperty: "transform",
        transitionDuration: "450ms",
        transitionTimingFunction: "cubic-bezier(.2,.8,.2,1)",
      } as object)
    : null;

function milesAway(distanceKm: number | null): string | null {
  if (distanceKm == null) return null;
  const mi = distanceKm * 0.621371;
  return `${mi < 10 ? mi.toFixed(1) : Math.round(mi)} mi away`;
}

function SpotOverlayCard({
  spot,
  width,
  aspectRatio,
  distanceKm,
  favorited,
  onToggleFav,
  onPress,
}: {
  spot: Spot;
  width: number;
  aspectRatio: number;
  distanceKm: number | null;
  favorited: boolean;
  onToggleFav: () => void;
  onPress: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const photo = spot.photo_urls?.[0];
  const dist = milesAway(distanceKm);

  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={({ pressed }) => [styles.card, { width, aspectRatio }, pressed && styles.cardPressed]}
    >
      {photo ? (
        <Image
          source={{ uri: photo }}
          style={[StyleSheet.absoluteFill, ZOOM_TRANSITION, { transform: [{ scale: hovered ? 1.05 : 1 }] }]}
          contentFit="cover"
          transition={200}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.cardPlaceholder, { backgroundColor: typeColor[spot.type] + "55" }]}>
          <Feather name="sun" size={40} color={colors.textFaint} />
        </View>
      )}
      <View style={styles.scrim} pointerEvents="none" />

      <Pressable onPress={onToggleFav} hitSlop={8} style={styles.heart}>
        <Ionicons
          name={favorited ? "heart" : "heart-outline"}
          size={18}
          color={favorited ? colors.accent : "#fff"}
        />
      </Pressable>

      {spot.ratings_count > 0 ? (
        <View style={styles.ratingPill}>
          <Text style={styles.ratingStar}>★</Text>
          <Text style={styles.ratingText}>{(spot.average_rating ?? 0).toFixed(1)}</Text>
        </View>
      ) : null}

      <View style={styles.cardBody}>
        <View style={[styles.typeBadge, { backgroundColor: typeColor[spot.type] }]}>
          <Text style={styles.typeBadgeText}>{TYPE_LABEL[spot.type]}</Text>
        </View>
        <Text style={styles.cardName} numberOfLines={1}>
          {spot.name}
        </Text>
        <View style={styles.locRow}>
          <Feather name="map-pin" size={12} color={colors.accent} />
          <Text style={styles.locText}>Verified Location</Text>
          {dist ? <Text style={styles.locDist}>{dist}</Text> : null}
        </View>
      </View>
    </Pressable>
  );
}

function FilterPill({
  label,
  active,
  variant = "amber",
  onPress,
}: {
  label: string;
  active: boolean;
  variant?: "amber" | "light";
  onPress: () => void;
}) {
  const activeStyle =
    variant === "light"
      ? active && styles.pillActiveLight
      : active && styles.pillActiveAmber;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.pill, activeStyle, pressed && styles.pillPressed]}
    >
      <Text style={[styles.pillText, active && (variant === "light" ? styles.pillTextLight : styles.pillTextAmber)]}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function ExploreScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { user } = useAuth();
  const { data: spots, isLoading, error } = useApprovedSpots();
  const { data: favorites } = useFavoriteSpots(user?.id);
  const toggleFav = useToggleFavorite();

  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [month, setMonth] = useState<string | null>(null);
  const [sort, setSort] = useState<"top" | "near">("top");
  const [me, setMe] = useState<{ latitude: number; longitude: number } | null>(null);

  // Server-side distance ordering (PostGIS RPC) — only runs for the "Near me"
  // sort once we have a location.
  const nearby = useNearbySpots(me, { enabled: sort === "near" });

  // Distances if location is already granted (no prompt on mount).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const perm = await Location.getForegroundPermissionsAsync();
        if (!perm.granted) return;
        const pos = await Location.getCurrentPositionAsync({});
        if (!cancelled)
          setMe({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Explicit tap on "Near me" → prompt for location if we don't have it yet.
  async function locate() {
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) return;
      const pos = await Location.getCurrentPositionAsync({});
      setMe({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
    } catch {
      /* ignore */
    }
  }

  const favIds = useMemo(() => new Set((favorites ?? []).map((f) => f.id)), [favorites]);

  const cols = width >= 900 ? 2 : 1;
  const aspectRatio = cols === 2 ? 1.7 : 1.45;
  // Numeric literals — `space.*` is a CSS-var string on web, so it can't be used
  // in arithmetic. These match the default space.lg / space.md pixel values.
  const HPAD = 20;
  const GAP = 14;
  const cardW = Math.floor((width - HPAD * 2 - GAP * (cols - 1)) / cols);

  // Base list + ordering. "Near me" uses the server-ordered PostGIS rows when
  // available, and falls back to a client haversine sort while they load (or if
  // the RPC isn't reachable), so the sort always works.
  const base: SpotWithDistance[] = useMemo(() => {
    if (sort === "near" && me) {
      if (nearby.data) return nearby.data;
      return (spots ?? [])
        .map((s) => ({ ...s, distanceKm: haversineKm(me, s) }))
        .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
    }
    return (spots ?? []).map((s) => ({ ...s, distanceKm: me ? haversineKm(me, s) : null }));
  }, [sort, me, nearby.data, spots]);

  const data: SpotWithDistance[] = useMemo(() => {
    let list: SpotWithDistance[] = base;
    if (typeFilter !== "all") list = list.filter((s) => s.type === typeFilter);
    if (month) {
      const m3 = month.slice(0, 3).toLowerCase();
      list = list.filter((s) =>
        (s.best_months ?? []).some((bm) => bm.slice(0, 3).toLowerCase() === m3),
      );
    }
    return list;
  }, [base, typeFilter, month]);

  function onToggleFav(spotId: string) {
    if (!user) {
      router.push("/sign-in");
      return;
    }
    toggleFav.mutate({ spotId, userId: user.id });
  }

  return (
    <Screen edges={[]}>
      <View style={styles.filters}>
        <Text style={styles.hero}>Discover the world&apos;s best light</Text>
        <View style={styles.typeRow}>
          {TYPE_FILTERS.map((t) => (
            <FilterPill
              key={t.key}
              label={t.label}
              active={typeFilter === t.key}
              onPress={() => setTypeFilter(t.key)}
            />
          ))}
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.monthRow}
        >
          <FilterPill label="All months" active={month === null} variant="light" onPress={() => setMonth(null)} />
          {MONTHS.map((m) => (
            <FilterPill
              key={m}
              label={m}
              active={month === m}
              variant="light"
              onPress={() => setMonth((cur) => (cur === m ? null : m))}
            />
          ))}
        </ScrollView>
        <View style={styles.sortRow}>
          <FilterPill
            label="Top rated"
            active={sort === "top"}
            variant="light"
            onPress={() => setSort("top")}
          />
          <FilterPill
            label="Near me"
            active={sort === "near"}
            variant="light"
            onPress={() => {
              setSort("near");
              if (!me) void locate();
            }}
          />
        </View>
      </View>

      {isLoading ? (
        <StateView loading message="Loading spots…" />
      ) : error ? (
        <StateView message="Couldn't load spots." />
      ) : (
        <FlatList
          key={cols}
          data={data}
          keyExtractor={(s) => s.id}
          numColumns={cols}
          columnWrapperStyle={cols > 1 ? styles.column : undefined}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <SpotOverlayCard
              spot={item}
              width={cardW}
              aspectRatio={aspectRatio}
              distanceKm={item.distanceKm}
              favorited={favIds.has(item.id)}
              onToggleFav={() => onToggleFav(item.id)}
              onPress={() => router.push(`/spot/${item.id}`)}
            />
          )}
          ListEmptyComponent={<StateView message="No spots match these filters." />}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  filters: { paddingHorizontal: space.lg, paddingTop: space.md, gap: space.sm },
  hero: { color: colors.textFaint, fontSize: 13, fontWeight: "700", letterSpacing: 0.4, marginBottom: 2 },
  typeRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  monthRow: { gap: 8, paddingVertical: 2, paddingRight: space.lg },
  sortRow: { flexDirection: "row", gap: 8, marginTop: 2 },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.bg2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  pillPressed: { opacity: 0.7 },
  pillActiveAmber: { backgroundColor: colors.accent, borderColor: colors.accent },
  pillActiveLight: { backgroundColor: colors.text, borderColor: colors.text },
  pillText: { color: colors.textMuted, fontSize: 12, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase" },
  pillTextAmber: { color: "#2a160c" },
  pillTextLight: { color: colors.bg },

  list: { padding: space.lg, paddingBottom: 130 },
  column: { gap: space.md, marginBottom: space.md },
  card: {
    borderRadius: radius.lg,
    overflow: "hidden",
    backgroundColor: colors.bg2,
    marginBottom: space.md,
  },
  cardPressed: { opacity: 0.95 },
  cardPlaceholder: { alignItems: "center", justifyContent: "center" },
  scrim: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.28)",
  },
  heart: {
    position: "absolute",
    top: 14,
    left: 14,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  ratingPill: {
    position: "absolute",
    top: 14,
    right: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  ratingStar: { color: colors.star, fontSize: 12 },
  ratingText: { color: "#fff", fontSize: 12.5, fontWeight: "800" },
  cardBody: { position: "absolute", left: 18, right: 18, bottom: 16, gap: 6 },
  typeBadge: { alignSelf: "flex-start", paddingHorizontal: 9, paddingVertical: 3, borderRadius: 6 },
  typeBadgeText: { color: "#2a160c", fontSize: 10, fontWeight: "800", letterSpacing: 0.6, textTransform: "uppercase" },
  cardName: {
    fontFamily: fonts.body,
    color: "#fff",
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  locRow: { flexDirection: "row", alignItems: "center", gap: 5, flexWrap: "wrap" },
  locText: { color: "rgba(255,255,255,0.82)", fontSize: 12.5, fontWeight: "600" },
  locDist: { color: "rgba(255,255,255,0.6)", fontSize: 12.5, marginLeft: 2 },
});
