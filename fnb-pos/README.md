# F&B POS

A multi-tenant, offline-first restaurant POS sold as a monthly subscription.
Two things set it apart: **true dual-currency checkout** and **a POS that keeps
selling with no internet**. Windows and Android terminals, plus a fully online
browser mode.

The plan lives in [`BLUEPRINT.md`](./BLUEPRINT.md) (a repo copy of the
*F&B POS Blueprint* doc). Build against it.

## Status: Phase 0 · Foundation

| Piece | State |
| --- | --- |
| `packages/core`: money, tax, second currency, mixed-tender settlement, UUIDv7, receipt numbers | ✅ Done, tested (incl. the blueprint's worked example) |
| `supabase/migrations`: tenants, subscriptions, branches, devices, pairing codes, roles, users, audit log, RLS | ✅ Done, pgTAP cross-tenant tests |
| Auth: sign-up / invite Edge Functions that set `app_metadata.tenant_id` | ⬜ Next |
| Device pairing Edge Function (redeem one-time code) | ⬜ Next |
| Spike: PowerSync offline sale on Windows (Electron) + Android (Capacitor) | ⬜ Next, the riskiest piece |
| Spike: ESC/POS network printing (port 9100) | ⬜ Next |

**Phase 0 gate:** an offline sale on Android and Windows syncs to the cloud.

## Layout

```
fnb-pos/
├── BLUEPRINT.md              # the plan (source of truth)
├── packages/
│   └── core/                 # platform-free business logic, shared by every target
│       ├── src/
│       │   ├── rounding.ts   # exact integer rounding (nearest / up / down, cash steps)
│       │   ├── fraction.ts   # bigint fractions so taxes stay exact until rounded
│       │   ├── currency.ts   # second currency: rates as decimal strings, conversion, cash rounding
│       │   ├── tax.ts        # tax groups: inclusive/exclusive, compound
│       │   ├── order.ts      # order totals: lines, service charge, per-line or per-invoice rounding
│       │   ├── payment.ts    # mixed-currency tenders → balance and change in both currencies
│       │   ├── ids.ts        # UUIDv7 generated on the device
│       │   └── receipt.ts    # per-device receipt series, e.g. B1-T2-000123
│       └── test/
└── supabase/
    ├── migrations/           # Postgres schema + row-level security
    └── tests/                # pgTAP tests (cross-tenant reads/writes)
```

## Rules the code follows

- **Money is integers** in the currency's minor unit. No floats anywhere in money math.
- **All calculation in the base currency**; the second currency is a conversion at a stored rate, cash-rounded at the end.
- **Rates are decimal strings** (`"89500"`), so they round-trip exactly through the database and sync.
- **A tax group is all-inclusive or all-exclusive**; mixing is rejected. Service-charge taxes are exclusive.
- **Every table has `tenant_id`** and RLS; the tenant comes from the JWT's `app_metadata`, which only the server writes.
- **Terminals don't write tables directly**; uploads go through a validating Edge Function (to build).

## Commands

Needs Node 22.18+ (runs TypeScript directly, no build step).

```bash
cd fnb-pos
npm install
npm test             # node:test, packages/core
npm run typecheck    # tsc
```

Database (needs the Supabase CLI and Docker):

```bash
supabase init        # once, creates supabase/config.toml
supabase db start    # applies migrations
supabase test db     # pgTAP RLS tests
```
