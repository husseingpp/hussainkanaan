# TimeWindow — CLAUDE.md (single source of truth)

MT5 intraday time-of-day backtester. Drop an M1 export, pick a time window
(e.g. 23:57 close → 01:00 open), set position size, and see every day's P&L over
years of data: win rate, expectancy, best/worst day, drawdown, a daily P&L bar
chart with an equity-curve overlay, and a breakdown table. Frontend-only, no
backend, no accounts.

## Workflow contract

- **Plan Mode before any code.** Agree the plan, then implement.
- **QA gates** must pass before moving on. See the per-phase gates below.
- **This file is the single source of truth.** Update it when a decision changes.

## Tech stack

| Layer        | Choice                                | Why |
| ------------ | ------------------------------------- | --- |
| Build        | Vite + React 18 + TypeScript (strict) | Established stack |
| Charts       | Recharts (Composed: Bar + Line)       | Daily P&L bars + equity curve overlay |
| Parsing      | Custom pure parser, run in a Web Worker | Stream big M1 files without freezing the UI |
| State        | Zustand (+ persist middleware)        | Small, localStorage persistence for settings |
| Dates        | Native UTC epoch math (dayjs available) | Parse/format only; no tz conversion |
| Styling      | Tailwind CSS (tokens in config)       | Fast iteration |
| Persistence  | localStorage (settings only)          | Last window + saved presets; never candle data |
| Testing      | Vitest                                | Engine is pure functions → unit-test heavy |
| Deploy       | Static SPA (injected into the portfolio at `/timewindow-app/`) | |

## Design tokens ("Trading Floor") — verbatim

Mirrored in `tailwind.config.js` and `src/tokens.ts`.

| Token           | Hex       | Role |
| --------------- | --------- | --- |
| `floor.bg`      | `#0A0E14` | App background (deep, low-lit) |
| `floor.panel`   | `#0F1419` | Left panel, cards |
| `floor.border`  | `#1A202D` | Hairline borders, grid lines |
| `floor.gold`    | `#D4AF37` | Win rate %, best day, key metrics |
| `trade.win`     | `#22863A` | Profitable bars (muted green) |
| `trade.loss`    | `#A91927` | Loss bars (muted red) |
| `trade.curve`   | `#FFA500` | Equity curve line (warm orange) |
| `text.primary`  | `#E8EAED` | Copy |
| `text.dim`      | `#7A8290` | Secondary copy |

Type: all figures use **IBM Plex Mono** (tabular numerals) via the `.num` class;
body/UI uses the system-ui stack. Motion: one moment only — bars rise from the
baseline on first render (~600ms), then the curve draws. Respect
`prefers-reduced-motion` (`usePrefersReducedMotion` + a media query in CSS).

## MT5 input contract (§3)

Tab-separated with angle-bracket headers is the canonical format; comma-separated
and bracket-less headers are also accepted. The parser:

- Auto-detects the delimiter (tab vs comma) and normalises headers (`<CLOSE>` → `CLOSE`).
- Requires columns `DATE TIME OPEN HIGH LOW CLOSE`; a missing column throws a
  UI-ready message naming the column.
- Dates are `YYYY.MM.DD` (also tolerates `-` / `/`) combined with `HH:MM[:SS]`
  into a **naive epoch-ms timestamp via `Date.UTC` — no timezone conversion.**
  Always read the clock back with `getUTC*`. Badge: "Times shown in broker server time".
- **Rejects non-M1 data** (median intraday bar gap ≠ 60±5s) with:
  "TimeWindow requires M1 (1-minute) data. Export your chart as M1 and re-import."
- Produces an **Import Report**: rows parsed, rows dropped, date range, timeframe,
  median bar gap, and intra-week gaps (weekend gaps are expected and NOT flagged).

## Data model (§4)

See `src/engine/types.ts`. Key formulas:

- `pnl = (exitPrice − entryPrice) × positionSize × contractSize`,
  `contractSize` defaults to **100,000** (blueprint §9.5).
- Exit is on **D+1** when the exit time is at or before the entry time within a
  day (the 23:57 → 01:00 midnight-crossing case); otherwise same day D.
- Missing entry/exit candle → skip the day (counted in `skippedDays`).
- `winRate` is a **percentage (0–100)**. Expectancy uses the win *fraction*:
  `expectancy = avgWin × winFraction − avgLoss × (1 − winFraction)`.
- `largestDrawdown` = peak-to-trough of the cumulative equity curve (positive).

## Architecture

- `src/engine/` — **pure functions only**, framework-free: `parser.ts`,
  `backtest.ts`, `stats.ts`, `types.ts`. This is the tested core.
- `src/worker/parse.worker.ts` — thin wrapper that runs the parser off-thread.
- `src/store/useStore.ts` — Zustand store; persists `lastWindow` + `savedPresets`
  only (never candles), key `timewindow.v1`.
- `src/components/` — Dropzone, TopBar, ControlPanel, StatsCard, PnlChart,
  BreakdownTable, ImportReport.
- `src/lib/` — `loadFile` (worker + inline fallback), `useBacktest`, formatters.

## Deliberate non-goals (v1)

No live data / broker connection. No slippage, commissions, partial fills, or
multiple entries. One dataset at a time. **Never converts timezones** — always
badges broker server time. Candle data is never persisted (always re-parsed).

## QA gates

**Phase 0 — Scaffold:** `npm run build` clean · tokens render · Vitest runs.
**Phase 1 — Data engine:** ≥20 unit tests green covering tab & comma parsers,
M1 detection & rejection, weekend gaps, midnight crossing (23:57 → 01:00 next
day), missing-candle skip, position-size scaling, day-of-week filtering; a large
M1 export parses in <3s without blocking the UI. **Current: 26 tests green.**

## Commands

```bash
npm run dev        # dev server
npm run build      # tsc + vite build (static SPA)
npm run typecheck  # tsc --noEmit
npm test           # vitest run
```
