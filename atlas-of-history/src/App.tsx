import { useState, useEffect, useCallback, useRef } from 'react';
import { GlobeView } from './components/GlobeView';
import { Sidebar } from './components/Sidebar';
import { sampleFacts, Fact } from './data/sampleFacts';

export default function App() {
  const [selectedFact, setSelectedFact] = useState<Fact | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const onResize = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        setDimensions({ width: window.innerWidth, height: window.innerHeight });
      });
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const handlePointClick = useCallback((fact: Fact) => {
    setSelectedFact(fact);
    setSidebarOpen(true);
  }, []);

  const handleSidebarClose = useCallback(() => {
    setSelectedFact(null);
  }, []);

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#0a0f1e]">
      <GlobeView
        facts={sampleFacts}
        onPointClick={handlePointClick}
        width={dimensions.width}
        height={dimensions.height}
      />

      {/* Empty-state hint */}
      {!sidebarOpen && (
        <p className="absolute bottom-6 left-1/2 -translate-x-1/2 text-slate-400 text-sm pointer-events-none select-none">
          Click a pin to read a historical fact
        </p>
      )}

      <Sidebar
        open={sidebarOpen}
        onToggle={() => setSidebarOpen((v) => !v)}
        selectedFact={selectedFact}
        onClose={handleSidebarClose}
      />
    </div>
  );
}
