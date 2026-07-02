# TimeWindow · MT5 Intraday Time-of-Day Backtester

Drop an MT5 **M1 (1-minute) export**, pick a time window (e.g. `23:57` close →
`01:00` open), set position size in lots, and see **every day's P&L** over years
of data: win rate, expectancy, best/worst day, largest drawdown — with a daily
P&L bar chart, an equity-curve overlay, and a sortable breakdown table. Filter by
day of week and date range. Built for XAUUSD; works for any symbol.

Frontend-only — no backend, no accounts, no broker connection. Your file never
leaves the browser. This is the interactive app showcased at `/timewindow-app/`
in the [portfolio](../README.md).

## Highlights

- **Pure-TypeScript engine** (`src/engine/`) — parser + P&L calculator + stats,
  all framework-free pure functions with **26 Vitest unit tests**.
- **Web Worker parsing** — a 3-year M1 export (~1M rows) parses without freezing
  the UI, then distils to ~750 daily P&L values.
- **Handles the hard cases** — midnight-crossing windows (exit on D+1),
  weekend/holiday gaps (skipped, not errored), M1 validation, position-size
  scaling, and day-of-week filtering.
- **Real account view** — enter your starting balance and lot size; see the
  running **account balance**, **return %**, and a **blow-up flag** (the day the
  account would have hit $0). P&L uses the real XAUUSD contract size ($100 per
  $1.00 move per lot → 0.1 lot = $10/$1), editable for other symbols.
- **Saved files** — every import is auto-saved locally (IndexedDB) so it reopens
  instantly, with optional Supabase cloud sync for cross-device access.
- **"Trading Floor" design** — deep low-lit palette, IBM Plex Mono tabular
  figures, green/red daily bars with a gold win-rate metric and an orange balance
  curve. One animation (bars rise on first render); respects
  `prefers-reduced-motion`.

## Run it

Requires Node.js 20+.

```bash
cd timewindow
npm install
npm run dev        # → http://localhost:5173
```

```bash
npm test           # 40 engine unit tests
npm run typecheck  # tsc --noEmit (strict)
npm run build      # static SPA → dist/
```

## Optional: cloud sync (Supabase)

Saved files always persist locally. To also sync them across devices, in
Supabase create a **public** Storage bucket named `timewindow-datasets` with
permissive anon `select/insert/update/delete` policies (this is a personal tool
with no auth by design), then paste your project **URL + anon key** into the
"Cloud sync" panel on the start screen. Credentials are stored only in your
browser — never committed. Because the bucket is public, treat it as shareable
data and rotate the key or disconnect any time.

## Export from MT5 (2 steps)

1. Open your symbol on the **M1** timeframe.
2. Right-click the chart → **Save As**, keeping the default columns. Drop that
   file into TimeWindow.

Tab-separated (`<DATE>\t<TIME>\t<OPEN>…`) and comma-separated exports are both
accepted; the delimiter and header style are auto-detected. Non-M1 files are
rejected with a clear message. Times are shown exactly as exported — **broker
server time, never timezone-converted**.

## How a trade is modelled

For each calendar day that passes the filters:

- **Entry** = close of the M1 candle at the entry time.
- **Exit** = open of the M1 candle at the exit time (on the **next day** if the
  exit time is at/before the entry time — the 23:57 → 01:00 case).
- **P&L** = `(exit − entry) × positionSize × 100,000` (XAUUSD contract size).
- Missing entry/exit candle → the day is skipped and counted.

## Stack

| Layer | Choice |
| --- | --- |
| Build | Vite + React 18 + TypeScript (strict) |
| Charts | Recharts (Bar + Line composite) |
| Parsing | Custom pure parser in a Web Worker |
| State | Zustand + `persist` (settings only) |
| Styling | Tailwind CSS (tokens in config) |
| Testing | Vitest |

## Structure

```
src/
├── engine/            # pure, tested core (no framework imports)
│   ├── parser.ts      # MT5 tab/comma parser + M1 validation + import report
│   ├── backtest.ts    # backtestWindow(dataset, window) → DailyTrade[]
│   ├── stats.ts       # calcStats(trades) → win %, expectancy, drawdown…
│   ├── types.ts       # Candle, Dataset, TimeWindow, DailyTrade, BacktestStats
│   └── __tests__/     # 26 unit tests + fixtures
├── worker/parse.worker.ts   # runs the parser off the main thread
├── store/useStore.ts        # Zustand store, localStorage persistence
├── components/              # Dropzone, ControlPanel, StatsCard, PnlChart, …
├── lib/                     # loadFile, useBacktest, formatters, reduced-motion
└── tokens.ts                # design tokens (mirrored in tailwind.config.js)
```

See [`CLAUDE.md`](./CLAUDE.md) for the full contract: input format, data model,
formulas, and QA gates.
