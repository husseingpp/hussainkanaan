"use client";

import { useTr } from "./use-tr";
import { useTranslations } from "next-intl";
import type { Media } from "@/lib/admin/media";
import type { SectorRow } from "@/lib/admin/taxonomy";
import { CoverPicker } from "./cover-picker";
import { Card, Field, Input, Select, Toggle } from "./ui";

export type PostSettingsValue = {
  kind: "activity" | "event" | "news";
  status: "draft" | "published";
  is_featured: boolean;
  event_date: string | null;
  sector_ids: string[];
  cover: Media | null;
};

type Props = { value: PostSettingsValue; onChange: (patch: Partial<PostSettingsValue>) => void; sectors: SectorRow[]; slugField: React.ReactNode };

/** Right-hand column of the post editor. */
export function PostSettings({ value, onChange, sectors, slugField }: Props) {
  const t = useTranslations();
  const trx = useTr();

  return (
    <div className="space-y-4">
      <Card className="space-y-4">
        <Field label={t("admin.fields.kind")} htmlFor="kind">
          <Select id="kind" value={value.kind} onChange={(e) => onChange({ kind: e.target.value as PostSettingsValue["kind"] })}>
            {(["activity", "event", "news"] as const).map((k) => <option key={k} value={k}>{t(`kinds.${k}`)}</option>)}
          </Select>
        </Field>
        <Field label={t("admin.common.status")} htmlFor="status">
          <Select id="status" value={value.status} onChange={(e) => onChange({ status: e.target.value as PostSettingsValue["status"] })}>
            <option value="draft">{t("admin.common.draft")}</option>
            <option value="published">{t("admin.common.published")}</option>
          </Select>
        </Field>
        <Toggle checked={value.is_featured} onChange={(v) => onChange({ is_featured: v })} label={t("admin.common.featured")} />
        {value.kind === "event" && (
          <Field label={t("admin.fields.event_date")} htmlFor="event_date">
            <Input id="event_date" type="date" dir="ltr" value={value.event_date ?? ""} onChange={(e) => onChange({ event_date: e.target.value || null })} />
          </Field>
        )}
        {slugField}
      </Card>

      <Card className="space-y-3">
        <p className="text-sm font-medium">{t("admin.fields.cover")}</p>
        <CoverPicker url={value.cover?.url ?? null} onChange={(m) => onChange({ cover: m })} />
      </Card>

      <Card>
        <fieldset>
          <legend className="mb-3 text-sm font-medium">
            {t("admin.fields.sectors")} <span className="font-normal opacity-60">({t("admin.common.optional")})</span>
          </legend>
          <div className="grid gap-2">
            {sectors.map((s) => (
              <label key={s.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 accent-[var(--color-primary)]"
                  checked={value.sector_ids.includes(s.id)}
                  onChange={(e) =>
                    onChange({ sector_ids: e.target.checked ? [...value.sector_ids, s.id] : value.sector_ids.filter((id) => id !== s.id) })
                  }
                />
                {trx(s.name)}
              </label>
            ))}
          </div>
        </fieldset>
      </Card>
    </div>
  );
}
