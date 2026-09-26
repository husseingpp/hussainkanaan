# Multilingual NGO Platform

A content website for an NGO: **Arabic first (RTL), English second**, and more
languages the owner can add at runtime. The owner controls both the content
(activities with photo albums, invitations & conferences, sectors, objectives,
pages) and the look (theme, homepage sections, menu) through a simple admin.

- **Spec:** [`BLUEPRINT.md`](./BLUEPRINT.md) is the source of truth.
- **Working rules:** [`CLAUDE.md`](./CLAUDE.md).
- **Preview:** https://husseingpp.github.io/hussainkanaan/ngo-platform/
  (static build, Phase 0; the real deployment targets Cloudflare Workers).

## Status

| Phase | Scope | Status |
|---|---|---|
| 0 | Scaffold: Next.js 15, Tailwind v4, shadcn, next-intl loader, Supabase local, deploy config | ✅ `/ar` RTL + `/en` LTR; GitHub Pages preview. Cloudflare deploy configured, not yet live |
| 1 | Database: migrations, RLS, seed, pgTAP | ⏳ |
| 2 | Public site | ⏳ |
| 3 | Admin core + content | ⏳ |
| 4 | Appearance | ⏳ |
| 5 | Languages | ⏳ |
| 6 | Requests module (if confirmed) | ⏳ |
| 7 | Hardening & handover | ⏳ |

## Getting started

Requires Node 20+ and pnpm (`corepack enable`).

```bash
pnpm install
cp .env.example .env.local
pnpm dev                     # http://localhost:3000 → redirects to /ar
pnpm lint && pnpm typecheck && pnpm build
```

Supabase (local, needs Docker): `pnpm supabase start`. Migrations arrive in Phase 1.

## How i18n works (Phase 0)

- Locales and UI strings are shaped like their future DB rows (`locales`,
  `ui_strings`). For now they're loaded from `src/lib/i18n/defaults/`; Phase 1
  swaps the two fetch functions for cached Supabase queries.
- Keys are flat and dotted (`home.hero.title`) so they map 1:1 to `ui_strings.key`.
- `<html lang dir>` comes from the locale row. Physical direction utilities
  (`ml-*`, `text-right`…) are rejected by ESLint; use logical ones.
- The theme is injected as CSS variables on `<html>` (`src/lib/theme`).

## Deploying

- **Preview (now):** `pnpm build:static` with `NEXT_PUBLIC_BASE_PATH` set
  produces `out/`. The portfolio's GitHub Pages workflow builds and publishes
  it under `/ngo-platform/`.
- **Production (later):** `pnpm run deploy` builds with OpenNext and deploys to
  Cloudflare Workers (`wrangler.jsonc`). It needs a Cloudflare account; the
  custom domain is attached in the Cloudflare dashboard. The static preview
  can't run the admin, server actions or ISR, so from Phase 3 on testing moves
  to Cloudflare (a free `*.workers.dev` URL works before the domain is bought).
