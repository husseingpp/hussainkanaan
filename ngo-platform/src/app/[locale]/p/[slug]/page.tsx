import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { RichText } from "@/components/public/rich-text";
import { PageHeader } from "@/components/public/section-heading";
import { SectionRenderer } from "@/components/sections/section-renderer";
import { getPage, getPages } from "@/lib/data/content";
import { getSections } from "@/lib/data/site";
import { getDefaultLocale } from "@/lib/i18n/locales";
import { tr, trDoc } from "@/lib/i18n/tr";
import { alternates } from "@/lib/seo";
import { slugParams } from "@/lib/static-params";

type Props = { params: Promise<{ locale: string; slug: string }> };

export const dynamicParams = false;

export async function generateStaticParams() {
  return slugParams((await getPages()).map((p) => p.slug));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const [page, def] = await Promise.all([getPage(slug), getDefaultLocale()]);
  if (!page) return {};
  return {
    title: tr(page.title, locale, def.code),
    ...(tr(page.seo_description, locale, def.code) && { description: tr(page.seo_description, locale, def.code) }),
    alternates: await alternates(`/p/${slug}`, locale),
  };
}

export default async function CustomPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const [page, def] = await Promise.all([getPage(slug), getDefaultLocale()]);
  if (!page) notFound();
  const sections = await getSections(page.id);
  const doc = trDoc(page.body, locale, def.code);

  return (
    <>
      <PageHeader title={tr(page.title, locale, def.code)} />
      {(page.cover_image || doc) && (
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
          {page.cover_image && (
            <div className="relative mb-10 aspect-[16/9] overflow-hidden rounded-theme">
              <Image src={page.cover_image} alt="" fill priority sizes="(min-width: 768px) 768px, 100vw" className="object-cover" />
            </div>
          )}
          <RichText doc={doc} />
        </div>
      )}
      <SectionRenderer sections={sections} locale={locale} defaultLocale={def.code} />
    </>
  );
}
