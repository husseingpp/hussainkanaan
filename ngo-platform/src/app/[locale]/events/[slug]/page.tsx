import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { PostDetail } from "@/components/public/post-detail";
import { getPost, getPostCards } from "@/lib/data/content";
import { getDefaultLocale } from "@/lib/i18n/locales";
import { tr } from "@/lib/i18n/tr";
import { alternates } from "@/lib/seo";
import { slugParams } from "@/lib/static-params";

type Props = { params: Promise<{ locale: string; slug: string }> };

export const dynamicParams = false;

export async function generateStaticParams() {
  return slugParams((await getPostCards("event")).map((p) => p.slug));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const [post, def] = await Promise.all([getPost("event", slug), getDefaultLocale()]);
  if (!post) return {};
  const title = tr(post.title, locale, def.code);
  const description = tr(post.excerpt, locale, def.code);
  return {
    title,
    description,
    alternates: await alternates(`/events/${slug}`, locale),
    openGraph: { title, description, type: "article", images: post.cover ? [post.cover.url] : undefined },
  };
}

export default async function Page({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const [post, def] = await Promise.all([getPost("event", slug), getDefaultLocale()]);
  if (!post) notFound();
  return <PostDetail post={post} locale={locale} defaultLocale={def.code} />;
}
