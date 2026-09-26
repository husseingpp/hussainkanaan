import { getTranslations } from "next-intl/server";
import { getModules, getSiteSettings } from "@/lib/data/site";
import { tr } from "@/lib/i18n/tr";
import { SocialIcon } from "@/components/public/social-icons";
import { SectionHeading } from "@/components/public/section-heading";
import { SectionShell } from "./section-shell";
import type { SectionProps } from "./types";

/** Facebook Page Plugin embed (only when the facebook_feed module is on and a page URL is set). */
export async function FacebookFeedSection({ section, locale, defaultLocale }: SectionProps<"facebook_feed">) {
  const [modules, settings, t] = await Promise.all([getModules(), getSiteSettings(), getTranslations()]);
  const page = (settings?.socials as Record<string, string> | null)?.facebook;
  if (!modules.facebook_feed || !page) return null;
  const src = `https://www.facebook.com/plugins/page.php?href=${encodeURIComponent(page)}&tabs=timeline&width=500&height=600&small_header=true&hide_cover=false&locale=${locale === "ar" ? "ar_AR" : "en_US"}`;
  const id = `s-${section.id}`;

  return (
    <SectionShell tone="tinted" labelledBy={id}>
      <SectionHeading id={id} title={tr(section.title, locale, defaultLocale)} subtitle={tr(section.subtitle, locale, defaultLocale)} />
      <div className="flex flex-col items-center gap-4">
        <iframe title={t("facebook.open")} src={src} width="500" height="600" loading="lazy" className="w-full max-w-[500px] rounded-theme border-0 bg-white" />
        <a href={page} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 font-medium text-primary hover:underline">
          <SocialIcon name="facebook" /> {t("facebook.open")}
        </a>
      </div>
    </SectionShell>
  );
}
