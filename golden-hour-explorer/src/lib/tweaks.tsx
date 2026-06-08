import type { ReactNode } from "react";

/**
 * Native no-op stub. The appearance-tweak system is web-only; on native this
 * provider just passes children through and useTweaks returns static defaults,
 * so the native app is completely unaffected. (Metro resolves tweaks.web.tsx
 * for the web bundle; TypeScript resolves consumers against this file.)
 */
export type Mode = "system" | "light" | "dark";
export type Density = "comfortable" | "compact";
export type Corners = "soft" | "sharp";
export type Tweaks = { mode: Mode; density: Density; radius: Corners };

const DEFAULTS: Tweaks = { mode: "system", density: "comfortable", radius: "soft" };

export function TweaksProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function useTweaks() {
  return {
    tweaks: DEFAULTS,
    resolvedMode: "dark" as "light" | "dark",
    setTweak<K extends keyof Tweaks>(_key: K, _value: Tweaks[K]): void {},
  };
}
