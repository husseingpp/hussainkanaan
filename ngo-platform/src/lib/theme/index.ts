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

/** Placeholder palette from BLUEPRINT Appendix A (also the DB column defaults). */
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
  full: "1.5rem",
};

function luminance(hex: string): number {
  const n = parseInt(hex.replace("#", ""), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two hex colors (1–21). */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** Whichever of white / near-black reads better on the given background. */
export function contrastText(hex: string): string {
  return contrastRatio(hex, "#ffffff") >= contrastRatio(hex, "#111111") ? "#ffffff" : "#111111";
}

/** Theme → CSS variables injected on <html>; Tailwind's @theme maps utilities to them. */
export function themeToCssVars(theme: Theme): CSSProperties {
  return {
    "--color-primary": theme.primary_color,
    "--color-primary-foreground": contrastText(theme.primary_color),
    "--color-secondary": theme.secondary_color,
    "--color-secondary-foreground": contrastText(theme.secondary_color),
    "--color-accent": theme.accent_color,
    "--color-background": theme.background_color,
    "--color-foreground": theme.text_color,
    "--radius": RADIUS[theme.radius],
    // Each curated font is loaded by next/font in the locale layout.
    "--font-ar": `var(--font-${theme.font_arabic.replaceAll("_", "-")})`,
    "--font-latin": `var(--font-${theme.font_latin.replaceAll("_", "-")})`,
  } as CSSProperties;
}
