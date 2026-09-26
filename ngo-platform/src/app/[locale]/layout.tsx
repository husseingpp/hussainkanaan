import type { ReactNode } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { IBM_Plex_Sans_Arabic, Inter } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { findLocale, getLocales } from "@/lib/i18n/locales";
import { getTheme, themeToCssVars } from "@/lib/theme";
import { SiteHeader } from "@/components/public/site-header";
import { SiteFooter } from "@/components/public/site-footer";

const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "700"],
  variable: "--font-ibm-plex-arabic",
  display: "swap",
});
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

type Props = { children: ReactNode; params: Promise<{ locale: string }> };

export const dynamicParams = false;

export async function generateStaticParams() {
  return (await getLocales()).map((l) => ({ locale: l.code }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "site" });
  const locales = await getLocales();
  return {
    title: t("name"),
    description: t("tagline"),
    alternates: {
      languages: Object.fromEntries(locales.map((l) => [l.code, `/${l.code}`])),
    },
  };
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  const row = await findLocale(locale);
  if (!row) notFound();
  setRequestLocale(row.code);

  const theme = await getTheme();
  const t = await getTranslations("nav");

  return (
    <html
      lang={row.code}
      dir={row.dir}
      className={`${plexArabic.variable} ${inter.variable}`}
      style={themeToCssVars(theme)}
    >
      <body className="flex min-h-dvh flex-col antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-50 focus:rounded-theme focus:bg-background focus:px-4 focus:py-2"
        >
          {t("skip_to_content")}
        </a>
        <NextIntlClientProvider>
          <SiteHeader locale={row.code} />
          <main id="main" className="flex-1">
            {children}
          </main>
          <SiteFooter />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
