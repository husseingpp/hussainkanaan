import type { ReactNode } from "react";
import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { Toaster } from "sonner";
import { AdminShell } from "@/components/admin/admin-shell";
import { fontVariables } from "@/lib/fonts";
import { loadMessages } from "@/lib/i18n/messages";
import { getTheme } from "@/lib/data/site";
import { themeToCssVars } from "@/lib/theme";

// The admin UI is Arabic by default (CLAUDE.md conventions).
const ADMIN_LOCALE = "ar";

export const metadata: Metadata = { title: "لوحة التحكم", robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: ReactNode }) {
  setRequestLocale(ADMIN_LOCALE);
  const [messages, theme] = await Promise.all([loadMessages(ADMIN_LOCALE, ADMIN_LOCALE), getTheme()]);

  return (
    <html lang={ADMIN_LOCALE} dir="rtl" className={fontVariables} style={themeToCssVars(theme)}>
      <body className="antialiased">
        <NextIntlClientProvider locale={ADMIN_LOCALE} messages={messages} timeZone="Asia/Beirut">
          <AdminShell>{children}</AdminShell>
          <Toaster position="top-center" richColors dir="rtl" />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
