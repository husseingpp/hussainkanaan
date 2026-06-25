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
- **Phase 0 — Foundations: DONE.** money.ts + tests; data-access interface; Tauri shell.
- **Phase 1 — Local-only offline POS core: DONE.**
  - Canonical schema `migrations/0001_init.sql` (one source for Rust `include_str!`
    and the JS/sql.js path).
  - SQL is behind a `SqlDriver` so the same `SqliteRepository` runs on tauri-plugin-sql
    (desktop), sql.js (Node tests + browser dev). Real impl for products/batches/sales/
    exchange-rates/settings; `sales.createCompleted` is transactional.
  - Pure `saleAssembly` (VAT-inclusive totals, discount allocation, settlement guard).
  - Checkout screen (`src/screens/Checkout/`): search, cart, dual-currency totals,
    mixed LL/$ payment, LL change with rounding, receipt preview.
  - Gate verified by `src/data/sqlite/SqliteRepository.test.ts` (sale persists, stock
    decrements via stock_movements, rate snapshotted) + a live browser run.
- **Phase 2 — Inventory depth: DONE.**
  - Goods received + stock adjustments (`inventory.receiveStock` / `adjustStock` write
    `purchase` / `adjustment` movements transactionally); `lowStock` + `expiryReport`.
  - Pure FEFO (`src/data/fefo.ts`) + expiry classification (`src/data/expiry.ts`).
  - Screens behind an `AppShell` nav: Checkout, Goods Received, Inventory alerts,
    Expiry report (with a low-stock/near-expiry badge).
  - Gate verified by `inventory.test.ts` + the FEFO assertions in
    `SqliteRepository.test.ts` (sale decrements the earliest-expiry batch) + a live run.
- **VAT decision (locked): prices are VAT-inclusive (11%).** The VAT figure is the
  component extracted from the total via `extractInclusiveVat` in money.ts.
- **FEFO model (locked): single earliest-expiry batch per line**, qty capped at that
  batch's on-hand (no batch oversell). `pickFefoBatch` chooses it.
- **Next: Phase 3 — Cloud + Auth** (Supabase schema mirror, RLS, cloud repository).
  See BLUEPRINT.md §9.
