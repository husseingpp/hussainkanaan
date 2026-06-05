# Hussein Kanaan — Portfolio

A modern, single-page personal portfolio for **Hussein Kanaan** — IT Support
Specialist & Full-Stack Developer.

Built with **Next.js (App Router)**, **TypeScript**, **Tailwind CSS**, and
**Framer Motion**. Dark mode by default with a light toggle, glassmorphism
cards, animated gradient blobs, a subtle grain overlay, scroll-reveal
animations, magnetic buttons, and hover-tilt cards.

## ✨ Features

- **Single-page scroll** with smooth section transitions and a sticky,
  shrinking glass navbar.
- **Dark / light theme** toggle (defaults to dark) via `next-themes`.
- **Micro-interactions**: typewriter role animation, magnetic buttons,
  3D tilt cards, scroll-reveal fade + slide, animated gradient blobs.
- **Sections**: Hero · About · Experience (timeline) · Skills (grouped pills +
  Google IT Support cert badge) · Projects · Contact (mock-submit form) ·
  Footer.
- **Accessible**: semantic HTML, keyboard navigation, visible focus rings,
  a skip link, and full `prefers-reduced-motion` support.
- **Responsive**, mobile-first layout.
- **Deploy-ready for Vercel.**

## 🗂 Project structure

```
.
├── app/
│   ├── globals.css        # Tailwind layers, theme tokens, noise/glass utilities
│   ├── layout.tsx         # Fonts (Geist), metadata, ThemeProvider
│   └── page.tsx           # Composes all sections
├── components/            # Reusable UI + interactions
│   ├── GradientBlobs.tsx
│   ├── Icons.tsx
│   ├── MagneticButton.tsx
│   ├── Navbar.tsx
│   ├── SectionHeading.tsx
│   ├── SectionReveal.tsx
│   ├── ThemeProvider.tsx
│   ├── ThemeToggle.tsx
│   ├── TiltCard.tsx
│   └── Typewriter.tsx
├── sections/              # Page sections
│   ├── Hero.tsx
│   ├── About.tsx
│   ├── Experience.tsx
│   ├── Skills.tsx
│   ├── Projects.tsx
│   ├── Contact.tsx
│   └── Footer.tsx
├── data/
│   └── portfolio.ts       # ⭐ ALL your content lives here
└── public/                # Static assets (add your CV here)
```

## ✏️ Editing your content

**Everything you'd want to change lives in [`data/portfolio.ts`](./data/portfolio.ts).**
Update your bio, location, jobs, skills, projects, certifications, and social
links there — the UI reads from this single config file.

- `personal` — name, roles (typewriter), tagline, email, location, CV path.
- `about` — bio paragraphs and the quick-facts grid.
- `experiences` — timeline entries.
- `skillGroups` — grouped skill pills.
- `certifications` — badge(s), e.g. Google IT Support.
- `projects` — project cards (title, description, tech tags, links).
- `socials` / `navLinks` — footer/contact links and nav items.

### Adding your CV

The **Download CV** button links to `/hussein-kanaan-cv.pdf`. Drop your file at
`public/hussein-kanaan-cv.pdf` (or change `personal.cv` in `data/portfolio.ts`).

### Contact form

The contact form is a **mock submit** (no backend). To make it real, wire the
`handleSubmit` in [`sections/Contact.tsx`](./sections/Contact.tsx) to an email
service or API route (e.g. Resend, Formspree, or a Next.js Route Handler).

## 🚀 Getting started

Requires **Node.js 18.17+** (Node 20+ recommended).

```bash
# install dependencies
npm install

# start the dev server (http://localhost:3000)
npm run dev

# create a production build
npm run build

# run the production build locally
npm start

# lint
npm run lint
```

## ▲ Deploying to Vercel

1. Push this repository to GitHub.
2. Go to [vercel.com/new](https://vercel.com/new) and import the repo.
3. Vercel auto-detects Next.js — no extra configuration needed. Click **Deploy**.

Or deploy from the CLI:

```bash
npm i -g vercel
vercel        # preview deploy
vercel --prod # production deploy
```

## 🧱 Tech stack

| Concern        | Choice                          |
| -------------- | ------------------------------- |
| Framework      | Next.js 14 (App Router)         |
| Language       | TypeScript                      |
| Styling        | Tailwind CSS                    |
| Animation      | Framer Motion                   |
| Fonts          | Geist Sans + Geist Mono         |
| Theme          | next-themes                     |
| Hosting        | Vercel                          |

---

Built with Next.js. © Hussein Kanaan.
