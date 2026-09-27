"use client";

import { useRef } from "react";
import { ImagePlus, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { buttonVariants } from "@/components/ui/button";
import type { Media } from "@/lib/admin/media";
import { useUploads } from "./use-uploads";

export function UploadButton({ multiple = true, onUploaded, label }: { multiple?: boolean; onUploaded: (m: Media[]) => void; label?: string }) {
  const t = useTranslations("admin.images");
  const ref = useRef<HTMLInputElement>(null);
  const { upload, progress, busy } = useUploads();

  return (
    <div className="flex flex-wrap items-center gap-3">
      <input
        ref={ref}
        type="file"
        accept="image/*"
        multiple={multiple}
        hidden
        onChange={async (e) => {
          const files = e.target.files;
          if (files?.length) onUploaded(await upload(files));
          e.target.value = "";
        }}
      />
      <button type="button" disabled={busy} onClick={() => ref.current?.click()} className={buttonVariants({ variant: "outline" })}>
        {busy ? <Loader2 aria-hidden className="animate-spin" /> : <ImagePlus aria-hidden />}
        {label ?? (multiple ? t("choose") : t("choose_one"))}
      </button>
      <span aria-live="polite" className="text-sm opacity-75">
        {progress ? t("uploading", progress) : t("compress_note")}
      </span>
      {progress && (
        <progress className="h-2 w-40 accent-[var(--color-primary)]" max={progress.total} value={progress.done} />
      )}
    </div>
  );
}
