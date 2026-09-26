import { getTranslations } from "next-intl/server";

export async function SiteFooter() {
  const t = await getTranslations();
  const year = new Date().getUTCFullYear();

  return (
    <footer className="bg-foreground text-background">
      <div className="mx-auto max-w-6xl px-4 py-8 text-sm opacity-80 sm:px-6">
        © {year} {t("site.name")} · {t("footer.rights")}
      </div>
    </footer>
  );
}
