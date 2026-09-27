"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, Save, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { loadSector, remove, saveSector, sectorSlugTaken } from "@/lib/admin/taxonomy";
import { slugify, uniqueSlug } from "@/lib/slug";
import { useAdmin } from "./admin-context";
import { CoverPicker } from "./cover-picker";
import { IconPicker } from "./icon-choices";
import { hasText, LocaleTabs, setLocale } from "./locale-tabs";
import { SlugField } from "./slug-field";
import { Card, Field, Input, PageHead, Spinner, Textarea, Toggle } from "./ui";
import { useUnsavedGuard } from "./use-unsaved";

type Form = { id?: string; slug: string; name: Record<string, string>; description: Record<string, string>; icon: string | null; color: string | null; cover_image: string | null; is_active: boolean };
const BLANK: Form = { slug: "", name: {}, description: {}, icon: null, color: null, cover_image: null, is_active: true };

export function SectorEditor({ id }: { id: string | null }) {
  const t = useTranslations("admin");
  const router = useRouter();
  const { defaultLocale } = useAdmin();
  const [form, setForm] = useState<Form | null>(id ? null : BLANK);
  const [saved, setSaved] = useState(JSON.stringify(form));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    loadSector(id).then((r) => {
      if (!r.ok) return toast.error(t(`errors.${r.error}`));
      const s = r.data;
      const next: Form = { id: s.id, slug: s.slug, name: s.name as Record<string, string>, description: s.description as Record<string, string>, icon: s.icon, color: s.color, cover_image: s.cover_image, is_active: s.is_active };
      setForm(next);
      setSaved(JSON.stringify(next));
    });
  }, [id, t]);

  const dirty = useMemo(() => form !== null && JSON.stringify(form) !== saved, [form, saved]);
  useUnsavedGuard(dirty, t("common.unsaved"));
  if (!form) return <Spinner label={t("common.loading")} />;
  const patch = (p: Partial<Form>) => setForm((f) => (f ? { ...f, ...p } : f));
  const source = form.name[defaultLocale] || Object.values(form.name).find(Boolean) || "";

  const save = async () => {
    setBusy(true);
    const slug = form.id && form.slug ? form.slug : await uniqueSlug(form.slug || slugify(source), (s) => sectorSlugTaken(s, form.id));
    const res = await saveSector({ ...form, slug });
    setBusy(false);
    if (!res.ok) return toast.error(t(`errors.${res.error}`));
    const next = { ...form, id: res.data.id, slug };
    setForm(next);
    setSaved(JSON.stringify(next));
    toast.success(t("common.saved"));
    if (!form.id) router.replace(`/admin/sectors/edit?id=${res.data.id}`);
  };

  const del = async () => {
    if (!form.id || !window.confirm(t("common.confirm_delete"))) return;
    const res = await remove("sectors", form.id);
    if (!res.ok) return toast.error(t(`errors.${res.error}`));
    setSaved(JSON.stringify(form));
    router.push("/admin/sectors");
  };

  return (
    <>
      <PageHead
        title={form.id ? t("sectors.edit") : t("sectors.new")}
        back={{ href: "/admin/sectors", label: t("common.back") }}
        actions={
          <>
            {form.id && <Link href={`/${defaultLocale}/sectors/${form.slug}`} target="_blank" prefetch={false} className={buttonVariants({ variant: "ghost" })}><ExternalLink aria-hidden /> {t("common.view_on_site")}</Link>}
            {form.id && <Button variant="ghost" onClick={del} className="text-red-700"><Trash2 aria-hidden /> {t("common.delete")}</Button>}
            <Button onClick={save} disabled={busy}><Save aria-hidden /> {busy ? t("common.saving") : t("common.save")}</Button>
          </>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          <Card>
            <LocaleTabs filled={(c) => hasText(form.name, c)}>
              {({ code, dir }) => (
                <>
                  <Field label={t("fields.name")} htmlFor={`name-${code}`}>
                    <Input id={`name-${code}`} dir={dir} value={form.name[code] ?? ""} onChange={(e) => patch({ name: setLocale(form.name, code, e.target.value) })} />
                  </Field>
                  <Field label={t("fields.description")} htmlFor={`desc-${code}`}>
                    <Textarea id={`desc-${code}`} dir={dir} value={form.description[code] ?? ""} onChange={(e) => patch({ description: setLocale(form.description, code, e.target.value) })} />
                  </Field>
                </>
              )}
            </LocaleTabs>
          </Card>
          <Card><IconPicker label={t("fields.icon")} value={form.icon} onChange={(icon) => patch({ icon })} /></Card>
        </div>
        <div className="space-y-4">
          <Card className="space-y-4">
            <Toggle checked={form.is_active} onChange={(is_active) => patch({ is_active })} label={form.is_active ? t("common.active") : t("common.inactive")} />
            <Field label={t("fields.color")} htmlFor="color">
              <input id="color" type="color" value={form.color ?? "#1F6F4A"} onChange={(e) => patch({ color: e.target.value.toUpperCase() })} className="h-10 w-20 rounded-theme border border-foreground/20" />
            </Field>
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
