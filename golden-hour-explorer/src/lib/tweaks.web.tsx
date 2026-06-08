import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type Mode = "system" | "light" | "dark";
export type Density = "comfortable" | "compact";
export type Corners = "soft" | "sharp";
export type Tweaks = { mode: Mode; density: Density; radius: Corners };

const DEFAULTS: Tweaks = { mode: "system", density: "comfortable", radius: "soft" };
const KEY = "gh:tweaks";

type Ctx = {
  tweaks: Tweaks;
  resolvedMode: "light" | "dark";
  setTweak: <K extends keyof Tweaks>(key: K, value: Tweaks[K]) => void;
};

const TweaksContext = createContext<Ctx | null>(null);

function systemPrefersDark(): boolean {
  return (
    typeof window !== "undefined" &&
    !!window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

/**
 * Web theme controller. Holds the user's appearance tweaks, writes them to
 * <html> data attributes (which the +html.tsx CSS reacts to) and persists them
 * to localStorage. Lazy initial state matches the pre-paint script, so the very
 * first render is already correct — no flash.
 */
export function TweaksProvider({ children }: { children: ReactNode }) {
  const [tweaks, setTweaks] = useState<Tweaks>(() => {
    if (typeof window === "undefined") return DEFAULTS;
    try {
      return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || "{}") };
    } catch {
      return DEFAULTS;
    }
  });
  const [sysDark, setSysDark] = useState<boolean>(() => systemPrefersDark());

  // Track OS light/dark changes (only matters while mode === "system").
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setSysDark(mq.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  const resolvedMode: "light" | "dark" =
    tweaks.mode === "system" ? (sysDark ? "dark" : "light") : tweaks.mode;

  // Apply to <html> + persist whenever anything changes.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const d = document.documentElement;
    d.setAttribute("data-gh-mode", resolvedMode);
    d.setAttribute("data-gh-density", tweaks.density);
    d.setAttribute("data-gh-radius", tweaks.radius);
    d.style.colorScheme = resolvedMode;
    try {
      localStorage.setItem(KEY, JSON.stringify(tweaks));
    } catch {
      /* ignore quota/availability errors */
    }
  }, [tweaks, resolvedMode]);

  const value = useMemo<Ctx>(
    () => ({
      tweaks,
      resolvedMode,
      setTweak: (key, val) => setTweaks((t) => ({ ...t, [key]: val })),
    }),
    [tweaks, resolvedMode],
  );

  return <TweaksContext.Provider value={value}>{children}</TweaksContext.Provider>;
}

export function useTweaks(): Ctx {
  const ctx = useContext(TweaksContext);
  if (!ctx) throw new Error("useTweaks must be used within a TweaksProvider");
  return ctx;
}
