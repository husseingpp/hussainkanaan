import { createClient } from "@/lib/supabase/client";
import type { Row } from "@/lib/data/types";
import { objectiveSchema, sectorSchema, type ObjectiveInput, type SectorInput } from "@/lib/validation/content";
import { errorKey, fail, ok, validate, type Result } from "./result";

export type SectorRow = Row<"sectors">;
export type ObjectiveRow = Row<"objectives">;
export type LocaleRow = Row<"locales">;

export async function listLocales(): Promise<Result<LocaleRow[]>> {
  const { data, error } = await createClient().from("locales").select("*").eq("is_enabled", true).order("sort_order");
  return error ? fail(errorKey(error)) : ok(data);
}

export async function listSectors(): Promise<Result<SectorRow[]>> {
  const { data, error } = await createClient().from("sectors").select("*").order("sort_order");
  return error ? fail(errorKey(error)) : ok(data);
}

export async function loadSector(id: string): Promise<Result<SectorRow>> {
  const { data, error } = await createClient().from("sectors").select("*").eq("id", id).maybeSingle();
  if (error) return fail(errorKey(error));
  return data ? ok(data) : fail("not_found");
}

export async function sectorSlugTaken(slug: string, exceptId?: string): Promise<boolean> {
  let q = createClient().from("sectors").select("id", { count: "exact", head: true }).eq("slug", slug);
  if (exceptId) q = q.neq("id", exceptId);
  return ((await q).count ?? 0) > 0;
}

export async function saveSector(input: SectorInput): Promise<Result<{ id: string }>> {
  const v = validate(sectorSchema, input);
  if (!v.ok) return v;
  const { id, ...row } = v.data;
  const db = createClient();
  const res = id
    ? await db.from("sectors").update(row).eq("id", id).select("id").single()
    : await db.from("sectors").insert({ ...row, sort_order: await nextOrder("sectors") }).select("id").single();
  return res.error ? fail(errorKey(res.error)) : ok({ id: res.data.id });
}

export async function listObjectives(): Promise<Result<ObjectiveRow[]>> {
  const { data, error } = await createClient().from("objectives").select("*").order("sort_order");
  return error ? fail(errorKey(error)) : ok(data);
}

export async function saveObjective(input: ObjectiveInput): Promise<Result<ObjectiveRow>> {
  const v = validate(objectiveSchema, input);
  if (!v.ok) return v;
  const { id, ...row } = v.data;
  const db = createClient();
  const res = id
    ? await db.from("objectives").update(row).eq("id", id).select().single()
    : await db.from("objectives").insert({ ...row, sort_order: await nextOrder("objectives") }).select().single();
  return res.error ? fail(errorKey(res.error)) : ok(res.data);
}

type Ordered = "sectors" | "objectives";

async function nextOrder(table: Ordered): Promise<number> {
  const { data } = await createClient().from(table).select("sort_order").order("sort_order", { ascending: false }).limit(1);
  return (data?.[0]?.sort_order ?? 0) + 1;
}

/** Persists a drag-and-drop order: position in `ids` becomes sort_order. */
export async function reorder(table: Ordered, ids: string[]): Promise<Result<null>> {
  const db = createClient();
  const results = await Promise.all(ids.map((id, i) => db.from(table).update({ sort_order: i + 1 }).eq("id", id)));
  const failed = results.find((r) => r.error);
  return failed?.error ? fail(errorKey(failed.error)) : ok(null);
}

export async function setActive(table: Ordered, id: string, is_active: boolean): Promise<Result<null>> {
  const { error } = await createClient().from(table).update({ is_active }).eq("id", id);
  return error ? fail(errorKey(error)) : ok(null);
}

export async function remove(table: Ordered | "pages", id: string): Promise<Result<null>> {
  const { error } = await createClient().from(table).delete().eq("id", id);
  return error ? fail(errorKey(error)) : ok(null);
}
