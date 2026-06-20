interface TimelineSliderProps {
  min: number;
  max: number;
  value: [number, number];
  onChange: (range: [number, number]) => void;
  onReset: () => void;
  undatedCount: number;
}

function formatYear(year: number): string {
  return year < 0 ? `${Math.abs(year)} BCE` : `${year} CE`;
}

export function TimelineSlider({
  min,
  max,
  value,
  onChange,
  onReset,
  undatedCount,
}: TimelineSliderProps) {
  const [low, high] = value;

  // Single distinct year — nothing to scrub.
  if (min === max) {
    return (
      <div className="text-xs text-slate-400">
        <p className="font-medium text-slate-300 mb-0.5">Timeline</p>
        <p>All dated facts are from {formatYear(min)}.</p>
      </div>
    );
  }

  const span = max - min;
  const lowPct = ((low - min) / span) * 100;
  const highPct = ((high - min) / span) * 100;

  const handleLow = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = Math.min(Number(e.target.value), high);
    onChange([next, high]);
  };

  const handleHigh = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = Math.max(Number(e.target.value), low);
    onChange([low, next]);
  };

  const isFullRange = low === min && high === max;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-slate-300">Timeline</p>
        {!isFullRange && (
          <button
            onClick={onReset}
            className="text-xs text-slate-400 hover:text-slate-200 underline underline-offset-2"
          >
            Reset
          </button>
        )}
      </div>

      <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
        <span>{formatYear(low)}</span>
        <span>{formatYear(high)}</span>
      </div>

      <div className="relative h-6">
        {/* Base track */}
        <div className="absolute top-1/2 -translate-y-1/2 h-1 w-full rounded bg-slate-700" />
        {/* Selected segment */}
        <div
          className="absolute top-1/2 -translate-y-1/2 h-1 rounded bg-sky-500"
          style={{ left: `${lowPct}%`, width: `${Math.max(highPct - lowPct, 0)}%` }}
        />
        <input
          type="range"
          className="range-thumb"
          min={min}
          max={max}
          step={1}
          value={low}
          onChange={handleLow}
          aria-label="Earliest year"
        />
        <input
          type="range"
          className="range-thumb"
          min={min}
          max={max}
          step={1}
          value={high}
          onChange={handleHigh}
          aria-label="Latest year"
        />
      </div>

      {undatedCount > 0 && (
        <p className="text-[11px] text-slate-500 mt-2">
          {undatedCount} undated fact{undatedCount !== 1 ? 's' : ''} always shown.
        </p>
      )}
    </div>
  );
}
