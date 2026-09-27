"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAdmin } from "@/components/admin/admin-context";
import { Card, Field, Input, PageHead } from "@/components/admin/ui";
import { setPassword } from "@/lib/admin/session";

export default function AccountPage() {
  const t = useTranslations("admin");
  const { staff } = useAdmin();
  const [password, setPw] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const res = await setPassword(password);
    setBusy(false);
    if (!res.ok) return toast.error(t(`errors.${res.error}`));
    setPw("");
    toast.success(t("account.password_saved"));
  };

  return (
    <>
      <PageHead title={t("account.title")} />
      <Card className="max-w-lg space-y-2">
        <p className="font-medium" dir="ltr">{staff.email}</p>
        <p className="text-sm opacity-70">{t(`role.${staff.role}`)}</p>
      </Card>
      <Card className="mt-4 max-w-lg">
        <form onSubmit={submit} className="space-y-4">
          <h2 className="font-bold">{t("account.password_title")}</h2>
          <p className="text-sm opacity-75">{t("account.password_hint")}</p>
          <Field label={t("account.new_password")} htmlFor="new-password">
            <Input id="new-password" type="password" dir="ltr" autoComplete="new-password" minLength={10} required value={password} onChange={(e) => setPw(e.target.value)} />
          </Field>
          <Button type="submit" disabled={busy}>{busy ? t("common.saving") : t("common.save")}</Button>
        </form>
      </Card>
    </>
  );
}
