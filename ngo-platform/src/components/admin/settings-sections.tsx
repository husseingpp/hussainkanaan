"use client";

import { useTranslations } from "next-intl";
import { SOCIAL_KEYS } from "@/lib/validation/content";
import { SocialIcon } from "@/components/public/social-icons";
import { CoverPicker } from "./cover-picker";
import { hasText, LocaleTabs, setLocale } from "./locale-tabs";
import { Card, Field, Input, Textarea, Toggle } from "./ui";

export type SettingsForm = {
  org_name: Record<string, string>;
  tagline: Record<string, string>;
  address: Record<string, string>;
  footer_text: Record<string, string>;
  donate_info: Record<string, string>;
  logo_url: string | null;
  logo_dark_url: string | null;
  favicon_url: string | null;
  phone: string;
  whatsapp: string;
  email: string;
  map_embed_url: string;
  socials: Partial<Record<(typeof SOCIAL_KEYS)[number], string>>;
  modules: { requests: boolean; donate: boolean; facebook_feed: boolean };
};

type Props = { form: SettingsForm; patch: (p: Partial<SettingsForm>) => void };

export function IdentitySection({ form, patch }: Props) {
  const t = useTranslations("admin.settings");
  return (
    <Card className="space-y-5">
      <h2 className="font-bold">{t("identity")}</h2>
      <LocaleTabs filled={(c) => hasText(form.org_name, c)}>
        {({ code, dir }) => (
          <>
            <Field label={t("org_name")} htmlFor={`org-${code}`}>
              <Input id={`org-${code}`} dir={dir} value={form.org_name[code] ?? ""} onChange={(e) => patch({ org_name: setLocale(form.org_name, code, e.target.value) })} />
            </Field>
            <Field label={t("tagline")} htmlFor={`tagline-${code}`}>
              <Input id={`tagline-${code}`} dir={dir} value={form.tagline[code] ?? ""} onChange={(e) => patch({ tagline: setLocale(form.tagline, code, e.target.value) })} />
            </Field>
            <Field label={t("footer_text")} htmlFor={`footer-${code}`}>
              <Textarea id={`footer-${code}`} dir={dir} rows={2} value={form.footer_text[code] ?? ""} onChange={(e) => patch({ footer_text: setLocale(form.footer_text, code, e.target.value) })} />
            </Field>
          </>
        )}
      </LocaleTabs>
      <div className="grid gap-6 border-t border-foreground/10 pt-5 md:grid-cols-3">
        <ImageSlot label={t("logo")} hint={t("logo_hint")} url={form.logo_url} onChange={(logo_url) => patch({ logo_url })} />
        <ImageSlot label={t("logo_dark")} hint={t("logo_dark_hint")} url={form.logo_dark_url} onChange={(logo_dark_url) => patch({ logo_dark_url })} dark />
        <ImageSlot label={t("favicon")} hint={t("favicon_hint")} url={form.favicon_url} onChange={(favicon_url) => patch({ favicon_url })} />
      </div>
    </Card>
  );
}

function ImageSlot({ label, hint, url, onChange, dark }: { label: string; hint: string; url: string | null; onChange: (v: string | null) => void; dark?: boolean }) {
  const t = useTranslations("admin.images");
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      <p className="text-xs opacity-65">{hint}</p>
      <CoverPicker
        url={url}
        onChange={(m) => onChange(m?.url ?? null)}
        emptyLabel={t("none")}
        previewClassName={dark ? "bg-foreground" : "bg-foreground/[0.03]"}
      />
    </div>
  );
}

export function ContactSection({ form, patch }: Props) {
  const t = useTranslations("admin.settings");
  return (
    <Card className="space-y-5">
      <h2 className="font-bold">{t("contact")}</h2>
      <div className="grid gap-4 md:grid-cols-3">
        <Field label={t("phone")} hint={t("phone_hint")} htmlFor="phone">
          <Input id="phone" type="tel" dir="ltr" value={form.phone} onChange={(e) => patch({ phone: e.target.value })} />
        </Field>
        <Field label={t("whatsapp")} hint={t("phone_hint")} htmlFor="whatsapp">
          <Input id="whatsapp" type="tel" dir="ltr" value={form.whatsapp} onChange={(e) => patch({ whatsapp: e.target.value })} />
        </Field>
        <Field label={t("email")} htmlFor="email">
          <Input id="email" type="email" dir="ltr" value={form.email} onChange={(e) => patch({ email: e.target.value })} />
        </Field>
      </div>
      <LocaleTabs filled={(c) => hasText(form.address, c)}>
        {({ code, dir }) => (
          <>
            <Field label={t("address")} htmlFor={`address-${code}`}>
              <Input id={`address-${code}`} dir={dir} value={form.address[code] ?? ""} onChange={(e) => patch({ address: setLocale(form.address, code, e.target.value) })} />
            </Field>
            <Field label={t("donate_info")} htmlFor={`donate-${code}`}>
              <Textarea id={`donate-${code}`} dir={dir} value={form.donate_info[code] ?? ""} onChange={(e) => patch({ donate_info: setLocale(form.donate_info, code, e.target.value) })} />
            </Field>
          </>
        )}
      </LocaleTabs>
      <Field label={t("map")} hint={t("map_hint")} htmlFor="map">
        <Input id="map" dir="ltr" value={form.map_embed_url} onChange={(e) => patch({ map_embed_url: e.target.value })} />
      </Field>
    </Card>
  );
}

export function SocialsSection({ form, patch }: Props) {
  const t = useTranslations("admin.settings");
  return (
    <Card className="space-y-4">
      <h2 className="font-bold">{t("socials")}</h2>
      <div className="grid gap-3 md:grid-cols-2">
        {SOCIAL_KEYS.map((k) => (
          <label key={k} className="flex items-center gap-2">
            <span className="grid size-10 shrink-0 place-items-center rounded-theme bg-foreground/5 text-lg"><SocialIcon name={k} /></span>
            <Input dir="ltr" aria-label={k} placeholder={`https://… (${k})`} value={form.socials[k] ?? ""} onChange={(e) => patch({ socials: { ...form.socials, [k]: e.target.value } })} />
          </label>
        ))}
      </div>
    </Card>
  );
}

export function ModulesSection({ form, patch }: Props) {
  const t = useTranslations("admin.settings");
  const set = (k: keyof SettingsForm["modules"], v: boolean) => patch({ modules: { ...form.modules, [k]: v } });
  return (
    <Card className="space-y-4">
      <h2 className="font-bold">{t("modules")}</h2>
      <p className="text-sm opacity-70">{t("modules_hint")}</p>
      <div className="flex flex-col gap-3">
        <Toggle checked={form.modules.donate} onChange={(v) => set("donate", v)} label={t("module_donate")} />
        <Toggle checked={form.modules.facebook_feed} onChange={(v) => set("facebook_feed", v)} label={t("module_facebook")} />
        <Toggle checked={form.modules.requests} onChange={(v) => set("requests", v)} label={t("module_requests")} />
      </div>
    </Card>
  );
}
