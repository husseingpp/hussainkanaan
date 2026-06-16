# PharmaPOS — Project Source of Truth

> Offline-first Windows POS for pharmacies. **SQLite is the local source of
> truth; the app must work with no internet.** This file is the single source of
> truth for schema, sync contract, conventions, and decisions. Keep it updated.

---

## 1. Phases (roadmap)

| Phase | Scope | Status |
|------:|-------|--------|
| 1 | Scaffold Tauri+React+TS, SQLite + migrations, 4 core tables, Product CRUD + search, barcode scanner, persistent `device_id` | ✅ done |
| **2** | Sales / POS flow: cart, FEFO checkout, stock ledger, receipts | ✅ **this build** |
| 3 | Payments (full), inventory purchases, suppliers | later |
| 4 | **Sync engine** ⟷ Supabase Postgres (cloud truth + backups) | later |
| 5 | Backups / restore | later |
| 6 | Next.js dashboard | later |

Target architecture: **Desktop app (SQLite, offline) ⟷ sync engine ⟷ Supabase
Postgres ⟷ Next.js dashboard.** Phase 1 is built so it extends cleanly into this
without rework — all data access lives in the Rust core, and every row already
carries the sync columns.

---

## 2. Tech stack & decisions

| Area | Choice | Why |
|------|--------|-----|
| Shell | **Tauri 2.x** (Rust core) | Small, native, Windows-friendly; Rust core owns the data layer |
| UI | **React 18 + TypeScript + Vite** | Fast dev, typed |
| Styling | **Tailwind v3** | Stable, utility-first |
| Local DB | **rusqlite + `bundled` SQLite** | SQLite statically compiled in → zero system deps, clean offline/Windows packaging |
| Migrations | **`rusqlite_migration`** | Ordered, version-tracked (`user_version`), forward-only |
| IDs | **UUIDv4**, client-generated | Offline-safe, collision-free across devices for Phase 4 sync |
| Time | **ISO-8601 UTC** text | Unambiguous; ingests into Postgres `timestamptz` later |
| Money | **INTEGER minor units** | SQLite has no decimal; floats corrupt currency |

**Key architectural rule:** the **frontend never touches SQL**. All data access
is through Rust `#[tauri::command]`s. The Phase 4 sync engine (also Rust) reuses
the exact same connection, transactions, and `dirty`/`updated_at`/`device_id`
bookkeeping instead of re-implementing it in the frontend.

---

## 3. Sync contract (built now, used in Phase 4)

Every **syncable** table carries these four columns from day one:

| Column | Type | Meaning |
|--------|------|---------|
| `id` | TEXT (UUIDv4) | Client-generated primary key. Stable across devices/cloud. |
| `updated_at` | TEXT (ISO-8601 UTC) | Set by the Rust core on **every** insert/update. Last-write basis for conflict resolution. |
| `device_id` | TEXT (UUIDv4) | The device that last wrote the row. Generated once on first launch, persisted to `device_id` file next to the DB. |
| `dirty` | INTEGER 0/1 | `1` = local change not yet pushed to cloud. New local rows start **dirty**. The Phase 4 push sets it to `0` after a successful upload. |

Planned sync semantics (not implemented yet, documented so we don't paint into a corner):
- **Push:** select rows where `dirty = 1`, upsert to Postgres by `id`, then set `dirty = 0`.
- **Pull:** fetch rows with `updated_at` newer than last pull; last-writer-wins by `updated_at` (ties broken by `device_id`).
- **Deletes:** Phase 1 hard-deletes locally. Before sync ships we will switch to **soft-delete** (a `deleted_at` / tombstone column) so deletions propagate. *(Open item — see §8.)*
- All timestamps are UTC; never store local time.

---

## 4. Data schema

### 4.1 Tables CREATED in Phase 1 (migration `0001_init`)

Conventions: money = INTEGER minor units of its currency (USD → cents ×100,
LBP → whole pounds ×1); booleans = INTEGER 0/1; `S` = sync columns
(`updated_at`, `device_id`, `dirty`).

**pharmacies** — also holds app-level currency/VAT config (single row in Phase 1)
| col | type | notes |
|-----|------|-------|
| id | TEXT PK | UUIDv4 |
| name | TEXT NOT NULL | |
| license_no, phone, address | TEXT | optional |
| main_currency | TEXT NOT NULL `'USD'\|'LBP'` | **switchable** primary display currency |
| fx_rate_lbp_per_usd | REAL | LBP per 1 USD, for display conversion |
| fx_updated_at | TEXT | stamped when a rate is set |
| default_vat_rate | REAL NOT NULL (0.11) | per-product override allowed |
| *S* | | |

**users** — identity only this phase (no PIN/password; auth is a later phase)
| col | type | notes |
|-----|------|-------|
| id | TEXT PK | UUIDv4 |
| pharmacy_id | TEXT → pharmacies(id) | |
| full_name | TEXT NOT NULL | |
| role | TEXT NOT NULL ('staff') | owner/pharmacist/cashier later |
| active | INTEGER NOT NULL (1) | |
| *S* | | |

**products**
| col | type | notes |
|-----|------|-------|
| id | TEXT PK | UUIDv4 |
| pharmacy_id | TEXT → pharmacies(id) | |
| name | TEXT NOT NULL | |
| generic_name, barcode, form, strength, category, manufacturer | TEXT | optional |
| requires_rx | INTEGER 0/1 | |
| controlled | INTEGER 0/1 | |
| vat_rate | REAL (0.0) | fraction; form pre-fills `default_vat_rate` |
| *S* | | |

Indexes: `idx_products_name`, `idx_products_generic`, and a **partial unique**
index `uq_products_barcode (pharmacy_id, barcode) WHERE barcode IS NOT NULL AND
barcode <> ''` so one barcode resolves to exactly one product per pharmacy.

**batches**
| col | type | notes |
|-----|------|-------|
| id | TEXT PK | UUIDv4 |
| product_id | TEXT NOT NULL → products(id) | delete of a product with batches is blocked |
| batch_no | TEXT | |
| expiry_date | TEXT | `'YYYY-MM-DD'` |
| currency | TEXT NOT NULL `'USD'\|'LBP'` | currency the prices are denominated in |
| cost_price | INTEGER (0) | minor units of `currency` |
| sell_price | INTEGER (0) | minor units of `currency` |
| qty_on_hand | INTEGER (0) | editable now; **stock movements** come later |
| supplier_id | TEXT | suppliers table is a later phase |
| *S* | | |

Indexes: `idx_batches_product`, `idx_batches_expiry`.

### 4.2 Tables STUBBED (NOT created yet)

To be added in later phases via new forward-only migrations:
`suppliers`, `purchases` + `purchase_items`, `payments`, `customers`,
`settings` (if needed beyond pharmacy-level config), and sync bookkeeping
(`sync_state`, tombstones).

### 4.3 Tables CREATED in Phase 2 (migration `0002_sales`)

**sales** — one completed transaction (sync columns `S` as before)
| col | type | notes |
|-----|------|-------|
| id | TEXT PK | UUIDv4 |
| pharmacy_id | TEXT → pharmacies(id) | |
| user_id | TEXT → users(id) | nullable until auth |
| sale_no | INTEGER NOT NULL | sequential per pharmacy; `uq_sales_no (pharmacy_id, sale_no)` |
| currency | TEXT `'USD'\|'LBP'` | settlement currency |
| fx_rate_lbp_per_usd | REAL | **rate snapshot** used to convert lines |
| subtotal / vat_total / discount_total / grand_total | INTEGER | minor units of `currency` |
| payment_method | TEXT `'cash'\|'card'\|'other'` | |
| amount_tendered / change_due | INTEGER | |
| status | TEXT `'completed'\|'void'` | void is a later phase |
| note, sold_at | | |
| *S* | | |

**sale_items** — one line (snapshots so history survives product/batch edits)
| col | type | notes |
|-----|------|-------|
| id | TEXT PK | |
| sale_id | TEXT NOT NULL → sales(id) ON DELETE CASCADE | |
| product_id, batch_id | TEXT | which batch the stock was drawn from |
| product_name, batch_no | TEXT | **snapshot** |
| qty | INTEGER | |
| unit_price | INTEGER | minor units of sale currency (converted) |
| vat_rate (snapshot), line_vat, line_total | | |
| *S* | | |

**inventory_movements** — stock ledger (Phase 3 purchases reuse it)
| col | type | notes |
|-----|------|-------|
| id | TEXT PK | |
| product_id, batch_id | TEXT | |
| qty_delta | INTEGER | negative = sold |
| reason | TEXT | `'sale'` now; `'adjustment'`/purchases later |
| ref_type, ref_id | TEXT | e.g. `'sale'` + sale id |
| moved_at | | |
| *S* | | |

**Checkout** (`create_sale` → `perform_checkout`) runs in **one transaction**
(`PRAGMA defer_foreign_keys` so item rows can precede the sale row):
1. assign `sale_no = MAX+1` per pharmacy;
2. per cart line, pull batches with stock **earliest-expiry-first (FEFO)**, splitting
   a line across batches as needed; **block if total stock < requested**;
3. convert each batch's `sell_price` from its currency into the sale currency via
   the snapshotted FX rate (errors if a cross-currency sale has no rate);
4. write `sale_items`, decrement `batches.qty_on_hand`, append `inventory_movements`;
5. write `sales` with totals + cash tendered/change.

> The cart's price **preview** uses the FEFO batch price (`get_sell_info`); the
> **authoritative** totals are recomputed server-side at checkout, so the receipt
> is always correct even if a line splits across differently-priced batches.

---

## 5. Currency model (dual LBP + USD)

- Each **batch** stores its prices in its own `currency` (USD or LBP). Switching
  the pharmacy's display currency never corrupts stored prices.
- The pharmacy has a **`main_currency`** (switchable) and an
  **`fx_rate_lbp_per_usd`** used only for **display** conversion. The UI shows the
  native price and, when it differs from the main currency, an `≈` converted
  equivalent. If no rate is set, it shows "(set rate)".
- Minor-unit factor follows the currency: **USD → ×100 (cents), LBP → ×1**.
  See `src/lib/format.ts` (`toMinor`, `fromMinor`, `formatMoney`, `convertMinor`).
- No sale-time rounding rules yet — that lands with the POS/sales phase.

---

## 6. Conventions

- **Naming:** `snake_case` end-to-end (SQLite columns ↔ Rust struct fields ↔
  JSON ↔ TypeScript interfaces). No field-name mapping anywhere.
- **Tauri invoke:** top-level command argument keys are **camelCase** in JS
  (Tauri converts to the Rust snake_case parameter names); nested payload objects
  (e.g. `input`) stay **snake_case** to match the serde structs.
- **Server-managed fields:** `id`, `updated_at`, `device_id`, `dirty` are set by
  the Rust core, never accepted from the frontend (`*Input` structs exclude them).
- **Optional text:** empty strings are normalized to `NULL` (`normalize_opt` in
  Rust, `emptyToNull` in TS).
- **Errors:** commands return `Result<T, AppError>`; `AppError` serializes to a
  plain string surfaced in the rejected `invoke` promise and shown as a toast.
- **i18n:** all UI strings go through `t()` (`src/lib/i18n.ts`). English only in
  Phase 1, but structured so Arabic/RTL can be added without a rewrite.

---

## 7. Project layout

```
pharmapos/
├─ src-tauri/                 # Rust core — the local source of truth
│  ├─ migrations/{0001_init,0002_sales}.sql
│  ├─ src/
│  │  ├─ main.rs  lib.rs  util.rs
│  │  ├─ db/{mod,migrations,models}.rs
│  │  └─ commands/{device,pharmacy,products,batches,sales}.rs   (+ mod.rs = AppError)
│  ├─ capabilities/default.json
│  └─ tauri.conf.json  Cargo.toml  build.rs  icons/
├─ src/                       # React + TS
│  ├─ lib/{types,api,format,i18n,util,cart}.ts        (cart + .test)
│  ├─ hooks/useBarcodeScanner.ts (+ .test.ts)
│  ├─ components/{ScannerInput,ProductForm,BatchForm,CurrencySettings,CheckoutModal,Receipt, ui/}
│  ├─ pages/{ProductsPage,ProductDetailPage,SellPage}.tsx
│  └─ App.tsx  main.tsx  index.css
└─ package.json  vite.config.ts  tailwind.config.ts  tsconfig*.json  CLAUDE.md
```

The Tauri commands registered in `lib.rs`: `get_device_id`, `get_pharmacy`,
`update_currency_settings`, `list_products`, `search_products`, `get_product`,
`find_product_by_barcode`, `create_product`, `update_product`, `delete_product`,
`list_batches`, `create_batch`, `update_batch`, `delete_batch`,
`get_sell_info`, `create_sale`, `list_sales`, `get_sale`.

---

## 8. Barcode scanner (HID)

HID scanners act as keyboard wedges: they "type" the code fast and send an Enter
suffix. Two cooperating layers (`src/hooks/useBarcodeScanner.ts`,
`src/components/ScannerInput.tsx`):

1. **`ScannerInput`** — an always-focused field (auto-refocus on blur). Primary,
   reliable path, and the manual fallback (type a code, press Enter).
2. **`useBarcodeScanner`** — global `keydown` timing detector. Scanner keys
   arrive `< ~50 ms` apart; slower input is treated as human typing and ignored.
   Safety net for when focus is outside the scanner field; ignores other inputs.

Uses `event.key` (survives EAN/UPC, Shift, AZERTY). Configurable min length,
inter-key timeout, and suffix key (Enter/Tab). Resolution: scan →
`find_product_by_barcode` → open the product, or offer to create one with the
barcode pre-filled. The pure `ScanDetector` is unit-tested
(`useBarcodeScanner.test.ts`).

---

## 9. Running & verifying

**Prerequisites:** Rust (stable), Node 18+. Windows is the target OS.
Linux dev also needs `libwebkit2gtk-4.1-dev libgtk-3-dev
libayatana-appindicator3-dev librsvg2-dev libsoup-3.0-dev build-essential`.

```bash
cd pharmapos
npm install
npm run tauri:dev      # launches the app window (Windows / Linux-with-display)
```

The SQLite DB and `device_id` live in the OS app-data dir
(Windows: `%APPDATA%/com.pharmapos.app/`), so **data persists across restarts**.

**Headless checks (no GUI window needed — CI / this dev container):**
```bash
npm run build                                   # tsc + vite build
npm test                                        # vitest: ScanDetector
cargo test --manifest-path src-tauri/Cargo.toml # migrations + DB round-trips + constraints
```

> ℹ️ The app *window* needs a display + webkit; on a headless box use the checks
> above. Visual QA (the Phase-1 gate) is performed on Windows.

---

## 10. QA gates

**Phase 1** — products, batches, barcode, persistence, offline. ✅

**Phase 2 (this build):**
- [ ] Sell screen: scan/search adds products to a cart; totals + VAT update live.
- [ ] Checkout (cash) computes change; a receipt shows and can be printed.
- [ ] Stock decrements (FEFO); product `qty_on_hand` drops by the amount sold.
- [ ] Overselling is blocked; cross-currency needs an FX rate.
- [ ] Sales persist across restarts with sequential receipt numbers.
- [ ] Works fully offline.
- [x] CLAUDE.md documents the schema, sale flow, conventions, and decisions.

## 11. Open items / decisions to revisit

- **Returns / void sales** — `sales.status` has a `'void'` value but no flow yet.
- **Discounts** — `discount_total` column exists; no UI yet.
- **Cart preview price** uses the FEFO batch; a multi-batch line can settle at a
  blended price (authoritative total is server-side). Revisit if confusing.
- **Default VAT = 11%** (Lebanon), per-product override; medicines may be exempt.
- **Soft-delete** (tombstones) before Phase 4 sync so deletes propagate.
- **GS1 / multi-barcode**, **FTS5** search — as before.
