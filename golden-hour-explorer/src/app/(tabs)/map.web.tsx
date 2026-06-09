import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { useQuery } from "@tanstack/react-query";
import * as Location from "expo-location";
import { useApprovedSpots } from "@/lib/db";
import { MAP_STYLE, DEFAULT_CENTER } from "@/lib/config";
import { fetchWeather, skyScore, scoreLabel } from "@/lib/weather";
import { colors, radius, space, typeColor } from "@/theme/theme";
import type { Spot } from "@/lib/types";

// Inject maplibre CSS once per session (Metro can't import .css files directly).
function ensureMaplibreCSS() {
  if (document.getElementById("maplibre-css")) return;
  const link = document.createElement("link");
  link.id = "maplibre-css";
  link.rel = "stylesheet";
  link.href = "https://unpkg.com/maplibre-gl@5.24.0/dist/maplibre-gl.css";
  link.onerror = () => console.warn("Failed to load maplibre-gl CSS");
  document.head.appendChild(link);
}

// A Feather-style white sun, inlined so it can live inside a raw DOM marker.
const SUN_ICON =
  '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" ' +
  'stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">' +
  '<circle cx="12" cy="12" r="4.2"/><path d="M12 2v2M12 20v2M4.5 4.5l1.4 1.4' +
  'M18.1 18.1l1.4 1.4M2 12h2M20 12h2M4.5 19.5l1.4-1.4M18.1 5.9l1.4-1.4"/></svg>';

/** Drop a blue "you are here" marker if location is already granted. */
async function addUserMarker(
  map: import("maplibre-gl").Map,
  Marker: typeof import("maplibre-gl").Marker,
) {
  try {
    const perm = await Location.getForegroundPermissionsAsync();
    if (!perm.granted) return;
    const pos = await Location.getCurrentPositionAsync({});
    const el = document.createElement("div");
    el.style.cssText =
      "width:20px;height:20px;border-radius:50%;border:3px solid #fff;background:#2f7ef0;" +
      "box-shadow:0 0 0 6px rgba(47,126,240,.25);";
    new Marker({ element: el }).setLngLat([pos.coords.longitude, pos.coords.latitude]).addTo(map);
  } catch {
    /* no location — skip the marker */
  }
}

/**
 * Bottom card shown when a pin is clicked — mirrors the native PopupCard so
 * the UX is identical across platforms. Rendered in React so it sits in the
 * normal stacking context (no MapLibre DOM popup quirks).
 */
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
    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${spot.latitude},${spot.longitude}`,
      "_blank",
      "noopener",
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
        <View
          style={[
            styles.cardPhoto,
            styles.cardPhotoPlaceholder,
            { backgroundColor: typeColor[spot.type] },
          ]}
        >
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
  const [mapError, setMapError] = useState(false);
  const [selected, setSelected] = useState<Spot | null>(null);

  const mapRef = useRef<import("maplibre-gl").Map | null>(null);
  const markersRef = useRef<import("maplibre-gl").Marker[]>([]);
  const resizeObsRef = useRef<ResizeObserver | null>(null);
  const spotsRef = useRef(spots);
  spotsRef.current = spots;
  // Stable setter ref so DOM click handlers always call the latest setter.
  const setSelectedRef = useRef(setSelected);
  setSelectedRef.current = setSelected;

  /**
   * Callback ref: build the map the moment the container <div> is attached.
   * Using a callback ref avoids the bug where useEffect([]) fires before the
   * div exists (loading state, early return). maplibre needs a real size too,
   * so we resize on load and whenever the element's box changes.
   */
  const attachMap = useCallback((container: HTMLDivElement | null) => {
    if (!container || mapRef.current) return;
    ensureMaplibreCSS();

    import("maplibre-gl").then(({ Map: MlMap, NavigationControl, Marker }) => {
      if (mapRef.current) return;
      const initial = spotsRef.current;
      const center: [number, number] = initial?.length
        ? [initial[0].longitude, initial[0].latitude]
        : DEFAULT_CENTER;
      const map = new MlMap({
        container,
        style: MAP_STYLE,
        center,
        zoom: initial?.length ? 5 : 1.4,
        attributionControl: { compact: true },
      });
      map.addControl(new NavigationControl({ showCompass: false }), "top-right");
      map.on("error", (e) => {
        console.warn("MapLibre error", e?.error ?? e);
        setMapError(true);
      });
      map.on("load", () => map.resize());
      const ro = new ResizeObserver(() => map.resize());
      ro.observe(container);
      resizeObsRef.current = ro;
      mapRef.current = map;
      syncMarkers(map, spotsRef.current ?? []);
      void addUserMarker(map, Marker);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Refresh markers whenever the spots list changes (after the map exists).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !spots) return;
    syncMarkers(map, spots);
  }, [spots]); // eslint-disable-line react-hooks/exhaustive-deps

  function syncMarkers(map: import("maplibre-gl").Map, list: typeof spots) {
    import("maplibre-gl").then(({ Marker }) => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      for (const spot of list ?? []) {
        const el = document.createElement("button");
        el.type = "button";
        el.title = spot.name;
        el.innerHTML = SUN_ICON;
        el.style.cssText =
          `width:30px;height:30px;border-radius:50%;display:flex;align-items:center;` +
          `justify-content:center;border:2px solid #fff;background:${typeColor[spot.type]};` +
          `cursor:pointer;box-shadow:0 2px 6px rgba(0,0,0,.55);padding:0;`;
        // stopPropagation so the map doesn't see the click and pan away.
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          setSelectedRef.current(spot);
        });
        markersRef.current.push(
          new Marker({ element: el }).setLngLat([spot.longitude, spot.latitude]).addTo(map),
        );
      }
    });
  }

  // Tear-down on unmount.
  useEffect(() => {
    return () => {
      resizeObsRef.current?.disconnect();
      resizeObsRef.current = null;
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  return (
    <View style={styles.root}>
      {/*
       * Rendered UNCONDITIONALLY so the callback ref always fires and the map
       * can initialise regardless of query state. Web-only file → DOM is fine.
       */}
      <div
        ref={attachMap}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      />

      {isLoading ? (
        <View style={styles.loading} pointerEvents="none">
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.loadingText}>Loading spots…</Text>
        </View>
      ) : null}

      {error || mapError ? (
        <View style={styles.errorBanner} pointerEvents="none">
          <Text style={styles.errorText}>
            {error
              ? "Couldn't reach the map data right now."
              : "The basemap couldn't load. Check your connection and reload."}
          </Text>
        </View>
      ) : null}

      {selected ? (
        <View style={styles.cardWrap} pointerEvents="box-none">
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
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
        onPress={() => router.push("/submit")}
      >
        <Text style={styles.fabText}>＋ Add spot</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, position: "relative" },
  loading: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
  },
  loadingText: { color: colors.textMuted, fontSize: 14 },
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
  cardWrap: {
    position: "absolute",
    left: space.lg,
    bottom: 96,
    width: 320,
    maxWidth: "86%",
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
    bottom: 104,
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
