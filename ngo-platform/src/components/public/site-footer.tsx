import Link from "next/link";
import { Mail, Phone } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { getNav, getSiteSettings, getTheme } from "@/lib/data/site";
import { getDefaultLocale } from "@/lib/i18n/locales";
import { tr } from "@/lib/i18n/tr";
import { cn } from "@/lib/utils";
import { isExternal, localePath, navHref, whatsappHref } from "@/lib/routes";
import { SOCIAL_KEYS, SocialIcon } from "./social-icons";

export async function SiteFooter({ locale }: { locale: string }) {
  const [t, settings, theme, nav, def] = await Promise.all([
    getTranslations(),
    getSiteSettings(),
    getTheme(),
    getNav(),
    getDefaultLocale(),
  ]);
  const name = tr(settings?.org_name, locale, def.code) || t("site.name");
  const about = tr(settings?.footer_text, locale, def.code) || tr(settings?.tagline, locale, def.code) || t("site.tagline");
  const socials = (settings?.socials ?? {}) as Record<string, string | undefined>;
  const year = new Date().getUTCFullYear();

  return (
    <footer
      className={cn(
        theme.footer_style === "dark" ? "bg-foreground text-background" : "border-t border-foreground/10 bg-background",
      )}
    >
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-3">
        <div>
          <p className="text-lg font-bold">{name}</p>
          <p className="mt-3 max-w-sm text-sm leading-relaxed opacity-80">{about}</p>
          <ul className="mt-5 flex flex-wrap gap-2">
            {SOCIAL_KEYS.filter((k) => socials[k]).map((k) => (
              <li key={k}>
                <a
                  href={socials[k]}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={k}
                  className="grid size-10 place-items-center rounded-theme bg-current/10 text-lg hover:bg-current/20"
                >
                  <SocialIcon name={k} />
                </a>
              </li>
            ))}
          </ul>
        </div>

        <nav aria-label={t("footer.links")}>
          <p className="font-semibold">{t("footer.links")}</p>
          <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm opacity-85">
            {nav.map((item) => {
              const href = navHref(locale, item.link_type, item.target);
              const label = tr(item.label, locale, def.code);
              return (
                <li key={item.id}>
                  {isExternal(href) ? <a href={href} className="hover:underline">{label}</a> : <Link href={href} className="hover:underline">{label}</Link>}
                </li>
              );
            })}
          </ul>
        </nav>

        <div>
          <p className="font-semibold">{t("footer.contact")}</p>
          <ul className="mt-3 space-y-2 text-sm opacity-85">
            {settings?.phone && (
              <li className="flex items-center gap-2">
                <Phone aria-hidden className="size-4" />
                <a href={`tel:${settings.phone}`} dir="ltr" className="hover:underline">{settings.phone}</a>
              </li>
            )}
            {settings?.whatsapp && (
              <li className="flex items-center gap-2">
                <SocialIcon name="whatsapp" className="size-4" />
                <a href={whatsappHref(settings.whatsapp)} target="_blank" rel="noreferrer" dir="ltr" className="hover:underline">
                  {settings.whatsapp}
                </a>
              </li>
            )}
            {settings?.email && (
              <li className="flex items-center gap-2">
                <Mail aria-hidden className="size-4" />
                <a href={`mailto:${settings.email}`} className="hover:underline">{settings.email}</a>
              </li>
            )}
            <li>
              <Link href={localePath(locale, "/contact")} className="font-medium underline-offset-4 hover:underline">
                {t("contact.title")}
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-current/10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-5 text-xs opacity-75 sm:px-6">
          <p>© {year} {name} · {t("footer.rights")}</p>
          <Link href={localePath(locale, "/privacy")} className="hover:underline">{t("footer.privacy")}</Link>
        </div>
      </div>
    </footer>
  );
}
