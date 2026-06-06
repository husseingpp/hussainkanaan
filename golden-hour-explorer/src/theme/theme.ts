/** Dark, glassmorphic palette tuned for outdoor (bright-light) visibility. */
export const colors = {
  bg: "#0c0a14",
  bg2: "#161023",
  glass: "rgba(20,18,28,0.42)",
  glassBorder: "rgba(255,255,255,0.14)",
  card: "rgba(255,255,255,0.05)",
  border: "rgba(255,255,255,0.10)",
  text: "#f4ece0",
  textMuted: "#b9b2c8",
  textFaint: "#7d7790",
  accent: "#f0922f",
  accent2: "#d9542b",
  sunrise: "#ffb85c",
  sunset: "#d9542b",
  both: "#a071d6",
  star: "#e8b53d",
  good: "#36c47a",
  warn: "#e8a94b",
  danger: "#e0556b",
} as const;

export const typeColor: Record<"sunrise" | "sunset" | "both", string> = {
  sunrise: colors.sunrise,
  sunset: colors.sunset,
  both: colors.both,
};

export const space = { xs: 6, sm: 10, md: 14, lg: 20, xl: 28, xxl: 40 } as const;
export const radius = { sm: 10, md: 16, lg: 22, pill: 999 } as const;

/** Default gradient backdrop for screens (top → horizon). */
export const SKY_GRADIENT = ["#241433", "#5a2a4d", "#c25a2e"] as const;
