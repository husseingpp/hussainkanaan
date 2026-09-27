"use client";

import { useState } from "react";
import { Images, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { buttonVariants } from "@/components/ui/button";
import type { Media } from "@/lib/admin/media";
import { MediaPicker } from "./media-picker";
import { UploadButton } from "./upload-button";

/** A single image: upload a new one or pick from the library. */
export function CoverPicker({ url, onChange }: { url: string | null; onChange: (m: Media | null) => void }) {
  const t = useTranslations("admin.images");
  const [picking, setPicking] = useState(false);

  return (
    <div className="space-y-3">
      {url ? (
        <div className="relative w-full max-w-sm overflow-hidden rounded-theme border border-foreground/15">
          {/* eslint-disable-next-line @next/next/no-img-element -- admin preview */}
          <img src={url} alt="" className="aspect-[16/10] w-full object-cover" />
          <button type="button" onClick={() => onChange(null)} aria-label={t("remove")} className="absolute end-2 top-2 grid size-9 place-items-center rounded-full bg-black/60 text-white hover:bg-black/75">
            <X aria-hidden className="size-4" />
          </button>
        </div>
      ) : (
        <p className="text-sm opacity-65">{t("no_cover")}</p>
      )}
      <div className="flex flex-wrap gap-2">
        <UploadButton multiple={false} onUploaded={(m) => m[0] && onChange(m[0])} />
        <button type="button" onClick={() => setPicking(true)} className={buttonVariants({ variant: "ghost" })}>
          <Images aria-hidden /> {t("from_library")}
        </button>
      </div>
      {picking && <MediaPicker onPick={onChange} onClose={() => setPicking(false)} />}
    </div>
  );
}
