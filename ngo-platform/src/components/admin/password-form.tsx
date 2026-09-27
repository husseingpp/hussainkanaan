"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setPassword, signOut } from "@/lib/admin/session";
import { AdminLanguageSwitch } from "./admin-intl";
import { Field, Input } from "./ui";

/** New password + confirmation. Used on "My account" and for the first sign-in. */
export function PasswordForm({ onSaved }: { onSaved?: () => void }) {
  const t = useTranslations("admin");
  const [password, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) return toast.error(t("errors.password_mismatch"));
    setBusy(true);
    const res = await setPassword(password);
    setBusy(false);
    if (!res.ok) return toast.error(t(`errors.${res.error}`));
    setPw("");
    setConfirm("");
    toast.success(t("account.password_saved"));
    onSaved?.();
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label={t("account.new_password")} htmlFor="new-password">
        <Input id="new-password" type="password" dir="ltr" autoComplete="new-password" minLength={10} required value={password} onChange={(e) => setPw(e.target.value)} />
      </Field>
      <Field label={t("account.confirm_password")} htmlFor="confirm-password">
        <Input id="confirm-password" type="password" dir="ltr" autoComplete="new-password" minLength={10} required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </Field>
      <Button type="submit" disabled={busy}>{busy ? t("common.saving") : t("common.save")}</Button>
    </form>
  );
}

/** Shown instead of the admin until someone signed in with a temporary password picks their own. */
export function FirstPassword({ email, onDone }: { email: string; onDone: () => void }) {
  const t = useTranslations("admin");
  return (
    <main id="main" className="grid min-h-dvh place-items-center bg-primary/5 p-4">
      <div className="w-full max-w-sm space-y-5 rounded-theme bg-white p-6 shadow-md">
        <AdminLanguageSwitch className="justify-end" />
        <div>
          <h1 className="text-xl font-bold">{t("account.first_title")}</h1>
          <p className="mt-1 text-sm opacity-75">{t("account.first_hint")}</p>
          <p className="mt-2 text-sm font-medium" dir="ltr">{email}</p>
        </div>
        <PasswordForm onSaved={onDone} />
        <button type="button" onClick={() => signOut()} className="flex items-center gap-2 text-sm text-primary underline">
          <LogOut aria-hidden className="size-4 rtl:rotate-180" /> {t("nav.sign_out")}
        </button>
      </div>
    </main>
  );
}
