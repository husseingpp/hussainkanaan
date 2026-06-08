/**
 * Web theme — every token is a CSS custom property so the Settings page can
 * retheme the whole app at runtime. react-native-web's `isWebColor` passes any
 * `var(...)` string straight through StyleSheet (and length props pass strings
 * through too), so no consumer needs to change. The fallbacks encode the default
 * minimal-dark palette, so the app still renders correctly before the
 * `app/+html.tsx` stylesheet/pre-paint script run and under static SSR.
 *
 * The matching native `theme.ts` keeps plain numeric/hex values, so the native
 * app is unaffected (Metro resolves this `.web.ts` only for the web bundle, and
 * TypeScript resolves consumers against `theme.ts`).
 */
export const colors = {
  bg: "var(--gh-bg, #0d0d0f)",
  bg2: "var(--gh-bg2, #161618)",
  glass: "var(--gh-surface, #161618)",
  glassBorder: "var(--gh-border, rgba(255,255,255,0.08))",
  card: "var(--gh-surface, #161618)",
  border: "var(--gh-border, rgba(255,255,255,0.08))",
  text: "var(--gh-text, #f2f2f3)",
  textMuted: "var(--gh-text-muted, #a1a1aa)",
  textFaint: "var(--gh-text-faint, #6b6b73)",
  accent: "var(--gh-accent, #f0922f)",
  accent2: "var(--gh-accent2, #d9542b)",
  sunrise: "var(--gh-sunrise, #ffb85c)",
  sunset: "var(--gh-sunset, #d9542b)",
  both: "var(--gh-both, #a071d6)",
  star: "var(--gh-star, #e8b53d)",
  good: "var(--gh-good, #36c47a)",
  warn: "var(--gh-warn, #e8a94b)",
  danger: "var(--gh-danger, #e0556b)",
} as const;

export const typeColor: Record<"sunrise" | "sunset" | "both", string> = {
  sunrise: colors.sunrise,
  sunset: colors.sunset,
  both: colors.both,
};

export const space = {
  xs: "var(--gh-space-xs, 6px)",
  sm: "var(--gh-space-sm, 10px)",
  md: "var(--gh-space-md, 14px)",
  lg: "var(--gh-space-lg, 20px)",
  xl: "var(--gh-space-xl, 28px)",
  xxl: "var(--gh-space-xxl, 40px)",
} as const;

export const radius = {
  sm: "var(--gh-radius-sm, 10px)",
  md: "var(--gh-radius-md, 16px)",
  lg: "var(--gh-radius-lg, 22px)",
  pill: "var(--gh-radius-pill, 999px)",
} as const;

/**
 * Editorial type system for web. Fraunces (loaded in +html.tsx) is a variable
 * serif with real character for headings; Inter carries the body. Falls back to
 * platform serifs/sans if the webfonts haven't loaded yet.
 */
export const fonts = {
  display: '"Fraunces", Georgia, "Times New Roman", serif',
  body: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
} as const;

/** Default gradient backdrop for screens (unused on web, kept for parity). */
export const SKY_GRADIENT = ["#241433", "#5a2a4d", "#c25a2e"] as const;
