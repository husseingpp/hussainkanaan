"use client";

import { useLocale } from "next-intl";
import { tr } from "@/lib/i18n/tr";
import { useAdmin } from "./admin-context";

/** Shows content in the admin's UI language, falling back to the site's default language. */
export function useTr() {
  const locale = useLocale();
  const { defaultLocale } = useAdmin();
  return (field: unknown) => tr(field, locale, defaultLocale);
}
