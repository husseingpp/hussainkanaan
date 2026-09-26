import type { Metadata } from "next";
import { Mail, MapPin, Phone } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/public/section-heading";
import { SOCIAL_KEYS, SocialIcon } from "@/components/public/social-icons";
import { getSiteSettings } from "@/lib/data/site";
import { getDefaultLocale } from "@/lib/i18n/locales";
import { tr } from "@/lib/i18n/tr";
import { whatsappHref } from "@/lib/routes";
import { alternates } from "@/lib/seo";

type Props = { params: Promise<{ locale: string }> };

// Only embed maps from known providers.
const SAFE_MAP = /^https:\/\/(www\.google\.com\/maps\/embed|maps\.google\.com\/maps|www\.openstreetmap\.org\/export\/embed)/;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "contact" });
  return { title: t("title"), description: t("subtitle"), alternates: await alternates("/contact", locale) };
}

export default async function ContactPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, s, def] = await Promise.all([getTranslations("contact"), getSiteSettings(), getDefaultLocale()]);
  const address = tr(s?.address, locale, def.code);
  const socials = (s?.socials ?? {}) as Record<string, string | undefined>;
  const activeSocials = SOCIAL_KEYS.filter((k) => socials[k]);
  const map = s?.map_embed_url && SAFE_MAP.test(s.map_embed_url) ? s.map_embed_url : null;

  const items = [
    s?.phone && { icon: <Phone aria-hidden className="size-5" />, label: t("phone"), value: s.phone, href: `tel:${s.phone}`, ltr: true },
    s?.email && { icon: <Mail aria-hidden className="size-5" />, label: t("email"), value: s.email, href: `mailto:${s.email}`, ltr: true },
    address && { icon: <MapPin aria-hidden className="size-5" />, label: t("address"), value: address },
  ].filter(Boolean) as { icon: React.ReactNode; label: string; value: string; href?: string; ltr?: boolean }[];

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-2">
        <div className="space-y-4">
          {items.length === 0 && !s?.whatsapp && <p className="opacity-75">{t("empty")}</p>}
          <dl className="space-y-4">
            {items.map((item) => (
              <div key={item.label} className="flex gap-4 rounded-theme border border-foreground/10 bg-white p-5">
                <span className="grid size-11 shrink-0 place-items-center rounded-theme bg-primary/10 text-primary">{item.icon}</span>
                <div>
                  <dt className="text-sm opacity-70">{item.label}</dt>
                  <dd className="font-medium" dir={item.ltr ? "ltr" : undefined}>
                    {item.href ? <a href={item.href} className="hover:underline">{item.value}</a> : item.value}
                  </dd>
                </div>
              </div>
            ))}
          </dl>
          {s?.whatsapp && (
            <a href={whatsappHref(s.whatsapp)} target="_blank" rel="noreferrer" className="inline-flex h-12 items-center gap-2 rounded-theme bg-[#1f8f4e] px-6 font-medium text-white hover:opacity-90">
              <SocialIcon name="whatsapp" className="size-5" /> {t("whatsapp_cta")}
            </a>
          )}
          {activeSocials.length > 0 && (
            <div className="pt-4">
              <p className="mb-3 font-semibold">{t("follow")}</p>
              <ul className="flex flex-wrap gap-2">
                {activeSocials.map((k) => (
                  <li key={k}>
                    <a href={socials[k]} target="_blank" rel="noreferrer" aria-label={k} className="grid size-11 place-items-center rounded-theme border border-foreground/15 text-xl hover:bg-foreground/5">
                      <SocialIcon name={k} />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        {map && (
          <iframe title={t("map")} src={map} loading="lazy" referrerPolicy="no-referrer-when-downgrade" className="h-96 w-full rounded-theme border-0 lg:h-full" />
        )}
      </div>
    </>
  );
}
