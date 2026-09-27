"use client";

import { tr } from "@/lib/i18n/tr";
import type { FormField } from "@/lib/forms/fields";
import { cn } from "@/lib/utils";

export type Answers = Record<string, string | string[]>;

const input =
  "w-full rounded-theme border border-foreground/20 bg-white px-3 py-2.5 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/25 aria-[invalid=true]:border-red-600";

type Props = {
  fields: FormField[];
  values: Answers;
  onChange: (key: string, value: string | string[]) => void;
  locale: string;
  defaultLocale: string;
  errors?: Record<string, string>;
  requiredLabel: string;
};

/** Renders a form's custom fields (shared by the public form and the admin preview). */
export function FormFields({ fields, values, onChange, locale, defaultLocale, errors = {}, requiredLabel }: Props) {
  const x = (v: unknown) => tr(v, locale, defaultLocale);

  return (
    <>
      {fields.map((f) => {
        const id = `f-${f.key}`;
        const err = errors[f.key];
        const value = values[f.key];
        const describedBy = [f.help && x(f.help) ? `${id}-help` : "", err ? `${id}-err` : ""].filter(Boolean).join(" ") || undefined;
        const common = { id, "aria-invalid": Boolean(err), "aria-describedby": describedBy, required: f.required };
        const label = (
          <>
            {x(f.label)}
            {f.required && <span className="text-red-700" aria-hidden> *</span>}
            {f.required && <span className="sr-only"> ({requiredLabel})</span>}
          </>
        );
        const help = f.help && x(f.help) ? <p id={`${id}-help`} className="text-sm opacity-70">{x(f.help)}</p> : null;
        const error = err ? <p id={`${id}-err`} role="alert" className="text-sm text-red-700">{err}</p> : null;

        if (f.type === "radio" || f.type === "checkboxes") {
          const selected = Array.isArray(value) ? value : value ? [value] : [];
          return (
            <fieldset key={f.key} className="space-y-2" aria-describedby={describedBy}>
              <legend className="mb-1 font-medium">{label}</legend>
              {help}
              {(f.options ?? []).map((o) => (
                <label key={o.value} className="flex items-center gap-3 rounded-theme border border-foreground/10 px-3 py-2.5 hover:bg-foreground/[0.03]">
                  <input
                    type={f.type === "radio" ? "radio" : "checkbox"}
                    name={f.key}
                    value={o.value}
                    checked={selected.includes(o.value)}
                    onChange={(e) =>
                      f.type === "radio"
                        ? onChange(f.key, o.value)
                        : onChange(f.key, e.target.checked ? [...selected, o.value] : selected.filter((v) => v !== o.value))
                    }
                    className="size-4 accent-[var(--color-primary)]"
                  />
                  {x(o.label)}
                </label>
              ))}
              {error}
            </fieldset>
          );
        }

        const str = typeof value === "string" ? value : "";
        return (
          <div key={f.key} className="space-y-1.5">
            <label htmlFor={id} className="block font-medium">{label}</label>
            {help}
            {f.type === "textarea" ? (
              <textarea {...common} rows={4} maxLength={5000} value={str} onChange={(e) => onChange(f.key, e.target.value)} className={cn(input, "leading-relaxed")} />
            ) : f.type === "select" ? (
              <select {...common} value={str} onChange={(e) => onChange(f.key, e.target.value)} className={cn(input, "h-11 py-0")}>
                <option value="">—</option>
                {(f.options ?? []).map((o) => <option key={o.value} value={o.value}>{x(o.label)}</option>)}
              </select>
            ) : (
              <input
                {...common}
                type={{ number: "number", email: "email", phone: "tel", date: "date" }[f.type as string] ?? "text"}
                dir={["email", "phone", "number", "date"].includes(f.type) ? "ltr" : undefined}
                inputMode={f.type === "number" ? "decimal" : undefined}
                maxLength={500}
                value={str}
                onChange={(e) => onChange(f.key, e.target.value)}
                className={input}
              />
            )}
            {error}
          </div>
        );
      })}
    </>
  );
}
