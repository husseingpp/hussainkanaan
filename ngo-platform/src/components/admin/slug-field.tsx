"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { slugify } from "@/lib/slug";
import { Field, Input } from "./ui";

/** "رابط الصفحة": follows the title until the user edits it by hand. */
export function SlugField({ value, source, onChange, locked }: { value: string; source: string; onChange: (v: string) => void; locked: boolean }) {
  const t = useTranslations("admin.fields");
  const [manual, setManual] = useState(locked);

  useEffect(() => {
    if (!manual) onChange(slugify(source));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only follow the source text
  }, [source, manual]);

  return (
    <Field label={t("slug")} hint={t("slug_hint")} htmlFor="slug">
      <Input
        id="slug"
        dir="ltr"
        value={value}
        onChange={(e) => {
          setManual(true);
          onChange(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"));
        }}
      />
    </Field>
  );
}
