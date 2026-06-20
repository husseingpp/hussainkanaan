import type { User } from '@supabase/supabase-js';
import { Fact } from '../data/sampleFacts';
import { AuthPanel } from './AuthPanel';
import { FactCard } from './FactCard';
import { CountryList } from './CountryList';
import { TimelineSlider } from './TimelineSlider';

interface SidebarProps {
  open: boolean;
  onToggle: () => void;
  selectedFact: Fact | null;
  onClose: () => void;
  user: User | null;
  isAdmin: boolean;
  facts: Fact[];
  query: string;
  onQueryChange: (q: string) => void;
  onSelectCountry: (countryCode: string) => void;
  onEdit: (fact: Fact) => void;
  yearBounds: [number, number] | null;
  yearRange: [number, number];
  onYearChange: (range: [number, number]) => void;
  onYearReset: () => void;
  undatedCount: number;
}

export function Sidebar({
  open,
  onToggle,
  selectedFact,
  onClose,
  user,
  isAdmin,
  facts,
  query,
  onQueryChange,
  onSelectCountry,
  onEdit,
  yearBounds,
  yearRange,
  onYearChange,
  onYearReset,
  undatedCount,
}: SidebarProps) {
  const canEdit = !!(selectedFact && isAdmin);
  const factsCount = facts.length;

  return (
    <>
      {/* Toggle tab */}
      <button
        aria-label={open ? 'Close sidebar' : 'Open sidebar'}
        onClick={onToggle}
        className="fixed top-4 right-4 z-30 flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-100 px-3 py-2 rounded-lg text-sm font-medium transition-colors shadow-lg"
      >
        <span className="text-base">{open ? '✕' : '☰'}</span>
        <span>{open ? 'Close' : 'Browse'}</span>
      </button>

      {/* Sidebar panel */}
      <aside
        className={`fixed top-0 right-0 h-full w-80 max-w-full bg-slate-900/95 backdrop-blur border-l border-slate-700 z-20 flex flex-col transition-transform duration-300 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="p-5 border-b border-slate-700 space-y-3">
          <div>
            <h1 className="text-lg font-semibold text-slate-100">Atlas of History</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {factsCount === 0
                ? 'No facts yet'
                : `${factsCount} fact${factsCount !== 1 ? 's' : ''} on the globe`}
            </p>
          </div>
          <AuthPanel user={user} />
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {selectedFact ? (
            <FactCard
              fact={selectedFact}
              canEdit={canEdit}
              onEdit={onEdit}
              onBack={onClose}
            />
          ) : (
            <CountryList
              facts={facts}
              query={query}
              onQueryChange={onQueryChange}
              onSelectCountry={onSelectCountry}
            />
          )}
        </div>

        {yearBounds && (
          <div className="p-5 border-t border-slate-700">
            <TimelineSlider
              min={yearBounds[0]}
              max={yearBounds[1]}
              value={yearRange}
              onChange={onYearChange}
              onReset={onYearReset}
              undatedCount={undatedCount}
            />
          </div>
        )}
      </aside>

      {/* Backdrop on mobile */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-10 sm:hidden"
          onClick={onToggle}
          aria-hidden="true"
        />
      )}
    </>
  );
}
