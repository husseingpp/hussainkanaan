"use client";

import { useTr } from "@/components/admin/use-tr";
import { useEffect, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { IconPreview } from "@/components/admin/icon-choices";
import { ObjectiveForm } from "@/components/admin/objective-form";
import { SortableList } from "@/components/admin/sortable-list";
import { Empty, PageHead, Spinner, Toggle } from "@/components/admin/ui";
import { listObjectives, listSectors, reorder, setActive, type ObjectiveRow, type SectorRow } from "@/lib/admin/taxonomy";

export default function ObjectivesPage() {
  const t = useTranslations("admin");
  const trx = useTr();
  const [items, setItems] = useState<ObjectiveRow[] | null>(null);
  const [sectors, setSectors] = useState<SectorRow[]>([]);
  const [editing, setEditing] = useState<ObjectiveRow | "new" | null>(null);

  useEffect(() => {
    listObjectives().then((r) => setItems(r.ok ? r.data : []));
    listSectors().then((r) => r.ok && setSectors(r.data));
  }, []);

  const report = (ok: boolean, error?: string) => (ok ? toast.success(t("common.order_saved")) : toast.error(t(`errors.${error}`)));
  const onReorder = async (next: ObjectiveRow[]) => {
    setItems(next);
    const res = await reorder("objectives", next.map((o) => o.id));
    report(res.ok, res.ok ? undefined : res.error);
  };
  const toggle = async (o: ObjectiveRow, v: boolean) => {
    setItems((list) => list?.map((x) => (x.id === o.id ? { ...x, is_active: v } : x)) ?? null);
    const res = await setActive("objectives", o.id, v);
    if (!res.ok) toast.error(t(`errors.${res.error}`));
  };
  const sectorOf = (id: string | null) => sectors.find((s) => s.id === id);

  return (
    <>
      <PageHead title={t("objectives.title")} actions={<Button onClick={() => setEditing("new")}><Plus aria-hidden /> {t("objectives.new")}</Button>} />
      {editing && (
        <div className="mb-6">
          <ObjectiveForm
            key={editing === "new" ? "new" : editing.id}
            objective={editing === "new" ? null : editing}
            sectors={sectors}
            onClose={() => setEditing(null)}
            onDeleted={(id) => { setItems((l) => l?.filter((o) => o.id !== id) ?? null); setEditing(null); }}
            onSaved={(o) => { setItems((l) => (l?.some((x) => x.id === o.id) ? l.map((x) => (x.id === o.id ? o : x)) : [...(l ?? []), o])); setEditing(null); }}
          />
        </div>
      )}
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
            render={(o, handle) => (
              <div className="flex items-center gap-3 rounded-theme border border-foreground/10 bg-white p-3">
                {handle}
                <IconPreview name={o.icon ?? sectorOf(o.sector_id)?.icon} className="size-5 shrink-0 text-primary" />
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2">{trx(o.text)}</span>
                  {sectorOf(o.sector_id) && <span className="text-xs opacity-60">{trx(sectorOf(o.sector_id)!.name)}</span>}
                </span>
                <Toggle checked={o.is_active} onChange={(v) => toggle(o, v)} label={o.is_active ? t("common.active") : t("common.inactive")} />
                <button type="button" onClick={() => setEditing(o)} aria-label={t("common.edit")} className="grid size-9 place-items-center rounded-theme hover:bg-foreground/5"><Pencil aria-hidden className="size-4" /></button>
              </div>
            )}
          />
        </>
      )}
    </>
  );
}
