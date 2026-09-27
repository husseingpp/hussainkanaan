"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { RequestView } from "@/components/admin/request-view";
import { Spinner } from "@/components/admin/ui";

function View() {
  const id = useSearchParams().get("id");
  return id ? <RequestView key={id} id={id} /> : null;
}

export default function RequestPage() {
  return <Suspense fallback={<Spinner />}><View /></Suspense>;
}
