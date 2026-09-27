"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, ExternalLink, Pencil, Plus, Save, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { FormFields, type Answers } from "@/components/forms/form-fields";
import { deleteForm, formSlugTaken, loadForm, saveForm, type FormInput } from "@/lib/admin/forms";
import { FIELD_TYPES, nextKey, type FieldType } from "@/lib/forms/fields";
import { slugify, uniqueSlug } from "@/lib/slug";
import { useAdmin } from "../admin-context";
import { hasText, LocaleTabs, setLocale } from "../locale-tabs";
import { SlugField } from "../slug-field";
import { SortableList } from "../sortable-list";
import { Card, Field, Input, PageHead, Select, Spinner, Textarea, Toggle } from "../ui";
import { useUnsavedGuard } from "../use-unsaved";
import { FieldCard } from "./field-card";

const BLANK: FormInput = { slug: "", name: {}, description: {}, is_open: true, fields: [] };

export function FormBuilder({ id }: { id: string | null }) {
  const t = useTranslations("admin");
  const router = useRouter();
  const { defaultLocale } = useAdmin();
  const [form, setForm] = useState<FormInput | null>(id ? null : BLANK);
  const [saved, setSaved] = useState(JSON.stringify(form));
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);
  const [previewValues, setPreviewValues] = useState<Answers>({});
  const [newType, setNewType] = useState<FieldType>("text");

  useEffect(() => {
    if (!id) return;
    loadForm(id).then((r) => {
      if (!r.ok) return toast.error(t(`errors.${r.error}`));
      setForm(r.data);
      setSaved(JSON.stringify(r.data));
    });
  }, [id, t]);

  const dirty = useMemo(() => form !== null && JSON.stringify(form) !== saved, [form, saved]);
  useUnsavedGuard(dirty, t("common.unsaved"));
  if (!form) return <Spinner label={t("common.loading")} />;
  const patch = (p: Partial<FormInput>) => setForm((f) => (f ? { ...f, ...p } : f));
  const source = form.name[defaultLocale] || Object.values(form.name).find(Boolean) || "";

  const addField = () =>
    patch({ fields: [...form.fields, { key: nextKey(form.fields), type: newType, required: false, label: {}, options: ["select", "radio", "checkboxes"].includes(newType) ? [{ value: "option_1", label: {} }] : undefined }] });

  const save = async () => {
    setBusy(true);
    const slug = form.id && form.slug ? form.slug : await uniqueSlug(form.slug || slugify(source), (s) => formSlugTaken(s, form.id));
    const res = await saveForm({ ...form, slug });
    setBusy(false);
    if (!res.ok) return toast.error(t(`errors.${res.error}`));
    const next = { ...form, id: res.data.id, slug };
    setForm(next);
    setSaved(JSON.stringify(next));
    toast.success(t("common.saved"));
    if (!form.id) router.replace(`/admin/forms/edit?id=${res.data.id}`);
  };

  const del = async () => {
    if (!form.id || !window.confirm(t("forms.confirm_delete"))) return;
    const res = await deleteForm(form.id);
    if (!res.ok) return toast.error(t(res.error === "in_use" ? "forms.has_responses" : `errors.${res.error}`));
    setSaved(JSON.stringify(form));
    router.push("/admin/forms");
  };

  return (
    <>
      <PageHead
        title={form.id ? t("forms.edit") : t("forms.new")}
        back={{ href: "/admin/forms", label: t("common.back") }}
        actions={
          <>
            <Button variant="ghost" onClick={() => setPreview((v) => !v)}>{preview ? <Pencil aria-hidden /> : <Eye aria-hidden />} {preview ? t("forms.back_to_edit") : t("forms.preview")}</Button>
            {form.id && form.is_open && <Link href={`/${defaultLocale}/apply/form?type=${form.slug}`} target="_blank" prefetch={false} className={buttonVariants({ variant: "ghost" })}><ExternalLink aria-hidden /> {t("common.view_on_site")}</Link>}
            {form.id && <Button variant="ghost" onClick={del} className="text-red-700"><Trash2 aria-hidden /> {t("common.delete")}</Button>}
            <Button onClick={save} disabled={busy}><Save aria-hidden /> {busy ? t("common.saving") : t("common.save")}</Button>
          </>
        }
      />
      {preview ? (
        <Card className="mx-auto max-w-2xl space-y-5">
          <h2 className="text-xl font-bold">{form.name[defaultLocale] || source}</h2>
          <FormFields fields={form.fields} values={previewValues} onChange={(k, v) => setPreviewValues((p) => ({ ...p, [k]: v }))} locale={defaultLocale} defaultLocale={defaultLocale} requiredLabel={t("forms.required")} />
        </Card>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1fr_20rem]">
          <div className="min-w-0 space-y-4">
            <Card>
              <LocaleTabs filled={(c) => hasText(form.name, c)}>
                {({ code, dir }) => (
                  <>
                    <Field label={t("forms.name")} htmlFor={`name-${code}`}>
                      <Input id={`name-${code}`} dir={dir} value={form.name[code] ?? ""} onChange={(e) => patch({ name: setLocale(form.name, code, e.target.value) })} />
                    </Field>
                    <Field label={t("forms.description")} htmlFor={`desc-${code}`}>
                      <Textarea id={`desc-${code}`} dir={dir} rows={2} value={form.description[code] ?? ""} onChange={(e) => patch({ description: setLocale(form.description, code, e.target.value) })} />
                    </Field>
                  </>
                )}
              </LocaleTabs>
            </Card>
            <p className="text-sm opacity-70">{t("forms.fixed_fields")}</p>
            <SortableList
              items={form.fields.map((f) => ({ ...f, id: f.key }))}
              onReorder={(items) => patch({ fields: items.map((it) => form.fields.find((f) => f.key === it.id)!) })}
              handleLabel={t("common.drag_handle")}
              className="space-y-3"
              render={(f, handle) => (
                <FieldCard
                  field={f}
                  handle={handle}
                  onChange={(next) => patch({ fields: form.fields.map((x) => (x.key === f.key ? next : x)) })}
                  onRemove={() => patch({ fields: form.fields.filter((x) => x.key !== f.key) })}
                />
              )}
            />
            <Card className="flex flex-wrap items-center gap-2">
              <Select aria-label={t("forms.field_type")} value={newType} onChange={(e) => setNewType(e.target.value as FieldType)} className="w-auto min-w-44">
                {FIELD_TYPES.map((k) => <option key={k} value={k}>{t(`forms.types.${k}`)}</option>)}
              </Select>
              <Button variant="outline" onClick={addField}><Plus aria-hidden /> {t("forms.add_field")}</Button>
            </Card>
          </div>
          <Card className="h-fit space-y-4">
            <Toggle checked={form.is_open} onChange={(is_open) => patch({ is_open })} label={form.is_open ? t("forms.open") : t("forms.closed")} />
            <SlugField value={form.slug} source={source} locked={Boolean(form.id)} onChange={(slug) => patch({ slug })} />
          </Card>
        </div>
      )}
    </>
  );
}
