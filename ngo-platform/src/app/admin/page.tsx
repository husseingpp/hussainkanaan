"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FilePlus2, ImagePlus, LayoutGrid } from "lucide-react";
import { useTranslations } from "next-intl";
import { buttonVariants } from "@/components/ui/button";
import { useAdmin } from "@/components/admin/admin-context";
import { Card, PageHead } from "@/components/admin/ui";
import { canEditContent } from "@/lib/admin/session";
import { dashboardStats, formatBytes, STORAGE_QUOTA_BYTES } from "@/lib/admin/stats";

export default function Dashboard() {
  const t = useTranslations("admin");
  const { staff } = useAdmin();
  const [stats, setStats] = useState<Awaited<ReturnType<typeof dashboardStats>> | null>(null);
  useEffect(() => void dashboardStats().then(setStats), []);

  if (!canEditContent(staff)) {
    return (
      <>
        <PageHead title={t("dashboard.welcome", { name: staff.name || staff.email })} />
        <Card>{t("dashboard.case_worker_note")}</Card>
      </>
    );
  }

  const pct = stats ? Math.min(100, (stats.bytes / STORAGE_QUOTA_BYTES) * 100) : 0;
  const tiles = [
    { label: t("dashboard.published"), value: stats?.published },
    { label: t("dashboard.drafts"), value: stats?.drafts },
    { label: t("dashboard.photos"), value: stats?.photos },
  ];

  return (
    <>
      <PageHead title={t("dashboard.welcome", { name: staff.name || staff.email })} />
      <div className="grid gap-4 sm:grid-cols-3">
        {tiles.map((tile) => (
          <Card key={tile.label}>
            <p className="text-sm opacity-70">{tile.label}</p>
            <p className="mt-1 text-3xl font-bold text-primary" dir="ltr">{tile.value ?? "…"}</p>
          </Card>
        ))}
      </div>
      <Card className="mt-4">
        <p className="text-sm opacity-70">{t("dashboard.storage")}</p>
        <p className="mt-1 font-medium" dir="ltr">{stats ? `${formatBytes(stats.bytes)} / 1 GB` : "…"}</p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-foreground/10" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
        </div>
      </Card>
      <h2 className="mb-3 mt-8 font-bold">{t("dashboard.quick")}</h2>
      <div className="flex flex-wrap gap-3">
        <Link href="/admin/posts/edit" className={buttonVariants()}><FilePlus2 aria-hidden /> {t("posts.new")}</Link>
        <Link href="/admin/media" className={buttonVariants({ variant: "outline" })}><ImagePlus aria-hidden /> {t("media.upload")}</Link>
        <Link href="/admin/sectors" className={buttonVariants({ variant: "outline" })}><LayoutGrid aria-hidden /> {t("nav.sectors")}</Link>
      </div>
    </>
  );
}
