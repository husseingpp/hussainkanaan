import { createClient } from "@/lib/supabase/client";
import type { Row } from "@/lib/data/types";
import { settingsSchema, type SettingsInput } from "@/lib/validation/content";
import { errorKey, fail, ok, validate, type Result } from "./result";

export type SettingsRow = Row<"site_settings">;

export async function loadSettings(): Promise<Result<SettingsRow>> {
  const { data, error } = await createClient().from("site_settings").select("*").eq("id", 1).maybeSingle();
  if (error) return fail(errorKey(error));
  return data ? ok(data) : fail("not_found");
}

/**
 * Saves general settings. `modules` is only sent for admins: editors may edit
 * everything else, and the DB trigger refuses module changes from non-admins anyway.
 */
export async function saveSettings(input: SettingsInput, isAdmin: boolean): Promise<Result<null>> {
  const v = validate(settingsSchema, input);
  if (!v.ok) return v;
  const { modules, ...rest } = v.data;
  const { error } = await createClient()
    .from("site_settings")
    .update(isAdmin ? { ...rest, modules } : rest)
    .eq("id", 1);
  return error ? fail(errorKey(error)) : ok(null);
}
