/** Trim a string; return null when empty (for optional/nullable columns). */
export const emptyToNull = (value: string): string | null => {
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

/** Round to a fixed number of decimals (avoids float noise like 0.110000001). */
export const round = (n: number, decimals = 2): number => {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
};

/** Best-effort error message extraction from a rejected Tauri invoke. */
export const errMessage = (e: unknown): string =>
  typeof e === "string" ? e : e instanceof Error ? e.message : String(e);
