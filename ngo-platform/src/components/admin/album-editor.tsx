"use client";

import { Star, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import type { Media } from "@/lib/admin/media";
import { cn } from "@/lib/utils";
import { useAdmin } from "./admin-context";
import { SortableList } from "./sortable-list";
import { UploadButton } from "./upload-button";
import { inputClass } from "./ui";

export type AlbumItem = { id: string; media: Media; caption: Record<string, string> };

type Props = {
  items: AlbumItem[];
  onChange: (items: AlbumItem[]) => void;
  coverId: string | null;
  onCover: (media: Media) => void;
};

/** The album: multi-upload (compressed), drag to reorder, a caption per locale, pick the cover. */
export function AlbumEditor({ items, onChange, coverId, onCover }: Props) {
  const t = useTranslations("admin");
  const { locales } = useAdmin();

  const add = (media: Media[]) => {
    const fresh = media.filter((m) => !items.some((i) => i.id === m.id)).map((m) => ({ id: m.id, media: m, caption: {} }));
    const next = [...items, ...fresh];
    onChange(next);
    if (!coverId && next[0]) onCover(next[0].media);
  };

  return (
    <div className="space-y-4">
      <UploadButton onUploaded={add} />
      {items.length > 0 && (
        <>
          <p className="text-sm opacity-70">{t("images.count", { count: items.length })} · {t("common.drag_hint")}</p>
          <SortableList
            items={items}
            onReorder={onChange}
            layout="grid"
            handleLabel={t("common.drag_handle")}
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
            render={(item, handle) => (
              <div className={cn("overflow-hidden rounded-theme border bg-white", item.id === coverId ? "border-primary ring-2 ring-primary/30" : "border-foreground/15")}>
                <div className="relative aspect-[4/3] bg-foreground/5">
                  {/* eslint-disable-next-line @next/next/no-img-element -- admin thumbnail of an uploaded image */}
                  <img src={item.media.url} alt="" className="size-full object-cover" loading="lazy" />
                  {item.id === coverId && (
                    <span className="absolute start-2 top-2 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">{t("images.is_cover")}</span>
                  )}
                </div>
                <div className="space-y-2 p-2">
                  <div className="flex items-center gap-1">
                    {handle}
                    <button type="button" onClick={() => onCover(item.media)} disabled={item.id === coverId} className="grid size-9 place-items-center rounded-theme hover:bg-foreground/5 disabled:opacity-40" aria-label={t("images.set_cover")} title={t("images.set_cover")}>
                      <Star aria-hidden className="size-4" />
                    </button>
                    <button type="button" onClick={() => onChange(items.filter((i) => i.id !== item.id))} className="ms-auto grid size-9 place-items-center rounded-theme text-red-700 hover:bg-red-50" aria-label={t("images.remove")} title={t("images.remove")}>
                      <Trash2 aria-hidden className="size-4" />
                    </button>
                  </div>
                  {locales.map((l) => (
                    <input
                      key={l.code}
                      lang={l.code}
                      dir={l.dir}
                      aria-label={`${t("fields.caption")} (${l.name})`}
                      placeholder={`${t("fields.caption")} · ${l.name}`}
                      value={item.caption[l.code] ?? ""}
                      onChange={(e) => onChange(items.map((i) => (i.id === item.id ? { ...i, caption: { ...i.caption, [l.code]: e.target.value } } : i)))}
                      className={cn(inputClass, "py-1.5 text-sm")}
                    />
                  ))}
                </div>
              </div>
            )}
          />
        </>
      )}
    </div>
  );
}
