import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import Globe, { type GlobeMethods } from "react-globe.gl";
import type { GlobePoint } from "../lib/transform";

// Base textures — reliable + CORS-enabled, so they always load (no blank globe).
const NIGHT_IMG = "https://unpkg.com/three-globe/example/img/earth-night.jpg";
const BUMP_IMG = "https://unpkg.com/three-globe/example/img/earth-topology.png";
// High-resolution (8K) night map, swapped in on top of the base once/if it loads.
const HI_RES_NIGHT =
  "https://www.solarsystemscope.com/textures/download/8k_earth_nightmap.jpg";

interface Props {
  points: GlobePoint[];
  selectedId: string | null;
  onSelect: (point: GlobePoint) => void;
}

export function GlobeView({ points, selectedId, onSelect }: Props) {
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  // Our own globe material so we control the texture quality + can upgrade it.
  const materialRef = useRef<THREE.MeshPhongMaterial | null>(null);
  if (!materialRef.current) {
    materialRef.current = new THREE.MeshPhongMaterial({ color: 0xffffff });
  }

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

  // Load textures once: show the reliable base, then upgrade to the 8K night map.
  useEffect(() => {
    const mat = materialRef.current!;
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin("anonymous");

    const applyMap = (tex: THREE.Texture) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 16;
      mat.map = tex;
      mat.needsUpdate = true;
    };

    // Base loads first (fast), then we attempt the high-res upgrade on top.
    loader.load(NIGHT_IMG, (base) => {
      applyMap(base);
      loader.load(HI_RES_NIGHT, applyMap, undefined, () => {
        /* host unreachable / CORS — keep the base texture */
      });
    });

    loader.load(BUMP_IMG, (bump) => {
      bump.anisotropy = 16;
      mat.bumpMap = bump;
      mat.bumpScale = 4;
      mat.needsUpdate = true;
    });
  }, []);

  // Runs once the globe is initialised: render quality + no auto-spin.
  const handleReady = () => {
    const g = globeRef.current;
    if (!g) return;

    // Crisper rendering on high-DPI screens (capped at 2x for performance).
    const renderer = g.renderer();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const mat = materialRef.current!;
    for (const tex of [mat.map, mat.bumpMap]) {
      if (tex) {
        tex.anisotropy = maxAniso;
        tex.needsUpdate = true;
      }
    }

    // No auto-spin — the globe only moves when the user drags it.
    const controls = g.controls();
    controls.autoRotate = false;
    controls.enableDamping = true;
    g.pointOfView({ altitude: 2.5 });
  };

  return (
    <div ref={containerRef} className="absolute inset-0">
      <Globe
        ref={globeRef}
        onGlobeReady={handleReady}
        width={size.width || undefined}
        height={size.height || undefined}
        backgroundColor="rgba(0,0,0,0)"
        globeMaterial={materialRef.current}
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
