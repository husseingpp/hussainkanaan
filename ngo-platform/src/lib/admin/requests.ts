import { createClient } from "@/lib/supabase/client";
import type { Enum, Row } from "@/lib/data/types";
import { readFields, type FormField } from "@/lib/forms/fields";
import { errorKey, fail, ok, type Result } from "./result";

export type RequestStatus = Enum<"request_status">;
export type RequestPriority = Enum<"request_priority">;
export const STATUSES: RequestStatus[] = ["new", "in_review", "approved", "rejected", "fulfilled", "closed"];
export const PRIORITIES: RequestPriority[] = ["low", "normal", "high", "urgent"];

export type InboxItem = Pick<Row<"requests">, "id" | "tracking_code" | "full_name" | "phone" | "status" | "priority" | "created_at" | "assigned_to"> & {
  form: Pick<Row<"request_types">, "id" | "name"> | null;
};
export type RequestDetail = Row<"requests"> & {
  form: { id: string; name: Row<"request_types">["name"]; fields: FormField[] } | null;
  events: Row<"request_events">[];
};
export type StaffOption = { user_id: string; full_name: string };

export async function listRequests(filters: { status?: RequestStatus; formId?: string }): Promise<Result<InboxItem[]>> {
  let q = createClient()
    .from("requests")
    .select("id, tracking_code, full_name, phone, status, priority, created_at, assigned_to, form:request_types(id, name)")
    .order("created_at", { ascending: false })
    .limit(500);
  if (filters.status) q = q.eq("status", filters.status);
  if (filters.formId) q = q.eq("type_id", filters.formId);
  const { data, error } = await q;
  return error ? fail(errorKey(error)) : ok(data as unknown as InboxItem[]);
}

export async function loadRequest(id: string): Promise<Result<RequestDetail>> {
  const { data, error } = await createClient()
    .from("requests")
    .select("*, form:request_types(id, name, form_schema), events:request_events(*)")
    .eq("id", id)
    .maybeSingle();
  if (error) return fail(errorKey(error));
  if (!data) return fail("not_found");
  const raw = data as unknown as Row<"requests"> & {
    form: { id: string; name: Row<"request_types">["name"]; form_schema: unknown } | null;
    events: Row<"request_events">[];
  };
  const { form, events, ...rest } = raw;
  return ok({
    ...rest,
    form: form ? { id: form.id, name: form.name, fields: readFields(form.form_schema) } : null,
    events: [...events].sort((a, b) => a.created_at.localeCompare(b.created_at)),
  });
}

/** Status / priority / assignee / public note. Each change is logged by a DB trigger (append-only history). */
export async function updateRequest(
  id: string,
  patch: Partial<{ status: RequestStatus; priority: RequestPriority; assigned_to: string | null; public_note: string | null }>,
): Promise<Result<null>> {
  const { error } = await createClient().from("requests").update(patch).eq("id", id);
  return error ? fail(errorKey(error)) : ok(null);
}

export async function addNote(requestId: string, actorId: string, text: string): Promise<Result<null>> {
  if (!text.trim()) return fail("invalid");
  const { error } = await createClient()
    .from("request_events")
    .insert({ request_id: requestId, event_type: "note", data: { text: text.trim() }, actor_id: actorId });
  return error ? fail(errorKey(error)) : ok(null);
}

/** Staff that requests can be assigned to (admins see everyone; others see themselves via RLS). */
export async function listAssignable(): Promise<StaffOption[]> {
  const { data } = await createClient()
    .from("profiles")
    .select("user_id, full_name, role, is_active")
    .in("role", ["admin", "case_worker"])
    .eq("is_active", true);
  return (data ?? []).map((p) => ({ user_id: p.user_id, full_name: p.full_name }));
}

export async function modulesState(): Promise<{ requests: boolean }> {
  const { data } = await createClient().from("site_settings").select("modules").eq("id", 1).maybeSingle();
  return { requests: (data?.modules as { requests?: boolean } | null)?.requests === true };
}
