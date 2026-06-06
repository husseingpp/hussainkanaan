# SunSpot · Golden Hour Explorer

A community React Native app for discovering, rating and sharing the best
**sunrise & sunset photography spots**. Interactive maps, local golden-hour solar
math, a weather-driven sky-suitability score, and community submissions — backed
by a real **Supabase** (Postgres) database with Row Level Security. **No AI**,
offline-first, runs entirely on free tiers.

Built with **Expo (dev client)** + **Expo Router** + **MapLibre**. This is the
mobile app showcased at `/sunspot` in the [portfolio](../README.md).

> ⚠️ **MapLibre needs a native build.** This app cannot run in Expo Go or be
> built in a hosted CI sandbox — you build a dev client locally (steps below).

## Run it

```bash
# 1 · install
cd golden-hour-explorer
npm install
# (versions were installed via the npm registry; on a fresh clone you may want
#  to align them to the SDK with: npx expo install --fix)

# 2 · environment (optional — sensible public defaults are baked in)
cp .env.example .env

# 3 · MapLibre requires a native dev client (NOT Expo Go)
npx expo prebuild
npx expo run:ios        # or: npx expo run:android
```

## Stack

| Layer | Choice |
|---|---|
| Runtime | Expo (dev client), TypeScript strict |
| Navigation | Expo Router (tabs + stack) |
| Maps | `@maplibre/maplibre-react-native` (keyless demo style, or a MapTiler key) |
| Backend | Supabase — Postgres, Auth, Storage, Row Level Security |
| Auth | Email/password (guest browsing by default; OAuth left as a TODO) |
| Solar | `suncalc` + `date-fns` (local) |
| Weather | Open-Meteo (keyless, direct HTTPS) → deterministic 0–100 sky score |
| State | Zustand-ready + TanStack Query; `expo-sqlite` offline cache |
| Media | `expo-image-picker` + `expo-image-manipulator` (compress before upload) |
| Alerts | `expo-notifications` local golden-hour reminders |

## Structure

```
src/
├── app/                      # Expo Router
│   ├── _layout.tsx           # providers: QueryClient, Auth, SafeArea, gestures
│   ├── index.tsx             # → redirect to /map
│   ├── (tabs)/               # map · explore · feed · favorites · profile
│   ├── spot/[id].tsx         # detail: solar times, sky score, rating, reviews
│   ├── submit.tsx            # GPS capture + photo compress/upload
│   └── sign-in.tsx           # email/password + continue as guest
├── components/               # Glass, Screen, StarRating, TypeBadge, SpotCard…
├── lib/                      # supabase, auth, db (TanStack hooks), cache,
│                             # solar, weather, geo, notifications, images
└── theme/theme.ts            # dark glassmorphic palette
```

## Backend & auth model (important)

This app is **adapted to a pre-existing Supabase schema** (the project's "v1"
tables) rather than a greenfield one. See [`supabase/SCHEMA.md`](./supabase/SCHEMA.md)
for the full mapping. Consequences baked into the app:

- **Guests browse, read-only.** Every table's `SELECT` policy is public, so the
  map/explore/feed/detail screens work with no sign-in.
- **Contributing needs a confirmed email.** All write policies require
  `author_id = auth.uid() AND is_email_verified()`, so submitting, rating,
  commenting and favouriting are gated behind `canContribute` (email confirmed).
- Spots use plain `latitude`/`longitude` → distances are a local **haversine**
  (`lib/geo.ts`). Ratings live in a separate `ratings` table; a DB trigger
  recomputes `spots.average_rating`/`ratings_count`. The feed reads `daily_spots`
  filtered to the last 24h (no `expires_at` column).

## Known limitations / TODO

- Google/Apple **SSO** is intentionally stubbed (email/password only for now).
- Daily-moment **creation** UI isn't wired (the feed is read-only); the
  `daily_spots` table and read path exist.
- Screenshots in the portfolio showcase are **designed mockups** until a dev
  client is built and real captures are added.
