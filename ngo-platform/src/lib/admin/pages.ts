import { createClient } from "@/lib/supabase/client";
import type { Row } from "@/lib/data/types";
import { pageSchema, type PageInput } from "@/lib/validation/content";
import { errorKey, fail, ok, validate, type Result } from "./result";

export type PageRow = Row<"pages">;

export async function listPages(): Promise<Result<PageRow[]>> {
  const { data, error } = await createClient().from("pages").select("*").order("created_at");
  return error ? fail(errorKey(error)) : ok(data);
}

export async function loadPage(id: string): Promise<Result<PageRow>> {
  const { data, error } = await createClient().from("pages").select("*").eq("id", id).maybeSingle();
  if (error) return fail(errorKey(error));
  return data ? ok(data) : fail("not_found");
}

export async function pageSlugTaken(slug: string, exceptId?: string): Promise<boolean> {
  let q = createClient().from("pages").select("id", { count: "exact", head: true }).eq("slug", slug);
  if (exceptId) q = q.neq("id", exceptId);
  return ((await q).count ?? 0) > 0;
}

export async function savePage(input: PageInput): Promise<Result<{ id: string }>> {
  const v = validate(pageSchema, input);
  if (!v.ok) return v;
  const { id, ...rest } = v.data;
  const row = { ...rest, body: rest.body as PageRow["body"] };
  const db = createClient();
  const res = id
    ? await db.from("pages").update(row).eq("id", id).select("id").single()
    : await db.from("pages").insert(row).select("id").single();
  return res.error ? fail(errorKey(res.error)) : ok({ id: res.data.id });
}
