import { z } from "zod";

/** Field types a form can use. Keep in sync with public.submit_request(). */
export const FIELD_TYPES = ["text", "textarea", "number", "email", "phone", "date", "select", "radio", "checkboxes"] as const;
export type FieldType = (typeof FIELD_TYPES)[number];
export const CHOICE_TYPES: FieldType[] = ["select", "radio", "checkboxes"];

const i18n = z.record(z.string(), z.string());

export const fieldSchema = z.object({
  key: z.string().regex(/^[a-z][a-z0-9_]{0,39}$/),
  type: z.enum(FIELD_TYPES),
  required: z.boolean(),
  label: i18n,
  help: i18n.optional(),
  options: z.array(z.object({ value: z.string().regex(/^[a-z0-9_]{1,40}$/), label: i18n })).optional(),
});

export type FormField = z.infer<typeof fieldSchema>;

/** A form's schema: unique keys, every field labelled, choice fields with at least one option. */
export const formSchemaSchema = z
  .array(fieldSchema)
  .max(60)
  .superRefine((fields, ctx) => {
    const seen = new Set<string>();
    fields.forEach((f, i) => {
      if (seen.has(f.key)) ctx.addIssue({ code: "custom", path: [i, "key"], message: "duplicate_key" });
      seen.add(f.key);
      if (!Object.values(f.label).some((v) => v.trim())) ctx.addIssue({ code: "custom", path: [i, "label"], message: "field_label" });
      if (CHOICE_TYPES.includes(f.type) && !f.options?.length) ctx.addIssue({ code: "custom", path: [i, "options"], message: "field_options" });
    });
  });

/** Parses a stored form_schema, dropping anything malformed instead of crashing a page. */
export function readFields(value: unknown): FormField[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((f) => {
    const parsed = fieldSchema.safeParse(f);
    return parsed.success ? [parsed.data] : [];
  });
}

/** A new, unused key like field_3. */
export function nextKey(fields: FormField[], base = "field"): string {
  for (let n = fields.length + 1; ; n++) {
    const key = `${base}_${n}`;
    if (!fields.some((f) => f.key === key)) return key;
  }
}
