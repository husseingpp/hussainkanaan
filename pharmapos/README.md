# PharmaPOS

Offline-first **pharmacy point-of-sale for Lebanon**, with dual currency (LBP primary,
USD secondary). Built as a Tauri 2 desktop app (local SQLite, works fully offline) and a
Supabase-backed web app that share the same React/TypeScript UI.

See [`BLUEPRINT.md`](./BLUEPRINT.md) for the full technical design and
[`CLAUDE.md`](./CLAUDE.md) for the non-negotiable project rules.

## Status — Phases 0 & 1 complete

| Piece | Where | Notes |
|---|---|---|
| Money math | `src/lib/money.ts` (+ `money.test.ts`) | Integer minor units only, no floats. Format/parse/convert, LL rounding, VAT extraction, settlement. The single source of truth for all money. |
| Client IDs | `src/lib/ids.ts` | `newId()` → UUID v4 for offline-safe rows. |
| Data-access contract | `src/data/repository.ts`, `src/data/types.ts` | The interface the UI depends on. |
| Schema | `migrations/0001_init.sql` | One canonical file used by Rust (`include_str!`) and the sql.js path. |
| SQL drivers | `src/data/sql/`, `src/data/sqlite/` | `SqlDriver` boundary → same `SqliteRepository` on tauri-plugin-sql, sql.js (tests + browser dev). |
| Sale assembly | `src/data/saleAssembly.ts` | Pure VAT-inclusive totals + discount allocation + settlement guard. |
| Checkout | `src/screens/Checkout/` | Search, cart, dual-currency totals, mixed LL/$ payment, LL change, receipt. |
| Cloud stub | `src/data/supabase/` | Type-checked stub; implemented in Phase 3. |
| Desktop shell | `src-tauri/` | Full Tauri 2 + `tauri-plugin-sql` scaffold (build on a desktop machine). |

Prices are **VAT-inclusive** (Lebanon 11%); the receipt shows the extracted VAT component.
The Phase 1 gate (a dual-currency sale persists to SQLite and decrements stock via
`stock_movements`) is verified by `src/data/sqlite/SqliteRepository.test.ts`.

## Stack
Tauri 2 · React · TypeScript · Vite · Tailwind CSS · SQLite (`tauri-plugin-sql`) · Supabase (Postgres).

## Getting started

```sh
cd pharmapos
npm install

npm test          # run the money.ts test suite (the Phase 0 gate)
npm run typecheck  # tsc --noEmit
npm run dev        # web/Vite dev server on http://localhost:1420
```

### Desktop (Tauri)

```sh
npm run tauri dev    # run the native desktop app
npm run tauri build  # produce a desktop binary
```

> **Note:** building the Tauri shell needs the Rust toolchain plus platform webview
> libraries (and, on first build, app icons — see `src-tauri/icons/README.md`). It does
> **not** build in a headless Linux CI/cloud container; develop the desktop build on a
> Windows/macOS machine. The pure-TypeScript core (money + data layer) is fully verified
> here via `npm test`.

## Money conventions (do not change)
- USD is stored as **integer cents** (`$12.50` → `1250`).
- LBP is stored as **whole integer LL** (`150,000 LL` → `150000`, no subunits).
- Canonical price currency is **USD cents**; LL is derived at display/checkout time.
- Exchange rate is whole **LBP per 1 USD** (integer), snapshotted on every sale.
- All money flows through `src/lib/money.ts` — no ad-hoc arithmetic anywhere else.
