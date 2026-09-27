"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { listMedia, type Media } from "@/lib/admin/media";
import { Spinner } from "./ui";

/** Modal grid to pick an existing image from the library. */
export function MediaPicker({ onPick, onClose }: { onPick: (m: Media) => void; onClose: () => void }) {
  const t = useTranslations("admin");
  const [items, setItems] = useState<Media[] | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    dialog.current?.showModal();
    listMedia().then((r) => setItems(r.ok ? r.data : []));
  }, []);

  return (
    <dialog ref={dialog} onClose={onClose} aria-label={t("images.from_library")} className="m-auto w-[min(56rem,calc(100vw-2rem))] rounded-theme p-0 backdrop:bg-black/50">
      <div className="flex items-center justify-between border-b border-foreground/10 p-4">
        <h2 className="font-bold">{t("images.from_library")}</h2>
        <button type="button" onClick={() => dialog.current?.close()} aria-label={t("common.close")} className="grid size-9 place-items-center rounded-theme hover:bg-foreground/5">
          <X aria-hidden className="size-5" />
        </button>
      </div>
      <div className="max-h-[70vh] overflow-y-auto p-4">
        {!items ? (
          <Spinner />
        ) : items.length === 0 ? (
          <p className="py-10 text-center opacity-70">{t("media.empty")}</p>
        ) : (
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-5">
            {items.map((m) => (
              <li key={m.id}>
                <button type="button" onClick={() => { onPick(m); dialog.current?.close(); }} className="block aspect-square w-full overflow-hidden rounded-theme border border-foreground/10 focus-visible:outline-2 focus-visible:outline-primary">
                  {/* eslint-disable-next-line @next/next/no-img-element -- admin thumbnail */}
                  <img src={m.url} alt="" className="size-full object-cover" loading="lazy" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </dialog>
  );
}
