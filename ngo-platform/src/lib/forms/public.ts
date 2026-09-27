import { createClient } from "@/lib/supabase/client";
import type { Row } from "@/lib/data/types";
import { readFields, type FormField } from "./fields";

// Browser-side public calls (anon). Work on static hosting; RLS / RPCs guard them.
export type PublicForm = Pick<Row<"request_types">, "id" | "slug" | "name" | "description" | "icon"> & { fields: FormField[] };
export type TrackResult = { tracking_code: string; status: string; public_note: string | null; type_name: unknown; updated_at: string };

export async function openForms(): Promise<PublicForm[] | null> {
  const { data, error } = await createClient()
    .from("request_types")
    .select("id, slug, name, description, icon, form_schema")
    .eq("is_open", true)
    .order("sort_order");
  if (error) return null;
  return data.map(({ form_schema, ...f }) => ({ ...f, fields: readFields(form_schema) }));
}

export async function openForm(slug: string): Promise<PublicForm | null> {
  const forms = await openForms();
  return forms?.find((f) => f.slug === slug) ?? null;
}

/** Returns the tracking code, or an error code (requests_closed, form_closed, missing:key, invalid:key, rate_limited…). */
export async function submit(
  slug: string,
  input: { fullName: string; phone: string; answers: Record<string, unknown>; consent: boolean; locale: string },
): Promise<{ ok: true; code: string } | { ok: false; error: string }> {
  const { data, error } = await createClient().rpc("submit_request", {
    p_type_slug: slug,
    p_full_name: input.fullName,
    p_phone: input.phone,
    p_answers: input.answers as never,
    p_consent: input.consent,
    p_locale: input.locale,
  });
  if (error) return { ok: false, error: error.message || "unknown" };
  return { ok: true, code: data as string };
}

export async function track(code: string, phone: string): Promise<{ ok: true; data: TrackResult | null } | { ok: false; error: string }> {
  const { data, error } = await createClient().rpc("check_request_status", { p_tracking_code: code, p_phone: phone });
  if (error) return { ok: false, error: error.message === "rate_limited" ? "rate_limited" : "unknown" };
  return { ok: true, data: (data?.[0] as TrackResult | undefined) ?? null };
}
