"use client";

import { useCallback, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

export type LightboxImage = { src: string; alt: string; caption?: string; width?: number | null; height?: number | null };

type Props = {
  images: LightboxImage[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
  labels: { label: string; close: string; next: string; previous: string; position: string };
};

/** Full-screen viewer. Arrow keys and swipes follow the page direction (RTL: swipe right = next). */
export function Lightbox({ images, index, onIndex, onClose, labels }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const total = images.length;
  const image = images[index];

  const go = useCallback((delta: number) => onIndex((index + delta + total) % total), [index, total, onIndex]);
  const isRtl = () => document.documentElement.dir === "rtl";

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      const forward = isRtl() ? "ArrowLeft" : "ArrowRight";
      const back = isRtl() ? "ArrowRight" : "ArrowLeft";
      if (e.key === forward) go(1);
      if (e.key === back) go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, onClose]);

  if (!image) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={labels.label}
      className="fixed inset-0 z-50 flex flex-col bg-black/95 text-white"
      onPointerDown={(e) => (start.current = { x: e.clientX, y: e.clientY })}
      onPointerUp={(e) => {
        if (!start.current) return;
        const dx = e.clientX - start.current.x;
        const dy = e.clientY - start.current.y;
        start.current = null;
        if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy)) return;
        // Swiping towards the reading direction's start reveals the next image.
        const next = isRtl() ? dx > 0 : dx < 0;
        go(next ? 1 : -1);
      }}
    >
      <div className="flex items-center justify-between p-3 text-sm">
        <span aria-live="polite">{labels.position}</span>
        <button ref={closeRef} type="button" onClick={onClose} aria-label={labels.close} className="grid size-11 place-items-center rounded-full hover:bg-white/10">
          <X aria-hidden className="size-6" />
        </button>
      </div>
      <figure className="relative flex min-h-0 flex-1 flex-col items-center justify-center px-2 pb-4 sm:px-16">
        {/* eslint-disable-next-line @next/next/no-img-element -- full-size view of an already-compressed image */}
        <img src={image.src} alt={image.alt} className="max-h-full max-w-full select-none object-contain" draggable={false} />
        {image.caption && <figcaption className="mt-3 max-w-2xl text-center text-sm opacity-85">{image.caption}</figcaption>}
      </figure>
      {total > 1 && (
        <>
          <button type="button" onClick={() => go(-1)} aria-label={labels.previous} className="absolute start-2 top-1/2 grid size-12 -translate-y-1/2 place-items-center rounded-full bg-white/10 hover:bg-white/20">
            <ChevronLeft aria-hidden className="size-7 rtl:rotate-180" />
          </button>
          <button type="button" onClick={() => go(1)} aria-label={labels.next} className="absolute end-2 top-1/2 grid size-12 -translate-y-1/2 place-items-center rounded-full bg-white/10 hover:bg-white/20">
            <ChevronRight aria-hidden className="size-7 rtl:rotate-180" />
          </button>
        </>
      )}
    </div>
  );
}
