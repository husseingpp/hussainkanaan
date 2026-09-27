/**
 * Normalizes a phone number to E.164 (the DB format). Numbers without a
 * country code are treated as Lebanese (+961). Returns null if it can't be.
 */
export function toE164(input: string, defaultCountry = "961"): string | null {
  let s = input.replace(/[\s\-().]/g, "");
  if (!s) return null;
  if (s.startsWith("00")) s = `+${s.slice(2)}`;
  if (!s.startsWith("+")) s = `+${defaultCountry}${s.replace(/^0/, "")}`;
  return /^\+[1-9][0-9]{6,14}$/.test(s) ? s : null;
}
