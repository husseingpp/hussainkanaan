"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { useAdmin } from "./admin-context";

type Props = {
  /** Which locales have content, to show the "missing translation" badge. */
  filled: (code: string) => boolean;
  children: (locale: { code: string; dir: "rtl" | "ltr"; name: string }) => ReactNode;
};

/** One tab per enabled locale (locales are data, never hard-coded). */
export function LocaleTabs({ filled, children }: Props) {
  const t = useTranslations("admin.common");
  const { locales, defaultLocale } = useAdmin();
  const [active, setActive] = useState(defaultLocale);
  const current = locales.find((l) => l.code === active) ?? locales[0];
  if (!current) return null;

  return (
    <div>
      <div role="tablist" aria-label={t("language_tab")} className="mb-4 flex flex-wrap gap-1 border-b border-foreground/10">
        {locales.map((l) => (
          <button
            key={l.code}
            type="button"
            role="tab"
            aria-selected={l.code === current.code}
            onClick={() => setActive(l.code)}
            className={cn("-mb-px flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium", l.code === current.code ? "border-primary text-primary" : "border-transparent opacity-70 hover:opacity-100")}
          >
            <span lang={l.code}>{l.name}</span>
            {!filled(l.code) && <span className="rounded-full bg-secondary/20 px-1.5 text-[0.7rem]">{t("missing_translation")}</span>}
          </button>
        ))}
      </div>
      <div role="tabpanel" lang={current.code} dir={current.dir} className="space-y-4">
        {children({ code: current.code, dir: current.dir, name: current.name })}
      </div>
    </div>
  );
}

/** Helpers for i18n maps in form state. */
export const setLocale = (map: Record<string, string>, code: string, value: string) => ({ ...map, [code]: value });
export const hasText = (map: Record<string, string> | null | undefined, code: string) => Boolean(map?.[code]?.trim());
