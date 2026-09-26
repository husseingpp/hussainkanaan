import type { Database } from "@/types/database";

type PostKind = Database["public"]["Enums"]["post_kind"];
type NavLinkType = Database["public"]["Enums"]["nav_link_type"];

/** Locale-prefixed internal path: localePath("ar", "/events") → "/ar/events". */
export function localePath(locale: string, path = "/"): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return clean === "/" ? `/${locale}` : `/${locale}${clean}`;
}

export const KIND_PATH: Record<PostKind, string> = {
  activity: "/activities",
  event: "/events",
  news: "/news",
};

export function postPath(locale: string, kind: PostKind, slug: string): string {
  return localePath(locale, `${KIND_PATH[kind]}/${slug}`);
}

export function isExternal(href: string): boolean {
  return /^(https?:)?\/\//.test(href) || href.startsWith("mailto:") || href.startsWith("tel:");
}

/** Resolves an admin-entered link (CTA, section) to a locale path unless it's external. */
export function resolveLink(locale: string, link: string | null | undefined): string {
  if (!link) return localePath(locale);
  return isExternal(link) ? link : localePath(locale, link);
}

export function navHref(locale: string, type: NavLinkType, target: string): string {
  switch (type) {
    case "page":
      return localePath(locale, `/p/${target}`);
    case "sector":
      return localePath(locale, `/sectors/${target}`);
    case "external":
      return target;
    default:
      return resolveLink(locale, target);
  }
}

/** E.164 → wa.me link. */
export function whatsappHref(phone: string, text?: string): string {
  const q = text ? `?text=${encodeURIComponent(text)}` : "";
  return `https://wa.me/${phone.replace(/\D/g, "")}${q}`;
}
