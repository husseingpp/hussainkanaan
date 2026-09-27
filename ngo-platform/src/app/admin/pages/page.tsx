"use client";

import { useTr } from "@/components/admin/use-tr";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { buttonVariants } from "@/components/ui/button";
import { Badge, Empty, PageHead, Spinner } from "@/components/admin/ui";
import { listPages, type PageRow } from "@/lib/admin/pages";

export default function PagesPage() {
  const t = useTranslations("admin");
  const trx = useTr();
  const [items, setItems] = useState<PageRow[] | null>(null);
  useEffect(() => void listPages().then((r) => setItems(r.ok ? r.data : [])), []);

  return (
    <>
      <PageHead title={t("pages.title")} actions={<Link href="/admin/pages/edit" className={buttonVariants()}><Plus aria-hidden /> {t("pages.new")}</Link>} />
      {!items ? (
        <Spinner label={t("common.loading")} />
      ) : items.length === 0 ? (
        <Empty>{t("common.empty")}</Empty>
      ) : (
        <ul className="divide-y divide-foreground/10 overflow-hidden rounded-theme border border-foreground/10 bg-white">
          {items.map((p) => (
            <li key={p.id}>
              <Link href={`/admin/pages/edit?id=${p.id}`} className="flex items-center justify-between gap-3 p-4 hover:bg-foreground/[0.03]">
                <span className="font-medium">{trx(p.title) || p.slug}</span>
                <span className="flex items-center gap-2">
                  <span className="text-xs opacity-60" dir="ltr">/p/{p.slug}</span>
                  <Badge tone={p.status === "published" ? "success" : "warning"}>{t(`common.${p.status}`)}</Badge>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
