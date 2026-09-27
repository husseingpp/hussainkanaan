import type { ReactNode } from "react";
import type { Metadata } from "next";
import type { AbstractIntlMessages } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { AdminIntl, ADMIN_LOCALE_KEY } from "@/components/admin/admin-intl";
import { AdminShell } from "@/components/admin/admin-shell";
import { fontVariables } from "@/lib/fonts";
import { getLocales } from "@/lib/i18n/locales";
import { loadMessages } from "@/lib/i18n/messages";
import { getTheme } from "@/lib/data/site";
import { themeToCssVars } from "@/lib/theme";

// Arabic by default (CLAUDE.md conventions); the user can switch in the admin.
const ADMIN_DEFAULT = "ar";

export const metadata: Metadata = { title: "لوحة التحكم · Admin", robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: ReactNode }) {
  setRequestLocale(ADMIN_DEFAULT);
  const [locales, theme] = await Promise.all([getLocales(), getTheme()]);
  const languages = locales.map((l) => ({ code: l.code, name: l.name, dir: l.dir }));
  const messages: Record<string, AbstractIntlMessages> = Object.fromEntries(
    await Promise.all(languages.map(async (l) => [l.code, await loadMessages(l.code, ADMIN_DEFAULT)] as const)),
  );
  const dirs = Object.fromEntries(languages.map((l) => [l.code, l.dir]));
  // Apply the saved admin language's direction before first paint (no RTL→LTR flash).
  const preload = `try{var l=localStorage.getItem(${JSON.stringify(ADMIN_LOCALE_KEY)}),d=${JSON.stringify(dirs)};if(l&&d[l]){document.documentElement.lang=l;document.documentElement.dir=d[l]}}catch(e){}`;

  return (
    <html lang={ADMIN_DEFAULT} dir="rtl" className={fontVariables} style={themeToCssVars(theme)} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: preload }} />
      </head>
      <body className="antialiased">
        <AdminIntl languages={languages} messages={messages} fallback={ADMIN_DEFAULT}>
          <AdminShell>{children}</AdminShell>
        </AdminIntl>
      </body>
    </html>
  );
}
