import Link from "next/link";
import { Leaf } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { LanguageSwitcher } from "./language-switcher";

export async function SiteHeader({ locale }: { locale: string }) {
  const t = await getTranslations("site");

  return (
    <header className="absolute inset-x-0 top-0 z-20 text-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link href={`/${locale}`} className="flex items-center gap-2 font-bold">
          <span className="grid size-9 place-items-center rounded-theme bg-white/15">
            <Leaf aria-hidden className="size-5" />
          </span>
          {t("name")}
        </Link>
        <LanguageSwitcher current={locale} />
      </div>
    </header>
  );
}
