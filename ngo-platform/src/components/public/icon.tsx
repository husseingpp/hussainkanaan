import { icons, type LucideProps } from "lucide-react";

/** Renders a lucide icon by its kebab-case name (as stored in the DB, e.g. "heart-pulse"). */
export function Icon({ icon, fallback = "circle", ...props }: Omit<LucideProps, "name"> & { icon?: string | null; fallback?: string }) {
  const pascal = (s: string) => s.replace(/(^|-)([a-z0-9])/g, (_, __, c: string) => c.toUpperCase());
  const Cmp = (icon && icons[pascal(icon) as keyof typeof icons]) || icons[pascal(fallback) as keyof typeof icons];
  return Cmp ? <Cmp aria-hidden {...props} /> : null;
}
