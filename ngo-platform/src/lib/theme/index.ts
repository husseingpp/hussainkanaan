import type { CSSProperties } from "react";

/** Shape of the singleton `theme` row (BLUEPRINT §6). */
export type Theme = {
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  background_color: string;
  text_color: string;
  font_arabic: "ibm_plex_arabic" | "cairo" | "tajawal" | "noto_kufi";
  font_latin: "inter" | "poppins" | "noto_sans";
  radius: "none" | "sm" | "md" | "lg" | "full";
  header_style: "light" | "dark" | "transparent_over_hero";
  footer_style: "light" | "dark";
};

/** Placeholder palette from BLUEPRINT Appendix A. The owner will change it. */
export const DEFAULT_THEME: Theme = {
  primary_color: "#1F6F4A",
  secondary_color: "#C98A2B",
  accent_color: "#2B7A9E",
  background_color: "#FAF8F3",
  text_color: "#1C2420",
  font_arabic: "ibm_plex_arabic",
  font_latin: "inter",
  radius: "md",
  header_style: "transparent_over_hero",
  footer_style: "dark",
};

const RADIUS: Record<Theme["radius"], string> = {
  none: "0px",
  sm: "0.25rem",
  md: "0.5rem",
  lg: "1rem",
  full: "9999px",
};

// Each curated font is loaded via next/font in the root layout, which exposes
// it as a CSS variable. Phase 2 preloads the full curated set.
const FONT_VAR: Record<Theme["font_arabic"] | Theme["font_latin"], string> = {
  ibm_plex_arabic: "var(--font-ibm-plex-arabic)",
  cairo: "var(--font-ibm-plex-arabic)",
  tajawal: "var(--font-ibm-plex-arabic)",
  noto_kufi: "var(--font-ibm-plex-arabic)",
  inter: "var(--font-inter)",
  poppins: "var(--font-inter)",
  noto_sans: "var(--font-inter)",
};

// Phase 0 stub. Phase 1 reads the `theme` row (cached, tag `theme`).
export async function getTheme(): Promise<Theme> {
  return DEFAULT_THEME;
}

/** Theme → CSS variables injected on <html>; Tailwind's @theme maps utilities to them. */
export function themeToCssVars(theme: Theme): CSSProperties {
  return {
    "--color-primary": theme.primary_color,
    "--color-secondary": theme.secondary_color,
    "--color-accent": theme.accent_color,
    "--color-background": theme.background_color,
    "--color-foreground": theme.text_color,
    "--radius": RADIUS[theme.radius],
    "--font-ar": FONT_VAR[theme.font_arabic],
    "--font-latin": FONT_VAR[theme.font_latin],
  } as CSSProperties;
}
