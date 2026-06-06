import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Map as MapLibreMap, Camera, Marker } from "@maplibre/maplibre-react-native";
import { Screen } from "@/components/Screen";
import { StateView } from "@/components/StateView";
import { useApprovedSpots } from "@/lib/db";
import { MAP_STYLE, DEFAULT_CENTER } from "@/lib/config";
import { colors, typeColor } from "@/theme/theme";

export default function MapScreen() {
  const router = useRouter();
  const { data: spots, isLoading, error } = useApprovedSpots();

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
      <MapLibreMap style={styles.map} mapStyle={MAP_STYLE}>
        <Camera initialViewState={{ center, zoom: 1.4 }} />
        {list.map((s) => (
          <Marker
            key={s.id}
            id={s.id}
            lngLat={[s.longitude, s.latitude]}
            onPress={() => router.push(`/spot/${s.id}`)}
          >
            <View style={[styles.pin, { backgroundColor: typeColor[s.type] }]} />
          </Marker>
        ))}
      </MapLibreMap>
      <Pressable style={styles.fab} onPress={() => router.push("/submit")}>
        <Text style={styles.fabText}>＋ Add spot</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  map: { flex: 1 },
  pin: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#fff",
  },
  fab: {
    position: "absolute",
    right: 18,
    bottom: 24,
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
  fabText: { color: "#2a160c", fontWeight: "700", fontSize: 14 },
});
