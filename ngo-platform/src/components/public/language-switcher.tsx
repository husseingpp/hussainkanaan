"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Globe } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  locales: { code: string; name: string }[];
  current: string;
  label: string;
  className?: string;
};

/** Switches language while staying on the same page. */
export function LanguageSwitcher({ locales, current, label, className }: Props) {
  const pathname = usePathname() || `/${current}`;
  const rest = pathname.replace(/^\/[^/]+/, "");

  return (
    <nav aria-label={label} className={cn("flex items-center gap-1 text-sm", className)}>
      <Globe aria-hidden className="me-1 size-4 opacity-70" />
      {locales.map((l) => (
        <Link
          key={l.code}
          href={`/${l.code}${rest}`}
          hrefLang={l.code}
          lang={l.code}
          aria-current={l.code === current ? "true" : undefined}
          className={cn(
            "rounded-theme px-2.5 py-1 transition-colors hover:bg-current/10",
            l.code === current && "bg-current/15 font-semibold",
          )}
        >
          {l.name}
        </Link>
      ))}
    </nav>
  );
}
