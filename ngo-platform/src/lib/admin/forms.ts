import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import type { Row } from "@/lib/data/types";
import { formSchemaSchema, readFields, type FormField } from "@/lib/forms/fields";
import { SLUG_PATTERN } from "@/lib/slug";
import { errorKey, fail, ok, type Result } from "./result";

export type FormRow = Row<"request_types">;
export type FormInput = {
  id?: string;
  slug: string;
  name: Record<string, string>;
  description: Record<string, string>;
  is_open: boolean;
  fields: FormField[];
};

const formInput = z.object({
  id: z.uuid().optional(),
  slug: z.string().regex(SLUG_PATTERN, "slug"),
  name: z.record(z.string(), z.string()).refine((m) => Object.values(m).some((v) => v.trim()), "required"),
  description: z.record(z.string(), z.string()),
  is_open: z.boolean(),
  fields: formSchemaSchema,
});

export async function listForms(): Promise<Result<(FormRow & { responses: { count: number }[] })[]>> {
  const { data, error } = await createClient().from("request_types").select("*, responses:requests(count)").order("sort_order");
  return error ? fail(errorKey(error)) : ok(data as unknown as (FormRow & { responses: { count: number }[] })[]);
}

export async function loadForm(id: string): Promise<Result<FormInput>> {
  const { data, error } = await createClient().from("request_types").select("*").eq("id", id).maybeSingle();
  if (error) return fail(errorKey(error));
  if (!data) return fail("not_found");
  return ok({
    id: data.id,
    slug: data.slug,
    name: data.name as Record<string, string>,
    description: data.description as Record<string, string>,
    is_open: data.is_open,
    fields: readFields(data.form_schema),
  });
}

export async function formSlugTaken(slug: string, exceptId?: string): Promise<boolean> {
  let q = createClient().from("request_types").select("id", { count: "exact", head: true }).eq("slug", slug);
  if (exceptId) q = q.neq("id", exceptId);
  return ((await q).count ?? 0) > 0;
}

export async function saveForm(input: FormInput): Promise<Result<{ id: string }>> {
  const parsed = formInput.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const msg = issue?.message;
    return fail(msg === "required" ? "title_required" : msg === "slug" ? "invalid_slug" : msg && ["duplicate_key", "field_label", "field_options"].includes(msg) ? msg : "invalid");
  }
  const { id, fields, ...row } = parsed.data;
  const db = createClient();
  const values = { ...row, form_schema: fields as unknown as FormRow["form_schema"] };
  const res = id
    ? await db.from("request_types").update(values).eq("id", id).select("id").single()
    : await db.from("request_types").insert(values).select("id").single();
  return res.error ? fail(errorKey(res.error)) : ok({ id: res.data.id });
}

export async function deleteForm(id: string): Promise<Result<null>> {
  const { error } = await createClient().from("request_types").delete().eq("id", id);
  return error ? fail(errorKey(error)) : ok(null);
}
