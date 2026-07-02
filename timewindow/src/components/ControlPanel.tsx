import { useRef } from 'react';
import { loadFile } from '@/lib/loadFile';
import { DEFAULT_WINDOW, useStore } from '@/store/useStore';
import { fromDateInput, toDateInput } from '@/lib/format';

const DOW_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const LOT_PRESETS = [0.01, 0.1, 1, 10];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs uppercase tracking-wide text-text-dim">{label}</span>
      {children}
    </label>
  );
}

function TimeInput({
  hour,
  min,
  onChange,
}: {
  hour: number;
  min: number;
  onChange: (h: number, m: number) => void;
}) {
  const clamp = (v: number, max: number) => Math.max(0, Math.min(max, Number.isFinite(v) ? v : 0));
  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        min={0}
        max={23}
        value={hour}
        onChange={(e) => onChange(clamp(+e.target.value, 23), min)}
        className="num w-16 rounded-md border border-floor-border bg-floor-bg px-2 py-1.5 text-center text-text-primary"
        aria-label="Hour"
      />
      <span className="num text-text-dim">:</span>
      <input
        type="number"
        min={0}
        max={59}
        value={min}
        onChange={(e) => onChange(hour, clamp(+e.target.value, 59))}
        className="num w-16 rounded-md border border-floor-border bg-floor-bg px-2 py-1.5 text-center text-text-primary"
        aria-label="Minute"
      />
    </div>
  );
}

export function ControlPanel({ skippedDays }: { skippedDays: number }) {
  const window = useStore((s) => s.window);
  const patch = useStore((s) => s.patchWindow);
  const dataset = useStore((s) => s.dataset);
  const inputRef = useRef<HTMLInputElement>(null);

  const crossesMidnight =
    window.exitHour * 60 + window.exitMin <= window.entryHour * 60 + window.entryMin;

  const range = dataset?.importReport.dateRange;

  return (
    <div className="flex flex-col gap-5 p-4">
      <div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full rounded-md border border-floor-border bg-floor-bg px-3 py-2 text-sm text-text-primary hover:border-floor-gold"
        >
          Load new file
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.txt,.tsv,text/csv,text/plain"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && void loadFile(e.target.files[0])}
        />
      </div>

      <Field label="Entry time (close)">
        <TimeInput
          hour={window.entryHour}
          min={window.entryMin}
          onChange={(entryHour, entryMin) => patch({ entryHour, entryMin })}
        />
      </Field>

      <Field label="Exit time (open)">
        <TimeInput
          hour={window.exitHour}
          min={window.exitMin}
          onChange={(exitHour, exitMin) => patch({ exitHour, exitMin })}
        />
        {crossesMidnight && (
          <span className="mt-1 block text-xs text-floor-gold">Crosses midnight — exit on next day.</span>
        )}
      </Field>

      <Field label="Position size (lots)">
        <div className="flex flex-wrap gap-1.5">
          {LOT_PRESETS.map((lot) => (
            <button
              key={lot}
              type="button"
              onClick={() => patch({ positionSize: lot })}
              className={`num rounded-md border px-2.5 py-1 text-sm ${
                window.positionSize === lot
                  ? 'border-floor-gold text-floor-gold'
                  : 'border-floor-border text-text-primary hover:border-text-dim'
              }`}
            >
              {lot}
            </button>
          ))}
        </div>
        <input
          type="number"
          min={0}
          step={0.01}
          value={window.positionSize}
          onChange={(e) => patch({ positionSize: Math.max(0, +e.target.value) })}
          className="num mt-2 w-full rounded-md border border-floor-border bg-floor-bg px-2 py-1.5 text-text-primary"
          aria-label="Custom position size"
        />
      </Field>

      <Field label="Days of week">
        <div className="flex flex-wrap gap-1.5">
          {DOW_LABELS.map((label, i) => {
            const on = window.filterDaysOfWeek[i];
            return (
              <button
                key={label}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  const next = [...window.filterDaysOfWeek];
                  next[i] = !next[i];
                  patch({ filterDaysOfWeek: next });
                }}
                className={`rounded-md border px-2 py-1 text-xs ${
                  on
                    ? 'border-floor-gold text-floor-gold'
                    : 'border-floor-border text-text-dim hover:border-text-dim'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => patch({ filterDaysOfWeek: [true, true, true, true, true, false, false] })}
          className="mt-2 text-xs text-text-dim underline-offset-2 hover:text-floor-gold hover:underline"
        >
          Mon–Fri only
        </button>
      </Field>

      {range && (
        <Field label="Date range">
          <div className="flex flex-col gap-2">
            <input
              type="date"
              min={toDateInput(range.start)}
              max={toDateInput(range.end)}
              value={toDateInput(window.dateRangeStart ?? range.start)}
              onChange={(e) => patch({ dateRangeStart: fromDateInput(e.target.value) })}
              className="num rounded-md border border-floor-border bg-floor-bg px-2 py-1.5 text-text-primary"
              aria-label="Start date"
            />
            <input
              type="date"
              min={toDateInput(range.start)}
              max={toDateInput(range.end)}
              value={toDateInput(window.dateRangeEnd ?? range.end)}
              onChange={(e) => patch({ dateRangeEnd: fromDateInput(e.target.value) })}
              className="num rounded-md border border-floor-border bg-floor-bg px-2 py-1.5 text-text-primary"
              aria-label="End date"
            />
          </div>
        </Field>
      )}

      <div className="flex items-center justify-between border-t border-floor-border pt-4 text-xs text-text-dim">
        <span className="num">{skippedDays} days skipped</span>
        <button
          type="button"
          onClick={() =>
            patch({
              ...DEFAULT_WINDOW,
              dateRangeStart: range?.start,
              dateRangeEnd: range?.end,
            })
          }
          className="underline-offset-2 hover:text-floor-gold hover:underline"
        >
          Reset filters
        </button>
      </div>
    </div>
  );
}
