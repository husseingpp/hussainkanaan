import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getModules } from "@/lib/data/site";
import { tr } from "@/lib/i18n/tr";
import { localePath } from "@/lib/routes";
import { buttonVariants } from "@/components/ui/button";
import { SectionShell } from "./section-shell";
import type { SectionProps } from "./types";

/** Hidden unless the requests module is on (CLAUDE.md rule 9). */
export async function RequestCtaSection({ section, locale, defaultLocale }: SectionProps<"request_cta">) {
  const [modules, t] = await Promise.all([getModules(), getTranslations()]);
  if (!modules.requests) return null;
  const id = `s-${section.id}`;

  return (
    <SectionShell tone="tinted" labelledBy={id}>
      <div className="flex flex-col items-start justify-between gap-6 rounded-theme bg-white p-8 shadow-sm md:flex-row md:items-center">
        <div>
          <h2 id={id} className="text-2xl font-bold">{tr(section.title, locale, defaultLocale) || t("request_cta.title")}</h2>
          <p className="mt-2 opacity-80">{tr(section.subtitle, locale, defaultLocale) || t("request_cta.body")}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href={localePath(locale, "/apply")} className={buttonVariants()}>{t("request_cta.apply")}</Link>
          <Link href={localePath(locale, "/track")} className={buttonVariants({ variant: "outline" })}>{t("request_cta.track")}</Link>
        </div>
      </div>
    </SectionShell>
  );
}
