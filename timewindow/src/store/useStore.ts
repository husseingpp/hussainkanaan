import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Dataset, TimeWindow } from '@/engine';
import { DEFAULT_CONTRACT_SIZE } from '@/engine';

/** The blueprint's headline example: 23:57 close → 01:00 open, XAUUSD, micro lot. */
export const DEFAULT_WINDOW: TimeWindow = {
  entryHour: 23,
  entryMin: 57,
  exitHour: 1,
  exitMin: 0,
  positionSize: 0.01,
  contractSize: DEFAULT_CONTRACT_SIZE,
  filterDaysOfWeek: [true, true, true, true, true, false, false], // Mon–Fri
};

export interface SavedPreset {
  id: string;
  name: string;
  window: Omit<TimeWindow, 'dateRangeStart' | 'dateRangeEnd'>;
}

/** Only settings are persisted — candle data is always re-parsed (blueprint §7). */
interface PersistedState {
  lastWindow: TimeWindow;
  savedPresets: SavedPreset[];
}

interface StoreState extends PersistedState {
  dataset: Dataset | null;
  parsing: boolean;
  parseError: string | null;
  window: TimeWindow;
  setDataset: (ds: Dataset | null) => void;
  setParsing: (v: boolean) => void;
  setParseError: (msg: string | null) => void;
  patchWindow: (patch: Partial<TimeWindow>) => void;
  setWindow: (w: TimeWindow) => void;
  savePreset: (name: string) => void;
  applyPreset: (id: string) => void;
  deletePreset: (id: string) => void;
}

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      dataset: null,
      parsing: false,
      parseError: null,
      window: DEFAULT_WINDOW,
      lastWindow: DEFAULT_WINDOW,
      savedPresets: [],

      setDataset: (dataset) =>
        set((s) => {
          if (!dataset) return { dataset: null };
          // Default the date range to the full span of the freshly-loaded file.
          const start = dataset.importReport.dateRange.start;
          const end = dataset.importReport.dateRange.end;
          return {
            dataset,
            parseError: null,
            window: { ...s.window, dateRangeStart: start, dateRangeEnd: end },
          };
        }),
      setParsing: (parsing) => set({ parsing }),
      setParseError: (parseError) => set({ parseError }),

      patchWindow: (patch) =>
        set((s) => {
          const window = { ...s.window, ...patch };
          return { window, lastWindow: window };
        }),
      setWindow: (window) => set({ window, lastWindow: window }),

      savePreset: (name) =>
        set((s) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { dateRangeStart, dateRangeEnd, ...window } = s.window;
          const preset: SavedPreset = { id: crypto.randomUUID(), name, window };
          return { savedPresets: [...s.savedPresets, preset] };
        }),
      applyPreset: (id) => {
        const preset = get().savedPresets.find((p) => p.id === id);
        if (!preset) return;
        set((s) => ({ window: { ...s.window, ...preset.window } }));
      },
      deletePreset: (id) =>
        set((s) => ({ savedPresets: s.savedPresets.filter((p) => p.id !== id) })),
    }),
    {
      name: 'timewindow.v1',
      version: 1,
      // Never persist candle data — only the last window + saved presets.
      partialize: (s): PersistedState => ({ lastWindow: s.lastWindow, savedPresets: s.savedPresets }),
      onRehydrateStorage: () => (state) => {
        if (state?.lastWindow) state.window = { ...state.lastWindow, dateRangeStart: undefined, dateRangeEnd: undefined };
      },
    },
  ),
);
