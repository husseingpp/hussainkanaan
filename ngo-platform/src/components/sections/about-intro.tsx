import Image from "next/image";
import Link from "next/link";
import { tr } from "@/lib/i18n/tr";
import { paragraphs } from "@/lib/format";
import { resolveLink } from "@/lib/routes";
import { buttonVariants } from "@/components/ui/button";
import { SectionShell } from "./section-shell";
import type { SectionProps } from "./types";

export function AboutIntroSection({ section, settings, locale, defaultLocale }: SectionProps<"about_intro">) {
  const x = (v: unknown) => tr(v, locale, defaultLocale);
  const body = paragraphs(x(settings.body));
  const ctaLabel = settings.cta ? x(settings.cta.label) : "";
  const id = `s-${section.id}`;

  return (
    <SectionShell labelledBy={id}>
      <div className={settings.image_url ? "grid items-center gap-10 md:grid-cols-2" : "max-w-3xl"}>
        <div>
          <h2 id={id} className="text-2xl font-bold sm:text-3xl">{x(section.title)}</h2>
          {x(section.subtitle) && <p className="mt-2 text-lg opacity-75">{x(section.subtitle)}</p>}
          <div className="mt-5 space-y-4 text-lg leading-relaxed opacity-90">
            {body.map((p, i) => <p key={i}>{p}</p>)}
          </div>
          {ctaLabel && settings.cta && (
            <Link href={resolveLink(locale, settings.cta.link)} className={buttonVariants({ className: "mt-8" })}>
              {ctaLabel}
            </Link>
          )}
        </div>
        {settings.image_url && (
          <div className="relative aspect-[4/3] overflow-hidden rounded-theme">
            <Image src={settings.image_url} alt="" fill sizes="(min-width: 768px) 50vw, 100vw" className="object-cover" />
          </div>
        )}
      </div>
    </SectionShell>
  );
}
