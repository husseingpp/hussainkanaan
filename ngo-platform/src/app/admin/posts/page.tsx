"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ImageIcon, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { buttonVariants } from "@/components/ui/button";
import { useAdmin } from "@/components/admin/admin-context";
import { Badge, Empty, PageHead, Spinner } from "@/components/admin/ui";
import { listPosts, type PostListItem } from "@/lib/admin/posts";
import { tr } from "@/lib/i18n/tr";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const KINDS = ["activity", "event", "news"] as const;

export default function PostsPage() {
  const t = useTranslations();
  const { defaultLocale } = useAdmin();
  const [kind, setKind] = useState<(typeof KINDS)[number] | null>(null);
  const [posts, setPosts] = useState<PostListItem[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setPosts(null);
    listPosts(kind ?? undefined).then((r) => (r.ok ? setPosts(r.data) : setFailed(true)));
  }, [kind]);

  const tab = (active: boolean) => cn("rounded-full px-4 py-1.5 text-sm font-medium", active ? "bg-primary text-primary-foreground" : "bg-foreground/5 hover:bg-foreground/10");

  return (
    <>
      <PageHead
        title={t("admin.posts.title")}
        actions={<Link href="/admin/posts/edit" className={buttonVariants()}><Plus aria-hidden /> {t("admin.posts.new")}</Link>}
      />
      <div className="mb-5 flex flex-wrap gap-2">
        <button type="button" className={tab(kind === null)} onClick={() => setKind(null)}>{t("admin.posts.all")}</button>
        {KINDS.map((k) => (
          <button key={k} type="button" className={tab(kind === k)} onClick={() => setKind(k)}>{t(`kinds.${k}`)}</button>
        ))}
      </div>
      {failed ? (
        <Empty>{t("admin.common.load_error")}</Empty>
      ) : !posts ? (
        <Spinner label={t("admin.common.loading")} />
      ) : posts.length === 0 ? (
        <Empty>{t("admin.posts.empty")}</Empty>
      ) : (
        <ul className="divide-y divide-foreground/10 overflow-hidden rounded-theme border border-foreground/10 bg-white">
          {posts.map((p) => (
            <li key={p.id}>
              <Link href={`/admin/posts/edit?id=${p.id}`} className="flex items-center gap-4 p-3 hover:bg-foreground/[0.03]">
                <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-theme bg-foreground/5">
                  {/* eslint-disable-next-line @next/next/no-img-element -- admin thumbnail */}
                  {p.cover ? <img src={p.cover.url} alt="" className="size-full object-cover" /> : <ImageIcon aria-hidden className="size-6 opacity-40" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{tr(p.title, defaultLocale) || t("admin.posts.untitled")}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-2 text-xs opacity-75">
                    <Badge>{t(`kinds.${p.kind}`)}</Badge>
                    <Badge tone={p.status === "published" ? "success" : "warning"}>{t(`admin.common.${p.status}`)}</Badge>
                    <span>{t("admin.images.count", { count: p.photos[0]?.count ?? 0 })}</span>
                    <span>{formatDate(p.kind === "event" ? p.event_date : p.updated_at, defaultLocale, "medium")}</span>
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
