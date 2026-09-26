# CLAUDE.md

Guidance for Claude Code working in this repository.

## Project
A multilingual NGO website: Arabic first (RTL), English second, and more languages added at runtime by the owner. The owner controls content (activities with photo albums, events/conferences, sectors, objectives, pages) AND appearance (theme, homepage sections, menu) through a simple admin. An optional requests module (submit → review → track) can be switched on or off.

**`BLUEPRINT.md` is the source of truth.** Read it fully before starting any phase. If code and blueprint disagree, or the blueprint is ambiguous, stop and ask; do not guess.

## Stack
Next.js 15 (App Router) · TypeScript strict · Tailwind v4 (CSS-variable theme) · shadcn/ui · next-intl (DB-loaded messages) · Tiptap · dnd-kit · Zod · React Hook Form · Supabase (Postgres + RLS, Auth, Storage, `@supabase/ssr`) · Resend · Turnstile · DeepL (optional) · Cloudflare Workers via `@opennextjs/cloudflare` · pnpm

## Commands
```bash
pnpm dev
pnpm lint && pnpm typecheck && pnpm build        # must pass before any commit
supabase start | supabase db reset | supabase migration new <name>
supabase test db                                  # pgTAP RLS tests
supabase gen types typescript --local > src/types/database.ts
pnpm run deploy                                   # opennext build + wrangler deploy
```

## Structure
```
src/
  app/[locale]/          # public routes (see BLUEPRINT §9)
  app/admin/             # admin (Arabic UI default)
  components/
    ui/                  # shadcn
    sections/            # one component per page_section type + registry.ts
    public/ admin/ forms/
  lib/
    supabase/            # client.ts, server.ts, admin.ts ('server-only', service role)
    i18n/                # tr(), locale loader, request config, defaults/ar.json, en.json
    theme/               # theme → CSS variables
    actions/             # server actions by domain
    validation/          # zod schemas; section settings schemas; form_schema → zod
    cache.ts             # cache tag constants + revalidate helpers
    email.ts turnstile.ts tracking-code.ts phone.ts media.ts
  types/database.ts      # generated, never hand-edit
supabase/migrations/ supabase/seed.sql supabase/tests/
docs/OWNER_GUIDE.md
```

## Non-negotiable rules
1. **i18n in the DB:** every translatable field is a JSONB locale map (`{"ar": "...", "en": "..."}`). Never add `_ar`/`_en` columns. Always read through `tr(field, locale)`, which falls back to the default locale and then to `''`.
2. **No hard-coded UI text.** Use next-intl keys; key values come from the `ui_strings` table, with `defaults/*.json` as the final fallback. Every new key is added to both defaults files AND the seed.
3. **Locales are data.** Never hard-code the locale list; read it from the `locales` table (cached). `dir` comes from the locale row.
4. **RTL/LTR:** use only logical utilities (`ms/me/ps/pe/start/end/text-start`). `ml/mr/pl/pr/left/right` are banned. Flip directional icons with `rtl:rotate-180`. Carousels and lightboxes respect `dir`.
5. **Theme = CSS variables** from the `theme` table, injected in the root layout. Never hard-code brand colors, fonts or radius in components; use the theme tokens.
6. **Sections:** the homepage is rendered from `page_sections` through `components/sections/registry.ts`. Each section type has a Zod settings schema that the admin form is generated from. Adding a type means adding the component + schema + registry entry + admin form + seed.
7. **RLS on every table** with explicit policies in the same migration, plus pgTAP tests for anon / editor / case_worker.
8. **The service-role key** is used only in `lib/supabase/admin.ts` (`import 'server-only'`), and only for request submission and cron jobs.
9. **Requests are never publicly readable.** Status lookup goes only through the `check_request_status` RPC. When `modules.requests` is false, the request routes 404 and every request UI is hidden.
10. **Validate on the server** with Zod, always.
11. **Cache:** public data is fetched with cache tags (`lib/cache.ts`). Every admin write revalidates the matching tags.
12. **Images:** compress client-side (WebP, max 1600px), register in `media`, and render with `next/image` with alt text from `tr(media.alt)`.
13. **Audit trail:** every request change inserts into `request_events`.
14. **Nothing copied from sessalb.org:** no text, images, logos or names.
15. **No secrets in git.** Keep `.env.example` complete.
16. Schema changes go only through new migrations. Regenerate types afterwards.

## Conventions
- Server Components by default; `'use client'` only when needed.
- Server Actions return `{ ok: true, data } | { ok: false, error }`. Never throw to the client.
- Files kebab-case, components PascalCase, DB snake_case.
- Store UTC; display in `Asia/Beirut`. Phones are E.164.
- Admin copy is plain Arabic, non-technical (e.g. the slug field is labeled "رابط الصفحة" and auto-generated).
- Accessibility: labeled inputs, visible focus, at least AA contrast (the theme editor warns on low contrast).
- Components under ~200 lines; extract beyond that.

## Workflow
- Work one phase at a time (BLUEPRINT §11). At the start, list the phase's tasks. At the end, verify each acceptance criterion and report pass/fail.
- State your plan and the files you'll touch before writing code.
- Run `pnpm lint && pnpm typecheck` after each step, and `pnpm build` + `supabase test db` before closing a phase.
- Commit per logical unit with conventional commits (`feat:`, `fix:`, `db:`, `chore:`).
- Seed content (objectives, sectors, default sections, theme) comes from BLUEPRINT Appendix A.

## Current phase
Phase 1 — Database: done (migrations, RLS, storage, seed, 78 pgTAP tests). Next: Phase 2 — Public site. Phase 0's live Cloudflare deploy is still pending the owner's account. (Update this line as phases complete.)
