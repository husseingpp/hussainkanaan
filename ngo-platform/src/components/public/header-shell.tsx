"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  style: "light" | "dark" | "transparent_over_hero";
  homePath: string;
  homeHasHero: boolean;
  labels: { menu: string; close: string };
  brand: ReactNode;
  desktopNav: ReactNode;
  mobileNav: ReactNode;
  switcher: ReactNode;
};

/** Header chrome: overlay-on-hero behaviour, scroll state and the mobile drawer. */
export function HeaderShell({ style, homePath, homeHasHero, labels, brand, desktopNav, mobileNav, switcher }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const overlay = style === "transparent_over_hero" && homeHasHero && pathname.replace(/\/$/, "") === homePath;

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const transparent = overlay && !scrolled && !open;
  const dark = transparent || style === "dark" || overlay;
  const tone = transparent
    ? "bg-transparent text-white"
    : dark
      ? "bg-foreground text-background shadow-sm"
      : "bg-background/95 text-foreground border-b border-foreground/10 backdrop-blur";

  return (
    <header data-tone={dark ? "dark" : "light"} className={cn("group inset-x-0 top-0 z-40 transition-colors", overlay ? "fixed" : "sticky", tone)}>
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        {brand}
        <div className="hidden items-center gap-4 lg:flex">
          {desktopNav}
          {switcher}
        </div>
        <button
          type="button"
          className="grid size-10 place-items-center rounded-theme hover:bg-current/10 lg:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? labels.close : labels.menu}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X aria-hidden className="size-6" /> : <Menu aria-hidden className="size-6" />}
        </button>
      </div>
      <div
        id="mobile-nav"
        hidden={!open}
        className="max-h-[calc(100dvh-4rem)] overflow-y-auto border-t border-current/10 px-4 pb-6 pt-2 lg:hidden"
      >
        {mobileNav}
        <div className="mt-4 border-t border-current/10 pt-4">{switcher}</div>
      </div>
    </header>
  );
}
