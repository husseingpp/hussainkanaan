"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { PageEditor } from "@/components/admin/page-editor";
import { Spinner } from "@/components/admin/ui";

function Editor() {
  const id = useSearchParams().get("id");
  return <PageEditor key={id ?? "new"} id={id} />;
}

export default function EditPagePage() {
  return <Suspense fallback={<Spinner />}><Editor /></Suspense>;
}
