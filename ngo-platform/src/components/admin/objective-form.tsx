"use client";

import { useState } from "react";
import { Save, Trash2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { remove, saveObjective, type ObjectiveRow, type SectorRow } from "@/lib/admin/taxonomy";
import { tr } from "@/lib/i18n/tr";
import { useAdmin } from "./admin-context";
import { IconPicker } from "./icon-choices";
import { hasText, LocaleTabs, setLocale } from "./locale-tabs";
import { Card, Field, Select, Textarea } from "./ui";

type Props = { objective: ObjectiveRow | null; sectors: SectorRow[]; onSaved: (o: ObjectiveRow) => void; onDeleted: (id: string) => void; onClose: () => void };

/** Inline editor for one objective (new when `objective` is null). */
export function ObjectiveForm({ objective, sectors, onSaved, onDeleted, onClose }: Props) {
  const t = useTranslations("admin");
  const { defaultLocale } = useAdmin();
  const [text, setText] = useState<Record<string, string>>((objective?.text as Record<string, string>) ?? {});
  const [icon, setIcon] = useState<string | null>(objective?.icon ?? null);
  const [sectorId, setSectorId] = useState<string | null>(objective?.sector_id ?? null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    const res = await saveObjective({ id: objective?.id, text, icon, sector_id: sectorId, is_active: objective?.is_active ?? true });
    setBusy(false);
    if (!res.ok) return toast.error(t(`errors.${res.error}`));
    toast.success(t("common.saved"));
    onSaved(res.data);
  };

  const del = async () => {
    if (!objective || !window.confirm(t("common.confirm_delete"))) return;
    const res = await remove("objectives", objective.id);
    if (!res.ok) return toast.error(t(`errors.${res.error}`));
    toast.success(t("common.deleted"));
    onDeleted(objective.id);
  };

  return (
    <Card className="space-y-5 border-primary/40">
      <div className="flex items-center justify-between">
        <h2 className="font-bold">{objective ? t("common.edit") : t("objectives.new")}</h2>
        <button type="button" onClick={onClose} aria-label={t("common.close")} className="grid size-9 place-items-center rounded-theme hover:bg-foreground/5"><X aria-hidden className="size-5" /></button>
      </div>
      <LocaleTabs filled={(c) => hasText(text, c)}>
        {({ code, dir }) => (
          <Field label={t("fields.text")} htmlFor={`text-${code}`}>
            <Textarea id={`text-${code}`} dir={dir} value={text[code] ?? ""} onChange={(e) => setText(setLocale(text, code, e.target.value))} />
          </Field>
        )}
      </LocaleTabs>
      <Field label={t("fields.sector")} htmlFor="sector">
        <Select id="sector" value={sectorId ?? ""} onChange={(e) => setSectorId(e.target.value || null)}>
          <option value="">{t("fields.no_sector")}</option>
          {sectors.map((s) => <option key={s.id} value={s.id}>{tr(s.name, defaultLocale)}</option>)}
        </Select>
      </Field>
      <IconPicker label={t("fields.icon")} value={icon} onChange={setIcon} />
      <div className="flex gap-2">
        <Button onClick={save} disabled={busy}><Save aria-hidden /> {busy ? t("common.saving") : t("common.save")}</Button>
        {objective && <Button variant="ghost" onClick={del} className="text-red-700"><Trash2 aria-hidden /> {t("common.delete")}</Button>}
      </div>
    </Card>
  );
}
