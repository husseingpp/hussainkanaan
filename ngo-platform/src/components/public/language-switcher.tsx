import Link from "next/link";
import { Globe } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { getLocales } from "@/lib/i18n/locales";
import { cn } from "@/lib/utils";

export async function LanguageSwitcher({ current }: { current: string }) {
  const [locales, t] = await Promise.all([getLocales(), getTranslations("nav")]);

  return (
    <nav aria-label={t("language")} className="flex items-center gap-1 text-sm">
      <Globe aria-hidden className="me-1 size-4 opacity-70" />
      {locales.map((l) => (
        <Link
          key={l.code}
          href={`/${l.code}`}
          hrefLang={l.code}
          lang={l.code}
          aria-current={l.code === current ? "page" : undefined}
          className={cn(
            "rounded-theme px-2.5 py-1 transition-colors hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2",
            l.code === current && "bg-white/20 font-semibold",
          )}
        >
          {l.name}
        </Link>
      ))}
    </nav>
  );
}
