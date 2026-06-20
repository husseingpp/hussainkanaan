import { Fact } from '../data/sampleFacts';

interface FactCardProps {
  fact: Fact;
  canEdit: boolean;
  onEdit: (fact: Fact) => void;
  onBack: () => void;
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
    // ignore malformed URLs
  }
  return 'Open reference →';
}

export function FactCard({ fact, canEdit, onEdit, onBack }: FactCardProps) {
  return (
    <div>
      <button
        onClick={onBack}
        className="text-xs text-slate-400 hover:text-slate-200 mb-4 flex items-center gap-1"
      >
        ← Back
      </button>

      <p className="text-xs font-medium text-orange-400 uppercase tracking-wider mb-1">
        {fact.country_name}
        {fact.year !== null && fact.year !== undefined && (
          <span className="text-slate-500 ml-2 normal-case">{formatYear(fact.year)}</span>
        )}
      </p>

      <h2 className="text-base font-semibold text-slate-100 mb-3">{fact.title}</h2>

      {fact.image_url && (
        <img
          src={fact.image_url}
          alt={fact.title}
          className="w-full rounded-lg mb-3 object-cover max-h-48"
        />
      )}

      <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">{fact.body}</p>

      {fact.reference_url && (
        <a
          href={fact.reference_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block mt-4 text-sm text-blue-400 hover:text-blue-300 underline underline-offset-2"
        >
          {referenceLabel(fact)}
        </a>
      )}

      {canEdit && (
        <button
          onClick={() => onEdit(fact)}
          className="mt-5 w-full bg-slate-800 hover:bg-slate-700 text-slate-100 text-sm font-medium py-2 rounded transition-colors"
        >
          Edit fact
        </button>
      )}
    </div>
  );
}
