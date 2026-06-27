import type { Metadata } from "next";
import { getBill, getAllBillIds } from "../../../lib/queries.ts";
import { BILL_TYPE_LABELS } from "../../../lib/constants.ts";
import { BillDetail } from "./BillDetail.tsx";

interface PageProps {
  params: { id: string };
}

/**
 * For the static export, pre-render one shell per known bill (capped). Returns
 * [] when Supabase is unconfigured or for the non-export build, where pages
 * resolve on demand. The shell fetches live data client-side.
 */
export async function generateStaticParams() {
  if (process.env.STATIC_EXPORT !== "true") return [];
  const ids = await getAllBillIds();
  // output:export needs at least one path for a dynamic route. When there is no
  // data yet (e.g. the first build, before ingestion), emit a single unreachable
  // shell that renders "not found"; real builds generate one page per bill.
  if (ids.length === 0) return [{ id: "_" }];
  return ids.map((id) => ({ id }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const bill = await getBill(params.id);
  if (!bill) return { title: "Bill" };
  const label = BILL_TYPE_LABELS[bill.bill_type] ?? bill.bill_type.toUpperCase();
  return {
    title: `${label} ${bill.number} (${bill.congress}th)`,
    description: bill.title ?? undefined,
  };
}

export default function BillProfilePage() {
  return <BillDetail />;
}
