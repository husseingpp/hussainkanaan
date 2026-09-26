# NGO Platform — Technical Blueprint (v2)

A multilingual NGO website: **Arabic first (RTL), English second, and more languages addable by the owner without a developer.** The owner controls the content AND the look through a simple admin panel.

**Reference:** layout and UX inspired by https://sessalb.org. Replicate structure and flow only; never copy their logo, name, text or photos.
**Client's Facebook page:** https://www.facebook.com/share/14spsC744tT/ (used for social links and an optional feed embed).

---

## 1. What the client asked for (source requirements)

From the client (translated):
1. Each **activity** is posted with its own photos (an album per activity).
2. Also post **participation in invitations and conferences** (تلبية دعوات ومؤتمرات).
3. Content is organized by **sectors**: agricultural, tourism, environmental, women's & children's rights, social, health, educational, and artificial intelligence.
4. Alternatively, the owner posts under a general title with whatever photos fit. So sector assignment is optional.
5. Content is in Arabic, translated to English, with more languages possible.
6. The owner decides the final content and look, so the backend must let them change how the site looks through a simple UI.

The NGO's **objectives** (12 items) are seeded as editable content; see Appendix A.

**Open question for the client:** is the public request/application system (§7) needed at launch? It's built as a module that can be switched off, so it can ship later without a redesign.

---

## 2. Goals & non-goals

**Goals**
- Running cost ≈ domain only (~$1/month).
- The owner edits everything: text, photos, albums, sectors, objectives, menus, homepage sections, colors, logo, font, and languages.
- Adding a new language requires no deploy.
- Mobile-first, fast, correct RTL/LTR switching.

**Non-goals (v1)**
- A free-form drag-and-drop page builder. Too complex, and it lets the owner break the design. We provide **predefined sections the owner can toggle, reorder and configure** instead.
- Online payments, applicant accounts, native app.
- Automatic Facebook post import. Meta's API requires app review, so it's not worth it for v1.

---

## 3. Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router) + TypeScript strict |
| UI | Tailwind CSS v4 (theme via CSS variables) + shadcn/ui |
| i18n | next-intl, with **messages loaded from the DB** (not JSON files) so languages are addable at runtime |
| Rich text | Tiptap (JSON per locale) |
| Drag & drop (admin reorder) | dnd-kit |
| Validation | Zod |
| Backend | Supabase: Postgres + RLS, Auth, Storage |
| Hosting | Cloudflare Workers via `@opennextjs/cloudflare` (free) |
| Email | Resend (free tier) |
| Anti-spam | Cloudflare Turnstile |
| Images | `browser-image-compression` on upload (WebP, max 1600px) |
| Optional auto-translate | DeepL API Free (~500k chars/month), used only as a "Translate from Arabic" button in admin; a human reviews the result |
| CI/cron | GitHub Actions (lint/build, Supabase keep-alive, weekly backup) |

**Free-tier risks**
- Supabase pauses free projects after ~1 week of inactivity → a daily keep-alive Action.
- About 1 GB of storage → compress all uploads, which fits thousands of photos. Albums are the main consumer, so monitor usage in the admin dashboard.

Verify every provider's current limits before launch.

---

## 4. Architecture

```
Visitors (/ar default, /en, /<any enabled locale>)       Owner / Staff
          │                                                    │
          ▼                                                    ▼
┌───────────────────────── Next.js on Cloudflare ───────────────────────────┐
│ Public (static + ISR, revalidated on every admin save)   /admin           │
│  Layout reads: theme, nav, locales, UI strings (cached)   Content          │
│  Home = ordered list of enabled sections from DB           Appearance       │
│  /activities /sectors/[slug] /events /objectives           Languages        │
│  /p/[slug] (custom pages) /apply /track /contact           Requests (module)│
└───────────────┬──────────────────────────────────────────────┬────────────┘
                ▼                                              ▼
     Supabase (Postgres+RLS, Auth, Storage)        Resend · DeepL (optional)
```

**Caching strategy:** every public page is ISR. Every admin write calls `revalidateTag`. Tags used: `settings`, `theme`, `nav`, `locales`, `ui-strings`, `sections`, `posts`, `sectors`, `objectives`, `pages`. Edits go live in seconds with near-zero compute.

---

## 5. Multilingual design (core decision)

**Translatable DB fields are JSONB maps**, not `_ar/_en` columns:
```json
{ "ar": "حماية البيئة", "en": "Protecting the environment" }
```
- Adding a language means adding a row in `locales`, with no schema change.
- Read helper: `tr(field, locale)` returns `field[locale] ?? field[defaultLocale] ?? ''`. So the site never shows blanks; it falls back to Arabic.
- Admin editors render **one tab per enabled locale**, show a "missing translation" badge per tab, and (optionally) a "Translate from Arabic" button (DeepL).
- Rich text: `body` is `{ "ar": <tiptap json>, "en": <tiptap json> }`.

**`locales` table:** `code` (pk, e.g. `ar`), `name` (native name, e.g. "العربية"), `dir` (`rtl`|`ltr`), `is_default`, `is_enabled`, `sort_order`. Exactly one default (enforced by a partial unique index).

**UI strings** (buttons, labels, nav fallbacks) live in the `ui_strings` table: `key text pk`, `value jsonb` (locale map). The next-intl `getRequestConfig` loads them from the DB (cached with the `ui-strings` tag). A code-level `defaults/ar.json` + `defaults/en.json` seeds the table and serves as the final fallback.

**Routing:** `/[locale]/...`. Middleware validates `locale` against the cached enabled-locales list. Unknown locales redirect to the default. `<html lang dir>` is set from the locale row. A language switcher lists enabled locales.

**SEO:** `hreflang` alternates for each enabled locale, plus a per-locale sitemap.

---

## 6. Content model

Every table has `id uuid pk default gen_random_uuid()`, `created_at`, `updated_at` (trigger). `i18n` = JSONB locale map.

```sql
-- Settings & appearance
site_settings (singleton id=1)
  org_name i18n, tagline i18n, logo_url, logo_dark_url, favicon_url,
  phone, whatsapp, email, address i18n, map_embed_url,
  socials jsonb            -- {facebook, instagram, x, youtube, tiktok, linkedin}
  donate_info i18n, footer_text i18n,
  modules jsonb default '{"requests":false,"donate":true,"facebook_feed":false}'

theme (singleton id=1)
  primary_color, secondary_color, accent_color, background_color, text_color,   -- hex
  font_arabic   ('ibm_plex_arabic'|'cairo'|'tajawal'|'noto_kufi'),
  font_latin    ('inter'|'poppins'|'noto_sans'),
  radius        ('none'|'sm'|'md'|'lg'|'full'),
  header_style  ('light'|'dark'|'transparent_over_hero'),
  footer_style  ('light'|'dark')

nav_items
  label i18n, link_type ('page'|'sector'|'route'|'external'), target text,
  parent_id null (one level of dropdown), sort_order, is_active

page_sections                  -- the homepage (and any page) is a list of these
  page_key ('home' | custom page id), section_type, sort_order, is_active,
  title i18n, subtitle i18n, settings jsonb
  -- section_type (fixed set, each with its own settings schema):
  --   hero_slider      {slide_ids[], autoplay, interval}
  --   about_intro      {image_url, body i18n, cta}
  --   objectives       {layout:'grid'|'list', show_icons}
  --   sectors_grid     {columns}
  --   latest_activities{count, sector_id?}
  --   events_strip     {count}                 -- invitations & conferences
  --   stats            {items:[{value, label i18n, icon}]}
  --   gallery          {album_post_id? | media_ids[]}
  --   partners         {logo media_ids[]}
  --   cta_banner       {image_url, text i18n, button_label i18n, link}
  --   facebook_feed    {}                       -- FB Page Plugin embed
  --   request_cta      {}                       -- only if modules.requests
  --   rich_text        {body i18n}

hero_slides
  image_url, title i18n, subtitle i18n, cta_label i18n, cta_link,
  overlay_opacity int (0–80), text_position ('start'|'center'|'end'),
  sort_order, is_active

-- Content
sectors                        -- القطاعات
  slug unique, name i18n, description i18n, icon, cover_image, color, sort_order, is_active

objectives                     -- أهدافنا
  text i18n, icon, sector_id null, sort_order, is_active

posts                          -- one table, three kinds
  kind ('activity'|'event'|'news'),
       -- activity = نشاط ; event = دعوات ومؤتمرات (participation) ; news = خبر عام
  slug unique, title i18n, excerpt i18n, body i18n (tiptap per locale),
  cover_media_id -> media, event_date date null, location i18n null,
  status ('draft'|'published'), published_at, is_featured bool, author_id

post_sectors (post_id, sector_id) pk     -- optional, many-to-many
post_media   (post_id, media_id, sort_order, caption i18n) pk(post_id, media_id)   -- the album

media                          -- central media library
  storage_path, url, width, height, size_bytes, alt i18n, uploaded_by

pages                          -- custom pages (About, Who we are, Board...)
  slug unique, title i18n, body i18n, cover_image, show_in_nav bool,
  status, seo_description i18n

-- i18n infrastructure
locales, ui_strings            -- see §5

-- People
profiles (user_id pk -> auth.users, full_name, role ('admin'|'editor'|'case_worker'), is_active)
```

**Theme application:** the root layout reads `theme` (cached) and injects CSS variables (`--color-primary`, `--radius`, `--font-ar`, …) into `<html style>`. Tailwind v4's `@theme` maps utilities to those variables, so a color change in admin restyles the whole site with no rebuild. Fonts: all curated options are preloaded via `next/font`, and the chosen one is selected by a CSS variable.

**Why fixed sections instead of a free builder:** the owner gets real control (turn sections on/off, reorder them, change titles, pick counts, colors, photos) but can't produce a broken layout. New section types are added by a developer when needed.

---

## 7. Requests module (switchable via `site_settings.modules.requests`)

Unchanged from v1, except all labels are i18n:
- `request_types`: slug, name i18n, description i18n, icon, `form_schema` jsonb (fields with `label` i18n, `type`, `required`, `options[{value, label i18n}]`), is_open, sort_order
- `requests`: type_id, tracking_code, full_name, phone (E.164), region, answers jsonb, status (`new|in_review|approved|rejected|fulfilled|closed`), priority, assigned_to, public_note, consent_given, locale (the language the applicant used)
- `request_events`: append-only audit trail

**Flow:** server action → Turnstile → Zod validation built from `form_schema` → insert (service role) → `created` event → email staff. Tracking uses code + phone via the `check_request_status` RPC (security definer, rate-limited).

When the module is off: `/apply` and `/track` return 404, the nav and home sections hide it, and the admin menu hides it.

---

## 8. Security (RLS)

| Table | anon | editor | case_worker | admin |
|---|---|---|---|---|
| site_settings, theme, nav_items, page_sections, hero_slides, locales, ui_strings | read (active/enabled) | read/write (not `locales`, `modules`) | read | all |
| sectors, objectives, pages, media | read active/published | all | read | all |
| posts, post_sectors, post_media | read published | all | read | all |
| request_types | read open | read | read | all |
| requests, request_events | **none** | none | read/write | all |
| profiles | none | read own | read own | all |

- RLS is enabled with explicit policies on every table, in the same migration that creates it.
- The service-role key is server-only and used only for request submission and cron jobs.
- Storage bucket `public-images`: public read; write for admin/editor only.
- Request data retention: anonymize closed requests after 12 months.

---

## 9. Frontend

### Public routes (`/[locale]/…`)
| Route | Content |
|---|---|
| `/` | Ordered `page_sections` for `home` |
| `/activities` | Activity grid; filters by sector and year; pagination |
| `/activities/[slug]` | Cover, body, **photo album** (masonry grid + lightbox with swipe), sectors chips, share buttons, related activities |
| `/events` | Invitations & conferences (kind = `event`), sorted by `event_date` |
| `/events/[slug]` | Same template as an activity plus date/location |
| `/news`, `/news/[slug]` | General posts |
| `/sectors` | Sector cards |
| `/sectors/[slug]` | Sector header + its objectives + its activities |
| `/objectives` | Full objectives list |
| `/p/[slug]` | Custom pages (About, etc.) |
| `/contact` | Contact info, WhatsApp button, map, Facebook link |
| `/donate` | If the module is on |
| `/apply`, `/apply/[type]`, `/track` | If the requests module is on |
| `/privacy` | Privacy notice |

### Admin (`/admin`) — Arabic UI by default, simple and non-technical
**Content**
- **Activities / Events / News:** one editor with a "kind" selector. Fields: locale tabs (title, excerpt, body), cover, **album uploader** (multi-select, drag to reorder, caption per photo, compression + progress), sectors multi-select (optional), date/location for events, draft/publish, feature on home.
- **Sectors**, **Objectives**, **Pages:** list with drag reorder, edit, and an active toggle.
- **Media library:** grid, search, alt text, delete if unused, total storage used.

**Appearance**
- **Theme:** color pickers with a live preview panel and a contrast warning; font dropdowns; corner radius; header/footer style; logo/favicon upload; a "Reset to default" button.
- **Homepage:** list of sections with drag reorder, on/off toggle, "Edit" (a form generated from that section type's settings schema), and "Add section" (pick a type).
- **Hero slides:** upload, text on photo, overlay darkness, text position, reorder.
- **Menu:** nav items with drag reorder, one dropdown level, link pickers (page / sector / route / URL).

**Settings**
- **General:** org name, tagline, contacts, socials, footer, modules on/off.
- **Languages:** add a language (code, native name, direction), enable/disable, set the default; a translation-coverage % per language; a UI-strings editor (table of key × locale).
- **Users & roles.**

**Requests** (if the module is on): inbox, detail, status workflow, form builder. Same as v1.

**Admin UX rules:** every save shows a toast; unsaved-changes guard; "View on site" link on every item; Arabic labels; no technical jargon ("slug" is shown as "رابط الصفحة" and auto-generated).

### RTL/LTR
- Use only logical Tailwind utilities; directional icons flip with `rtl:rotate-180`.
- The lightbox and carousel swipe direction follow `dir`.

---

## 10. Ops
- **CI:** lint, typecheck, build on PR. **Cron:** daily Supabase keep-alive; weekly `pg_dump` backup.
- **Env vars:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `RESEND_API_KEY`, `STAFF_NOTIFY_EMAILS`, `NEXT_PUBLIC_SITE_URL`, `DEEPL_API_KEY` (optional).
- **SEO:** per-locale metadata, hreflang, sitemap, OG image per post (its cover).

---

## 11. Build phases & acceptance criteria

**Phase 0 — Scaffold**
- Next.js, Tailwind v4, shadcn, next-intl with a DB-backed message loader stubbed from `defaults/*.json`; Supabase local; Cloudflare deploy.
- ✅ `/ar` renders RTL and `/en` renders LTR; production URL is live.

**Phase 1 — Database**
- All migrations: tables, enums, triggers, RLS, storage policies, `tr()` equivalents where useful; seed data (Appendix A + default theme + home sections + ar/en locales + UI strings).
- ✅ pgTAP tests: anon can't read drafts or requests; editor can't touch locales/modules/requests.

**Phase 2 — Public site**
- Theme variables, dynamic nav, language switcher, section renderer for all section types, and all public routes except requests.
- ✅ Changing the primary color in the DB restyles the site after revalidation; Lighthouse mobile ≥ 90.

**Phase 3 — Admin core + content**
- Auth, roles, admin shell; posts editor with album uploader; sectors, objectives, pages, media library.
- ✅ The owner creates an activity with 20 photos in Arabic only; it shows on `/ar` and falls back to Arabic on `/en`.

**Phase 4 — Appearance**
- Theme editor with live preview, homepage section manager, hero slides, menu editor.
- ✅ Reorder/toggle sections and change font/colors, all without a deploy.

**Phase 5 — Languages**
- Languages manager, UI-strings editor, coverage %, optional DeepL "Translate from Arabic".
- ✅ Adding `fr` (ltr) in admin makes `/fr` work with fallbacks, without a deploy.

**Phase 6 — Requests module** (if confirmed)
- Everything in §7 plus the admin inbox and form builder.
- ✅ With the module off, all request routes 404 and the UI is hidden.

**Phase 7 — Hardening & handover**
- Rate limits, retention job, backups, keep-alive, SEO, privacy page, and `docs/OWNER_GUIDE.md` (Arabic, with screenshots).

---

## Appendix A — Seed content (owner will edit)

### Objectives (أهدافنا)
| # | ar | en |
|---|---|---|
| 1 | تعزيز الأمن الغذائي ودعم الإنتاج المحلي. | Strengthening food security and supporting local production. |
| 2 | تنمية القطاع السياحي وتعزيز السياحة الريفية. | Developing the tourism sector and promoting rural tourism. |
| 3 | حماية البيئة وصون الموارد الطبيعية. | Protecting the environment and conserving natural resources. |
| 4 | إدارة النفايات وتعزيز إعادة التدوير. | Waste management and promoting recycling. |
| 5 | تعزيز السلامة والحماية الاجتماعية والتماسك المجتمعي. | Promoting safety, social protection and community cohesion. |
| 6 | تمكين المرأة والشباب وتعزيز مشاركتهم في التنمية. | Empowering women and youth and strengthening their role in development. |
| 7 | حماية حقوق المرأة والطفل وتعزيز المساواة وتكافؤ الفرص والحد من جميع أشكال التمييز والعنف. | Protecting women's and children's rights, promoting equality and equal opportunity, and reducing all forms of discrimination and violence. |
| 8 | تعزيز الرعاية الصحية والتوعية والوقاية الصحية. | Promoting healthcare, health awareness and prevention. |
| 9 | التعليم والتدريب المهني والحرفي وتنمية المهارات. | Education, vocational and craft training, and skills development. |
| 10 | توظيف الذكاء الاصطناعي والتحول الرقمي في التنمية. | Harnessing artificial intelligence and digital transformation for development. |
| 11 | الحد من مخاطر الكوارث وتعزيز القدرة على الاستجابة وحالات الطوارئ. | Reducing disaster risk and strengthening emergency response capacity. |
| 12 | تعزيز الطاقة المتجددة وكفاءة استخدام الطاقة. | Promoting renewable energy and energy efficiency. |

### Sectors (القطاعات), as named by the client
| slug | ar | en |
|---|---|---|
| agriculture | القطاع الزراعي | Agriculture |
| tourism | القطاع السياحي | Tourism |
| environment | القطاع البيئي | Environment |
| women-children | حقوق المرأة والطفل | Women's & Children's Rights |
| social | القطاع الاجتماعي | Social |
| health | القطاع الصحي | Health |
| education | القطاع التربوي | Education |
| ai | الذكاء الاصطناعي | Artificial Intelligence |

Objectives 11 (disasters) and 12 (renewable energy) have no matching sector yet. Leave `sector_id` null; the owner can add sectors for them.

Suggested objective → sector links: 1→agriculture, 2→tourism, 3,4→environment, 5→social, 6,7→women-children, 8→health, 9→education, 10→ai.

### Default homepage sections (in order)
hero_slider → about_intro → objectives → sectors_grid → latest_activities (6) → events_strip (4) → stats → partners (off) → facebook_feed (off) → cta_banner (contact)

### Default theme
Placeholder green/earth palette (primary `#1F6F4A`, secondary `#C98A2B`, accent `#2B7A9E`), IBM Plex Sans Arabic + Inter, radius `md`, header `transparent_over_hero`, footer `dark`. The owner will change these.
