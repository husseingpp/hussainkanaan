"use client";

import { useCallback, useEffect, useState } from "react";
import { MessageSquarePlus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { addNote, listAssignable, loadRequest, PRIORITIES, STATUSES, updateRequest, type RequestDetail, type StaffOption } from "@/lib/admin/requests";
import { formatDate } from "@/lib/format";
import { useAdmin } from "./admin-context";
import { Card, Field, PageHead, Select, Spinner, Textarea } from "./ui";
import { useTr } from "./use-tr";

/** One response: answers, workflow controls and the append-only history. */
export function RequestView({ id }: { id: string }) {
  const t = useTranslations("admin.requests");
  const tc = useTranslations("admin");
  const trx = useTr();
  const locale = useLocale();
  const { staff } = useAdmin();
  const [req, setReq] = useState<RequestDetail | null>(null);
  const [assignable, setAssignable] = useState<StaffOption[]>([]);
  const [publicNote, setPublicNote] = useState("");
  const [note, setNote] = useState("");

  const reload = useCallback(async () => {
    const r = await loadRequest(id);
    if (!r.ok) return toast.error(tc(`errors.${r.error}`));
    setReq(r.data);
    setPublicNote(r.data.public_note ?? "");
  }, [id, tc]);

  useEffect(() => {
    reload();
    listAssignable().then(setAssignable);
  }, [reload]);
  if (!req) return <Spinner label={tc("common.loading")} />;

  const change = async (patch: Parameters<typeof updateRequest>[1]) => {
    const res = await updateRequest(req.id, patch);
    if (!res.ok) return toast.error(tc(`errors.${res.error}`));
    toast.success(tc("common.saved"));
    reload();
  };
  const staffName = (uid: string | null) => (uid ? assignable.find((s) => s.user_id === uid)?.full_name || t("staff") : t("applicant"));
  const answer = (key: string) => {
    const field = req.form?.fields.find((f) => f.key === key);
    const v = (req.answers as Record<string, unknown>)[key];
    const label = (val: unknown) => trx(field?.options?.find((o) => o.value === val)?.label) || String(val);
    return Array.isArray(v) ? v.map(label).join("، ") : field?.options ? label(v) : String(v ?? "");
  };

  return (
    <>
      <PageHead title={`${t("request")} ${req.tracking_code}`} back={{ href: "/admin/requests", label: tc("common.back") }} />
      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          <Card>
            <p className="text-sm opacity-70">{trx(req.form?.name)} · {formatDate(req.created_at, locale)}</p>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              <div><dt className="text-sm opacity-65">{t("full_name")}</dt><dd className="font-medium">{req.full_name}</dd></div>
              <div><dt className="text-sm opacity-65">{t("phone")}</dt><dd className="font-medium" dir="ltr"><a href={`tel:${req.phone}`} className="hover:underline">{req.phone}</a></dd></div>
              {(req.form?.fields ?? []).map((f) => (
                <div key={f.key} className={f.type === "textarea" ? "sm:col-span-2" : undefined}>
                  <dt className="text-sm opacity-65">{trx(f.label)}</dt>
                  <dd className="whitespace-pre-wrap font-medium">{answer(f.key) || "—"}</dd>
                </div>
              ))}
            </dl>
          </Card>
          <Card>
            <h2 className="mb-4 font-bold">{t("history")}</h2>
            <ol className="space-y-3 border-s-2 border-foreground/10 ps-4">
              {req.events.map((e) => (
                <li key={e.id} className="text-sm">
                  <p className="font-medium">{t(`events.${e.event_type}`, { from: e.from_status ? t(`status.${e.from_status}`) : "", to: e.to_status ? t(`status.${e.to_status}`) : "" })}</p>
                  {e.event_type === "note" && <p className="mt-1 whitespace-pre-wrap rounded-theme bg-foreground/5 p-2">{(e.data as { text?: string }).text}</p>}
                  {e.event_type === "public_note_changed" && <p className="mt-1 opacity-80">{(e.data as { to?: string }).to}</p>}
                  <p className="text-xs opacity-60">{staffName(e.actor_id)} · {formatDate(e.created_at, locale, "medium")}</p>
                </li>
              ))}
            </ol>
            <div className="mt-5 space-y-2">
              <Textarea aria-label={t("add_note")} placeholder={t("note_placeholder")} value={note} onChange={(e) => setNote(e.target.value)} />
              <Button variant="outline" onClick={async () => { const r = await addNote(req.id, staff.id, note); if (!r.ok) return toast.error(tc(`errors.${r.error}`)); setNote(""); reload(); }}>
                <MessageSquarePlus aria-hidden /> {t("add_note")}
              </Button>
            </div>
          </Card>
        </div>
        <Card className="h-fit space-y-4">
          <Field label={tc("common.status")} htmlFor="status">
            <Select id="status" value={req.status} onChange={(e) => change({ status: e.target.value as RequestDetail["status"] })}>
              {STATUSES.map((s) => <option key={s} value={s}>{t(`status.${s}`)}</option>)}
            </Select>
          </Field>
          <Field label={t("priority_label")} htmlFor="priority">
            <Select id="priority" value={req.priority} onChange={(e) => change({ priority: e.target.value as RequestDetail["priority"] })}>
              {PRIORITIES.map((p) => <option key={p} value={p}>{t(`priority.${p}`)}</option>)}
            </Select>
          </Field>
          <Field label={t("assigned")} htmlFor="assigned">
            <Select id="assigned" value={req.assigned_to ?? ""} onChange={(e) => change({ assigned_to: e.target.value || null })}>
              <option value="">{t("unassigned")}</option>
              {assignable.map((s) => <option key={s.user_id} value={s.user_id}>{s.full_name || s.user_id.slice(0, 8)}</option>)}
            </Select>
          </Field>
          <Field label={t("public_note")} hint={t("public_note_hint")} htmlFor="public_note">
            <Textarea id="public_note" value={publicNote} onChange={(e) => setPublicNote(e.target.value)} />
          </Field>
          <Button onClick={() => change({ public_note: publicNote.trim() || null })} disabled={(req.public_note ?? "") === publicNote}>{tc("common.save")}</Button>
        </Card>
      </div>
    </>
  );
}
