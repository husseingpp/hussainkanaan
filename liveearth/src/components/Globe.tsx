import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import Globe, { type GlobeMethods } from "react-globe.gl";
import type { GlobePoint } from "../lib/transform";
import { buildHypsometricCanvas } from "../lib/relief";

// Grayscale elevation heightmap (reliable + CORS-enabled via unpkg). Used as the
// single source for both the 3D relief (displacement) and the hypsometric colour.
const HEIGHT_IMG = "https://unpkg.com/three-globe/example/img/earth-topology.png";

// Coarser mesh on touch devices to protect performance; dense on desktop so the
// displacement reads as real terrain.
const COARSE_POINTER =
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(pointer: coarse)").matches;
const CURVATURE = COARSE_POINTER ? 0.8 : 0.4; // segments = 360 / value
const DISPLACEMENT = 5; // relief height on three-globe's GLOBE_RADIUS (100)

interface Props {
  points: GlobePoint[];
  selectedId: string | null;
  onSelect: (point: GlobePoint) => void;
}

export function GlobeView({ points, selectedId, onSelect }: Props) {
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  // Our own material: a stylized relief surface (no Earth photo).
  const materialRef = useRef<THREE.MeshPhongMaterial | null>(null);
  if (!materialRef.current) {
    materialRef.current = new THREE.MeshPhongMaterial({
      color: 0x06121f,
      emissive: 0xffffff,
      emissiveIntensity: 0.5,
      shininess: 2,
    });
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

  // Load the heightmap once → real 3D relief (displacement/bump) + elevation tints.
  useEffect(() => {
    const mat = materialRef.current!;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      // Displacement + bump push the actual vertices out → 3D mountains/valleys.
      const height = new THREE.Texture(img);
      height.needsUpdate = true;
      mat.displacementMap = height;
      mat.displacementScale = DISPLACEMENT;
      mat.bumpMap = height;
      mat.bumpScale = 1.2;

      // Colour the surface from elevation alone (cyberpunk cyan → magenta ramp).
      // The same neon map is used as an emissive map so the land self-illuminates
      // against the dark oceans for a glowing, cyberpunk look.
      try {
        const colorTex = new THREE.CanvasTexture(buildHypsometricCanvas(img, 2048));
        colorTex.colorSpace = THREE.SRGBColorSpace;
        colorTex.anisotropy = 8;
        mat.map = colorTex;
        mat.emissiveMap = colorTex;
        mat.color = new THREE.Color(0xffffff);
      } catch {
        /* canvas unavailable — keep the flat base colour */
      }
      mat.needsUpdate = true;
    };
    img.onerror = () => {
      /* heightmap unreachable — leave a plain coloured sphere */
    };
    img.src = HEIGHT_IMG;
  }, []);

  // Runs once the globe is initialised: render quality, lighting, no auto-spin.
  const handleReady = () => {
    const g = globeRef.current;
    if (!g) return;

    const renderer = g.renderer();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const mat = materialRef.current!;
    for (const tex of [mat.map, mat.bumpMap, mat.displacementMap]) {
      if (tex) {
        tex.anisotropy = maxAniso;
        tex.needsUpdate = true;
      }
    }

    // Keep a directional light for relief shading, but let the neon emissive
    // glow lead; dim the ambient so the dark side stays moody.
    for (const light of g.lights()) {
      if (light instanceof THREE.DirectionalLight) light.intensity = 0.9;
      if (light instanceof THREE.AmbientLight) light.intensity = 0.35;
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
        globeCurvatureResolution={CURVATURE}
        showAtmosphere
        atmosphereColor="#ff2bd6"
        atmosphereAltitude={0.28}
        pointsData={points}
        pointLat={(d) => (d as GlobePoint).lat}
        pointLng={(d) => (d as GlobePoint).lng}
        pointColor={(d) => (d as GlobePoint).color}
        pointAltitude={(d) => ((d as GlobePoint).id === selectedId ? 0.14 : 0.06)}
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
