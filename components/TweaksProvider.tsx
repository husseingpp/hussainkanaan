"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type Direction = "editorial" | "warm" | "tech";
export type ThemePref = "system" | "light" | "dark";
export type AnimLevel = "full" | "subtle" | "off";
export type Accent = "default" | "clay" | "honey" | "indigo" | "forest" | "rose";

export type Tweaks = {
  direction: Direction;
  theme: ThemePref;
  anim: AnimLevel;
  accent: Accent;
  grain: boolean;
};

const DEFAULTS: Tweaks = {
  direction: "editorial",
  theme: "system",
  anim: "full",
  accent: "default",
  grain: true,
};

const STORAGE_KEY = "portfolio:tweaks";

// accent overrides: [light accent, light accent2, dark accent, dark accent2]
const ACCENTS: Record<Exclude<Accent, "default">, [string, string, string, string]> = {
  clay: ["#B4543A", "#C2613F", "#E08A6E", "#D87C5E"],
  honey: ["#C8791E", "#B86A12", "#E8A94B", "#DA9A3A"],
  indigo: ["#4338CA", "#4F46E5", "#8B8CF9", "#7B7DF5"],
  forest: ["#2F7A55", "#27684A", "#5FBF93", "#4FB083"],
  rose: ["#C0436A", "#AD385C", "#EE7D9E", "#E06B8E"],
};

function hexToSoft(hex: string, a: number) {
  const h = hex.replace("#", "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  const n = parseInt(full, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

type Ctx = {
  tweaks: Tweaks;
  resolvedTheme: "light" | "dark";
  mounted: boolean;
  setTweak: <K extends keyof Tweaks>(key: K, value: Tweaks[K]) => void;
  toggleTheme: () => void;
};

const TweaksContext = createContext<Ctx | null>(null);

export function useTweaks() {
  const ctx = useContext(TweaksContext);
  if (!ctx) throw new Error("useTweaks must be used within TweaksProvider");
  return ctx;
}

export function TweaksProvider({ children }: { children: ReactNode }) {
  const [tweaks, setTweaks] = useState<Tweaks>(DEFAULTS);
  const [mounted, setMounted] = useState(false);
  const [sysDark, setSysDark] = useState(false);

  // hydrate from localStorage + read system preference (post-mount, no SSR mismatch)
  useEffect(() => {
    setMounted(true);
    setSysDark(window.matchMedia("(prefers-color-scheme: dark)").matches);
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      setTweaks((t) => ({ ...t, ...saved }));
    } catch {
      /* ignore */
    }
  }, []);

  // track system color-scheme changes
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const on = (e: MediaQueryListEvent) => setSysDark(e.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  const resolvedTheme: "light" | "dark" =
    tweaks.theme === "system" ? (sysDark ? "dark" : "light") : tweaks.theme;

  // apply root attributes + accent override + persist
  useEffect(() => {
    if (!mounted) return;
    const r = document.documentElement;
    r.setAttribute("data-theme", resolvedTheme);
    r.setAttribute("data-direction", tweaks.direction);
    r.setAttribute("data-anim", tweaks.anim);
    r.style.colorScheme = resolvedTheme;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tweaks));
    } catch {
      /* ignore */
    }

    if (tweaks.accent !== "default") {
      const [la, la2, da, da2] = ACCENTS[tweaks.accent];
      const dark = resolvedTheme === "dark";
      const a = dark ? da : la;
      const a2 = dark ? da2 : la2;
      r.style.setProperty("--accent", a);
      r.style.setProperty("--accent-2", a2);
      r.style.setProperty("--accent-soft", hexToSoft(a, dark ? 0.14 : 0.1));
    } else {
      r.style.removeProperty("--accent");
      r.style.removeProperty("--accent-2");
      r.style.removeProperty("--accent-soft");
    }
  }, [mounted, resolvedTheme, tweaks]);

  // scroll-reveal observer + anim-on gating
  useEffect(() => {
    if (!mounted) return;
    const root = document.documentElement;
    const els = Array.from(document.querySelectorAll<HTMLElement>(".reveal"));
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (tweaks.anim === "off" || reduce) {
      root.classList.remove("anim-on");
      els.forEach((e) => e.classList.add("in"));
      return;
    }

    root.classList.add("anim-on");
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) {
            en.target.classList.add("in");
            io.unobserve(en.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px -5% 0px" },
    );
    els.forEach((e) => {
      e.classList.remove("in");
      io.observe(e);
    });

    return () => io.disconnect();
  }, [mounted, tweaks.anim, tweaks.direction]);

  const setTweak = useCallback(
    <K extends keyof Tweaks>(key: K, value: Tweaks[K]) => {
      setTweaks((t) => ({ ...t, [key]: value }));
    },
    [],
  );

  const toggleTheme = useCallback(() => {
    setTweaks((t) => {
      const resolved =
        t.theme === "system"
          ? window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light"
          : t.theme;
      return { ...t, theme: resolved === "dark" ? "light" : "dark" };
    });
  }, []);

  return (
    <TweaksContext.Provider
      value={{ tweaks, resolvedTheme, mounted, setTweak, toggleTheme }}
    >
      {children}
    </TweaksContext.Provider>
  );
}
