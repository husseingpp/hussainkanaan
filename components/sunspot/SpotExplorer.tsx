"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import "maplibre-gl/dist/maplibre-gl.css";
import { SUPABASE_URL, SUPABASE_ANON_KEY, MAP_STYLE } from "./config";

/** A row from the live `spots` table (approved, public-readable). */
type Spot = {
  id: string;
  name: string;
  description: string | null;
  latitude: number;
  longitude: number;
  type: "sunrise" | "sunset" | "both";
  best_months: string[] | null;
  average_rating: number | null;
  ratings_count: number | null;
};

type SortKey = "rating" | "popular" | "name";

const TYPE_LABEL: Record<Spot["type"], string> = {
  sunrise: "Sunrise",
  sunset: "Sunset",
  both: "Sunrise & sunset",
};

const SORTS: { key: SortKey; label: string }[] = [
  { key: "rating", label: "Top rated" },
  { key: "popular", label: "Most rated" },
  { key: "name", label: "A–Z" },
];

export function SpotExplorer() {
  const [spots, setSpots] = useState<Spot[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>("rating");
  const [active, setActive] = useState<string | null>(null);

  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import("maplibre-gl").Map | null>(null);
  const markersRef = useRef<import("maplibre-gl").Marker[]>([]);

  // Load approved spots straight from Supabase — public SELECT, no auth needed.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          auth: { persistSession: false },
        });
        const { data, error: qErr } = await supabase
          .from("spots")
          .select(
            "id,name,description,latitude,longitude,type,best_months,average_rating,ratings_count",
          )
          .eq("status", "approved");
        if (qErr) throw qErr;
        if (!cancelled) setSpots((data as Spot[]) ?? []);
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Could not reach the database.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const sorted = useMemo(() => {
    const list = [...(spots ?? [])];
    if (sort === "rating")
      list.sort((a, b) => (b.average_rating ?? 0) - (a.average_rating ?? 0));
    else if (sort === "popular")
      list.sort((a, b) => (b.ratings_count ?? 0) - (a.ratings_count ?? 0));
    else list.sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [spots, sort]);

  // Build the MapLibre map + markers once spots arrive.
  useEffect(() => {
    if (!mapEl.current || !spots || spots.length === 0 || mapRef.current) return;
    let disposed = false;
    (async () => {
      const { Map: MlMap, Marker, NavigationControl } = await import("maplibre-gl");
      if (disposed || !mapEl.current || mapRef.current) return;
      const map = new MlMap({
        container: mapEl.current,
        style: MAP_STYLE,
        center: [20, 25],
        zoom: 1.1,
        attributionControl: { compact: true },
      });
      map.addControl(new NavigationControl({ showCompass: false }), "top-right");
      // Surface a failed style/tiles load to the existing fallback UI instead of
      // leaving a blank canvas.
      map.on("error", (e) => {
        console.warn("MapLibre error", e?.error ?? e);
        setError("the basemap failed to load");
      });
      mapRef.current = map;
      for (const s of spots) {
        const el = document.createElement("button");
        el.className = `gh-marker gh-marker-${s.type}`;
        el.type = "button";
        el.title = s.name;
        el.setAttribute("aria-label", s.name);
        el.addEventListener("click", () => setActive(s.id));
        markersRef.current.push(
          new Marker({ element: el }).setLngLat([s.longitude, s.latitude]).addTo(map),
        );
      }
    })();
    return () => {
      disposed = true;
    };
  }, [spots]);

  // Tear down the map on unmount.
  useEffect(() => {
    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Fly to the selected spot.
  useEffect(() => {
    if (!active || !mapRef.current || !spots) return;
    const s = spots.find((x) => x.id === active);
    if (s) mapRef.current.flyTo({ center: [s.longitude, s.latitude], zoom: 5, speed: 0.9 });
  }, [active, spots]);

  if (error) {
    return (
      <div className="gh-live-fallback">
        <p>
          The live map is offline right now ({error}). The app reads approved spots
          directly from Supabase with the public key — security is enforced by row-level
          security on the database.
        </p>
      </div>
    );
  }

  const loading = spots === null;

  return (
    <div className="gh-explorer">
      <div className="gh-explorer-bar">
        <span className="gh-live-dot" aria-hidden="true" />
        <span className="gh-live-label">
          {loading
            ? "Loading live spots…"
            : `${spots.length} approved spot${spots.length === 1 ? "" : "s"} · live from Supabase`}
        </span>
        <div className="gh-sorts" role="group" aria-label="Sort spots">
          {SORTS.map((s) => (
            <button
              key={s.key}
              type="button"
              className={"gh-sort" + (sort === s.key ? " is-active" : "")}
              onClick={() => setSort(s.key)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="gh-explorer-grid">
        <div className="gh-map" ref={mapEl} aria-label="Map of sunrise and sunset spots">
          {loading && <div className="gh-map-skel">Loading map…</div>}
        </div>

        <ul className="gh-spotlist">
          {loading &&
            Array.from({ length: 5 }).map((_, i) => (
              <li key={i} className="gh-spotcard gh-spotcard-skel" />
            ))}
          {!loading &&
            sorted.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  className={"gh-spotcard" + (active === s.id ? " is-active" : "")}
                  onClick={() => setActive(s.id)}
                >
                  <span className={`gh-spot-type gh-spot-type-${s.type}`}>
                    {TYPE_LABEL[s.type]}
                  </span>
                  <span className="gh-spot-name">{s.name}</span>
                  <span className="gh-spot-meta">
                    <span className="gh-star">★ {(s.average_rating ?? 0).toFixed(1)}</span>
                    <span className="gh-count">{s.ratings_count ?? 0} ratings</span>
                  </span>
                  {s.best_months && s.best_months.length > 0 && (
                    <span className="gh-spot-months">Best: {s.best_months.join(", ")}</span>
                  )}
                </button>
              </li>
            ))}
        </ul>
      </div>
    </div>
  );
}
