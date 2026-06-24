/**
 * Client-generated identifiers.
 *
 * Every syncable row gets a UUID created on the client (see CLAUDE.md / BLUEPRINT.md §7)
 * so that rows created offline have stable IDs and never collide with cloud rows.
 */

/** Generate a new RFC 4122 v4 UUID. */
export function newId(): string {
  return crypto.randomUUID();
}

/** Current timestamp as an ISO 8601 string — used for created_at / updated_at. */
export function nowIso(): string {
  return new Date().toISOString();
}
