import { useState } from "react";
import { useRouter } from "expo-router";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { useQuery } from "@tanstack/react-query";
import { Map as MapLibreMap, Camera, Marker } from "@maplibre/maplibre-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Screen } from "@/components/Screen";
import { StateView } from "@/components/StateView";
import { WeatherHeader } from "@/components/WeatherHeader";
import { useApprovedSpots } from "@/lib/db";
import { MAP_STYLE, DEFAULT_CENTER } from "@/lib/config";
import { fetchWeather, skyScore, scoreLabel } from "@/lib/weather";
import { colors, radius, space, typeColor } from "@/theme/theme";
import type { Spot } from "@/lib/types";

/** Bottom card shown when a pin is tapped: photo, sky forecast, and actions. */
function PopupCard({
  spot,
  onClose,
  onMore,
}: {
  spot: Spot;
  onClose: () => void;
  onMore: () => void;
}) {
  const photo = spot.photo_urls?.[0];
  const { data: weather } = useQuery({
    queryKey: ["spot-weather", spot.latitude.toFixed(1), spot.longitude.toFixed(1)],
    queryFn: () => fetchWeather(spot.latitude, spot.longitude),
    staleTime: 600_000,
    retry: 0,
  });
  const wxText = weather
    ? `${scoreLabel(skyScore(weather))} sky · ${Math.round(weather.temperature)}° · ${Math.round(weather.cloudCover)}% cloud`
    : "Checking sky…";

  function drive() {
    Linking.openURL(
      `https://www.google.com/maps/dir/?api=1&destination=${spot.latitude},${spot.longitude}`,
    );
  }

  return (
    <View style={styles.card}>
      <Pressable style={styles.cardClose} onPress={onClose} hitSlop={10}>
        <Text style={styles.cardCloseText}>✕</Text>
      </Pressable>
      {photo ? (
        <Image source={{ uri: photo }} style={styles.cardPhoto} contentFit="cover" />
      ) : (
        <View style={[styles.cardPhoto, styles.cardPhotoPlaceholder, { backgroundColor: typeColor[spot.type] }]}>
          <Text style={styles.cardPhotoEmoji}>🌄</Text>
        </View>
      )}
      <Text style={styles.cardName} numberOfLines={1}>
        {spot.name}
      </Text>
      <Text style={styles.cardWx}>{wxText}</Text>
      <View style={styles.cardRow}>
        <Pressable style={[styles.cardBtn, styles.cardBtnPrimary]} onPress={drive}>
          <Text style={styles.cardBtnPrimaryText}>🚗 Drive there</Text>
        </Pressable>
        <Pressable style={[styles.cardBtn, styles.cardBtnGhost]} onPress={onMore}>
          <Text style={styles.cardBtnGhostText}>More info</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function MapScreen() {
  const router = useRouter();
  const { data: spots, isLoading, error } = useApprovedSpots();
  const [mapFailed, setMapFailed] = useState(false);
  const [selected, setSelected] = useState<Spot | null>(null);
  const insets = useSafeAreaInsets();

  if (isLoading) {
    return (
      <Screen title="Map">
        <StateView loading message="Loading spots…" />
      </Screen>
    );
  }
  if (error) {
    return (
      <Screen title="Map">
        <StateView message="Couldn't reach the map data right now." />
      </Screen>
    );
  }

  const list = spots ?? [];
  const center: [number, number] =
    list.length > 0 ? [list[0].longitude, list[0].latitude] : DEFAULT_CENTER;

  return (
    <View style={styles.root}>
      <MapLibreMap
        style={styles.map}
        mapStyle={MAP_STYLE}
        onDidFailLoadingMap={() => setMapFailed(true)}
      >
        <Camera initialViewState={{ center, zoom: 1.4 }} />
        {list.map((s) => (
          <Marker
            key={s.id}
            id={s.id}
            lngLat={[s.longitude, s.latitude]}
            onPress={() => setSelected(s)}
          >
            <View style={[styles.pin, { backgroundColor: typeColor[s.type] }]} />
          </Marker>
        ))}
      </MapLibreMap>
      {mapFailed ? (
        <View style={styles.errorBanner} pointerEvents="none">
          <Text style={styles.errorText}>
            The basemap couldn&apos;t load. Check your connection.
          </Text>
        </View>
      ) : null}
      <View
        style={[styles.weatherOverlay, { top: insets.top + space.sm }]}
        pointerEvents="box-none"
      >
        <WeatherHeader />
      </View>
      {selected ? (
        <View style={[styles.cardWrap, { bottom: insets.bottom + 144 }]} pointerEvents="box-none">
          <PopupCard
            spot={selected}
            onClose={() => setSelected(null)}
            onMore={() => {
              const id = selected.id;
              setSelected(null);
              router.push(`/spot/${id}`);
            }}
          />
        </View>
      ) : null}
      <Pressable
        style={({ pressed }) => [styles.fab, { bottom: insets.bottom + 88 }, pressed && styles.fabPressed]}
        onPress={() => router.push("/submit")}
      >
        <Text style={styles.fabText}>＋ Add spot</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  map: { flex: 1 },
  errorBanner: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(224,85,107,0.92)",
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  errorText: { color: "#fff", fontSize: 13, fontWeight: "600", textAlign: "center" },
  weatherOverlay: {
    position: "absolute",
    left: space.lg,
    right: space.lg,
    zIndex: 10,
  },
  pin: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#fff",
  },
  cardWrap: {
    position: "absolute",
    left: space.lg,
    right: space.lg,
    zIndex: 15,
  },
  card: {
    backgroundColor: colors.bg2,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: space.md,
    gap: 8,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  cardClose: {
    position: "absolute",
    top: 8,
    right: 8,
    zIndex: 2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  cardCloseText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  cardPhoto: { width: "100%", height: 130, borderRadius: radius.sm },
  cardPhotoPlaceholder: { alignItems: "center", justifyContent: "center" },
  cardPhotoEmoji: { fontSize: 34 },
  cardName: { color: colors.text, fontWeight: "700", fontSize: 16 },
  cardWx: { color: colors.textMuted, fontSize: 13 },
  cardRow: { flexDirection: "row", gap: 8, marginTop: 2 },
  cardBtn: { flex: 1, paddingVertical: 11, borderRadius: radius.pill, alignItems: "center" },
  cardBtnPrimary: { backgroundColor: colors.accent },
  cardBtnPrimaryText: { color: "#2a160c", fontWeight: "700", fontSize: 13 },
  cardBtnGhost: {
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  cardBtnGhostText: { color: colors.text, fontWeight: "600", fontSize: 13 },
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
  },
  fabPressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },
  fabText: { color: "#2a160c", fontWeight: "700", fontSize: 14 },
});
