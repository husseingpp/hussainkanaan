import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import Globe, { type GlobeMethods } from "react-globe.gl";
import type { GlobePoint } from "../lib/transform";
import { buildHypsometricCanvas, buildReliefTextures } from "../lib/relief";

// Elevation heightmap + land/ocean mask (reliable + CORS-enabled via unpkg).
const HEIGHT_IMG = "https://unpkg.com/three-globe/example/img/earth-topology.png";
const WATER_IMG = "https://unpkg.com/three-globe/example/img/earth-water.png";

// Lighter settings on touch devices for a smooth mobile experience.
const COARSE_POINTER =
  typeof window !== "undefined" &&
  ((typeof window.matchMedia === "function" &&
    window.matchMedia("(pointer: coarse)").matches) ||
    window.innerWidth < 768);
const CURVATURE = COARSE_POINTER ? 1.2 : 0.5; // segments = 360 / value
const TEX_MAX = COARSE_POINTER ? 1024 : 2048; // texture working resolution
const MAX_PIXEL_RATIO = COARSE_POINTER ? 1.5 : 2;
const DISPLACEMENT = 5; // relief height on three-globe's GLOBE_RADIUS (100)

// Load an <img> as a promise (CORS-enabled so the canvas stays untainted).
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

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

  // Build the relief surface: elevation + land/ocean mask → flat dark seas,
  // raised neon continents. Falls back to a topology-only tint if the mask fails.
  useEffect(() => {
    let cancelled = false;
    const mat = materialRef.current!;

    const applyColor = (canvas: HTMLCanvasElement) => {
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 8;
      mat.map = tex;
      mat.emissiveMap = tex;
      mat.color = new THREE.Color(0xffffff);
    };
    const applyDisplacement = (source: HTMLCanvasElement | HTMLImageElement) => {
      const tex =
        source instanceof HTMLCanvasElement
          ? new THREE.CanvasTexture(source)
          : new THREE.Texture(source);
      tex.needsUpdate = true;
      mat.displacementMap = tex;
      mat.displacementScale = DISPLACEMENT;
      mat.bumpMap = tex;
      mat.bumpScale = 1.2;
    };

    (async () => {
      try {
        const [topo, water] = await Promise.all([
          loadImage(HEIGHT_IMG),
          loadImage(WATER_IMG),
        ]);
        if (cancelled) return;
        const relief = buildReliefTextures(topo, water, TEX_MAX);
        if (relief) {
          applyColor(relief.colorCanvas);
          applyDisplacement(relief.dispCanvas);
        } else {
          applyColor(buildHypsometricCanvas(topo, TEX_MAX));
          applyDisplacement(topo);
        }
        mat.needsUpdate = true;
      } catch {
        // Mask unavailable → topology-only fallback (relief + tint, no flat seas).
        try {
          const topo = await loadImage(HEIGHT_IMG);
          if (cancelled) return;
          applyColor(buildHypsometricCanvas(topo, TEX_MAX));
          applyDisplacement(topo);
          mat.needsUpdate = true;
        } catch {
          /* leave the plain coloured sphere */
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Runs once the globe is initialised: render quality, lighting, no auto-spin.
  const handleReady = () => {
    const g = globeRef.current;
    if (!g) return;

    const renderer = g.renderer();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));
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

    // Smooth, no auto-spin — the globe only moves when the user drags it.
    const controls = g.controls();
    controls.autoRotate = false;
    controls.enableDamping = true;
    controls.dampingFactor = 0.12;
    controls.rotateSpeed = 0.6;
    controls.zoomSpeed = 0.7;
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
