import { useEffect, useRef, useState } from "react";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { StateView } from "@/components/StateView";
import { WeatherHeader } from "@/components/WeatherHeader";
import { useApprovedSpots } from "@/lib/db";
import { MAP_STYLE, DEFAULT_CENTER } from "@/lib/config";
import { colors, space, typeColor } from "@/theme/theme";

// Inject maplibre CSS once per session (Metro can't import .css files directly).
// Pinned to the exact installed version so the markup matches the JS bundle.
function ensureMaplibreCSS() {
  if (document.getElementById("maplibre-css")) return;
  const link = document.createElement("link");
  link.id = "maplibre-css";
  link.rel = "stylesheet";
  link.href = "https://unpkg.com/maplibre-gl@5.24.0/dist/maplibre-gl.css";
  link.onerror = () => console.warn("Failed to load maplibre-gl CSS");
  document.head.appendChild(link);
}

export default function MapScreen() {
  const router = useRouter();
  const { data: spots, isLoading, error } = useApprovedSpots();
  const [mapError, setMapError] = useState(false);

  // mapContainerRef points to a real <div> rendered in the JSX below.
  // In .web.tsx, native HTML elements are valid — this file never runs on native.
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("maplibre-gl").Map | null>(null);
  const markersRef = useRef<import("maplibre-gl").Marker[]>([]);

  // Initialise the map once the container div mounts.
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    let disposed = false;
    const container = mapContainerRef.current;

    ensureMaplibreCSS();

    import("maplibre-gl").then(({ Map: MlMap, NavigationControl }) => {
      if (disposed || mapRef.current) return;
      const center: [number, number] = spots?.length
        ? [spots[0].longitude, spots[0].latitude]
        : DEFAULT_CENTER;
      const map = new MlMap({
        container,
        style: MAP_STYLE,
        center,
        zoom: spots?.length ? 5 : 1.4,
        attributionControl: { compact: true },
      });
      map.addControl(new NavigationControl({ showCompass: false }), "top-right");
      // Surface a failed style/tiles load instead of leaving a blank canvas.
      map.on("error", (e) => {
        console.warn("MapLibre error", e?.error ?? e);
        setMapError(true);
      });
      mapRef.current = map;
    });

    return () => {
      disposed = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-draw markers whenever the spots list changes.
  useEffect(() => {
    if (!spots?.length) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    import("maplibre-gl").then(({ Marker }) => {
      const map = mapRef.current;
      if (!map) return;
      for (const spot of spots) {
        const el = document.createElement("button");
        el.type = "button";
        el.title = spot.name;
        el.style.cssText =
          `width:16px;height:16px;border-radius:50%;` +
          `border:2px solid #fff;background:${typeColor[spot.type]};` +
          `cursor:pointer;box-shadow:0 2px 4px rgba(0,0,0,.45);padding:0;`;
        el.addEventListener("click", () => router.push(`/spot/${spot.id}`));
        markersRef.current.push(
          new Marker({ element: el }).setLngLat([spot.longitude, spot.latitude]).addTo(map),
        );
      }
    });
  }, [spots, router]);

  // Tear-down on unmount.
  useEffect(() => {
    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  if (isLoading)
    return (
      <Screen title="Map">
        <StateView loading message="Loading spots…" />
      </Screen>
    );
  if (error)
    return (
      <Screen title="Map">
        <StateView message="Couldn't reach the map data right now." />
      </Screen>
    );

  return (
    <View style={styles.root}>
      {/*
       * A real <div> is necessary here so maplibre-gl can receive an HTMLElement.
       * react-native-web renders View as a div, but the ref gives a component
       * instance rather than the DOM node. This file is web-only so DOM elements are valid.
       * Explicit width/height (not just inset) keeps it sized even if a parent
       * loses flex height in static export.
       */}
      <div
        ref={mapContainerRef}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      />
      {mapError ? (
        <View style={styles.errorBanner} pointerEvents="none">
          <Text style={styles.errorText}>
            The basemap couldn&apos;t load. Check your connection and reload.
          </Text>
        </View>
      ) : null}
      <View style={styles.weatherOverlay} pointerEvents="box-none">
        <WeatherHeader />
      </View>
      <Pressable style={styles.fab} onPress={() => router.push("/submit")}>
        <Text style={styles.fabText}>＋ Add spot</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, position: "relative" },
  errorBanner: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(224,85,107,0.92)",
    paddingVertical: 10,
    paddingHorizontal: 16,
    zIndex: 20,
  },
  errorText: { color: "#fff", fontSize: 13, fontWeight: "600", textAlign: "center" },
  weatherOverlay: {
    position: "absolute",
    top: space.md,
    left: space.lg,
    right: space.lg,
    zIndex: 10,
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
    zIndex: 10,
  },
  fabText: { color: "#2a160c", fontWeight: "700", fontSize: 14 },
});
