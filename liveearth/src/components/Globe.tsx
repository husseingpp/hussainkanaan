import { useEffect, useRef, useState } from "react";
import Globe, { type GlobeMethods } from "react-globe.gl";
import type { GlobePoint } from "../lib/transform";

// Textures from the three-globe examples (loaded by the browser at runtime).
const GLOBE_IMG = "https://unpkg.com/three-globe/example/img/earth-night.jpg";
const BUMP_IMG = "https://unpkg.com/three-globe/example/img/earth-topology.png";

interface Props {
  points: GlobePoint[];
  selectedId: string | null;
  onSelect: (point: GlobePoint) => void;
}

export function GlobeView({ points, selectedId, onSelect }: Props) {
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  // Keep the canvas sized to its container (responsive + mobile).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Auto-rotate + a pleasant starting zoom once the globe is mounted.
  useEffect(() => {
    const g = globeRef.current;
    if (!g) return;
    const controls = g.controls();
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.45;
    controls.enableDamping = true;
    g.pointOfView({ altitude: 2.5 });
  }, []);

  return (
    <div ref={containerRef} className="absolute inset-0">
      <Globe
        ref={globeRef}
        width={size.width || undefined}
        height={size.height || undefined}
        backgroundColor="rgba(0,0,0,0)"
        globeImageUrl={GLOBE_IMG}
        bumpImageUrl={BUMP_IMG}
        showAtmosphere
        atmosphereColor="#4c8dff"
        atmosphereAltitude={0.18}
        pointsData={points}
        pointLat={(d) => (d as GlobePoint).lat}
        pointLng={(d) => (d as GlobePoint).lng}
        pointColor={(d) => (d as GlobePoint).color}
        pointAltitude={(d) => ((d as GlobePoint).id === selectedId ? 0.12 : 0.02)}
        pointRadius={(d) => ((d as GlobePoint).id === selectedId ? 0.55 : 0.32)}
        pointResolution={6}
        pointLabel={(d) =>
          `<div class="globe-tip">${escapeHtml((d as GlobePoint).title)}</div>`
        }
        onPointClick={(d) => onSelect(d as GlobePoint)}
      />
    </div>
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
