"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { FormBuilder } from "@/components/admin/forms/form-builder";
import { Spinner } from "@/components/admin/ui";

function Editor() {
  const id = useSearchParams().get("id");
  return <FormBuilder key={id ?? "new"} id={id} />;
}

export default function EditFormPage() {
  return <Suspense fallback={<Spinner />}><Editor /></Suspense>;
}
