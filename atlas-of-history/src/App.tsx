import { useState, useEffect, useCallback, useRef } from 'react';
import type { User } from '@supabase/supabase-js';
import { GlobeView } from './components/GlobeView';
import { Sidebar } from './components/Sidebar';
import { AddFactPanel, type FactDraft } from './components/AddFactPanel';
import { useFacts } from './hooks/useFacts';
import { supabase } from './lib/supabase';
import { detectCountry } from './lib/countries';
import type { Fact } from './data/sampleFacts';

export default function App() {
  const { facts, loading, error, upsertFact, removeFact } = useFacts();
  const [selectedFact, setSelectedFact] = useState<Fact | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [draft, setDraft] = useState<FactDraft | null>(null);
  const [editing, setEditing] = useState<Fact | null>(null);
  const [oceanHint, setOceanHint] = useState(false);
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });
  const rafRef = useRef<number | null>(null);
  const oceanTimer = useRef<number | null>(null);

  const panelOpen = draft !== null || editing !== null;

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

  const handleGlobeClick = useCallback((lat: number, lng: number) => {
    const country = detectCountry(lat, lng);
    if (!country) {
      setOceanHint(true);
      if (oceanTimer.current) clearTimeout(oceanTimer.current);
      oceanTimer.current = window.setTimeout(() => setOceanHint(false), 2500);
      return;
    }
    setOceanHint(false);
    setEditing(null);
    setSelectedFact(null);
    setDraft({ lat, lng, country_code: country.country_code, country_name: country.country_name });
  }, []);

  const handleClosePanel = useCallback(() => {
    setDraft(null);
    setEditing(null);
  }, []);

  const handleSaved = useCallback(
    (fact: Fact) => {
      upsertFact(fact);
      setDraft(null);
      setEditing(null);
      setSelectedFact(fact);
      setSidebarOpen(true);
    },
    [upsertFact],
  );

  const handleDeleted = useCallback(
    (id: string) => {
      removeFact(id);
      setDraft(null);
      setEditing(null);
      setSelectedFact((cur) => (cur && cur.id === id ? null : cur));
    },
    [removeFact],
  );

  const handleEditRequest = useCallback((fact: Fact) => {
    setDraft(null);
    setEditing(fact);
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
        draftPin={draft ? { lat: draft.lat, lng: draft.lng } : null}
        paused={panelOpen}
        onPointClick={handlePointClick}
        onGlobeClick={handleGlobeClick}
        width={dimensions.width}
        height={dimensions.height}
      />

      {oceanHint && (
        <p className="absolute top-4 left-1/2 -translate-x-1/2 z-40 bg-slate-800/90 border border-slate-600 text-slate-100 text-sm px-4 py-2 rounded-lg">
          Click on land to add a fact.
        </p>
      )}

      {!panelOpen && !sidebarOpen && !loading && !error && (
        <p className="absolute bottom-6 left-1/2 -translate-x-1/2 text-slate-400 text-sm pointer-events-none select-none">
          {facts.length === 0
            ? 'Click a country to add the first fact.'
            : 'Click a country to add a fact, or a pin to read one.'}
        </p>
      )}

      <Sidebar
        open={sidebarOpen}
        onToggle={() => setSidebarOpen((v) => !v)}
        selectedFact={selectedFact}
        onClose={() => setSelectedFact(null)}
        user={user}
        factsCount={facts.length}
        onEdit={handleEditRequest}
      />

      {panelOpen && (
        <AddFactPanel
          draft={draft}
          editing={editing}
          user={user}
          onClose={handleClosePanel}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  );
}
