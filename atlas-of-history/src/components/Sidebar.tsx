import type { User } from '@supabase/supabase-js';
import { Fact } from '../data/sampleFacts';
import { AuthPanel } from './AuthPanel';

interface SidebarProps {
  open: boolean;
  onToggle: () => void;
  selectedFact: Fact | null;
  onClose: () => void;
  user: User | null;
  factsCount: number;
}

function formatYear(year: number | null): string {
  if (year === null) return '';
  return year < 0 ? `${Math.abs(year)} BCE` : `${year} CE`;
}

function referenceLabel(fact: Fact): string {
  if (!fact.reference_url) return '';
  if (fact.reference_label) return `${fact.reference_label} →`;
  try {
    const host = new URL(fact.reference_url).hostname;
    if (host.includes('wikipedia')) return 'Read on Wikipedia →';
  } catch {
    // ignore
  }
  return 'Open reference →';
}

export function Sidebar({ open, onToggle, selectedFact, onClose, user, factsCount }: SidebarProps) {
  return (
    <>
      {/* Toggle tab */}
      <button
        aria-label={open ? 'Close sidebar' : 'Open sidebar'}
        onClick={onToggle}
        className="fixed top-4 right-4 z-30 flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-100 px-3 py-2 rounded-lg text-sm font-medium transition-colors shadow-lg"
      >
        <span className="text-base">{open ? '✕' : '☰'}</span>
        <span>{open ? 'Close' : 'Facts'}</span>
      </button>

      {/* Sidebar panel */}
      <aside
        className={`fixed top-0 right-0 h-full w-80 bg-slate-900/95 backdrop-blur border-l border-slate-700 z-20 flex flex-col transition-transform duration-300 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="p-5 border-b border-slate-700 space-y-3">
          <div>
            <h1 className="text-lg font-semibold text-slate-100">Atlas of History</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {factsCount === 0 ? 'No facts yet' : `${factsCount} fact${factsCount !== 1 ? 's' : ''} on the globe`}
            </p>
          </div>
          <AuthPanel user={user} />
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {selectedFact ? (
            <div>
              <button
                onClick={onClose}
                className="text-xs text-slate-400 hover:text-slate-200 mb-4 flex items-center gap-1"
              >
                ← Back
              </button>

              <p className="text-xs font-medium text-orange-400 uppercase tracking-wider mb-1">
                {selectedFact.country_name}
                {selectedFact.year !== null && (
                  <span className="text-slate-500 ml-2 normal-case">
                    {formatYear(selectedFact.year)}
                  </span>
                )}
              </p>

              <h2 className="text-base font-semibold text-slate-100 mb-3">
                {selectedFact.title}
              </h2>

              {selectedFact.image_url && (
                <img
                  src={selectedFact.image_url}
                  alt={selectedFact.title}
                  className="w-full rounded-lg mb-3 object-cover max-h-48"
                />
              )}

              <p className="text-sm text-slate-300 leading-relaxed">{selectedFact.body}</p>

              {selectedFact.reference_url && (
                <a
                  href={selectedFact.reference_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-4 text-sm text-blue-400 hover:text-blue-300 underline underline-offset-2"
                >
                  {referenceLabel(selectedFact)}
                </a>
              )}
            </div>
          ) : (
            <div className="text-sm text-slate-400 space-y-2">
              {factsCount === 0 ? (
                <p>Click a country to add the first fact.</p>
              ) : (
                <p>Click a pin on the globe to read a historical fact.</p>
              )}
            </div>
          )}
        </div>
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
