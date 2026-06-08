import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "expo-router";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { WeatherHeader } from "@/components/WeatherHeader";
import { useApprovedSpots } from "@/lib/db";
import { MAP_STYLE, DEFAULT_CENTER } from "@/lib/config";
import { fetchWeather, skyScore, scoreLabel } from "@/lib/weather";
import { colors, space, typeColor } from "@/theme/theme";
import type { Spot } from "@/lib/types";

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

/**
 * Build the popup's DOM: a photo, a (lazily filled) weather line, and the two
 * action buttons. Returns the container plus the weather <span> so the caller
 * can update it once the forecast resolves without rebuilding the node.
 */
function buildPopupContent(spot: Spot, onMore: () => void) {
  const container = document.createElement("div");
  container.style.cssText = "width:212px;font-family:inherit;";

  const photo = spot.photo_urls?.[0];
  if (photo) {
    const img = document.createElement("img");
    img.src = photo;
    img.alt = spot.name;
    img.style.cssText =
      "width:100%;height:118px;object-fit:cover;border-radius:8px;display:block;background:#222;";
    container.appendChild(img);
  } else {
    const ph = document.createElement("div");
    ph.style.cssText =
      `width:100%;height:118px;border-radius:8px;background:${typeColor[spot.type]};` +
      "display:flex;align-items:center;justify-content:center;font-size:30px;";
    ph.textContent = "🌄";
    container.appendChild(ph);
  }

  const name = document.createElement("div");
  name.textContent = spot.name;
  name.style.cssText = "color:#f4ece0;font-weight:700;font-size:14px;margin:8px 0 2px;";
  container.appendChild(name);

  const wx = document.createElement("div");
  wx.textContent = "Checking sky…";
  wx.style.cssText = "color:#b9b2c8;font-size:12px;margin-bottom:8px;";
  container.appendChild(wx);

  const row = document.createElement("div");
  row.style.cssText = "display:flex;gap:6px;";

  const drive = document.createElement("a");
  drive.textContent = "🚗 Drive there";
  drive.href = `https://www.google.com/maps/dir/?api=1&destination=${spot.latitude},${spot.longitude}`;
  drive.target = "_blank";
  drive.rel = "noopener";
  drive.style.cssText =
    "flex:1;text-align:center;text-decoration:none;background:#f0922f;color:#2a160c;" +
    "font-weight:700;font-size:12px;padding:8px 6px;border-radius:999px;";
  row.appendChild(drive);

  const more = document.createElement("button");
  more.type = "button";
  more.textContent = "More info";
  more.style.cssText =
    "flex:1;cursor:pointer;background:rgba(255,255,255,0.08);color:#f4ece0;" +
    "border:1px solid rgba(255,255,255,0.18);font-weight:600;font-size:12px;" +
    "padding:8px 6px;border-radius:999px;";
  more.addEventListener("click", onMore);
  row.appendChild(more);

  container.appendChild(row);
  return { container, wx };
}

export default function MapScreen() {
  const router = useRouter();
  const { data: spots, isLoading, error } = useApprovedSpots();
  const [mapError, setMapError] = useState(false);

  const mapRef = useRef<import("maplibre-gl").Map | null>(null);
  const markersRef = useRef<import("maplibre-gl").Marker[]>([]);
  const popupRef = useRef<import("maplibre-gl").Popup | null>(null);
  const resizeObsRef = useRef<ResizeObserver | null>(null);
  // Latest spots, read inside the one-time init without re-running it.
  const spotsRef = useRef(spots);
  spotsRef.current = spots;
  // Keep a stable router reference for marker listeners created inside init.
  const routerRef = useRef(router);
  routerRef.current = router;

  /**
   * Callback ref: build the map the moment the container <div> is actually
   * attached to the DOM. This avoids the classic bug where a mount effect runs
   * before the container exists (e.g. while data is still loading) and never
   * re-runs. maplibre also needs the container to have a real size, so we
   * resize on load and whenever the element's box changes.
   */
  const attachMap = useCallback((container: HTMLDivElement | null) => {
    if (!container || mapRef.current) return;
    ensureMaplibreCSS();

    import("maplibre-gl").then(({ Map: MlMap, NavigationControl }) => {
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
      // The tab content can settle its height a frame after mount; force the
      // canvas to recompute against the real container box once and on resize.
      map.on("load", () => map.resize());
      const ro = new ResizeObserver(() => map.resize());
      ro.observe(container);
      resizeObsRef.current = ro;
      mapRef.current = map;
      // Draw any markers we already have.
      syncMarkers(map, spotsRef.current ?? []);
    });
    // syncMarkers is stable for our purposes; init must run exactly once.
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Draw/refresh markers whenever the spots list changes (after the map exists).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !spots) return;
    syncMarkers(map, spots);
  }, [spots]); // eslint-disable-line react-hooks/exhaustive-deps

  function openPopup(map: import("maplibre-gl").Map, spot: Spot) {
    import("maplibre-gl").then(({ Popup }) => {
      popupRef.current?.remove();
      const { container, wx } = buildPopupContent(spot, () => {
        popupRef.current?.remove();
        routerRef.current.push(`/spot/${spot.id}`);
      });
      const popup = new Popup({ closeButton: true, maxWidth: "232px", offset: 14 })
        .setLngLat([spot.longitude, spot.latitude])
        .setDOMContent(container)
        .addTo(map);
      popupRef.current = popup;
      // Fill the weather line once the forecast resolves (popup may have closed).
      fetchWeather(spot.latitude, spot.longitude)
        .then((w) => {
          const s = skyScore(w);
          wx.textContent = `${scoreLabel(s)} sky · ${Math.round(w.temperature)}° · ${Math.round(w.cloudCover)}% cloud`;
        })
        .catch(() => {
          wx.textContent = "Sky forecast unavailable";
        });
    });
  }

  function syncMarkers(map: import("maplibre-gl").Map, list: typeof spots) {
    import("maplibre-gl").then(({ Marker }) => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      for (const spot of list ?? []) {
        const el = document.createElement("button");
        el.type = "button";
        el.title = spot.name;
        el.style.cssText =
          `width:16px;height:16px;border-radius:50%;` +
          `border:2px solid #fff;background:${typeColor[spot.type]};` +
          `cursor:pointer;box-shadow:0 2px 4px rgba(0,0,0,.45);padding:0;`;
        el.addEventListener("click", () => openPopup(map, spot));
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
      popupRef.current?.remove();
      popupRef.current = null;
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  return (
    <View style={styles.root}>
      {/*
       * A real <div> is necessary so maplibre-gl can receive an HTMLElement, and
       * it is rendered UNCONDITIONALLY (never behind a loading/error early return)
       * so the callback ref always fires and the map can initialise. This file is
       * web-only, so DOM elements are valid here.
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
