"use client";

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useAdmin } from "@/components/admin/admin-context";
import { Card, Empty, Input, PageHead, Spinner, inputClass } from "@/components/admin/ui";
import { UploadButton } from "@/components/admin/upload-button";
import { deleteMedia, listMedia, updateAlt, type Media } from "@/lib/admin/media";
import { formatBytes, STORAGE_QUOTA_BYTES } from "@/lib/admin/stats";

export default function MediaPage() {
  const t = useTranslations("admin");
  const { locales } = useAdmin();
  const [items, setItems] = useState<Media[] | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => void listMedia().then((r) => setItems(r.ok ? r.data : [])), []);
  const used = (items ?? []).reduce((n, m) => n + (m.size_bytes ?? 0), 0);
  const shown = (items ?? []).filter((m) => !q || JSON.stringify(m.alt).toLowerCase().includes(q.toLowerCase()));

  const saveAlt = async (m: Media, code: string, value: string) => {
    const alt = { ...(m.alt as Record<string, string>), [code]: value };
    if ((m.alt as Record<string, string>)[code] === value) return;
    const res = await updateAlt(m.id, alt);
    if (!res.ok) return toast.error(t(`errors.${res.error}`));
    setItems((l) => l?.map((x) => (x.id === m.id ? { ...x, alt } : x)) ?? null);
    toast.success(t("common.saved"));
  };

  const del = async (m: Media) => {
    if (!window.confirm(t("common.confirm_delete"))) return;
    const res = await deleteMedia(m);
    if (!res.ok) return toast.error(t(`errors.${res.error}`));
    setItems((l) => l?.filter((x) => x.id !== m.id) ?? null);
    toast.success(t("common.deleted"));
  };

  return (
    <>
      <PageHead title={t("media.title")} />
      <Card className="mb-6 space-y-4">
        <p className="text-sm" dir="auto">{t("media.usage", { used: formatBytes(used), total: formatBytes(STORAGE_QUOTA_BYTES) })}</p>
        <UploadButton label={t("media.upload")} onUploaded={(m) => setItems((l) => [...m, ...(l ?? [])])} />
        <Input type="search" placeholder={t("media.search")} aria-label={t("media.search")} value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
      </Card>
      {!items ? (
        <Spinner label={t("common.loading")} />
      ) : shown.length === 0 ? (
        <Empty>{t("media.empty")}</Empty>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {shown.map((m) => (
            <li key={m.id} className="overflow-hidden rounded-theme border border-foreground/10 bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element -- admin thumbnail */}
              <img src={m.url} alt="" loading="lazy" className="aspect-[4/3] w-full bg-foreground/5 object-cover" />
              <div className="space-y-2 p-3">
                <p className="flex justify-between text-xs opacity-60" dir="ltr">
                  <span>{m.width && m.height ? `${m.width}×${m.height}` : ""}</span>
                  <span>{m.size_bytes ? formatBytes(m.size_bytes) : ""}</span>
                </p>
                {locales.map((l) => (
                  <input
                    key={l.code}
                    lang={l.code}
                    dir={l.dir}
                    aria-label={`${t("fields.alt")} (${l.name})`}
                    placeholder={`${t("fields.alt")} · ${l.name}`}
                    defaultValue={(m.alt as Record<string, string>)[l.code] ?? ""}
                    onBlur={(e) => saveAlt(m, l.code, e.target.value)}
                    className={`${inputClass} py-1.5 text-sm`}
                  />
                ))}
                <button type="button" onClick={() => del(m)} className="inline-flex items-center gap-1 text-sm text-red-700 hover:underline">
                  <Trash2 aria-hidden className="size-4" /> {t("common.delete")}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
