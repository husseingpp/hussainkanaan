"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { PostEditor } from "@/components/admin/post-editor";
import { Spinner } from "@/components/admin/ui";

// ?id=… edits a post; no id creates one (query params keep this route static-hostable).
function Editor() {
  const params = useSearchParams();
  const kind = params.get("kind");
  return (
    <PostEditor
      key={params.get("id") ?? "new"}
      id={params.get("id")}
      initialKind={kind === "event" || kind === "news" ? kind : "activity"}
    />
  );
}

export default function EditPostPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <Editor />
    </Suspense>
  );
}
