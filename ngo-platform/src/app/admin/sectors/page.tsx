"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Pencil, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { buttonVariants } from "@/components/ui/button";
import { useAdmin } from "@/components/admin/admin-context";
import { IconPreview } from "@/components/admin/icon-choices";
import { SortableList } from "@/components/admin/sortable-list";
import { Empty, PageHead, Spinner, Toggle } from "@/components/admin/ui";
import { listSectors, reorder, setActive, type SectorRow } from "@/lib/admin/taxonomy";
import { tr } from "@/lib/i18n/tr";

export default function SectorsPage() {
  const t = useTranslations("admin");
  const { defaultLocale } = useAdmin();
  const [items, setItems] = useState<SectorRow[] | null>(null);

  useEffect(() => void listSectors().then((r) => setItems(r.ok ? r.data : [])), []);

  const onReorder = async (next: SectorRow[]) => {
    setItems(next);
    const res = await reorder("sectors", next.map((s) => s.id));
    if (res.ok) toast.success(t("common.order_saved"));
    else toast.error(t(`errors.${res.error}`));
  };
  const toggle = async (s: SectorRow, v: boolean) => {
    setItems((list) => list?.map((x) => (x.id === s.id ? { ...x, is_active: v } : x)) ?? null);
    const res = await setActive("sectors", s.id, v);
    if (!res.ok) toast.error(t(`errors.${res.error}`));
  };

  return (
    <>
      <PageHead title={t("sectors.title")} actions={<Link href="/admin/sectors/edit" className={buttonVariants()}><Plus aria-hidden /> {t("sectors.new")}</Link>} />
      {!items ? (
        <Spinner label={t("common.loading")} />
      ) : items.length === 0 ? (
        <Empty>{t("common.empty")}</Empty>
      ) : (
        <>
          <p className="mb-3 text-sm opacity-70">{t("common.drag_hint")}</p>
          <SortableList
            items={items}
            onReorder={onReorder}
            handleLabel={t("common.drag_handle")}
            className="space-y-2"
            render={(s, handle) => (
              <div className="flex items-center gap-3 rounded-theme border border-foreground/10 bg-white p-3">
                {handle}
                <span className="grid size-10 place-items-center rounded-theme bg-primary/10 text-primary"><IconPreview name={s.icon} className="size-5" /></span>
                <span className="min-w-0 flex-1 truncate font-medium">{tr(s.name, defaultLocale)}</span>
                <Toggle checked={s.is_active} onChange={(v) => toggle(s, v)} label={s.is_active ? t("common.active") : t("common.inactive")} />
                <Link href={`/admin/sectors/edit?id=${s.id}`} aria-label={t("common.edit")} className="grid size-9 place-items-center rounded-theme hover:bg-foreground/5"><Pencil aria-hidden className="size-4" /></Link>
              </div>
            )}
          />
        </>
      )}
    </>
  );
}
