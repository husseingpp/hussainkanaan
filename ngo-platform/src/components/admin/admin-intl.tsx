"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { NextIntlClientProvider, type AbstractIntlMessages } from "next-intl";
import { Toaster } from "sonner";

export type AdminLanguage = { code: string; name: string; dir: "rtl" | "ltr" };
export const ADMIN_LOCALE_KEY = "ngo-admin-locale";

type Ctx = { locale: string; languages: AdminLanguage[]; setLocale: (code: string) => void };
const AdminLocaleContext = createContext<Ctx | null>(null);

export function useAdminLocale(): Ctx {
  const ctx = useContext(AdminLocaleContext);
  if (!ctx) throw new Error("useAdminLocale() outside AdminIntl");
  return ctx;
}

/** Admin UI language: Arabic by default, switchable per browser (remembered in localStorage). */
export function AdminIntl({
  languages,
  messages,
  fallback,
  children,
}: {
  languages: AdminLanguage[];
  messages: Record<string, AbstractIntlMessages>;
  fallback: string;
  children: ReactNode;
}) {
  const [locale, setState] = useState(fallback);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(ADMIN_LOCALE_KEY);
      if (saved && messages[saved]) setState(saved);
    } catch {
      // storage unavailable: stay on the default
    }
  }, [messages]);

  const lang = languages.find((l) => l.code === locale) ?? languages[0];
  useEffect(() => {
    if (!lang) return;
    document.documentElement.lang = lang.code;
    document.documentElement.dir = lang.dir;
  }, [lang]);

  const setLocale = useCallback(
    (code: string) => {
      if (!messages[code]) return;
      setState(code);
      try {
        localStorage.setItem(ADMIN_LOCALE_KEY, code);
      } catch {
        // not persisted; still switches for this visit
      }
    },
    [messages],
  );

  return (
    <AdminLocaleContext.Provider value={{ locale, languages, setLocale }}>
      <NextIntlClientProvider locale={locale} messages={messages[locale] ?? messages[fallback]} timeZone="Asia/Beirut">
        {children}
        <Toaster position="top-center" richColors dir={lang?.dir ?? "rtl"} />
      </NextIntlClientProvider>
    </AdminLocaleContext.Provider>
  );
}

/** Compact language switch for the admin chrome. */
export function AdminLanguageSwitch({ className }: { className?: string }) {
  const { locale, languages, setLocale } = useAdminLocale();
  if (languages.length < 2) return null;
  return (
    <div role="group" aria-label="Language / اللغة" className={`flex flex-wrap gap-1 ${className ?? ""}`}>
      {languages.map((l) => (
        <button
          key={l.code}
          type="button"
          lang={l.code}
          aria-pressed={l.code === locale}
          onClick={() => setLocale(l.code)}
          className={`rounded-theme px-2.5 py-1 text-sm ${l.code === locale ? "bg-primary text-primary-foreground" : "hover:bg-foreground/5"}`}
        >
          {l.name}
        </button>
      ))}
    </div>
  );
}
