"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { SectorEditor } from "@/components/admin/sector-editor";
import { Spinner } from "@/components/admin/ui";

function Editor() {
  const id = useSearchParams().get("id");
  return <SectorEditor key={id ?? "new"} id={id} />;
}

export default function EditSectorPage() {
  return <Suspense fallback={<Spinner />}><Editor /></Suspense>;
}
