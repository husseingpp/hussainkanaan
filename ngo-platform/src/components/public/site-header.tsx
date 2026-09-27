import Link from "next/link";
import Image from "next/image";
import { ChevronDown, Leaf } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { getModules, getNav, getSections, getSiteSettings, getTheme, type NavItem } from "@/lib/data/site";
import { getLocales, getDefaultLocale } from "@/lib/i18n/locales";
import { tr } from "@/lib/i18n/tr";
import { isExternal, localePath, navHref } from "@/lib/routes";
import { HeaderShell } from "./header-shell";
import { LanguageSwitcher } from "./language-switcher";

function NavLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return isExternal(href) ? (
    <a href={href} target="_blank" rel="noreferrer" className={className}>
      {children}
    </a>
  ) : (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

export async function SiteHeader({ locale }: { locale: string }) {
  const [t, menu, modules, settings, theme, sections, locales, def] = await Promise.all([
    getTranslations("nav"),
    getNav(),
    getModules(),
    getSiteSettings(),
    getTheme(),
    getSections("home"),
    getLocales(),
    getDefaultLocale(),
  ]);
  const siteT = await getTranslations("site");
  const name = tr(settings?.org_name, locale, def.code) || siteT("name");
  const label = (v: unknown) => tr(v, locale, def.code);
  const nav = withRequestsLink(menu, modules.requests, t("apply"), locale);

  // Both logos are rendered; the header's live tone (data-tone) shows the right one.
  const img = (src: string, className: string) => (
    <Image src={src} alt="" width={40} height={40} className={`h-10 w-auto max-w-32 object-contain ${className}`} />
  );
  const brand = (
    <Link href={localePath(locale)} className="flex min-w-0 items-center gap-2 font-bold">
      {settings?.logo_url ? (
        <>
          {img(settings.logo_url, settings.logo_dark_url ? "group-data-[tone=dark]:hidden" : "")}
          {settings.logo_dark_url && img(settings.logo_dark_url, "hidden group-data-[tone=dark]:block")}
        </>
      ) : (
        <span className="grid size-9 shrink-0 place-items-center rounded-theme bg-current/15">
          <Leaf aria-hidden className="size-5" />
        </span>
      )}
      <span className="truncate">{name}</span>
    </Link>
  );

  const desktopNav = (
    <nav aria-label={t("main")}>
      <ul className="flex items-center gap-1 text-sm font-medium">
        {nav.map((item) => (
          <li key={item.id} className="group relative">
            <NavLink
              href={navHref(locale, item.link_type, item.target)}
              className="flex items-center gap-1 rounded-theme px-3 py-2 hover:bg-current/10"
            >
              {label(item.label)}
              {item.children.length > 0 && <ChevronDown aria-hidden className="size-4 opacity-70" />}
            </NavLink>
            {item.children.length > 0 && (
              <ul className="invisible absolute start-0 top-full z-50 min-w-52 rounded-theme border border-foreground/10 bg-background p-2 text-foreground opacity-0 shadow-lg transition group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
                {item.children.map((c) => (
                  <li key={c.id}>
                    <NavLink
                      href={navHref(locale, c.link_type, c.target)}
                      className="block rounded-theme px-3 py-2 hover:bg-foreground/5"
                    >
                      {label(c.label)}
                    </NavLink>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );

  const mobileNav = (
    <nav aria-label={t("main")}>
      <ul className="flex flex-col text-base font-medium">
        {nav.map((item) => (
          <li key={item.id}>
            <NavLink href={navHref(locale, item.link_type, item.target)} className="block rounded-theme px-3 py-3 hover:bg-current/10">
              {label(item.label)}
            </NavLink>
            {item.children.length > 0 && (
              <ul className="ms-4 border-s border-current/15 ps-2">
                {item.children.map((c) => (
                  <li key={c.id}>
                    <NavLink href={navHref(locale, c.link_type, c.target)} className="block rounded-theme px-3 py-2 opacity-90 hover:bg-current/10">
                      {label(c.label)}
                    </NavLink>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );

  return (
    <HeaderShell
      style={theme.header_style}
      homePath={localePath(locale)}
      homeHasHero={sections[0]?.section_type === "hero_slider"}
      labels={{ menu: t("menu"), close: t("close_menu") }}
      brand={brand}
      desktopNav={desktopNav}
      mobileNav={mobileNav}
      switcher={
        <LanguageSwitcher
          locales={locales.map((l) => ({ code: l.code, name: l.name }))}
          current={locale}
          label={t("language")}
        />
      }
    />
  );
}

const isRequestRoute = (i: NavItem) => i.link_type === "route" && /^\/(apply|track)(\/|$)/.test(i.target);

/** While the requests module is on, the menu links to /apply (unless the owner added it); while off, request links are hidden (CLAUDE.md rule 9). */
function withRequestsLink(nav: NavItem[], on: boolean, text: string, locale: string): NavItem[] {
  if (!on) return nav.filter((i) => !isRequestRoute(i)).map((i) => ({ ...i, children: i.children.filter((c) => !isRequestRoute(c as NavItem)) }));
  if (nav.some((i) => isRequestRoute(i) || i.children.some((c) => isRequestRoute(c as NavItem)))) return nav;
  const apply = { ...nav[0], id: "requests-apply", label: { [locale]: text }, link_type: "route", target: "/apply", parent_id: null, children: [] } as NavItem;
  return [...nav, apply];
}
