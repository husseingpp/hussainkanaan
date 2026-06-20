import { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import Globe, { GlobeMethods } from 'react-globe.gl';
import { Fact } from '../data/sampleFacts';

export interface DraftPin {
  lat: number;
  lng: number;
}

export interface FlyTo {
  lat: number;
  lng: number;
}

interface GlobeViewProps {
  facts: Fact[];
  draftPin: DraftPin | null;
  paused: boolean;
  flyTo: FlyTo | null;
  onPointClick: (fact: Fact) => void;
  onGlobeClick: (lat: number, lng: number) => void;
  width: number;
  height: number;
}

type GlobePoint = (Fact & { __draft?: false }) | (DraftPin & { __draft: true; id: '__draft' });

export function GlobeView({
  facts,
  draftPin,
  paused,
  flyTo,
  onPointClick,
  onGlobeClick,
  width,
  height,
}: GlobeViewProps) {
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return;
    globe.controls().autoRotateSpeed = 0.4;
    globe.controls().enableDamping = true;
    globe.pointOfView({ altitude: 2.2 }, 0);
  }, []);

  // Pause auto-rotation while a draft/panel is open.
  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return;
    globe.controls().autoRotate = !paused;
  }, [paused]);

  // Fly the camera to a requested point (e.g. a country selected in the list).
  useEffect(() => {
    const globe = globeRef.current;
    if (!globe || !flyTo) return;
    globe.pointOfView({ lat: flyTo.lat, lng: flyTo.lng, altitude: 1.6 }, 1000);
  }, [flyTo]);

  const points = useMemo<GlobePoint[]>(() => {
    const base = facts.map((f) => ({ ...f, __draft: false as const }));
    if (draftPin) {
      return [...base, { ...draftPin, __draft: true as const, id: '__draft' as const }];
    }
    return base;
  }, [facts, draftPin]);

  const pointColor = useCallback(
    (obj: object) => {
      const p = obj as GlobePoint;
      if (p.__draft) return '#22d3ee';
      return hovered === p.id ? '#facc15' : '#f97316';
    },
    [hovered],
  );

  return (
    <Globe
      ref={globeRef}
      width={width}
      height={height}
      backgroundColor="rgba(0,0,0,0)"
      globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
      bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
      atmosphereColor="#3b82f6"
      atmosphereAltitude={0.15}
      pointsData={points}
      pointLat={(obj) => (obj as GlobePoint).lat}
      pointLng={(obj) => (obj as GlobePoint).lng}
      pointColor={pointColor}
      pointAltitude={(obj) => ((obj as GlobePoint).__draft ? 0.04 : 0.01)}
      pointRadius={(obj) => ((obj as GlobePoint).__draft ? 0.7 : 0.5)}
      pointLabel={(obj) => {
        const p = obj as GlobePoint;
        if (p.__draft) return '';
        const f = p as Fact;
        return `<div style="background:#1e293b;color:#f0f4ff;padding:6px 10px;border-radius:6px;font-size:13px;pointer-events:none;">
          <strong>${f.title}</strong><br/>
          <span style="opacity:0.7">${f.country_name}${f.year != null ? ` · ${f.year < 0 ? Math.abs(f.year) + ' BCE' : f.year + ' CE'}` : ''}</span>
        </div>`;
      }}
      onPointClick={(obj) => {
        const p = obj as GlobePoint;
        if (!p.__draft) onPointClick(p as Fact);
      }}
      onPointHover={(obj) => {
        const p = obj as GlobePoint | null;
        setHovered(p && !p.__draft ? p.id : null);
      }}
      onGlobeClick={({ lat, lng }) => onGlobeClick(lat, lng)}
    />
  );
}
