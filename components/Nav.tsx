"use client";

import { useEffect, useState } from "react";
import { Icons } from "./Icons";
import { useTweaks } from "./TweaksProvider";
import { data } from "@/data/portfolio";

export function Nav() {
  const { resolvedTheme, mounted, toggleTheme } = useTweaks();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  const Sun = Icons.sun;
  const Moon = Icons.moon;

  return (
    <nav className={"nav" + (scrolled ? " scrolled" : "")}>
      <div className="wrap">
        <a className="logo" href="#hero" aria-label="Home">
          {data.monogram}
          <span className="dot">.</span>
        </a>
        <div className="nav-links">
          {data.nav.map((n) => (
            <a key={n.href} className="nav-link" href={n.href}>
              {n.label}
            </a>
          ))}
        </div>
        <div className="nav-right">
          <button
            className="icon-btn"
            onClick={toggleTheme}
            aria-label="Toggle light or dark mode"
            title="Toggle theme"
          >
            {/* render the icon only after mount to avoid hydration mismatch */}
            {!mounted ? (
              <span style={{ width: 18, height: 18 }} />
            ) : resolvedTheme === "dark" ? (
              <Sun className="theme-ico" />
            ) : (
              <Moon className="theme-ico" />
            )}
          </button>
          <a
            className="btn btn-primary"
            href="#contact"
            style={{ padding: "10px 18px" }}
          >
            Hire Me <Icons.arrow className="ar" />
          </a>
        </div>
      </div>
    </nav>
  );
}
