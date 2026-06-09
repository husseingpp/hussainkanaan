import type { Metadata } from "next";
import Link from "next/link";
import { Icons } from "@/components/Icons";
import { SunspotHeader } from "@/components/sunspot/SunspotHeader";
import { SpotExplorer } from "@/components/sunspot/SpotExplorer";
import "./sunspot.css";

const SOURCE_URL =
  "https://github.com/husseingpp/hussainkanaan/tree/main/golden-hour-explorer";
const APK_URL =
  "https://github.com/husseingpp/hussainkanaan/releases/download/sunspot-android-latest/sunspot-golden-hour.apk";
const WEB_APP_URL = "/hussainkanaan/sunspot-app/";

export const metadata: Metadata = {
  title: "SunSpot · Golden Hour Explorer — Hussein Kanaan",
  description:
    "A community React Native app for discovering, rating and sharing the best sunrise & sunset photography spots. Interactive maps, golden-hour solar math, a weather-based sky score, and a real Supabase backend with row-level security.",
};

const FEATURES: { icon: keyof typeof Icons; title: string; body: string }[] = [
  {
    icon: "map",
    title: "Interactive map",
    body: "MapLibre vector map with markers for every approved spot. Tap a pin to open its detail, photos and reviews.",
  },
  {
    icon: "sun",
    title: "Golden-hour math",
    body: "SunCalc + date-fns compute sunrise, sunset and the golden-hour window locally for each spot and date — no network needed.",
  },
  {
    icon: "spark",
    title: "Sky-suitability score",
    body: "A deterministic 0–100 score from Open-Meteo cloud cover, wind, humidity and temperature. A pure formula — no AI anywhere.",
  },
  {
    icon: "pin",
    title: "Community spots",
    body: "Submit a new spot with GPS auto-capture and locally compressed photos, then rate it 1–5. Moderated via status flags.",
  },
  {
    icon: "moon",
    title: "Daily moments feed",
    body: "Full-screen, gesture-driven “stories” of the day’s skies that roll off after 24 hours.",
  },
  {
    icon: "database",
    title: "Offline-first cache",
    body: "expo-sqlite hydrates instantly from cache, then reconciles against Supabase. A Set of ids de-dups cache + network.",
  },
  {
    icon: "phone",
    title: "Golden-hour alerts",
    body: "expo-notifications schedules local “15 minutes to golden hour” reminders for your saved spots.",
  },
  {
    icon: "server",
    title: "Real backend, secured",
    body: "Supabase Postgres with row-level security: reads are public, writes are restricted to verified accounts and owners.",
  },
];

const PHONES: {
  cap: string;
  cls: string;
  render: () => React.ReactNode;
}[] = [
  {
    cap: "Map",
    cls: "gh-screen-map",
    render: () => (
      <>
        <div className="gh-screen-top">
          <span>Explore</span>
          <span>◴ 19:42</span>
        </div>
        <div className="gh-screen-pins">
          <i style={{ left: "22%", top: "30%" }} />
          <i style={{ left: "58%", top: "44%", background: "#d9542b" }} />
          <i style={{ left: "40%", top: "62%", background: "#8a63c0" }} />
          <i style={{ left: "72%", top: "26%" }} />
        </div>
        <div className="gh-glass" style={{ marginTop: "auto" }}>
          <div className="gh-glass-title">Raouché Pigeon Rocks</div>
          <div className="gh-glass-sub">Sunset · ★ 4.8 · golden hour 19:02</div>
        </div>
        <div className="gh-tabbar">
          <i className="on" />
          <i />
          <i />
          <i />
          <i />
        </div>
      </>
    ),
  },
  {
    cap: "Spot detail",
    cls: "",
    render: () => (
      <>
        <div className="gh-screen-top">
          <span>← Spot</span>
          <span>♡</span>
        </div>
        <div className="gh-screen-sun" />
        <div className="gh-glass">
          <div className="gh-glass-title">Santorini — Oia</div>
          <div className="gh-glass-sub">Sunset · ★ 4.7 · 412 ratings</div>
        </div>
        <div className="gh-glass">
          <div className="gh-glass-sub">Sky score today</div>
          <div className="gh-bar-line" style={{ width: "82%" }} />
          <div className="gh-glass-sub" style={{ marginTop: 6 }}>82 / 100 · clear</div>
        </div>
        <div className="gh-tabbar">
          <i />
          <i className="on" />
          <i />
          <i />
          <i />
        </div>
      </>
    ),
  },
  {
    cap: "Feed",
    cls: "gh-screen-feed",
    render: () => (
      <>
        <div className="gh-screen-top">
          <span>Today’s skies</span>
          <span>24h</span>
        </div>
        <div className="gh-bar-line" style={{ width: "100%", height: 3 }} />
        <div className="gh-screen-sun" style={{ width: 80, height: 80 }} />
        <div className="gh-glass" style={{ marginTop: "auto" }}>
          <div className="gh-glass-title">@dawnchaser</div>
          <div className="gh-glass-sub">Caught the first light over the Cedars 🌄</div>
        </div>
        <div className="gh-tabbar">
          <i />
          <i />
          <i className="on" />
          <i />
          <i />
        </div>
      </>
    ),
  },
  {
    cap: "Profile",
    cls: "gh-screen-profile",
    render: () => (
      <>
        <div className="gh-screen-top">
          <span>Profile</span>
          <span>⚙</span>
        </div>
        <div className="gh-screen-sun" style={{ width: 46, height: 46 }} />
        <div className="gh-glass">
          <div className="gh-glass-title">Dawn Chaser</div>
          <div className="gh-glass-sub">37 golden hours explored</div>
        </div>
        <div className="gh-glass">
          <div className="gh-glass-sub">Badges</div>
          <div className="gh-bar-line" style={{ width: "60%" }} />
        </div>
        <div className="gh-tabbar">
          <i />
          <i />
          <i />
          <i />
          <i className="on" />
        </div>
      </>
    ),
  },
];

export default function SunspotPage() {
  return (
    <div className="gh-page">
      <SunspotHeader />

      {/* hero */}
      <section className="gh-hero">
        <div className="gh-hero-inner">
          <span className="gh-eyebrow">Featured project · Mobile app</span>
          <h1 className="gh-h1">SunSpot · Golden Hour Explorer</h1>
          <p className="gh-lead">
            A community app for discovering, rating and sharing the best sunrise and
            sunset photography spots. Built from scratch with Expo &amp; React Native on a
            real Supabase backend — interactive maps, local golden-hour math and a
            weather-driven sky score. No AI, offline-first, entirely on free tiers.
          </p>
          <div className="gh-chips">
            {[
              "Expo",
              "React Native",
              "Expo Router",
              "MapLibre",
              "Supabase",
              "PostgreSQL",
              "TanStack Query",
              "SunCalc",
              "Open-Meteo",
            ].map((c) => (
              <span key={c} className="gh-chip">
                {c}
              </span>
            ))}
          </div>
          <div className="gh-cta-row">
            <a className="gh-btn gh-btn-solid" href={WEB_APP_URL} target="_blank" rel="noreferrer">
              <Icons.globe /> Open web app
            </a>
            <a className="gh-btn gh-btn-android" href={APK_URL}>
              <Icons.phone /> Download Android APK
            </a>
            <a className="gh-btn gh-btn-ghost" href="#live">
              <Icons.map /> Explore the live map
            </a>
            <a className="gh-btn gh-btn-ghost" href={SOURCE_URL} target="_blank" rel="noreferrer">
              <Icons.github /> View source
            </a>
          </div>
        </div>
      </section>

      {/* live explorer */}
      <section className="gh-section" id="live">
        <span className="gh-kicker">Live data</span>
        <h2 className="gh-h2">Real spots, straight from the database.</h2>
        <p className="gh-sub">
          The map and list below are not mockups — they query the project’s live Supabase
          database in your browser using the public key. Reads are open to everyone; writes
          are locked down by row-level security. Tap a pin or a card to fly there.
        </p>
        <SpotExplorer />
      </section>

      {/* features */}
      <section className="gh-section">
        <span className="gh-kicker">What it does</span>
        <h2 className="gh-h2">Everything a golden-hour chaser needs.</h2>
        <div className="gh-features">
          {FEATURES.map((f) => {
            const Glyph = Icons[f.icon];
            return (
              <article key={f.title} className="gh-feature">
                <span className="gh-feature-ico">
                  <Glyph />
                </span>
                <h3>{f.title}</h3>
                <p>{f.body}</p>
              </article>
            );
          })}
        </div>
      </section>

      {/* screens */}
      <section className="gh-section">
        <span className="gh-kicker">The app</span>
        <h2 className="gh-h2">A dark, glassmorphic UI tuned for the outdoors.</h2>
        <p className="gh-sub">
          Five tabs — Map, Explore, Feed, Favorites and Profile — plus spot detail and a
          submit flow, all on glass surfaces with 48px+ touch targets for use in bright
          light.
        </p>
        <div className="gh-phones">
          {PHONES.map((p) => (
            <div className="gh-phone" key={p.cap}>
              <div className="gh-phone-frame">
                <div className={"gh-phone-screen " + p.cls}>{p.render()}</div>
              </div>
              <div className="gh-phone-cap">{p.cap}</div>
            </div>
          ))}
        </div>
        <p className="gh-note">
          Designed mockups — real device screenshots drop in once the native dev client is
          built locally (MapLibre requires a native build, so it can’t run in this hosted
          environment or in Expo Go).
        </p>
      </section>

      {/* architecture */}
      <section className="gh-section">
        <span className="gh-kicker">Under the hood</span>
        <h2 className="gh-h2">How it’s built.</h2>
        <div className="gh-arch">
          <div className="gh-arch-col">
            <h3>Mobile</h3>
            <ul>
              <li>
                <strong>Expo</strong> dev client + <strong>Expo Router</strong> (file-based
                tabs &amp; stack)
              </li>
              <li>
                <strong>React Native</strong>, reanimated &amp; gesture-handler for story
                gestures
              </li>
              <li>
                <strong>MapLibre RN</strong> vector map with a keyless demo style
              </li>
              <li>Glassmorphic dark theme with blur surfaces</li>
            </ul>
          </div>
          <div className="gh-arch-col">
            <h3>Data &amp; solar</h3>
            <ul>
              <li>
                <strong>SunCalc + date-fns</strong> for sunrise/sunset &amp; golden-hour
                windows
              </li>
              <li>
                <strong>Open-Meteo</strong> (keyless) → deterministic 0–100 sky score
              </li>
              <li>
                <strong>TanStack Query + Zustand</strong> for server cache &amp; UI state
              </li>
              <li>
                <strong>expo-sqlite</strong> offline cache with id de-dup
              </li>
            </ul>
          </div>
          <div className="gh-arch-col">
            <h3>Backend</h3>
            <ul>
              <li>
                <strong>Supabase Postgres</strong> — spots, ratings, comments, favorites,
                daily moments
              </li>
              <li>
                <strong>Row-level security</strong>: public reads, verified-owner writes
              </li>
              <li>
                <strong>Storage</strong> bucket for compressed photos
              </li>
              <li>Rating-recompute trigger · no server · no AI · free tier</li>
            </ul>
          </div>
        </div>
      </section>

      {/* run it */}
      <section className="gh-section" id="run">
        <span className="gh-kicker">Try it</span>
        <h2 className="gh-h2">Run it yourself.</h2>
        <p className="gh-sub">
          The fastest way to try it on Android is the prebuilt APK — no toolchain needed.
          Download it, open the file on your phone and allow install from an unknown source.
          It is a debug-keystore-signed test build (CI: Expo prebuild → Gradle release), so
          Android will warn it is from an “unknown developer” — that is expected.
        </p>
        <div className="gh-cta-row gh-cta-left">
          <a className="gh-btn gh-btn-solid" href={WEB_APP_URL} target="_blank" rel="noreferrer">
            <Icons.globe /> Open web app
          </a>
          <a className="gh-btn gh-btn-android" href={APK_URL}>
            <Icons.phone /> Download Android APK
          </a>
          <a className="gh-btn gh-btn-ghost" href={SOURCE_URL} target="_blank" rel="noreferrer">
            <Icons.github /> View source
          </a>
        </div>
        <p className="gh-sub" style={{ marginTop: "1.4rem" }}>
          Prefer to build it from source (and the only route for iOS)? MapLibre needs a
          native build, so the app runs on a dev client (not Expo Go). The source lives in
          the <code>golden-hour-explorer/</code> folder of this repo.
        </p>
        <div className="gh-code">
          <div className="gh-code-head">terminal</div>
          <pre>
            {`# 1 · install
cd golden-hour-explorer
npm install

# 2 · add your keys
cp .env.example .env   `}
            <span className="c"># Supabase URL + publishable key (+ optional MapTiler)</span>
            {`

# 3 · build a native dev client (MapLibre can't run in Expo Go)
npx expo prebuild
npx expo run:ios       `}
            <span className="c"># or: npx expo run:android</span>
          </pre>
        </div>
      </section>

      <footer className="gh-foot">
        Part of <Link href="/">Hussein Kanaan’s portfolio</Link>. Rebuilt from scratch,
        June 2026.
      </footer>
    </div>
  );
}
