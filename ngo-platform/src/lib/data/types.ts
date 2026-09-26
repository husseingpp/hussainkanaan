import type { Database } from "@/types/database";

type PublicTables = Database["public"]["Tables"];
export type Row<T extends keyof PublicTables> = PublicTables[T]["Row"];
export type Enum<T extends keyof Database["public"]["Enums"]> = Database["public"]["Enums"][T];
