import type { ZodType } from "zod";

/** Same contract as the blueprint's server actions: never throw to the UI. */
export type Result<T> = { ok: true; data: T } | { ok: false; error: string };

export const ok = <T>(data: T): Result<T> => ({ ok: true, data });
export const fail = <T = never>(error: string): Result<T> => ({ ok: false, error });

/** Maps a Postgres/PostgREST error to an admin.errors.* key (the UI translates it). */
export function errorKey(e: { code?: string; message?: string } | null | undefined): string {
  if (!e) return "unknown";
  if (e.code === "42501" || /row-level security/i.test(e.message ?? "")) return "forbidden";
  if (e.code === "23505") return "duplicate";
  if (e.code === "23503") return "in_use";
  if (e.code === "23514" || e.code === "22P02") return "invalid";
  return "unknown";
}

/** Validates with Zod; the error is an admin.errors.* key. */
export function validate<T>(schema: ZodType<T>, input: unknown): Result<T> {
  const parsed = schema.safeParse(input);
  if (parsed.success) return ok(parsed.data);
  const issue = parsed.error.issues[0];
  if (issue?.message === "required") return fail("title_required");
  if (issue?.message === "slug") return fail("invalid_slug");
  return fail("invalid");
}
