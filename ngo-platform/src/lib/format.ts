/** Dates are stored in UTC and shown in Beirut time, with Latin digits. */
export function formatDate(value: string | null | undefined, locale: string, style: "long" | "medium" = "long") {
  if (!value) return "";
  const date = value.length === 10 ? new Date(`${value}T12:00:00Z`) : new Date(value);
  return new Intl.DateTimeFormat(`${locale}-u-nu-latn`, { dateStyle: style, timeZone: "Asia/Beirut" }).format(date);
}

export function dateParts(value: string, locale: string) {
  const date = new Date(`${value.slice(0, 10)}T12:00:00Z`);
  const fmt = (o: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(`${locale}-u-nu-latn`, { ...o, timeZone: "Asia/Beirut" }).format(date);
  return { day: fmt({ day: "numeric" }), month: fmt({ month: "short" }), year: fmt({ year: "numeric" }) };
}

export function yearOf(value: string | null | undefined): string | null {
  return value ? value.slice(0, 4) : null;
}

/** Splits plain multi-line text into paragraphs. */
export function paragraphs(text: string): string[] {
  return text.split(/\n{2,}|\r\n\r\n/).map((p) => p.trim()).filter(Boolean);
}
