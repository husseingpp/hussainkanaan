"use client";

import Link from "next/link";
import { Icons } from "@/components/Icons";
import { useTweaks } from "@/components/TweaksProvider";

const SOURCE_URL =
  "https://github.com/husseingpp/hussainkanaan/tree/main/golden-hour-explorer";

export function SunspotHeader() {
  const { resolvedTheme, mounted, toggleTheme } = useTweaks();

  return (
    <header className="gh-bar">
      <Link className="gh-back" href="/">
        <Icons.arrow /> Hussein Kanaan
      </Link>
      <div className="gh-bar-spacer" />
      <a
        className="gh-bar-link"
        href={SOURCE_URL}
        target="_blank"
        rel="noreferrer"
      >
        <Icons.github /> Source
      </a>
      <button
        className="gh-icon-btn"
        onClick={toggleTheme}
        aria-label="Toggle light or dark mode"
        title="Toggle theme"
      >
        {!mounted ? (
          <span style={{ width: 18, height: 18 }} />
        ) : resolvedTheme === "dark" ? (
          <Icons.sun />
        ) : (
          <Icons.moon />
        )}
      </button>
    </header>
  );
}
