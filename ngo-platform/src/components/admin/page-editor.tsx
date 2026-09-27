"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, Save, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { JSONContent } from "@tiptap/react";
import { Button, buttonVariants } from "@/components/ui/button";
import { loadPage, pageSlugTaken, savePage } from "@/lib/admin/pages";
import { remove } from "@/lib/admin/taxonomy";
import { slugify, uniqueSlug } from "@/lib/slug";
import { useAdmin } from "./admin-context";
import { CoverPicker } from "./cover-picker";
import { hasText, LocaleTabs, setLocale } from "./locale-tabs";
import { RichTextEditor } from "./rich-text-editor";
import { SlugField } from "./slug-field";
import { Card, Field, Input, PageHead, Select, Spinner, Textarea, Toggle } from "./ui";
import { useUnsavedGuard } from "./use-unsaved";

type Form = { id?: string; slug: string; title: Record<string, string>; body: Record<string, JSONContent>; seo_description: Record<string, string>; cover_image: string | null; show_in_nav: boolean; status: "draft" | "published" };
const BLANK: Form = { slug: "", title: {}, body: {}, seo_description: {}, cover_image: null, show_in_nav: false, status: "draft" };

export function PageEditor({ id }: { id: string | null }) {
  const t = useTranslations("admin");
  const router = useRouter();
  const { defaultLocale } = useAdmin();
  const [form, setForm] = useState<Form | null>(id ? null : BLANK);
  const [saved, setSaved] = useState(JSON.stringify(form));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    loadPage(id).then((r) => {
      if (!r.ok) return toast.error(t(`errors.${r.error}`));
      const p = r.data;
      const next: Form = { id: p.id, slug: p.slug, title: p.title as Form["title"], body: p.body as Form["body"], seo_description: p.seo_description as Form["seo_description"], cover_image: p.cover_image, show_in_nav: p.show_in_nav, status: p.status };
      setForm(next);
      setSaved(JSON.stringify(next));
    });
  }, [id, t]);

  const dirty = useMemo(() => form !== null && JSON.stringify(form) !== saved, [form, saved]);
  useUnsavedGuard(dirty, t("common.unsaved"));
  if (!form) return <Spinner label={t("common.loading")} />;
  const patch = (p: Partial<Form>) => setForm((f) => (f ? { ...f, ...p } : f));
  const source = form.title[defaultLocale] || Object.values(form.title).find(Boolean) || "";

  const save = async () => {
    setBusy(true);
    const slug = form.id && form.slug ? form.slug : await uniqueSlug(form.slug || slugify(source), (s) => pageSlugTaken(s, form.id));
    const res = await savePage({ ...form, slug });
    setBusy(false);
    if (!res.ok) return toast.error(t(`errors.${res.error}`));
    const next = { ...form, id: res.data.id, slug };
    setForm(next);
    setSaved(JSON.stringify(next));
    toast.success(t("common.saved"));
    if (!form.id) router.replace(`/admin/pages/edit?id=${res.data.id}`);
  };

  const del = async () => {
    if (!form.id || !window.confirm(t("common.confirm_delete"))) return;
    const res = await remove("pages", form.id);
    if (!res.ok) return toast.error(t(`errors.${res.error}`));
    setSaved(JSON.stringify(form));
    router.push("/admin/pages");
  };

  return (
    <>
      <PageHead
        title={form.id ? t("pages.edit") : t("pages.new")}
        back={{ href: "/admin/pages", label: t("common.back") }}
        actions={
          <>
            {form.id && form.status === "published" && <Link href={`/${defaultLocale}/p/${form.slug}`} target="_blank" prefetch={false} className={buttonVariants({ variant: "ghost" })}><ExternalLink aria-hidden /> {t("common.view_on_site")}</Link>}
            {form.id && <Button variant="ghost" onClick={del} className="text-red-700"><Trash2 aria-hidden /> {t("common.delete")}</Button>}
            <Button onClick={save} disabled={busy}><Save aria-hidden /> {busy ? t("common.saving") : t("common.save")}</Button>
          </>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_20rem]">
        <Card>
          <LocaleTabs filled={(c) => hasText(form.title, c)}>
            {({ code, dir }) => (
              <>
                <Field label={t("fields.title")} htmlFor={`title-${code}`}>
                  <Input id={`title-${code}`} dir={dir} value={form.title[code] ?? ""} onChange={(e) => patch({ title: setLocale(form.title, code, e.target.value) })} />
                </Field>
                <Field label={t("fields.body")}>
                  <RichTextEditor key={code} dir={dir} label={t("fields.body")} value={form.body[code] ?? null} onChange={(doc) => patch({ body: { ...form.body, [code]: doc } })} />
                </Field>
                <Field label={t("fields.seo_description")} htmlFor={`seo-${code}`}>
                  <Textarea id={`seo-${code}`} dir={dir} rows={2} value={form.seo_description[code] ?? ""} onChange={(e) => patch({ seo_description: setLocale(form.seo_description, code, e.target.value) })} />
                </Field>
              </>
            )}
          </LocaleTabs>
        </Card>
        <div className="space-y-4">
          <Card className="space-y-4">
            <Field label={t("common.status")} htmlFor="status">
              <Select id="status" value={form.status} onChange={(e) => patch({ status: e.target.value as Form["status"] })}>
                <option value="draft">{t("common.draft")}</option>
                <option value="published">{t("common.published")}</option>
              </Select>
            </Field>
            <Toggle checked={form.show_in_nav} onChange={(show_in_nav) => patch({ show_in_nav })} label={t("fields.show_in_nav")} />
            <SlugField value={form.slug} source={source} locked={Boolean(form.id)} onChange={(slug) => patch({ slug })} />
          </Card>
          <Card className="space-y-3">
            <p className="text-sm font-medium">{t("fields.cover")}</p>
            <CoverPicker url={form.cover_image} onChange={(m) => patch({ cover_image: m?.url ?? null })} />
          </Card>
        </div>
      </div>
    </>
  );
}
