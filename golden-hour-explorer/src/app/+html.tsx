import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

/**
 * Web-only HTML document shell (Expo Router renders this for `expo export
 * --platform web`; it is ignored on native). It carries the CSS custom-property
 * design tokens that drive the whole app's theme, plus a pre-paint script that
 * applies the saved/system theme BEFORE first paint to avoid a flash.
 */

// Design tokens. Default :root = minimal dark; [data-gh-mode="light"] flips the
// palette; density/radius presets scale spacing and corners. html/body/#root
// height:100% guarantees the map container has a real size.
const BASE_CSS = `
:root {
  color-scheme: dark;
  --gh-space-xs: 6px; --gh-space-sm: 10px; --gh-space-md: 14px;
  --gh-space-lg: 20px; --gh-space-xl: 28px; --gh-space-xxl: 40px;
  --gh-radius-sm: 10px; --gh-radius-md: 16px; --gh-radius-lg: 22px; --gh-radius-pill: 999px;
  --gh-bg: #0d0d0f; --gh-bg2: #161618; --gh-surface: #161618;
  --gh-border: rgba(255,255,255,0.08);
  --gh-text: #f2f2f3; --gh-text-muted: #a1a1aa; --gh-text-faint: #6b6b73;
  --gh-accent: #f0922f; --gh-accent2: #d9542b;
  --gh-sunrise: #ffb85c; --gh-sunset: #d9542b; --gh-both: #a071d6;
  --gh-star: #e8b53d; --gh-good: #36c47a; --gh-warn: #e8a94b; --gh-danger: #e0556b;
}
[data-gh-mode="light"] {
  color-scheme: light;
  --gh-bg: #fafafa; --gh-bg2: #ffffff; --gh-surface: #ffffff;
  --gh-border: rgba(0,0,0,0.10);
  --gh-text: #18181b; --gh-text-muted: #52525b; --gh-text-faint: #9b9ba3;
  --gh-accent: #d9701f; --gh-accent2: #c2541f;
  --gh-good: #1f9d57; --gh-warn: #c98414; --gh-danger: #d23f57;
}
[data-gh-density="compact"] {
  --gh-space-xs: 4px; --gh-space-sm: 7px; --gh-space-md: 10px;
  --gh-space-lg: 14px; --gh-space-xl: 20px; --gh-space-xxl: 28px;
}
[data-gh-radius="sharp"] {
  --gh-radius-sm: 4px; --gh-radius-md: 8px; --gh-radius-lg: 12px;
}
html, body, #root { height: 100%; }
body {
  margin: 0;
  background: var(--gh-bg);
  font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}
#root { display: flex; flex-direction: column; }
/* Photos and surfaces ease their hover/press transforms for a polished feel. */
img { -webkit-user-drag: none; user-select: none; }
@media (prefers-reduced-motion: reduce) {
  * { transition-duration: 0.001ms !important; animation-duration: 0.001ms !important; }
}
`;

// Runs in the browser before React mounts → no theme flash on reload.
const PRE_PAINT = `
(function () {
  try {
    var d = document.documentElement;
    var t = { mode: "system", density: "comfortable", radius: "soft" };
    try {
      var s = JSON.parse(localStorage.getItem("gh:tweaks") || "{}");
      if (s.mode) t.mode = s.mode;
      if (s.density) t.density = s.density;
      if (s.radius) t.radius = s.radius;
    } catch (e) {}
    var dark = t.mode === "dark" ||
      (t.mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    d.setAttribute("data-gh-mode", dark ? "dark" : "light");
    d.setAttribute("data-gh-density", t.density);
    d.setAttribute("data-gh-radius", t.radius);
    d.style.colorScheme = dark ? "dark" : "light";
  } catch (e) {}
})();
`;

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: BASE_CSS }} />
        <script dangerouslySetInnerHTML={{ __html: PRE_PAINT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
