import Image from "next/image";
import Link from "next/link";
import { tr } from "@/lib/i18n/tr";
import { isExternal, resolveLink } from "@/lib/routes";
import type { SectionProps } from "./types";

export function CtaBannerSection({ section, settings, locale, defaultLocale }: SectionProps<"cta_banner">) {
  const x = (v: unknown) => tr(v, locale, defaultLocale);
  const text = x(settings.text) || x(section.title);
  const label = x(settings.button_label);
  if (!text && !label) return null;
  const href = resolveLink(locale, settings.link);

  return (
    <section className="relative isolate overflow-hidden bg-secondary text-secondary-foreground">
      {settings.image_url && (
        <>
          <Image src={settings.image_url} alt="" fill sizes="100vw" className="-z-10 object-cover" />
          <div className="absolute inset-0 -z-10 bg-black/55" />
        </>
      )}
      <div className={`mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-4 py-14 sm:flex-row sm:items-center sm:px-6 ${settings.image_url ? "text-white" : ""}`}>
        <p className="max-w-2xl text-2xl font-bold leading-snug sm:text-3xl">{text}</p>
        {label && (
          <Link
            href={href}
            {...(isExternal(href) && { target: "_blank", rel: "noreferrer" })}
            className="inline-flex h-12 shrink-0 items-center rounded-theme bg-primary px-7 font-medium text-primary-foreground hover:opacity-90"
          >
            {label}
          </Link>
        )}
      </div>
    </section>
  );
}
