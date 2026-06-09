# Hussein Kanaan — Portfolio

A modern, single-page personal portfolio for **Hussein Kanaan** — IT Support
Specialist, Aspiring QA Engineer & Database Administrator (Beirut, Lebanon).

Built with **Next.js (App Router)** + **TypeScript** and a custom **CSS
variable theming system**. It ships **three live design directions**, light &
dark modes, and a floating **Tweaks** panel to switch between them in real time.

## ✨ Features

- **Three design directions** — switch live via the Tweaks panel:
  - **Editorial** — Instrument Serif display, clay accent, sharp corners (default)
  - **Warm** — Schibsted Grotesk, honey accent, soft rounded cards
  - **Tech** — Space Grotesk, indigo accent, grid-forward
- **Light / dark** — follows your system setting by default, with a toggle in
  the nav. Fully themed across all three directions.
- **Tweaks panel** (bottom-right) — Style, Theme, **5 accent colors**,
  **animation level** (Full / Subtle / Off), and a **film-grain** toggle.
  All choices persist in `localStorage` and apply before first paint (no flash).
- **Alive & animated** — staggered hero entrance, typewriter role cycler, soft
  drifting glow + grid hero background, scroll-reveal on every section, hover
  micro-interactions on chips/cards/buttons/timeline, and a nav that condenses
  + blurs on scroll.
- **Sections** — Hero · About (with a drag-and-drop headshot slot, facts,
  bio) · Skills (5 grouped cards) · Projects (featured SunSpot + Google Maps
  Scraper + "More on GitHub") · Experience (Experience / Education /
  Certifications timelines) · Contact · Footer.
- **Accessible** — semantic HTML, keyboard navigation, visible focus rings, a
  skip link, ARIA on the Tweaks controls, and full `prefers-reduced-motion`
  support (animations degrade to a static, fully-visible page).
- **Responsive**, mobile-first layout.
- **Deploy-ready for Vercel.**

## 🗂 Project structure

```
.
├── app/
│   ├── globals.css        # Theming tokens (3 directions × light/dark) + all styles
│   ├── layout.tsx         # Fonts, metadata, no-flash script, TweaksProvider
│   └── page.tsx           # Composes nav, sections, footer, Tweaks panel
├── components/
│   ├── Icons.tsx          # Inline SVG icon set
│   ├── Nav.tsx            # Sticky nav (condenses on scroll) + theme toggle
│   ├── Rich.tsx           # **bold** markdown → <strong> renderer
│   ├── TweaksProvider.tsx # Theme/direction/anim/accent state, persistence, reveal observer
│   └── TweaksPanel.tsx    # The live style-switcher panel
├── sections/
│   ├── Hero.tsx  About.tsx  Skills.tsx  Projects.tsx
│   ├── Experience.tsx  Contact.tsx  Footer.tsx
├── data/
│   └── portfolio.ts       # ⭐ ALL your content lives here
└── public/                # Static assets (add your CV here)
```

## ✏️ Editing your content

**Everything you'd want to change lives in [`data/portfolio.ts`](./data/portfolio.ts)** —
name, roles (typewriter), tagline, bio, location, contact details, skills,
projects, experience, education, and certifications. The UI reads from this
single typed config.

### Adding your CV / headshot

- **CV:** `personal.cv` points to `/hussein-kanaan-cv.pdf`. Drop the file in
  `public/` to enable a download link from it.
- **Headshot:** the About section has a drag-and-drop slot — drop an image and
  it's previewed and saved to `localStorage`. To ship a permanent photo, place
  it in `public/` and reference it in `sections/About.tsx`.

## 🎨 How theming works

The visual system is driven entirely by CSS custom properties scoped to two
attributes on `<html>`:

- `data-direction` — `editorial` | `warm` | `tech` (fonts, radii, weights)
- `data-theme` — `light` | `dark` (color tokens)
- `data-anim` — `full` | `subtle` | `off` (animation level)

`components/TweaksProvider.tsx` manages this state, persists it, and applies the
accent override. A small inline script in `app/layout.tsx` applies the saved
choice before paint to prevent a flash. To change the **default** direction or
theme, edit `DEFAULTS` in `TweaksProvider.tsx`.

## 🚀 Getting started

Requires **Node.js 18.17+** (Node 20+ recommended).

```bash
npm install      # install dependencies
npm run dev      # dev server → http://localhost:3000
npm run build    # production build
npm start        # serve the production build
npm run lint     # lint
```

## ▲ Deploying to Vercel

1. Push this repository to GitHub.
2. Import it at [vercel.com/new](https://vercel.com/new) — Next.js is
   auto-detected, no config needed. Click **Deploy**.

Or via CLI: `npm i -g vercel && vercel --prod`.

## 🧱 Tech stack

| Concern   | Choice                                   |
| --------- | ---------------------------------------- |
| Framework | Next.js 14 (App Router)                  |
| Language  | TypeScript                               |
| Styling   | Custom CSS variable theming system       |
| Fonts     | Instrument Serif · Hanken / Schibsted / Space Grotesk · JetBrains Mono (via `next/font`) |
| Hosting   | Vercel                                   |

---

Designed & built by Hussein Kanaan.
