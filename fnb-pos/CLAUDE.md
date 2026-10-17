# CLAUDE.md

Guidance for Claude Code working in `fnb-pos/`.

## Project
A multi-tenant, offline-first restaurant POS (Windows, Android, web) with native second-currency checkout, sold per branch per month.

**`BLUEPRINT.md` is the source of truth.** Read the relevant sections before starting work. If code and blueprint disagree, or the blueprint is ambiguous, stop and ask; do not guess. The blueprint itself is a repo copy of a living doc; if a decision changes, update `BLUEPRINT.md` in the same change.

## Stack
React + TypeScript (Electron for Windows, Capacitor for Android, web build) · SQLite on device · PowerSync · Supabase (Postgres + RLS, Auth, Edge Functions) · Stripe or Paddle. Only `packages/core` and `supabase/` exist so far (Phase 0).

## Commands
```bash
npm test && npm run typecheck     # must pass before any commit
supabase db start && supabase test db
```

## Rules
- `packages/core` stays platform-free: no DOM, Node, React or database imports. Every target shares it.
- Money is integer minor units; exact math through `fraction.ts`/`rounding.ts`; never floats.
- Every new table: `tenant_id`, UUIDv7 `id`, `created_at`, `updated_at`, `deleted_at` if synced, RLS enabled, and a pgTAP cross-tenant test.
- Closed orders, payments, stock movements and the audit log are append-only.
- Orders snapshot names, prices, tax rates and exchange rates at the time of sale.
- Core code runs via Node type stripping: use `.ts` import extensions and erasable syntax only (no enums, namespaces or parameter properties).
