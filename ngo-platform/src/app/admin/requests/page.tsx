"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useTr } from "@/components/admin/use-tr";
import { Badge, Empty, PageHead, Select, Spinner } from "@/components/admin/ui";
import { listForms } from "@/lib/admin/forms";
import { listRequests, STATUSES, type InboxItem, type RequestStatus } from "@/lib/admin/requests";
import { formatDate } from "@/lib/format";

const TONE: Record<RequestStatus, "neutral" | "success" | "warning"> = {
  new: "warning", in_review: "neutral", approved: "success", rejected: "neutral", fulfilled: "success", closed: "neutral",
};

function Inbox() {
  const t = useTranslations("admin");
  const trx = useTr();
  const locale = useLocale();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const status = (params.get("status") as RequestStatus | null) ?? undefined;
  const formId = params.get("form") ?? undefined;
  const [items, setItems] = useState<InboxItem[] | null>(null);
  const [forms, setForms] = useState<{ id: string; name: unknown }[]>([]);

  useEffect(() => void listForms().then((r) => r.ok && setForms(r.data)), []);
  useEffect(() => {
    setItems(null);
    listRequests({ status, formId }).then((r) => setItems(r.ok ? r.data : []));
  }, [status, formId]);

  const setFilter = (k: string, v: string) => {
    const next = new URLSearchParams(params.toString());
    if (v) next.set(k, v);
    else next.delete(k);
    router.replace(next.size ? `${pathname}?${next}` : pathname);
  };

  return (
    <>
      <PageHead title={t("requests.title")} />
      <div className="mb-5 flex flex-wrap gap-3">
        <Select aria-label={t("requests.filter_form")} value={formId ?? ""} onChange={(e) => setFilter("form", e.target.value)} className="w-auto min-w-48">
          <option value="">{t("requests.all_forms")}</option>
          {forms.map((f) => <option key={f.id} value={f.id}>{trx(f.name)}</option>)}
        </Select>
        <Select aria-label={t("common.status")} value={status ?? ""} onChange={(e) => setFilter("status", e.target.value)} className="w-auto min-w-40">
          <option value="">{t("requests.all_statuses")}</option>
          {STATUSES.map((s) => <option key={s} value={s}>{t(`requests.status.${s}`)}</option>)}
        </Select>
      </div>
      {!items ? (
        <Spinner label={t("common.loading")} />
      ) : items.length === 0 ? (
        <Empty>{t("requests.empty")}</Empty>
      ) : (
        <ul className="divide-y divide-foreground/10 overflow-hidden rounded-theme border border-foreground/10 bg-white">
          {items.map((r) => (
            <li key={r.id}>
              <Link href={`/admin/requests/view?id=${r.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 p-4 hover:bg-foreground/[0.03]">
                <span className="font-mono text-sm" dir="ltr">{r.tracking_code}</span>
                <span className="min-w-0 flex-1 truncate font-medium">{r.full_name}</span>
                <span className="text-sm opacity-70">{trx(r.form?.name)}</span>
                <Badge tone={TONE[r.status]}>{t(`requests.status.${r.status}`)}</Badge>
                {r.priority !== "normal" && <Badge tone={r.priority === "urgent" || r.priority === "high" ? "warning" : "neutral"}>{t(`requests.priority.${r.priority}`)}</Badge>}
                <span className="text-xs opacity-60">{formatDate(r.created_at, locale, "medium")}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export default function RequestsPage() {
  return <Suspense fallback={<Spinner />}><Inbox /></Suspense>;
}
