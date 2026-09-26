import { use } from "react";
import { ArrowRight, CalendarDays, Images, LayoutGrid } from "lucide-react";
import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { buttonVariants } from "@/components/ui/button";

const FEATURES = [
  { key: "activities", Icon: Images },
  { key: "events", Icon: CalendarDays },
  { key: "sectors", Icon: LayoutGrid },
] as const;

export default function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);
  setRequestLocale(locale);
  const t = useTranslations("home");

  return (
    <>
      <section className="relative overflow-hidden bg-primary text-white">
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,var(--color-accent),transparent_55%),radial-gradient(circle_at_85%_80%,var(--color-secondary),transparent_50%)] opacity-60"
        />
        <div className="relative mx-auto max-w-6xl px-4 pb-24 pt-36 sm:px-6 sm:pb-32 sm:pt-44">
          <span className="inline-block rounded-full bg-white/15 px-3 py-1 text-xs font-medium">
            {t("hero.badge")}
          </span>
          <h1 className="mt-5 max-w-3xl text-balance text-3xl font-bold leading-tight sm:text-5xl">
            {t("hero.title")}
          </h1>
          <p className="mt-5 max-w-2xl text-pretty text-base leading-relaxed opacity-90 sm:text-lg">
            {t("hero.body")}
          </p>
          <a
            href="#features"
            className={buttonVariants({ variant: "secondary", size: "lg", className: "mt-8" })}
          >
            {t("hero.cta")}
            <ArrowRight aria-hidden className="rtl:rotate-180" />
          </a>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <h2 className="text-2xl font-bold sm:text-3xl">{t("features.title")}</h2>
        <div className="mt-8 grid gap-5 sm:grid-cols-3">
          {FEATURES.map(({ key, Icon }) => (
            <article
              key={key}
              className="rounded-theme border border-foreground/10 bg-white p-6 shadow-sm"
            >
              <span className="grid size-11 place-items-center rounded-theme bg-primary/10 text-primary">
                <Icon aria-hidden className="size-5" />
              </span>
              <h3 className="mt-4 text-lg font-semibold">{t(`features.${key}.title`)}</h3>
              <p className="mt-2 leading-relaxed opacity-80">{t(`features.${key}.body`)}</p>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
