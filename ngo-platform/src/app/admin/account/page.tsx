"use client";

import { useTranslations } from "next-intl";
import { useAdmin } from "@/components/admin/admin-context";
import { PasswordForm } from "@/components/admin/password-form";
import { Card, PageHead } from "@/components/admin/ui";

export default function AccountPage() {
  const t = useTranslations("admin");
  const { staff } = useAdmin();

  return (
    <>
      <PageHead title={t("account.title")} />
      <Card className="max-w-lg space-y-2">
        <p className="font-medium" dir="ltr">{staff.email}</p>
        <p className="text-sm opacity-70">{t(`role.${staff.role}`)}</p>
      </Card>
      <Card className="mt-4 max-w-lg space-y-4">
        <h2 className="font-bold">{t("account.password_title")}</h2>
        <p className="text-sm opacity-75">{t("account.password_hint")}</p>
        <PasswordForm />
      </Card>
    </>
  );
}
