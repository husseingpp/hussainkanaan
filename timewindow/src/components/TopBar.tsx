import { useState } from 'react';
import { useStore } from '@/store/useStore';

/** Symbol · broker-time badge · save-preset control. */
export function TopBar() {
  const dataset = useStore((s) => s.dataset);
  const savePreset = useStore((s) => s.savePreset);
  const presets = useStore((s) => s.savedPresets);
  const applyPreset = useStore((s) => s.applyPreset);
  const [name, setName] = useState('');

  if (!dataset) return null;

  return (
    <header className="flex flex-wrap items-center gap-3 border-b border-floor-border bg-floor-panel px-4 py-3">
      <div className="flex items-baseline gap-2">
        <span className="text-lg font-semibold">
          Time<span className="text-floor-gold">Window</span>
        </span>
        <span className="num text-text-dim">·</span>
        <span className="num font-semibold text-text-primary">{dataset.symbol}</span>
      </div>

      <span
        className="rounded-full border border-floor-border px-2.5 py-0.5 text-xs text-text-dim"
        title="Timestamps are shown exactly as exported — no timezone conversion."
      >
        Times shown in broker server time
      </span>

      <div className="ml-auto flex items-center gap-2">
        {presets.length > 0 && (
          <select
            className="num rounded-md border border-floor-border bg-floor-bg px-2 py-1 text-sm text-text-primary"
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) applyPreset(e.target.value);
              e.target.value = '';
            }}
            aria-label="Load a saved preset"
          >
            <option value="" disabled>
              Load preset…
            </option>
            {presets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Preset name"
          className="w-32 rounded-md border border-floor-border bg-floor-bg px-2 py-1 text-sm text-text-primary placeholder:text-text-dim"
        />
        <button
          type="button"
          disabled={!name.trim()}
          onClick={() => {
            savePreset(name.trim());
            setName('');
          }}
          className="rounded-md border border-floor-border bg-floor-bg px-3 py-1 text-sm text-text-primary hover:border-floor-gold disabled:cursor-not-allowed disabled:opacity-40"
        >
          Save preset
        </button>
      </div>
    </header>
  );
}
