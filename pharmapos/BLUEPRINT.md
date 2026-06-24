# PharmaPOS — Technical Blueprint

A pharmacy Point-of-Sale system for Lebanon. Cloud-first with a fully offline-capable desktop version that syncs when reconnected. Dual currency: **LBP (LL)** primary, **USD ($)** secondary.

---

## 1. Product Summary

PharmaPOS lets a Lebanese pharmacy ring up sales, manage drug inventory (including batch/expiry tracking), accept payment in LL and/or $ at a configurable exchange rate, and keep working when the internet drops. It runs in three modes:

1. **Cloud mode** — web app, data lives in Postgres (Supabase). Multi-branch capable.
2. **Hybrid (offline-first desktop)** — Windows desktop app with a local SQLite database. Works with no connection; pushes/pulls changes to the cloud when online.
3. **Fully offline** — same desktop app, never connects. Local SQLite is the only source of truth.

The same desktop binary covers modes 2 and 3 — sync is just a toggle.

---

## 2. Core Requirements

### Functional
- **Sales / checkout**: barcode scan or search, cart, quantity, line discounts, whole-sale discount, hold/resume sale, returns/refunds.
- **Dual currency**: every price stored canonically; display + accept in LL and $. Configurable exchange rate with history. Mixed payment (e.g. part cash $, part cash LL). Correct change calculation across currencies.
- **Inventory**: products, barcodes, categories, suppliers, stock levels per branch, **batch + expiry tracking** (critical for pharmacy), low-stock and near-expiry alerts, stock adjustments, purchase/goods-received entries.
- **Pharmacy specifics**: generic vs brand name, dosage/form/strength fields, controlled-substance flag, optional prescription reference field per sale line.
- **Customers** (optional): basic profile, purchase history, store credit.
- **Users & roles**: admin, pharmacist, cashier. Permission gating (e.g. only admin edits prices / exchange rate / voids).
- **Receipts**: printable (thermal 80mm), shows both currencies, exchange rate used, VAT line.
- **Reports**: daily Z-report, sales by period, top products, profit (needs cost price), stock valuation, expiry report.
- **Offline + sync**: full CRUD offline; conflict-aware sync when reconnected.

### Non-functional
- Checkout must stay fast and fully usable offline with zero latency (local DB).
- Sync must be resumable and must never lose a completed sale.
- Money math must never use floats — store integer minor units.

---

## 3. Recommended Stack

| Layer | Choice | Why |
|---|---|---|
| Desktop shell | **Tauri 2** (Rust core) | Small binary, native Windows, secure, bundles a local DB easily |
| Frontend (desktop + web) | **React + TypeScript + Vite** | One UI codebase for desktop and web |
| Styling | Tailwind CSS | Fast, consistent |
| Local DB (desktop) | **SQLite** (via `tauri-plugin-sql` or `rusqlite`) | Embedded, zero-config, reliable offline |
| Cloud DB | **Supabase (Postgres)** | Auth, row-level security, REST/realtime, free tier to start |
| Cloud API | Supabase client + Postgres RPC; optional thin Node/Express layer if you need custom logic | Minimal backend to maintain |
| Web app hosting | Vercel or Netlify | Free, simple |
| State | Zustand or React Query | Local state + server cache |
| Auth | Supabase Auth (cloud); local PIN/password for offline desktop | Works in both modes |

> The web app and the desktop app share the same React component tree. A **data-access layer** abstracts "where does data come from" so UI code never cares whether it's hitting SQLite or Supabase.

---

## 4. Architecture

```
┌────────────────────────────────────────────────────────────┐
│                     SHARED REACT/TS UI                       │
│   screens, components, money formatting, cart logic          │
└───────────────┬────────────────────────────┬───────────────┘
                │                            │
      data-access interface (TS)   data-access interface (TS)
                │                            │
        ┌───────▼────────┐          ┌────────▼─────────┐
        │  Desktop repo  │          │   Cloud repo     │
        │  → SQLite      │          │   → Supabase     │
        │  + sync engine │          │                  │
        └───────┬────────┘          └──────────────────┘
                │  (when online)
                ▼
        ┌────────────────┐
        │  SYNC ENGINE   │  push local changes → pull remote changes
        │  outbox + pull │  conflict resolution, exchange-rate sync
        └───────┬────────┘
                ▼
            Supabase (Postgres) ← single source of truth in cloud
```

**Key principle:** all three modes use the *same* repository interface. Cloud mode wires it to Supabase; offline/hybrid wires it to SQLite + sync engine.

---

## 5. Money & Dual Currency (read this twice)

This is the most error-prone part. Get it right early.

- **Store all money as integers in minor units.** Never floats.
  - USD: store **cents** (`$12.50` → `1250`).
  - LBP: there are effectively no subunits in practice; store **whole LL** as integer (`150000` LL → `150000`). Pick one minor-unit convention and document it.
- **Canonical pricing currency:** pick ONE currency to store product prices in (recommend **USD cents**, since LL is volatile). Convert to LL at display/checkout time using the current rate.
- **Exchange rate** is a first-class entity:
  - `exchange_rates(id, usd_to_lbp, effective_from, created_by)` — keep history, never overwrite.
  - Each sale records the **exact rate used** at sale time (`sales.exchange_rate`), so old receipts/reports stay correct even after the rate changes.
- **Payments are multi-line and multi-currency:** a sale can be paid with several payment rows, each with its own currency and amount. Settlement check: convert each payment to the canonical currency at the sale's rate, sum, compare to total.
- **Change/rounding:** decide change currency (usually LL). Add a configurable LL rounding step (e.g. round to nearest 1,000 LL) because tiny denominations don't circulate. Store rounding as an explicit line so totals reconcile.
- Build a single `money.ts` utility module: parse, format (LL with thousands separators + "L.L."; $ with 2 decimals), convert, round. **All money flows through it.** Unit-test it first.

---

## 6. Data Model (core tables)

Same schema shape in SQLite and Postgres. Every syncable row carries sync metadata.

**Sync metadata on every syncable table:**
`id` (UUID, generated client-side so offline rows have stable IDs), `created_at`, `updated_at`, `deleted_at` (soft delete), `last_modified_by`, `sync_version` (or use `updated_at` for LWW).

```
branches(id, name, address, phone)
users(id, branch_id, name, role[admin|pharmacist|cashier],
      pin_hash, supabase_user_id?, active)
products(id, sku, barcode, name, generic_name, brand,
         form, strength, category_id, supplier_id,
         price_usd_cents,          -- canonical price
         cost_usd_cents,           -- for profit reports
         vat_rate, is_controlled, active)
batches(id, product_id, branch_id, batch_no, expiry_date,
        qty_on_hand, cost_usd_cents)   -- stock lives here, FEFO
categories(id, name)
suppliers(id, name, phone, notes)
customers(id, name, phone, store_credit_usd_cents)
exchange_rates(id, usd_to_lbp, effective_from, created_by)
sales(id, branch_id, user_id, customer_id?,
      status[completed|held|voided|refunded],
      subtotal_usd_cents, discount_usd_cents, vat_usd_cents,
      total_usd_cents,
      exchange_rate,            -- rate snapshot at sale time
      ll_rounding_cents,        -- applied LL rounding
      prescription_ref?, created_at)
sale_lines(id, sale_id, product_id, batch_id,
           qty, unit_price_usd_cents, line_discount_usd_cents,
           line_total_usd_cents)
payments(id, sale_id, currency[USD|LBP], amount_minor,
         method[cash|card|credit], created_at)
stock_movements(id, product_id, batch_id, branch_id,
                type[sale|purchase|adjustment|return],
                qty_delta, ref_id, created_at)
settings(key, value)   -- store config, default currency, rounding step, etc.
```

**Pharmacy notes baked in:** stock is tracked per **batch** so you can do FEFO (first-expiry-first-out) dispensing and near-expiry alerts. Sales decrement specific batches via `sale_lines.batch_id`.

---

## 7. Offline-First Sync Engine

### Strategy: Outbox + pull, Last-Writer-Wins with guardrails

**Writes (offline → cloud):**
1. Every local mutation writes to the real table AND appends an entry to a local **`outbox`** table (`id, table, row_id, op[insert|update|delete], payload, created_at, synced`).
2. When online, a background worker drains the outbox in order, calling Supabase. On success, mark `synced`. On failure, retry with backoff. Outbox is durable, so a completed sale survives a crash or power cut.

**Reads (cloud → local):**
1. Track a `last_pulled_at` per table (or globally).
2. On reconnect, pull all remote rows where `updated_at > last_pulled_at` (and deletions via `deleted_at`).
3. Upsert into SQLite.

**Conflict resolution:**
- Default **Last-Writer-Wins** by `updated_at`.
- **Sales are append-only and immutable once `completed`** → they essentially never conflict; just insert. This is the key insight that makes pharmacy POS sync safe.
- **Inventory quantities must NOT be blind LWW** (you'd lose concurrent stock changes). Instead sync **stock_movements** (deltas), and derive `qty_on_hand` by replaying movements, OR reconcile quantities server-side from movement sum. Treat `batches.qty_on_hand` as a cache, not the truth.
- Products/prices/settings: LWW is fine; last admin edit wins.

**Exchange rate while offline:** desktop keeps the last-known rate and lets an admin override locally. Each sale snapshots its rate, so offline sales remain correct. On sync, local rate edits and cloud rate edits reconcile by `effective_from` timestamp.

**IDs:** generate UUIDs on the client so offline-created rows never collide with cloud rows.

---

## 8. Screens (MVP scope)

1. **Login / user select** (PIN for offline, email/password for cloud).
2. **Checkout** (the main screen): search/scan, cart, dual-currency total, payment panel (LL + $), change, print.
3. **Inventory list** + product editor (with batches/expiry).
4. **Goods received / purchase entry** (adds batches, sets cost).
5. **Exchange rate** screen (set rate, view history) — admin only.
6. **Reports** (daily Z, sales, stock valuation, expiry).
7. **Settings** (store info, currency defaults, LL rounding step, sync toggle, printer).
8. **Sync status** indicator (online/offline, pending outbox count, last sync time).

---

## 9. Build Phases (milestone-gated)

Work **one feature per Claude Code session**, Plan Mode first, with a QA gate before advancing.

**Phase 0 — Foundations**
- Repo, Tauri 2 + React + TS + Vite + Tailwind scaffold.
- `money.ts` with full unit tests (formatting, conversion, LL rounding). **Gate: all money tests pass.**
- Data-access interface defined (TS types + repository contract), with two stub implementations (SQLite, Supabase).

**Phase 1 — Local-only POS (offline core)**
- SQLite schema + migrations.
- Products + batches CRUD.
- Checkout with cart, dual currency, payments, change, receipt print.
- **Gate:** can complete a full dual-currency sale offline and it persists.

**Phase 2 — Inventory depth**
- Goods received, stock movements, FEFO batch selection, low-stock + near-expiry alerts.
- **Gate:** selling decrements correct batch; expiry report works.

**Phase 3 — Cloud + Auth**
- Supabase project, Postgres schema mirrors SQLite, RLS policies, Supabase Auth.
- Cloud-mode repository implementation. Web app builds and runs against Supabase.
- **Gate:** same UI works in pure cloud mode.

**Phase 4 — Sync engine**
- Outbox, pull loop, conflict rules, sync status UI.
- **Gate:** create sales offline → reconnect → they appear in cloud; stock reconciles; kill-during-sync test recovers cleanly.

**Phase 5 — Reports, roles, polish**
- Reports, role-based permissions, settings, printer config, backups.
- **Gate:** Z-report reconciles to sum of sales for the day in both currencies.

---

## 10. Key Risks & Decisions to Lock Early

1. **LL minor-unit convention** — decide now (recommend whole LL as integer) and never change it.
2. **Canonical price currency** — recommend USD cents. Document it in `CLAUDE.md`.
3. **Stock truth = movements, not a quantity field** — prevents sync from corrupting inventory.
4. **Sales immutable after completion** — makes sync safe.
5. **Snapshot exchange rate on every sale** — keeps history correct.
6. **Client-generated UUIDs** — required for offline.
7. **VAT handling** — confirm Lebanon VAT rules and whether prices are VAT-inclusive.

---

## 11. CLAUDE.md (in the repo root)

See `CLAUDE.md` — the non-negotiable project rules live there.

---

## 12. Phase 1 Claude Code Kickoff Prompt

Paste this to start Phase 1 after scaffolding:

> We're building PharmaPOS (see BLUEPRINT.md and CLAUDE.md). Enter Plan Mode.
>
> Goal for this session: **Phase 1 — local-only offline POS core.**
>
> Deliver:
> 1. SQLite schema + migrations for: products, batches, categories, suppliers, exchange_rates, sales, sale_lines, payments, stock_movements, settings — matching BLUEPRINT.md §6, with UUID ids, updated_at, deleted_at on syncable tables.
> 2. The repository interface (TS) and its SQLite implementation for products, batches, and sales.
> 3. A Checkout screen: product search, cart, dual-currency total (LL + $) using money.ts and the current exchange rate, a payment panel accepting mixed LL/$ cash, correct change in LL with configurable rounding, and completing the sale (writing sale + sale_lines + payments + stock_movements).
> 4. A minimal receipt preview showing both currencies and the rate used.
>
> Constraints: follow every rule in CLAUDE.md. Money only through money.ts. Sales immutable after completion. Generate UUIDs client-side.
>
> Acceptance gate: I can complete a full dual-currency sale fully offline, it persists in SQLite, stock decrements via stock_movements, and the receipt shows both currencies and the snapshotted rate.
>
> Present the plan first. Do not write code until I approve.
