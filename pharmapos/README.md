# PharmaPOS

Offline-first **pharmacy point-of-sale for Lebanon**, with dual currency (LBP primary,
USD secondary). Built as a Tauri 2 desktop app (local SQLite, works fully offline) and a
Supabase-backed web app that share the same React/TypeScript UI.

See [`BLUEPRINT.md`](./BLUEPRINT.md) for the full technical design and
[`CLAUDE.md`](./CLAUDE.md) for the non-negotiable project rules.

## Status — Phases 0–2 complete; Phase 3 cloud code complete (live project pending)

| Piece | Where | Notes |
|---|---|---|
| Money math | `src/lib/money.ts` (+ `money.test.ts`) | Integer minor units only, no floats. Format/parse/convert, LL rounding, VAT extraction, settlement. The single source of truth for all money. |
| Client IDs | `src/lib/ids.ts` | `newId()` → UUID v4 for offline-safe rows. |
| Data-access contract | `src/data/repository.ts`, `src/data/types.ts` | The interface the UI depends on (products, batches, sales, exchange rates, settings, inventory). |
| Schema | `migrations/0001_init.sql` | One canonical file used by Rust (`include_str!`) and the sql.js path. |
| SQL drivers | `src/data/sql/`, `src/data/sqlite/` | `SqlDriver` boundary → same `SqliteRepository` on tauri-plugin-sql, sql.js (tests + browser dev). |
| Sale assembly | `src/data/saleAssembly.ts` | Pure VAT-inclusive totals + discount allocation + settlement guard. |
| FEFO + expiry | `src/data/fefo.ts`, `src/data/expiry.ts` | Pure single-batch FEFO pick + expiry bucketing. |
| Inventory | `inventory.*` on the repository | Goods received, stock adjustments, low-stock, expiry report (transactional movements). |
| Screens | `src/screens/` | `AppShell` nav across Checkout · Goods Received · Inventory · Expiry Report. |
| Cloud stub | `src/data/supabase/` | Type-checked stub; implemented in Phase 3. |
| Desktop shell | `src-tauri/` | Full Tauri 2 + `tauri-plugin-sql` scaffold (build on a desktop machine). |

Prices are **VAT-inclusive** (Lebanon 11%); the receipt shows the extracted VAT component.
Stock is dispensed **single-batch FEFO** (earliest-expiry batch, qty capped at its on-hand).
Gates are verified by `src/data/sqlite/SqliteRepository.test.ts` (a dual-currency sale persists
and decrements the correct batch via `stock_movements`) and `src/data/inventory.test.ts`
(goods received, low-stock, expiry report).

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

### Cloud mode (Supabase)

The same React UI runs against Supabase (Postgres) when cloud env vars are set. To connect a
project:

```sh
# 1. Create (or reuse) a Supabase project.
# 2. Apply the schema + seed (Supabase SQL editor, or the MCP/CLI):
#      supabase/migrations/0001_init.sql   # tables, product_stock view, create_sale RPC, RLS
#      supabase/seed.sql                   # demo branch/user/products/batches/rate/settings
# 3. Point the app at it:
cp .env.example .env        # then fill in:
#   VITE_SUPABASE_URL=https://<ref>.supabase.co
#   VITE_SUPABASE_ANON_KEY=<publishable/anon key>
npm run dev                 # now runs in cloud mode (web); Tauri always stays offline-first
```

> Backend selection (`src/data/createRepository.ts`): **Tauri → local SQLite**; otherwise
> **Supabase env present → cloud**; otherwise **dev → seeded sql.js**. Phase 3 is a *permissive
> MVP* — anon key + allow-all RLS, no login screen yet (a hardening pass adds auth + tight RLS).

## Money conventions (do not change)
- USD is stored as **integer cents** (`$12.50` → `1250`).
- LBP is stored as **whole integer LL** (`150,000 LL` → `150000`, no subunits).
- Canonical price currency is **USD cents**; LL is derived at display/checkout time.
- Exchange rate is whole **LBP per 1 USD** (integer), snapshotted on every sale.
- All money flows through `src/lib/money.ts` — no ad-hoc arithmetic anywhere else.
