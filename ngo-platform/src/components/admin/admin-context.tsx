"use client";

import { createContext, useContext } from "react";
import type { Staff } from "@/lib/admin/session";
import type { LocaleRow } from "@/lib/admin/taxonomy";

export type AdminContextValue = {
  staff: Staff;
  locales: LocaleRow[];
  defaultLocale: string;
};

export const AdminContext = createContext<AdminContextValue | null>(null);

export function useAdmin(): AdminContextValue {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error("useAdmin() outside the admin shell");
  return ctx;
}
