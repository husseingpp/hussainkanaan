"use client";

import { useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Lightbox, type LightboxImage } from "./lightbox";

/** Masonry album; each photo opens the lightbox. */
export function AlbumGallery({ images }: { images: LightboxImage[] }) {
  const t = useTranslations("lightbox");
  const [open, setOpen] = useState<number | null>(null);
  if (!images.length) return null;

  return (
    <>
      <ul className="columns-2 gap-3 sm:columns-3 [&>li]:mb-3">
        {images.map((img, i) => (
          <li key={img.src + i} className="break-inside-avoid">
            <button
              type="button"
              onClick={() => setOpen(i)}
              aria-label={t("open", { index: i + 1 })}
              className="block w-full overflow-hidden rounded-theme focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <Image
                src={img.src}
                alt={img.alt}
                width={img.width ?? 800}
                height={img.height ?? 600}
                sizes="(min-width: 640px) 33vw, 50vw"
                className="h-auto w-full transition duration-300 hover:scale-[1.03]"
              />
            </button>
          </li>
        ))}
      </ul>
      {open !== null && (
        <Lightbox
          images={images}
          index={open}
          onIndex={setOpen}
          onClose={() => setOpen(null)}
          labels={{
            label: t("label"),
            close: t("close"),
            next: t("next"),
            previous: t("previous"),
            position: t("position", { index: open + 1, total: images.length }),
          }}
        />
      )}
    </>
  );
}
