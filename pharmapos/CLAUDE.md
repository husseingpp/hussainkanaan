# PharmaPOS — Project Rules (single source of truth)

## What this is
Offline-first pharmacy POS for Lebanon. Dual currency LL (primary) + USD (secondary).
Desktop: Tauri 2 + React + TS + SQLite. Cloud: Supabase (Postgres). Shared React UI.

## Non-negotiable rules
- Money is ALWAYS integer minor units. USD = cents, LBP = whole LL. Never floats.
- Canonical price currency = USD cents. Convert to LL at display/checkout only.
- All money operations go through `src/lib/money.ts`. No ad-hoc math anywhere else.
- Every sale snapshots the exchange rate used (`sales.exchange_rate`).
- Sales are immutable once status = completed.
- Stock truth = `stock_movements`; `batches.qty_on_hand` is a derived cache.
- All syncable rows use client-generated UUID ids + updated_at + deleted_at (soft delete).
- UI never talks to SQLite or Supabase directly — only through the repository interface.

## Workflow
- One feature per session. Plan Mode first; no code until the plan is approved.
- Each phase has a QA gate (see BLUEPRINT.md §9). Do not advance until the gate passes.
- Write tests for money.ts and sync logic before/with the feature.

## Stack
Tauri 2, React, TypeScript, Vite, Tailwind, SQLite (tauri-plugin-sql), Supabase, Zustand/React Query.

## Status
- **Phase 0 — Foundations: DONE.**
  - `src/lib/money.ts` + full Vitest suite (the gate). Run with `npm test`.
  - Data-access interface (`src/data/repository.ts` + `types.ts`) with two stub
    implementations (`SqliteRepository`, `SupabaseRepository`).
  - Full Tauri 2 shell scaffolded under `src-tauri/` (build it on a Windows/dev
    machine — the cloud dev container has no Rust/webkit toolchain).
- **Next: Phase 1 — local-only offline POS core** (SQLite schema + migrations,
  products/batches/sales SQLite repo, Checkout screen, receipt). See BLUEPRINT.md §12.
