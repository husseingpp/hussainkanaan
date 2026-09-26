import type { ReactNode } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { fontVariables } from "@/lib/fonts";
import { findLocale, getDefaultLocale, getLocales } from "@/lib/i18n/locales";
import { tr } from "@/lib/i18n/tr";
import { getSiteSettings, getTheme } from "@/lib/data/site";
import { themeToCssVars } from "@/lib/theme";
import { alternates } from "@/lib/seo";
import { SiteHeader } from "@/components/public/site-header";
import { SiteFooter } from "@/components/public/site-footer";

type Props = { children: ReactNode; params: Promise<{ locale: string }> };

export const dynamicParams = false;

export async function generateStaticParams() {
  return (await getLocales()).map((l) => ({ locale: l.code }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const [t, settings, def] = await Promise.all([
    getTranslations({ locale, namespace: "site" }),
    getSiteSettings(),
    getDefaultLocale(),
  ]);
  const name = tr(settings?.org_name, locale, def.code) || t("name");
  const description = tr(settings?.tagline, locale, def.code) || t("tagline");
  return {
    metadataBase: process.env.NEXT_PUBLIC_SITE_URL ? new URL(process.env.NEXT_PUBLIC_SITE_URL) : undefined,
    title: { default: name, template: `%s | ${name}` },
    description,
    alternates: await alternates("/"),
    icons: settings?.favicon_url ? { icon: settings.favicon_url } : undefined,
    openGraph: { siteName: name, locale, type: "website" },
  };
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  const row = await findLocale(locale);
  if (!row) notFound();
  setRequestLocale(row.code);

  const [theme, t] = await Promise.all([getTheme(), getTranslations("nav")]);

  return (
    <html lang={row.code} dir={row.dir} className={fontVariables} style={themeToCssVars(theme)}>
      <body className="flex min-h-dvh flex-col antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50 focus:rounded-theme focus:bg-background focus:px-4 focus:py-2 focus:text-foreground"
        >
          {t("skip_to_content")}
        </a>
        <NextIntlClientProvider>
          <SiteHeader locale={row.code} />
          <main id="main" className="flex-1">
            {children}
          </main>
          <SiteFooter locale={row.code} />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
