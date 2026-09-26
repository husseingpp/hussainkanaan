"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type Slide = {
  id: string;
  image: string;
  title: string;
  subtitle: string;
  cta?: { label: string; href: string; external: boolean };
  overlay: number;
  position: "start" | "center" | "end";
};

type Props = {
  slides: Slide[];
  autoplay: boolean;
  interval: number;
  labels: { previous: string; next: string; goTo: string };
};

const ALIGN = { start: "items-start text-start", center: "items-center text-center", end: "items-end text-end" };

/** Hero slider. Swipe and arrow order follow the page direction; autoplay pauses on hover/focus and for reduced motion. */
export function HeroCarousel({ slides, autoplay, interval, labels }: Props) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const start = useRef<number | null>(null);
  const total = slides.length;
  const go = useCallback((d: number) => setIndex((i) => (i + d + total) % total), [total]);

  useEffect(() => {
    if (!autoplay || paused || total < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => go(1), interval);
    return () => clearInterval(id);
  }, [autoplay, paused, total, interval, go]);

  return (
    <section
      aria-roledescription="carousel"
      className="relative isolate min-h-[34rem] overflow-hidden bg-primary text-white sm:min-h-[40rem]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onPointerDown={(e) => (start.current = e.clientX)}
      onPointerUp={(e) => {
        if (start.current === null) return;
        const dx = e.clientX - start.current;
        start.current = null;
        if (Math.abs(dx) < 50) return;
        const rtl = document.documentElement.dir === "rtl";
        go((rtl ? dx > 0 : dx < 0) ? 1 : -1);
      }}
    >
      {slides.map((s, i) => (
        <div
          key={s.id}
          role="group"
          aria-roledescription="slide"
          aria-label={`${i + 1} / ${total}`}
          aria-hidden={i !== index}
          className={cn("absolute inset-0 transition-opacity duration-700", i === index ? "opacity-100" : "pointer-events-none opacity-0")}
        >
          <Image src={s.image} alt="" fill priority={i === 0} sizes="100vw" className="-z-10 object-cover" />
          <div className="absolute inset-0 -z-10 bg-black" style={{ opacity: s.overlay / 100 }} />
          <div className={cn("mx-auto flex h-full max-w-6xl flex-col justify-end px-4 pb-24 pt-32 sm:px-6", ALIGN[s.position])}>
            {s.title && (i === 0 ? <h1 className="max-w-3xl text-balance text-3xl font-bold leading-tight sm:text-5xl">{s.title}</h1> : <p className="max-w-3xl text-balance text-3xl font-bold leading-tight sm:text-5xl">{s.title}</p>)}
            {s.subtitle && <p className="mt-4 max-w-2xl text-pretty text-lg opacity-90">{s.subtitle}</p>}
            {s.cta && (
              <Link
                href={s.cta.href}
                tabIndex={i === index ? 0 : -1}
                {...(s.cta.external && { target: "_blank", rel: "noreferrer" })}
                className="mt-8 inline-flex h-12 items-center rounded-theme bg-secondary px-7 font-medium text-secondary-foreground hover:opacity-90"
              >
                {s.cta.label}
              </Link>
            )}
          </div>
        </div>
      ))}

      {total > 1 && (
        <div className="absolute inset-x-0 bottom-6 mx-auto flex max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex gap-2">
            {slides.map((s, i) => (
              <button
                key={s.id}
                type="button"
                aria-label={labels.goTo.replace("{index}", String(i + 1))}
                aria-current={i === index}
                onClick={() => setIndex(i)}
                className={cn("h-2.5 rounded-full bg-white transition-all", i === index ? "w-8" : "w-2.5 opacity-50")}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <button type="button" aria-label={labels.previous} onClick={() => go(-1)} className="grid size-11 place-items-center rounded-full bg-white/15 hover:bg-white/25">
              <ChevronLeft aria-hidden className="size-6 rtl:rotate-180" />
            </button>
            <button type="button" aria-label={labels.next} onClick={() => go(1)} className="grid size-11 place-items-center rounded-full bg-white/15 hover:bg-white/25">
              <ChevronRight aria-hidden className="size-6 rtl:rotate-180" />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
