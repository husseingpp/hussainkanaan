"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, Save, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { JSONContent } from "@tiptap/react";
import { Button, buttonVariants } from "@/components/ui/button";
import { deletePost, loadPost, savePost, slugTaken } from "@/lib/admin/posts";
import { listSectors, type SectorRow } from "@/lib/admin/taxonomy";
import { KIND_PATH } from "@/lib/routes";
import { slugify, uniqueSlug } from "@/lib/slug";
import { useAdmin } from "./admin-context";
import { AlbumEditor, type AlbumItem } from "./album-editor";
import { hasText, LocaleTabs, setLocale } from "./locale-tabs";
import { PostSettings, type PostSettingsValue } from "./post-settings";
import { RichTextEditor } from "./rich-text-editor";
import { SlugField } from "./slug-field";
import { Card, Field, Input, PageHead, Spinner, Textarea } from "./ui";
import { useUnsavedGuard } from "./use-unsaved";

type Form = PostSettingsValue & {
  id?: string;
  slug: string;
  title: Record<string, string>;
  excerpt: Record<string, string>;
  body: Record<string, JSONContent>;
  location: Record<string, string>;
  album: AlbumItem[];
};

const blank = (kind: Form["kind"]): Form => ({
  kind, slug: "", title: {}, excerpt: {}, body: {}, location: {}, album: [],
  status: "draft", is_featured: false, event_date: null, sector_ids: [], cover: null,
});

export function PostEditor({ id, initialKind }: { id: string | null; initialKind: Form["kind"] }) {
  const t = useTranslations("admin");
  const router = useRouter();
  const { defaultLocale } = useAdmin();
  const [form, setForm] = useState<Form | null>(id ? null : blank(initialKind));
  const [saved, setSaved] = useState<string>(JSON.stringify(form));
  const [sectors, setSectors] = useState<SectorRow[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => void listSectors().then((r) => r.ok && setSectors(r.data)), []);
  useEffect(() => {
    if (!id) return;
    loadPost(id).then((r) => {
      if (!r.ok) return toast.error(t(`errors.${r.error}`));
      const p = r.data;
      const next: Form = {
        id: p.id, kind: p.kind, slug: p.slug, title: p.title, excerpt: p.excerpt,
        body: p.body as Record<string, JSONContent>, location: p.location ?? {}, status: p.status,
        is_featured: p.is_featured, event_date: p.event_date, sector_ids: p.sector_ids, cover: p.cover,
        album: p.album_media.map((m, i) => ({ id: m.id, media: m, caption: p.album[i]?.caption ?? {} })),
      };
      setForm(next);
      setSaved(JSON.stringify(next));
    });
  }, [id, t]);

  const dirty = useMemo(() => form !== null && JSON.stringify(form) !== saved, [form, saved]);
  useUnsavedGuard(dirty, t("common.unsaved"));
  if (!form) return <Spinner label={t("common.loading")} />;

  const patch = (p: Partial<Form>) => setForm((f) => (f ? { ...f, ...p } : f));
  const titleSource = form.title[defaultLocale] || Object.values(form.title).find(Boolean) || "";

  const save = async () => {
    setBusy(true);
    const slug = form.id && form.slug ? form.slug : await uniqueSlug(form.slug || slugify(titleSource), (s) => slugTaken(s, form.id));
    const res = await savePost({
      id: form.id, kind: form.kind, slug, title: form.title, excerpt: form.excerpt, body: form.body,
      cover_media_id: form.cover?.id ?? null, event_date: form.event_date,
      location: form.kind === "event" ? form.location : null, status: form.status, is_featured: form.is_featured,
      sector_ids: form.sector_ids, album: form.album.map((a) => ({ media_id: a.id, caption: a.caption })),
    });
    setBusy(false);
    if (!res.ok) return toast.error(t(`errors.${res.error}`));
    const next = { ...form, id: res.data.id, slug };
    setForm(next);
    setSaved(JSON.stringify(next));
    toast.success(t("common.saved"));
    if (!form.id) router.replace(`/admin/posts/edit?id=${res.data.id}`);
  };

  const remove = async () => {
    if (!form.id || !window.confirm(t("common.confirm_delete"))) return;
    const res = await deletePost(form.id);
    if (!res.ok) return toast.error(t(`errors.${res.error}`));
    setSaved(JSON.stringify(form));
    toast.success(t("common.deleted"));
    router.push("/admin/posts");
  };

  return (
    <>
      <PageHead
        title={form.id ? t("posts.edit") : t("posts.new")}
        back={{ href: "/admin/posts", label: t("common.back") }}
        actions={
          <>
            {form.id && form.status === "published" && (
              <Link href={`/${defaultLocale}${KIND_PATH[form.kind]}/${form.slug}`} target="_blank" prefetch={false} className={buttonVariants({ variant: "ghost" })}>
                <ExternalLink aria-hidden /> {t("common.view_on_site")}
              </Link>
            )}
            {form.id && <Button variant="ghost" onClick={remove} className="text-red-700"><Trash2 aria-hidden /> {t("common.delete")}</Button>}
            <Button onClick={save} disabled={busy}><Save aria-hidden /> {busy ? t("common.saving") : t("common.save")}</Button>
          </>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_20rem]">
        <div className="min-w-0 space-y-6">
          <Card>
            <LocaleTabs filled={(c) => hasText(form.title, c)}>
              {({ code, dir }) => (
                <>
                  <Field label={t("fields.title")} htmlFor={`title-${code}`}>
                    <Input id={`title-${code}`} dir={dir} value={form.title[code] ?? ""} onChange={(e) => patch({ title: setLocale(form.title, code, e.target.value) })} />
                  </Field>
                  <Field label={t("fields.excerpt")} htmlFor={`excerpt-${code}`}>
                    <Textarea id={`excerpt-${code}`} dir={dir} value={form.excerpt[code] ?? ""} onChange={(e) => patch({ excerpt: setLocale(form.excerpt, code, e.target.value) })} />
                  </Field>
                  {form.kind === "event" && (
                    <Field label={t("fields.location")} htmlFor={`location-${code}`}>
                      <Input id={`location-${code}`} dir={dir} value={form.location[code] ?? ""} onChange={(e) => patch({ location: setLocale(form.location, code, e.target.value) })} />
                    </Field>
                  )}
                  <Field label={t("fields.body")}>
                    <RichTextEditor key={code} dir={dir} label={t("fields.body")} value={form.body[code] ?? null} onChange={(doc) => patch({ body: { ...form.body, [code]: doc } })} />
                  </Field>
                </>
              )}
            </LocaleTabs>
          </Card>
          <Card>
            <h2 className="mb-4 font-bold">{t("fields.album")}</h2>
            <AlbumEditor items={form.album} onChange={(album) => patch({ album })} coverId={form.cover?.id ?? null} onCover={(cover) => patch({ cover })} />
          </Card>
        </div>
        <PostSettings
          value={form}
          sectors={sectors}
          onChange={patch}
          slugField={<SlugField value={form.slug} source={titleSource} locked={Boolean(form.id)} onChange={(slug) => patch({ slug })} />}
        />
      </div>
    </>
  );
}
