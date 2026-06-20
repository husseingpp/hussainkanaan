import { useState, useEffect, useCallback, useRef } from 'react';
import type { User } from '@supabase/supabase-js';
import { GlobeView } from './components/GlobeView';
import { Sidebar } from './components/Sidebar';
import { useFacts } from './hooks/useFacts';
import { supabase } from './lib/supabase';
import type { Fact } from './data/sampleFacts';

export default function App() {
  const { facts, loading, error } = useFacts();
  const [selectedFact, setSelectedFact] = useState<Fact | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

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
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center z-40 pointer-events-none">
          <span className="text-slate-400 text-sm animate-pulse">Loading facts…</span>
        </div>
      )}

      {error && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 bg-red-900/80 border border-red-700 text-red-200 text-sm px-4 py-2 rounded-lg max-w-sm text-center">
          {error}
        </div>
      )}

      <GlobeView
        facts={facts}
        onPointClick={handlePointClick}
        width={dimensions.width}
        height={dimensions.height}
      />

      {!sidebarOpen && !loading && facts.length === 0 && !error && (
        <p className="absolute bottom-6 left-1/2 -translate-x-1/2 text-slate-400 text-sm pointer-events-none select-none">
          Click a country to add the first fact.
        </p>
      )}

      {!sidebarOpen && !loading && facts.length > 0 && (
        <p className="absolute bottom-6 left-1/2 -translate-x-1/2 text-slate-400 text-sm pointer-events-none select-none">
          Click a pin to read a historical fact
        </p>
      )}

      <Sidebar
        open={sidebarOpen}
        onToggle={() => setSidebarOpen((v) => !v)}
        selectedFact={selectedFact}
        onClose={handleSidebarClose}
        user={user}
        factsCount={facts.length}
      />
    </div>
  );
}
