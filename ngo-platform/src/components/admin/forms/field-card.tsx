"use client";

import type { ReactNode } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { CHOICE_TYPES, FIELD_TYPES, type FieldType, type FormField } from "@/lib/forms/fields";
import { cn } from "@/lib/utils";
import { useAdmin } from "../admin-context";
import { inputClass, Select, Toggle } from "../ui";

type Props = { field: FormField; onChange: (f: FormField) => void; onRemove: () => void; handle: ReactNode };

/** One question in the form builder. */
export function FieldCard({ field, onChange, onRemove, handle }: Props) {
  const t = useTranslations("admin.forms");
  const { locales } = useAdmin();
  const set = (patch: Partial<FormField>) => onChange({ ...field, ...patch });
  const isChoice = CHOICE_TYPES.includes(field.type);
  const options = field.options ?? [];

  const addOption = () => {
    let n = options.length + 1;
    while (options.some((o) => o.value === `option_${n}`)) n++;
    set({ options: [...options, { value: `option_${n}`, label: {} }] });
  };

  return (
    <div className="space-y-4 rounded-theme border border-foreground/15 bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        {handle}
        <Select
          aria-label={t("field_type")}
          value={field.type}
          onChange={(e) => {
            const type = e.target.value as FieldType;
            set({ type, options: CHOICE_TYPES.includes(type) ? (options.length ? options : [{ value: "option_1", label: {} }]) : undefined });
          }}
          className="w-auto min-w-44"
        >
          {FIELD_TYPES.map((k) => <option key={k} value={k}>{t(`types.${k}`)}</option>)}
        </Select>
        <Toggle checked={field.required} onChange={(required) => set({ required })} label={t("required")} />
        <button type="button" onClick={onRemove} aria-label={t("remove_field")} className="ms-auto grid size-9 place-items-center rounded-theme text-red-700 hover:bg-red-50">
          <Trash2 aria-hidden className="size-4" />
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {locales.map((l) => (
          <input
            key={`label-${l.code}`}
            lang={l.code}
            dir={l.dir}
            aria-label={`${t("question")} (${l.name})`}
            placeholder={`${t("question")} · ${l.name}`}
            value={field.label[l.code] ?? ""}
            onChange={(e) => set({ label: { ...field.label, [l.code]: e.target.value } })}
            className={cn(inputClass, "font-medium")}
          />
        ))}
        {locales.map((l) => (
          <input
            key={`help-${l.code}`}
            lang={l.code}
            dir={l.dir}
            aria-label={`${t("help")} (${l.name})`}
            placeholder={`${t("help")} · ${l.name}`}
            value={field.help?.[l.code] ?? ""}
            onChange={(e) => set({ help: { ...(field.help ?? {}), [l.code]: e.target.value } })}
            className={cn(inputClass, "text-sm")}
          />
        ))}
      </div>

      {isChoice && (
        <div className="space-y-2 border-t border-foreground/10 pt-3">
          <p className="text-sm font-medium">{t("options")}</p>
          {options.map((o, i) => (
            <div key={o.value} className="flex items-center gap-2">
              <span className="w-6 text-center text-sm opacity-50">{i + 1}</span>
              {locales.map((l) => (
                <input
                  key={l.code}
                  lang={l.code}
                  dir={l.dir}
                  aria-label={`${t("option")} ${i + 1} (${l.name})`}
                  placeholder={`${t("option")} ${i + 1} · ${l.name}`}
                  value={o.label[l.code] ?? ""}
                  onChange={(e) => set({ options: options.map((x) => (x.value === o.value ? { ...x, label: { ...x.label, [l.code]: e.target.value } } : x)) })}
                  className={cn(inputClass, "py-1.5 text-sm")}
                />
              ))}
              <button type="button" onClick={() => set({ options: options.filter((x) => x.value !== o.value) })} aria-label={t("remove_option")} className="grid size-8 shrink-0 place-items-center rounded-theme hover:bg-foreground/5">
                <X aria-hidden className="size-4" />
              </button>
            </div>
          ))}
          <button type="button" onClick={addOption} className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
            <Plus aria-hidden className="size-4" /> {t("add_option")}
          </button>
        </div>
      )}
    </div>
  );
}
