"use client";

import { useEffect, useMemo, useState } from "react";
import { Save } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAdmin } from "@/components/admin/admin-context";
import { ContactSection, IdentitySection, ModulesSection, SocialsSection, type SettingsForm } from "@/components/admin/settings-sections";
import { PageHead, Spinner } from "@/components/admin/ui";
import { useUnsavedGuard } from "@/components/admin/use-unsaved";
import { loadSettings, saveSettings } from "@/lib/admin/settings";
import { toE164 } from "@/lib/phone";

const map = (v: unknown) => (v && typeof v === "object" ? (v as Record<string, string>) : {});

export default function SettingsPage() {
  const t = useTranslations("admin");
  const { staff } = useAdmin();
  const isAdmin = staff.role === "admin";
  const [form, setForm] = useState<SettingsForm | null>(null);
  const [saved, setSaved] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    loadSettings().then((r) => {
      if (!r.ok) return toast.error(t(`errors.${r.error}`));
      const s = r.data;
      const m = map(s.modules) as unknown as Partial<SettingsForm["modules"]>;
      const next: SettingsForm = {
        org_name: map(s.org_name), tagline: map(s.tagline), address: map(s.address),
        footer_text: map(s.footer_text), donate_info: map(s.donate_info),
        logo_url: s.logo_url, logo_dark_url: s.logo_dark_url, favicon_url: s.favicon_url,
        phone: s.phone ?? "", whatsapp: s.whatsapp ?? "", email: s.email ?? "", map_embed_url: s.map_embed_url ?? "",
        socials: map(s.socials),
        modules: { requests: m.requests === true, donate: m.donate !== false, facebook_feed: m.facebook_feed === true },
      };
      setForm(next);
      setSaved(JSON.stringify(next));
    });
  }, [t]);

  const dirty = useMemo(() => form !== null && JSON.stringify(form) !== saved, [form, saved]);
  useUnsavedGuard(dirty, t("common.unsaved"));
  if (!form) return <Spinner label={t("common.loading")} />;
  const patch = (p: Partial<SettingsForm>) => setForm((f) => (f ? { ...f, ...p } : f));

  const save = async () => {
    const phone = form.phone.trim() ? toE164(form.phone) : null;
    const whatsapp = form.whatsapp.trim() ? toE164(form.whatsapp) : null;
    if ((form.phone.trim() && !phone) || (form.whatsapp.trim() && !whatsapp)) return toast.error(t("errors.invalid_phone"));
    const socials = Object.fromEntries(Object.entries(form.socials).filter(([, v]) => v?.trim())) as SettingsForm["socials"];
    setBusy(true);
    const res = await saveSettings(
      { ...form, phone, whatsapp, socials, email: form.email.trim() || null, map_embed_url: form.map_embed_url.trim() || null },
      isAdmin,
    );
    setBusy(false);
    if (!res.ok) return toast.error(t(`errors.${res.error}`));
    const next = { ...form, phone: phone ?? "", whatsapp: whatsapp ?? "", socials };
    setForm(next);
    setSaved(JSON.stringify(next));
    toast.success(t("common.saved"));
  };

  return (
    <>
      <PageHead
        title={t("settings.title")}
        actions={<Button onClick={save} disabled={busy}><Save aria-hidden /> {busy ? t("common.saving") : t("common.save")}</Button>}
      />
      <div className="space-y-6">
        <IdentitySection form={form} patch={patch} />
        <ContactSection form={form} patch={patch} />
        <SocialsSection form={form} patch={patch} />
        {isAdmin && <ModulesSection form={form} patch={patch} />}
      </div>
    </>
  );
}
