// "رابط الصفحة": generated from the title. The DB only accepts lowercase
// ASCII kebab-case, so Arabic is transliterated (simple, readable, lossy).
const AR: Record<string, string> = {
  ا: "a", أ: "a", إ: "e", آ: "a", ء: "", ؤ: "o", ئ: "e", ب: "b", ت: "t", ث: "th", ج: "j", ح: "h", خ: "kh",
  د: "d", ذ: "th", ر: "r", ز: "z", س: "s", ش: "sh", ص: "s", ض: "d", ط: "t", ظ: "z", ع: "a", غ: "gh",
  ف: "f", ق: "q", ك: "k", ل: "l", م: "m", ن: "n", ه: "h", ة: "a", و: "w", ي: "y", ى: "a",
  "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4", "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
};

export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function slugify(text: string, max = 80): string {
  const latin = [...text.normalize("NFKD").replace(/[ً-ٰٟ]/g, "")]
    .map((ch) => AR[ch] ?? ch)
    .join("")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return latin.slice(0, max).replace(/-+$/, "");
}

/** Appends -2, -3… until `taken` says the slug is free. */
export async function uniqueSlug(base: string, taken: (slug: string) => Promise<boolean>): Promise<string> {
  const root = base || `item-${Math.random().toString(36).slice(2, 7)}`;
  for (let n = 1; n < 50; n++) {
    const candidate = n === 1 ? root : `${root}-${n}`;
    if (!(await taken(candidate))) return candidate;
  }
  return `${root}-${Date.now().toString(36)}`;
}
