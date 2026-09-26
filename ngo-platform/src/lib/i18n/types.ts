/** A JSONB locale map as stored in the DB, e.g. {"ar": "…", "en": "…"}. */
export type I18nText = Partial<Record<string, string>>;

/** Shape of a row in the `locales` table. */
export type LocaleRow = {
  code: string;
  name: string;
  dir: "rtl" | "ltr";
  is_default: boolean;
  is_enabled: boolean;
  sort_order: number;
};

/** Shape of a row in the `ui_strings` table. */
export type UiStringRow = { key: string; value: I18nText };
