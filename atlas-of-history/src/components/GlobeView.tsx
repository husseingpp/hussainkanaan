import { useRef, useEffect, useCallback, useState } from 'react';
import Globe, { GlobeMethods } from 'react-globe.gl';
import { Fact } from '../data/sampleFacts';

interface GlobeViewProps {
  facts: Fact[];
  onPointClick: (fact: Fact) => void;
  width: number;
  height: number;
}

export function GlobeView({ facts, onPointClick, width, height }: GlobeViewProps) {
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const [hovered, setHovered] = useState<Fact | null>(null);

  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return;

    globe.controls().autoRotate = true;
    globe.controls().autoRotateSpeed = 0.4;
    globe.controls().enableDamping = true;

    globe.pointOfView({ altitude: 2.2 }, 0);
  }, []);

  const pointColor = useCallback(
    (obj: object) => {
      const fact = obj as Fact;
      return hovered?.id === fact.id ? '#facc15' : '#f97316';
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
      pointsData={facts}
      pointLat={(obj) => (obj as Fact).lat}
      pointLng={(obj) => (obj as Fact).lng}
      pointColor={pointColor}
      pointAltitude={0.01}
      pointRadius={0.5}
      pointLabel={(obj) => {
        const f = obj as Fact;
        return `<div style="background:#1e293b;color:#f0f4ff;padding:6px 10px;border-radius:6px;font-size:13px;pointer-events:none;">
          <strong>${f.title}</strong><br/>
          <span style="opacity:0.7">${f.country_name}${f.year !== null ? ` · ${f.year < 0 ? Math.abs(f.year) + ' BCE' : f.year + ' CE'}` : ''}</span>
        </div>`;
      }}
      onPointClick={(obj) => onPointClick(obj as Fact)}
      onPointHover={(obj) => setHovered(obj ? (obj as Fact) : null)}
    />
  );
}
