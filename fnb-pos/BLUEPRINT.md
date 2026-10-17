# F&B POS Blueprint

> Repo copy of the living doc **F&B POS Blueprint**
> (https://claude.ai/artifact/XxamCeYG7panNQYkUXv9XZ), taken 2026-10-17.
> The doc is where the plan is discussed; this file is what the code is built
> against. When the doc changes, update this file in the same commit as the
> code that follows it.

## Overview

Build a multi-tenant, offline-first restaurant POS sold as a monthly
subscription, where every customer account owns its own data, tax rules and
second currency. The product competes on two things the big players handle
poorly for smaller and international venues: **true dual-currency checkout**
and **a POS that keeps selling with no internet**.

**Decisions taken**

| Area | Decision |
| --- | --- |
| Customers | Cafes, quick-service, casual dine-in, bars, cloud kitchens; 1 to 20 branches |
| Market | International from day one: any base currency, any tax regime, English first, RTL-ready (Arabic) |
| Devices | Windows touch terminals, Android tablets/handhelds, web browser |
| Modes | Offline-capable terminals that sync, plus a fully online browser mode |
| v1 scope | Sales, menu and modifiers, tables and dine-in, kitchen printing and KDS, takeaway and delivery, inventory and recipes, taxes, second currency, shifts, reports |
| Tenancy | One account per business; branches, devices and users live under it; data never crosses accounts |

Out of v1: integrated card payments, online ordering site, loyalty,
reservations, delivery-aggregator integrations, accounting exports. These are
the add-on revenue in later phases.

## Industry benchmark

Every serious restaurant POS now sells offline mode, floor plans, KDS and
multi-location as table stakes; the gaps are price transparency, device
lock-in and multi-currency. That gap is our wedge.

| Vendor | Devices | Offline | Second currency | Price (per location / month) | What to copy |
| --- | --- | --- | --- | --- | --- |
| Toast | Own Android hardware, handheld Go 3 | Yes, marketed as core | No | Quote-based; full suite reported from $75 | One platform for dine-in, takeout, delivery; KDS; handhelds for servers |
| Square for Restaurants | iPad, Square hardware | Yes | No | Free, Plus ~$49 to $60, Premium $149 | Free tier as a funnel; floor plans with seat-level checks; month-to-month, no contract |
| Lightspeed Restaurant | iPad only | Yes | No | $69 / $189 / $399 USD | Clean tier ladder; staff profiles with scoped access; fewer clicks on split and discount |
| Foodics | iPad, cloud back office | Yes | Regional | Per-country price pages, add-ons extra | Cloud back office plus centralized menu control across branches; Middle East focus |
| Loyverse | iOS, Android | Yes | No (a common user complaint) | Free core, paid add-ons | Free POS, KDS and customer display apps; tax by order type (dine-in vs takeaway) |

**Copy for v1:** offline selling, floor plan with open checks, split by item or
seat, modifiers and combos, KDS plus printer routing, order types with their
own tax rules, role-based staff access, shift and cash reports, multi-branch
back office, month-to-month pricing with a free trial.

**Where we differ:** native second currency at checkout, any hardware (cheap
Windows and Android), published flat pricing, and a fully online browser mode
for owners who don't want installs.

## v1 feature spec

v1 covers the full order-to-cash loop of a restaurant shift; every module
below must work offline except account sign-up, billing and multi-branch
reports.

| Module | Must have in v1 | Later |
| --- | --- | --- |
| Sales screen | Category grid, search, quantity, notes, void with reason, hold/recall, reprint, refund against original receipt | Customer-facing display, barcode |
| Menu | Items, variants (size), modifier groups with min/max and price, combos, per-branch price and availability, item images, 86 (sold out) toggle | Time-based menus, happy-hour pricing |
| Order types | Dine-in, takeaway, delivery, each with its own tax and service-charge rules | Online ordering, aggregator orders |
| Tables & dine-in | Floor plans per area, table status colors, open checks, guest count, seat assignment, transfer/merge tables, split by item, seat or equal parts | Reservations, waitlist |
| Kitchen | Printer routing by category to stations (grill, bar), KDS screen with bump, course firing, ticket timers, reprint | Expo screen, prep-time analytics |
| Delivery & takeaway | Customer phone/name/address, driver assignment, pickup time, status flow (new, preparing, ready, out, delivered) | Driver app, live tracking |
| Payments | Cash, card (recorded, not integrated), other tenders; split tender; mixed currency; change calc; tips | Integrated card terminals, QR pay |
| Discounts | Item and order level, % or fixed, manager approval, reason codes | Promotions engine, coupons |
| Inventory & recipes | Ingredients with units, recipes per item and modifier, auto stock deduction on sale, waste, stock counts, suppliers, purchase orders and receiving, low-stock alerts | Transfers between branches, cost forecasting |
| Shifts & cash | Open/close shift with float, cash in/out, blind close, X and Z reports, over/short | Cash drawer audit trail per user |
| Staff | Users with PIN login on terminals, roles and permissions, clock in/out | Scheduling, payroll export |
| Reports | Sales by day/hour/item/category/staff/order type, tax report, payment report, currency report, voids and discounts, inventory usage | Custom dashboards, scheduled emails |
| Back office (web) | Menu, taxes, currencies, users, branches, devices, printers, reports, subscription | Public API, webhooks |

Permissions worth copying from Lightspeed and Toast: void after send, discount
above a limit, reopen closed check, refund, open drawer without sale, edit
prices, view reports. Each needs a manager PIN override on the terminal.

## Multi-tenant account model

Use **one shared database with a `tenant_id` on every row**, enforced by
Postgres row-level security, so one account can never read another's data even
if the app has a bug. This is cheaper to run than a database per customer and
is how most SaaS POS platforms scale.

Hierarchy: **Account** (the business) → **Branches** (locations) → **Devices**
(terminals, KDS screens) and **Users** (staff).

- **Account owner** signs up, picks base currency, country and tax preset, then invites staff.
- **Account settings** apply to all branches unless a branch overrides them: base currency, second currency and its rate, tax rates, receipt header/footer, rounding, order types, service charge.
- **Branch settings:** address, tax registration number, opening hours, floor plans, printers, price overrides, menu availability.
- **Devices** are registered with a one-time pairing code from the back office. Each gets a device ID, a receipt prefix (for example B1-T2) and a role: POS, KDS, or Store Hub.
- **Users** have one account-wide identity with a role per branch. Terminals use a 4 to 6 digit PIN; the web back office uses email and password with optional 2FA.
- **Subscription** lives on the account: plan, number of branches, number of devices, add-ons, trial end, status. A lapsed subscription puts terminals into read-only after a grace period; it never deletes data.
- **Data export:** the owner can export all sales, menu and inventory to CSV at any time. This is a selling point against lock-in.

## Architecture and tech stack

Recommended stack: one React + TypeScript codebase shipped three ways, a local
SQLite database on every terminal, Supabase (Postgres) in the cloud, and
PowerSync as the sync engine between them. One codebase keeps a solo or small
team shipping to Windows, Android and web at once, and it matches a full-stack
JavaScript skill set.

Windows and Android terminals keep working on their local database and sync
through PowerSync; the browser talks to Supabase directly and needs a
connection.

| Layer | Choice | Why |
| --- | --- | --- |
| UI | React + TypeScript, Tailwind, TanStack Query | One UI for all three targets; large hiring pool |
| Windows terminal | Electron wrapper | Mature, direct USB and network printer access from Node, auto-update |
| Android terminal | Capacitor wrapper | Same web code, native plugins for printers and cash drawer |
| Web (online mode, back office) | Same app as a web build | No install; owners manage menu and reports anywhere |
| Local database | SQLite on device (native on Android/Windows, WA-SQLite in the browser) | Real queries offline; survives restarts |
| Sync engine | PowerSync (Postgres ↔ SQLite) | Built for this exact pattern, first-class Supabase integration, sync rules per tenant |
| Backend | Supabase: Postgres, Auth, row-level security, Edge Functions, Storage | Managed, cheap at start, RLS gives tenant isolation |
| Billing | Stripe (or Paddle as merchant of record for international tax) | Subscriptions, trials, per-device add-ons |

**Risk to note:** PowerSync's Capacitor SDK was released as alpha and its Tauri
SDK is only a proposal, so prototype the Android sync path first. Fallback if
it disappoints: React Native for Android, which has a mature PowerSync SDK,
while keeping the shared business logic in a plain TypeScript package.

### How offline and sync work

- Every write goes to **local SQLite first**. The UI never waits on the network, so online and offline feel identical to the cashier.
- An **upload queue** sends local changes to the backend when online, in order, with retries. Uploads go through an Edge Function that validates them (prices, permissions, totals) instead of writing straight to tables.
- **Downloads** stream each device only its own account's and branch's data, set by sync rules keyed on `tenant_id` and `branch_id`.
- **IDs are generated on the device** (UUIDv7), so nothing waits for the server to assign one.
- **Receipt numbers** use a per-device series such as `B1-T2-000123`, so two offline terminals never issue the same number. A gapless legal invoice number, if a country requires one, is assigned by the server on sync.

Conflict rules (keep them simple and predictable):

- **Master data** (menu, prices, taxes, users) is edited only in the back office. The server wins; terminals just download it.
- **Closed orders and payments are append-only.** They are never edited, only reversed with a refund or void record, so they cannot conflict.
- **Open checks** carry a version number and a lock on the device editing them. A second device editing the same table is warned; on a real clash, line additions from both sides merge and edits to the same line go to the latest write, with an audit entry.
- **Stock is never synced as a number.** Each sale writes stock movement rows and the level is the sum, so offline sales on several devices add up correctly.

### Store Hub for multi-terminal offline

One terminal per branch can be set as the **Store Hub**. When the internet
drops, other terminals on the same Wi-Fi sync open checks and kitchen tickets
through the hub over the local network, so a waiter's tablet and the cashier's
PC still see the same tables. When the internet returns, the hub and terminals
each upload to the cloud. Without a hub, each terminal still sells offline but
cannot see other terminals' open checks until back online; that is acceptable
for single-terminal cafes.

### Fully online mode

The web build can run as a pure online POS: same screens, data cached for the
session only, no install. It suits owners on a laptop, a backup when a
terminal breaks, or very small venues. The account chooses per device whether
it is offline-capable or online-only.

### Hardware

- **Receipt and kitchen printers:** ESC/POS over network (port 9100) first, then USB on Windows and Bluetooth on Android. Network printers are the most reliable for kitchens.
- **Cash drawer:** kicked through the receipt printer.
- **KDS:** any Android tablet or browser running the app in KDS role.
- **Card terminals:** v1 records card payments manually; integrated terminals are a later add-on.

## Data model

Every table below carries `tenant_id`, `id` (UUIDv7), `created_at`,
`updated_at` and, where synced, `deleted_at` for soft delete. **Money is
stored as integers in the currency's smallest unit**, never as floats.

| Group | Tables | Key fields |
| --- | --- | --- |
| Tenancy | tenants, branches, devices, subscriptions | tenant: base_currency, country, plan · device: branch_id, role (pos/kds/hub), receipt_prefix, mode (offline/online) |
| People | users, roles, permissions, user_branch_roles, time_entries | user: pin_hash, email · role: permission list |
| Settings | tenant_settings, branch_settings | rounding rules, receipt texts, service charge, order types enabled |
| Currency | currencies, exchange_rates | rate: from, to, rate, effective_from, set_by |
| Tax | tax_rates, tax_groups, tax_group_rates, tax_rules | rate: percent, inclusive/exclusive, compound · rule: tax_group by order type |
| Menu | categories, items, item_variants, modifier_groups, modifiers, item_modifier_groups, combos, branch_item_overrides | item: price, tax_group_id, station_id, is_available |
| Floor | areas, tables | table: area_id, name, seats, x, y, shape |
| Orders | orders, order_lines, order_line_modifiers, order_taxes, order_discounts | order: type, table_id, status, device_id, receipt_no, exchange_rate snapshot, totals in base and second currency |
| Payments | payments, refunds | payment: method, currency, amount, rate_used, change_given, shift_id |
| Kitchen | stations, printers, kitchen_tickets, kitchen_ticket_lines | ticket: station_id, status, fired_at, bumped_at |
| Delivery | customers, customer_addresses, delivery_info, drivers | delivery: status, driver_id, promised_at |
| Shifts | shifts, cash_movements | shift: opening_float, expected and counted cash per currency |
| Inventory | ingredients, units, recipes, recipe_lines, stock_movements, stock_counts, suppliers, purchase_orders, po_lines | movement: ingredient_id, qty, reason (sale/waste/receive/count/adjust), ref_id |
| System | audit_log, sync_errors | audit: user, device, action, before/after |

**Snapshot rule:** an order line stores the item name, price, tax rate and
exchange rate as they were at the time of sale. Later menu or rate changes
must never alter past receipts or reports.

## Tax and second-currency rules

**All calculation happens in the base currency**; the second currency is a
conversion at a stored rate, applied at the end and rounded by the account's
rule. This keeps tax reports clean in one currency while customers can see and
pay in two.

### Tax, set per account

- **Multiple taxes per item** through tax groups (for example VAT 11% plus a municipality tax).
- **Inclusive or exclusive** pricing per tax. Inclusive is standard in Europe and much of the Middle East; exclusive in the US.
- **Compound taxes** (tax on tax) as an option per rate.
- **Service charge** as its own line, with a setting for whether it is taxable.
- **Rules by order type:** dine-in, takeaway and delivery can use different tax groups, as Loyverse allows.
- **Tax exemption** per order with a reason and manager permission.
- **Rounding:** per line or per invoice, set per account, since countries differ.
- **Presets:** the sign-up flow offers a country preset that the owner can edit.

For tax-inclusive prices, the tax inside a price is:

```
tax = price × r / (1 + r)
```

### Second currency, set per account

- Owner picks a **second currency** and enters its **exchange rate** in the back office; terminals download it like any setting. Each change is stored with who set it and when.
- Optional **separate buy and sell rates** (the rate used when a customer pays vs when change is given), common in dual-currency markets.
- **Display:** totals in both currencies on screen, receipts and the customer display. Item prices can show in base only or both.
- **Rounding rule for the second currency**, for example to the nearest 1,000 or 0.05, and a choice of round up, down or nearest.
- **Mixed payment:** part in base, part in second currency; the remaining balance updates in both. Change can be given in either or split.
- **Snapshot:** each order stores the rate used, so reports show what was actually collected in each currency.
- **Shift close** counts expected cash per currency separately.

### Worked example (rate is illustrative)

Base USD, second currency LBP at 89,500, VAT 11% exclusive, service charge 10%
taxable, LBP rounded to nearest 1,000.

| Line | USD | LBP |
| --- | --- | --- |
| Subtotal | 20.00 | |
| Service 10% | 2.00 | |
| VAT 11% on 22.00 | 2.42 | |
| **Total** | **24.42** | **2,186,000** (2,185,590 rounded) |
| Paid cash USD | 20.00 | |
| **Balance due** | **4.42** | **396,000** (395,590 rounded) |

The rounding difference is booked to a rounding account so the tax report and
cash count still reconcile.

## Security, compliance and reliability

The two failures that kill a POS business are one tenant seeing another's data
and a terminal losing sales; both are designed out below.

- **Tenant isolation:** row-level security on every table using the tenant_id in the user's token; sync rules scoped the same way; an automated test suite that tries cross-tenant reads on every release.
- **Server-side validation:** uploads are re-checked in an Edge Function (prices, tax, permissions, totals) so a tampered terminal cannot write bad data.
- **Device security:** devices paired by one-time code and revocable from the back office; staff PINs hashed; terminals auto-lock after idle time; local database encrypted where the platform allows.
- **Audit log:** voids, refunds, discounts, price edits, drawer opens and permission overrides record user, device and time, and cannot be edited.
- **No card data stored:** v1 records card payments only; integrated payments later go through a certified provider so card numbers never touch our system.
- **Fiscal compliance:** some countries require certified e-invoicing or fiscal printers (for example Saudi ZATCA, Germany TSE). Treat each as a per-country module, not a v1 blocker; pick launch countries without such rules first.
- **Privacy:** customer data (names, phones, addresses) exportable and deletable per account to meet GDPR-style requests.
- **Reliability:** local data kept until the server confirms receipt; a sync status badge on every terminal; alerts in the back office for devices offline longer than a set time; daily database backups with point-in-time recovery.
- **Updates:** staged auto-updates for Electron and Android, never during an open shift.

## Business model and pricing

Charge a **flat monthly fee per branch**, priced well under Lightspeed ($69 to
$399) and Square Premium ($149), with a free trial and no contract. The prices
below are a starting proposal to test, not market-validated figures.

| Plan | Proposed price / branch / month | Includes |
| --- | --- | --- |
| Starter | $19 | 1 POS terminal, sales, menu, taxes, second currency, shifts, basic reports, offline mode |
| Pro | $39 | 3 terminals, tables and floor plans, KDS, kitchen printing, takeaway and delivery, staff roles |
| Business | $69 | Unlimited terminals, inventory and recipes, purchase orders, multi-branch reports, Store Hub |
| Add-ons | $5 to $15 each | Extra terminal, extra KDS, later: online ordering, loyalty, integrated payments, accounting export |

- **Trial:** 14 days of Business, then drops to the chosen plan.
- **Annual billing:** two months free, which improves cash flow.
- **Hardware:** don't sell it at first. Publish a list of tested printers and tablets; partner with a local reseller per country for bundles.
- **Onboarding fee** (optional): paid menu setup for customers who want it done for them.
- **Unit economics to watch:** Supabase and PowerSync hosting cost per branch, support hours per customer in the first 30 days, monthly churn.

## Roadmap and open questions

A small team (1 to 2 developers) can reach a paid launch in roughly 24 weeks if
each phase passes its gate before the next starts. Durations are estimates to
plan against, not commitments.

| Phase | Weeks | Scope | Gate to pass |
| --- | --- | --- | --- |
| 0 · Foundation | 1 to 4 (estimate) | Schema, tenant isolation, auth, device pairing. Spikes: offline sync on Windows + Android, ESC/POS printing | An offline sale on Android and Windows syncs to the cloud |
| 1 · Core POS | 5 to 12 | Menu, modifiers, sales screen, taxes, second currency. Payments, shifts, receipts, back office basics | One pilot cafe runs a full week with no data loss |
| 2 · Restaurant | 13 to 18 | Tables and floor plans, KDS, printer routing. Takeaway and delivery, Store Hub | Three pilots, including one full-service dine-in |
| 3 · Inventory + launch | 19 to 24 | Recipes, stock, purchase orders, full reports. Billing, self-serve sign-up, help center | **Paid launch** |
| 4 · Growth | After launch | Integrated card payments, online ordering, loyalty. Fiscal modules per country, accounting export, API | |

Each gate is a real-world test: nothing moves forward until a pilot venue has
used the previous phase without losing a sale.

### Open questions

- [ ] Which 1 to 3 launch countries? This decides tax presets, fiscal rules and the first languages.
- [ ] Is the second currency always one extra, or should an account support three or more?
- [ ] Should the Store Hub be in v1 for every dine-in customer, or only on the Business plan?
- [ ] Brand name and domain.
- [ ] Who handles support in the first months, and in which hours and languages?
- [ ] Pilot venues: which 3 restaurants will test Phases 1 and 2?

## Sources

- [Toast POS](https://pos.toasttab.com/au) and [NerdWallet Toast review](https://www.nerdwallet.com/business/software/reviews/toast-pos)
- [Square for Restaurants on Capterra](https://www.capterra.com/p/183267/Square-for-Restaurants/) and [CostBench pricing](https://www.costbench.com/software/restaurant-pos/square-for-restaurants/)
- [Lightspeed Restaurant pricing](https://www.lightspeedhq.com/restaurant/pricing)
- [Foodics on GetApp](https://www.getapp.com/retail-consumer-services-software/a/foodics/)
- [Loyverse review, Merchant Maverick](https://www.merchantmaverick.com/reviews/loyverse-review/) and [Loyverse review, Mobile Transaction](https://www.mobiletransaction.org/loyverse-review/)
- [TechRadar best restaurant POS 2026](https://www.techradar.com/best/best-pizza-restaurant-pos-systems)
- [PowerSync overview](https://docs.powersync.com/overview/readme-1), [examples](https://docs.powersync.com/intro/examples) and [November 2025 changelog](https://powersync.com/blog/powersync-changelog-november-2025)
