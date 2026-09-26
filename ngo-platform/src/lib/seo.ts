import "server-only";
import type { Metadata } from "next";
import { getLocales } from "@/lib/i18n/locales";

/** Public origin + base path, e.g. https://example.org or https://user.github.io/repo/app. */
export function siteUrl(): string | null {
  const url = process.env.NEXT_PUBLIC_SITE_URL;
  return url ? url.replace(/\/+$/, "") : null;
}

/** Absolute URL for a locale path when the site URL is known (keeps any base path). */
export function absoluteUrl(path: string): string {
  const base = siteUrl();
  const isFile = /\.[a-z0-9]+$/i.test(path);
  const withSlash = process.env.STATIC_EXPORT === "1" && !isFile && !path.endsWith("/") ? `${path}/` : path;
  return base ? `${base}${withSlash}` : withSlash;
}

/** hreflang alternates + canonical for a locale-less path ("/", "/events/x"). */
export async function alternates(path: string, locale?: string): Promise<Metadata["alternates"]> {
  const locales = await getLocales();
  const suffix = path === "/" ? "" : path;
  const languages = Object.fromEntries(locales.map((l) => [l.code, absoluteUrl(`/${l.code}${suffix}`)]));
  const def = locales.find((l) => l.is_default) ?? locales[0];
  if (def) languages["x-default"] = absoluteUrl(`/${def.code}${suffix}`);
  return { languages, ...(locale && { canonical: absoluteUrl(`/${locale}${suffix}`) }) };
}
