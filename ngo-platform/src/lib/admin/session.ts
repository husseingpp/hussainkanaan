import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";
import { fail, ok, type Result } from "./result";

export type Role = Database["public"]["Enums"]["user_role"];
export type Staff = { id: string; email: string; name: string; role: Role };

/** The signed-in staff member, or null (not signed in / no active profile). */
export async function currentStaff(): Promise<Staff | null> {
  const db = createClient();
  const { data: { session } } = await db.auth.getSession();
  if (!session) return null;
  const { data } = await db.from("profiles").select("full_name, role, is_active").eq("user_id", session.user.id).maybeSingle();
  if (!data?.is_active) return null;
  return { id: session.user.id, email: session.user.email ?? "", name: data.full_name, role: data.role };
}

export const canEditContent = (s: Staff | null) => s?.role === "admin" || s?.role === "editor";

export async function sendLoginLink(email: string, redirectTo: string): Promise<Result<null>> {
  const { error } = await createClient().auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectTo, shouldCreateUser: false },
  });
  if (!error) return ok(null);
  return fail(/rate/i.test(error.message) ? "rate_limited" : /signups|not allowed|not found/i.test(error.message) ? "no_account" : "unknown");
}

export async function signInWithPassword(email: string, password: string): Promise<Result<null>> {
  const { error } = await createClient().auth.signInWithPassword({ email, password });
  return error ? fail("wrong_credentials") : ok(null);
}

export async function setPassword(password: string): Promise<Result<null>> {
  if (password.length < 10) return fail("weak_password");
  const { error } = await createClient().auth.updateUser({ password });
  return error ? fail(/weak|pwned|leaked/i.test(error.message) ? "weak_password" : "unknown") : ok(null);
}

export async function signOut() {
  await createClient().auth.signOut();
}
