import { getTranslations } from "next-intl/server";
import { getPostCards } from "@/lib/data/content";
import { tr } from "@/lib/i18n/tr";
import { localePath } from "@/lib/routes";
import { PostCard, PostGrid } from "@/components/public/post-card";
import { SectionHeading } from "@/components/public/section-heading";
import { SectionShell } from "./section-shell";
import type { SectionProps } from "./types";

export async function LatestActivitiesSection({ section, settings, locale, defaultLocale }: SectionProps<"latest_activities">) {
  const [all, t] = await Promise.all([getPostCards("activity"), getTranslations()]);
  const posts = (settings.sector_id ? all.filter((p) => p.sector_ids.includes(settings.sector_id!)) : all).slice(0, settings.count);
  if (!posts.length) return null;
  const id = `s-${section.id}`;

  return (
    <SectionShell labelledBy={id}>
      <SectionHeading
        id={id}
        title={tr(section.title, locale, defaultLocale) || t("activities.title")}
        subtitle={tr(section.subtitle, locale, defaultLocale)}
        action={{ href: localePath(locale, "/activities"), label: t("common.view_all") }}
      />
      <PostGrid>
        {posts.map((p) => (
          <PostCard key={p.id} post={p} locale={locale} defaultLocale={defaultLocale} />
        ))}
      </PostGrid>
    </SectionShell>
  );
}
