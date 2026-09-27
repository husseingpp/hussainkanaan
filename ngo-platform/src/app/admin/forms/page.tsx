"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Copy, ExternalLink, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { buttonVariants } from "@/components/ui/button";
import { useAdmin } from "@/components/admin/admin-context";
import { useTr } from "@/components/admin/use-tr";
import { Badge, Empty, PageHead, Spinner } from "@/components/admin/ui";
import { listForms, type FormRow } from "@/lib/admin/forms";
import { readFields } from "@/lib/forms/fields";

export default function FormsPage() {
  const t = useTranslations("admin");
  const trx = useTr();
  const { defaultLocale } = useAdmin();
  // The public page lives outside the admin, so build a plain (base-path aware) URL.
  const publicPath = (slug: string) => `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/${defaultLocale}/apply/form/?type=${slug}`;
  const copy = async (slug: string) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${publicPath(slug)}`);
      toast.success(t("forms.link_copied"));
    } catch {
      toast.error(t("errors.unknown"));
    }
  };
  const [items, setItems] = useState<(FormRow & { responses: { count: number }[] })[] | null>(null);
  useEffect(() => void listForms().then((r) => setItems(r.ok ? r.data : [])), []);

  return (
    <>
      <PageHead title={t("forms.title")} actions={<Link href="/admin/forms/edit" className={buttonVariants()}><Plus aria-hidden /> {t("forms.new")}</Link>} />
      {!items ? (
        <Spinner label={t("common.loading")} />
      ) : items.length === 0 ? (
        <Empty>{t("forms.empty")}</Empty>
      ) : (
        <ul className="divide-y divide-foreground/10 overflow-hidden rounded-theme border border-foreground/10 bg-white">
          {items.map((f) => (
            <li key={f.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <Link href={`/admin/forms/edit?id=${f.id}`} className="min-w-0 flex-1 hover:underline">
                <span className="block font-medium">{trx(f.name) || f.slug}</span>
                <span className="text-xs opacity-65">{t("forms.question_count", { count: readFields(f.form_schema).length })}</span>
              </Link>
              <Badge tone={f.is_open ? "success" : "warning"}>{f.is_open ? t("forms.open") : t("forms.closed")}</Badge>
              {f.is_open && (
                <span className="flex gap-3 text-sm">
                  <a href={publicPath(f.slug)} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                    <ExternalLink aria-hidden className="size-4" /> {t("forms.open_form")}
                  </a>
                  <button type="button" onClick={() => copy(f.slug)} className="flex items-center gap-1 text-primary hover:underline">
                    <Copy aria-hidden className="size-4" /> {t("forms.copy_link")}
                  </button>
                </span>
              )}
              <Link href={`/admin/requests?form=${f.id}`} className="text-sm text-primary hover:underline">
                {t("forms.responses", { count: f.responses[0]?.count ?? 0 })}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
