"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { uploadImage, type Media } from "@/lib/admin/media";

/** Uploads files two at a time (compression is CPU-heavy on phones), reporting progress. */
export function useUploads() {
  const t = useTranslations("admin");
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  async function upload(files: FileList | File[]): Promise<Media[]> {
    const list = [...files];
    if (!list.length) return [];
    const results: (Media | null)[] = new Array(list.length).fill(null);
    let done = 0;
    setProgress({ done, total: list.length });
    let next = 0;
    const worker = async () => {
      while (next < list.length) {
        const i = next++;
        const res = await uploadImage(list[i]!);
        if (res.ok) results[i] = res.data;
        else toast.error(`${list[i]!.name}: ${t(`errors.${res.error}`)}`);
        setProgress({ done: ++done, total: list.length });
      }
    };
    await Promise.all([worker(), worker()]);
    setProgress(null);
    return results.filter((m): m is Media => m !== null);
  }

  return { upload, progress, busy: progress !== null };
}
