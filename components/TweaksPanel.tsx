"use client";

import { useEffect, useState } from "react";
import { Icons } from "./Icons";
import {
  useTweaks,
  type Accent,
  type Tweaks,
} from "./TweaksProvider";

type Opt<T extends string> = { value: T; label: string };

function Seg<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Opt<T>[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="twk-row">
      <span className="twk-label">{label}</span>
      <div className="twk-seg" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            data-on={value === o.value ? "1" : "0"}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

const ACCENT_SWATCHES: { key: Accent; color: string }[] = [
  { key: "default", color: "var(--accent)" },
  { key: "clay", color: "#C2613F" },
  { key: "honey", color: "#D98A2B" },
  { key: "indigo", color: "#4F46E5" },
  { key: "forest", color: "#2F8A5B" },
  { key: "rose", color: "#C0436A" },
];

function AccentRow({
  value,
  onChange,
}: {
  value: Accent;
  onChange: (v: Accent) => void;
}) {
  return (
    <div className="twk-row">
      <span className="twk-label">Accent</span>
      <div className="twk-chips" role="radiogroup" aria-label="Accent color">
        {ACCENT_SWATCHES.map((s) => (
          <button
            key={s.key}
            type="button"
            className="twk-chip"
            role="radio"
            aria-checked={value === s.key}
            title={s.key}
            aria-label={s.key}
            style={{ background: s.color }}
            onClick={() => onChange(s.key)}
          >
            {value === s.key && (
              <span
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "grid",
                  placeItems: "center",
                }}
              >
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: "#fff",
                    boxShadow: "0 0 0 1px rgba(0,0,0,.25)",
                  }}
                />
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="twk-row">
      <span className="twk-label">{label}</span>
      <button
        type="button"
        className="twk-toggle"
        role="switch"
        aria-checked={value}
        aria-label={label}
        data-on={value ? "1" : "0"}
        onClick={() => onChange(!value)}
      >
        <span className="knob" />
      </button>
    </div>
  );
}

export function TweaksPanel() {
  const { tweaks, setTweak, mounted } = useTweaks();
  const [open, setOpen] = useState(false);

  // close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // avoid rendering panel state before hydration settles
  if (!mounted) return null;

  const set =
    <K extends keyof Tweaks>(key: K) =>
    (v: Tweaks[K]) =>
      setTweak(key, v);

  return (
    <>
      {!open && (
        <button
          type="button"
          className="twk-fab"
          onClick={() => setOpen(true)}
          aria-label="Open style tweaks"
        >
          <Icons.sliders />
          Tweaks
        </button>
      )}

      {open && (
        <>
          <div
            className="twk-overlay"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div
            className="twk-panel"
            role="dialog"
            aria-label="Style tweaks"
            aria-modal="true"
          >
            <div className="twk-head">
              <span className="twk-title">Tweaks</span>
              <button
                type="button"
                className="twk-close"
                onClick={() => setOpen(false)}
                aria-label="Close tweaks"
              >
                <Icons.close />
              </button>
            </div>

            <div className="twk-section">Design direction</div>
            <Seg
              label="Style"
              value={tweaks.direction}
              options={[
                { value: "editorial", label: "Editorial" },
                { value: "warm", label: "Warm" },
                { value: "tech", label: "Tech" },
              ]}
              onChange={set("direction")}
            />

            <div className="twk-section">Appearance</div>
            <Seg
              label="Theme"
              value={tweaks.theme}
              options={[
                { value: "system", label: "System" },
                { value: "light", label: "Light" },
                { value: "dark", label: "Dark" },
              ]}
              onChange={set("theme")}
            />
            <AccentRow value={tweaks.accent} onChange={set("accent")} />

            <div className="twk-section">Motion &amp; texture</div>
            <Seg
              label="Animation"
              value={tweaks.anim}
              options={[
                { value: "full", label: "Full" },
                { value: "subtle", label: "Subtle" },
                { value: "off", label: "Off" },
              ]}
              onChange={set("anim")}
            />
            <ToggleRow
              label="Film grain"
              value={tweaks.grain}
              onChange={set("grain")}
            />
          </div>
        </>
      )}
    </>
  );
}
