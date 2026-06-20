import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { User } from '@supabase/supabase-js';
import { GlobeView, type FlyTo } from './components/GlobeView';
import { Sidebar } from './components/Sidebar';
import { AddFactPanel, type FactDraft } from './components/AddFactPanel';
import { useFacts } from './hooks/useFacts';
import { supabase } from './lib/supabase';
import { detectCountry } from './lib/countries';
import type { Fact } from './data/sampleFacts';

// Spread pins that share (nearly) the same coordinates into a small ring so
// stacked facts stay individually clickable.
function clusterOffset(facts: Fact[]): Fact[] {
  const groups = new Map<string, Fact[]>();
  for (const f of facts) {
    const key = `${f.lat.toFixed(3)},${f.lng.toFixed(3)}`;
    const group = groups.get(key);
    if (group) group.push(f);
    else groups.set(key, [f]);
  }

  const result: Fact[] = [];
  for (const group of groups.values()) {
    if (group.length === 1) {
      result.push(group[0]);
      continue;
    }
    const radius = 0.4; // degrees
    group.forEach((f, i) => {
      const angle = (2 * Math.PI * i) / group.length;
      result.push({
        ...f,
        lat: f.lat + radius * Math.sin(angle),
        lng: f.lng + radius * Math.cos(angle),
      });
    });
  }
  return result;
}

export default function App() {
  const { facts, loading, error, upsertFact, removeFact } = useFacts();
  const [selectedFact, setSelectedFact] = useState<Fact | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [draft, setDraft] = useState<FactDraft | null>(null);
  const [editing, setEditing] = useState<Fact | null>(null);
  const [oceanHint, setOceanHint] = useState(false);
  const [query, setQuery] = useState('');
  const [flyTo, setFlyTo] = useState<FlyTo | null>(null);
  const [yearRange, setYearRange] = useState<[number, number] | null>(null);
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });
  const rafRef = useRef<number | null>(null);
  const oceanTimer = useRef<number | null>(null);

  const panelOpen = draft !== null || editing !== null;

  const searchFiltered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return facts;
    return facts.filter(
      (f) =>
        f.title.toLowerCase().includes(q) ||
        f.country_name.toLowerCase().includes(q) ||
        f.body.toLowerCase().includes(q),
    );
  }, [facts, query]);

  const yearBounds = useMemo<[number, number] | null>(() => {
    const years = facts.filter((f) => f.year != null).map((f) => f.year as number);
    if (years.length === 0) return null;
    return [Math.min(...years), Math.max(...years)];
  }, [facts]);

  const undatedCount = useMemo(() => facts.filter((f) => f.year == null).length, [facts]);

  // Undated facts are always shown; the slider only constrains dated facts.
  const filteredFacts = useMemo(() => {
    if (!yearRange) return searchFiltered;
    const [lo, hi] = yearRange;
    return searchFiltered.filter((f) => f.year == null || (f.year >= lo && f.year <= hi));
  }, [searchFiltered, yearRange]);

  const globeFacts = useMemo(() => clusterOffset(filteredFacts), [filteredFacts]);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

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

  const handleSelectCountry = useCallback(
    (countryCode: string) => {
      const inCountry = filteredFacts.filter((f) => f.country_code === countryCode);
      if (inCountry.length === 0) return;

      const lat = inCountry.reduce((sum, f) => sum + f.lat, 0) / inCountry.length;
      const lng = inCountry.reduce((sum, f) => sum + f.lng, 0) / inCountry.length;
      setFlyTo({ lat, lng });

      // One fact: open it directly. Several: fly there and let the user pick a pin.
      setSelectedFact(inCountry.length === 1 ? inCountry[0] : null);
      setSidebarOpen(true);
    },
    [filteredFacts],
  );

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
        facts={globeFacts}
        draftPin={draft ? { lat: draft.lat, lng: draft.lng } : null}
        paused={panelOpen || reducedMotion}
        flyTo={flyTo}
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
        <p className="absolute bottom-6 left-1/2 -translate-x-1/2 text-slate-400 text-sm pointer-events-none select-none text-center px-4">
          {facts.length === 0
            ? 'Click a country to add the first fact.'
            : globeFacts.length === 0
              ? 'No facts match the current filters.'
              : 'Click a country to add a fact, or a pin to read one.'}
        </p>
      )}

      <Sidebar
        open={sidebarOpen}
        onToggle={() => setSidebarOpen((v) => !v)}
        selectedFact={selectedFact}
        onClose={() => setSelectedFact(null)}
        user={user}
        facts={filteredFacts}
        query={query}
        onQueryChange={setQuery}
        onSelectCountry={handleSelectCountry}
        onEdit={handleEditRequest}
        yearBounds={yearBounds}
        yearRange={yearRange ?? yearBounds ?? [0, 0]}
        onYearChange={setYearRange}
        onYearReset={() => setYearRange(null)}
        undatedCount={undatedCount}
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
