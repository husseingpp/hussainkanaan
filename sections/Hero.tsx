"use client";

import { useEffect, useRef, useState } from "react";
import { Icons } from "@/components/Icons";
import { data } from "@/data/portfolio";

function useTypewriter(words: string[]) {
  const [typed, setTyped] = useState("");
  const idx = useRef(0);
  const char = useRef(0);
  const del = useRef(false);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setTyped(words[0]);
      return;
    }
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const word = words[idx.current % words.length];
      if (!del.current) {
        char.current++;
        setTyped(word.slice(0, char.current));
        if (char.current === word.length) {
          del.current = true;
          timer = setTimeout(tick, 1500);
          return;
        }
        timer = setTimeout(tick, 70 + Math.random() * 50);
      } else {
        char.current--;
        setTyped(word.slice(0, char.current));
        if (char.current === 0) {
          del.current = false;
          idx.current++;
          timer = setTimeout(tick, 220);
          return;
        }
        timer = setTimeout(tick, 36);
      }
    };
    timer = setTimeout(tick, 900);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return typed;
}

export function Hero() {
  const typed = useTypewriter(data.roles);

  return (
    <header className="hero" id="hero">
      <div className="hero-bg" aria-hidden="true">
        <div className="hero-grid" />
        <div className="hero-glow glow-a" />
        <div className="hero-glow glow-b" />
      </div>
      <div className="wrap hero-inner">
        <p className="eyebrow" data-rise="1">
          {data.greeting}
        </p>
        <h1 className="hero-name" data-rise="2">
          {data.name}
        </h1>
        <div className="hero-role" data-rise="3">
          <span className="typed">{typed}</span>
          <span className="caret" />
        </div>
        <p className="hero-desc" data-rise="4">
          {data.tagline}
        </p>
        <div className="hero-cta" data-rise="5">
          <a className="btn btn-primary" href="#projects">
            View Work <Icons.arrow className="ar" />
          </a>
          <a className="btn btn-ghost" href="#contact">
            Contact Me
          </a>
        </div>
        <div className="hero-social" data-rise="6">
          <a
            className="icon-btn"
            href={"mailto:" + data.email}
            aria-label="Email"
          >
            <Icons.mail />
          </a>
          <a
            className="icon-btn"
            href={data.linkedin}
            target="_blank"
            rel="noreferrer"
            aria-label="LinkedIn"
          >
            <Icons.linkedin />
          </a>
          <a
            className="icon-btn"
            href={data.github}
            target="_blank"
            rel="noreferrer"
            aria-label="GitHub"
          >
            <Icons.github />
          </a>
        </div>
      </div>
      <a className="scrollcue" href="#about" aria-label="Scroll down">
        <span>scroll</span>
        <span className="line" />
      </a>
    </header>
  );
}
