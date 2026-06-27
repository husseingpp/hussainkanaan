import type { Metadata } from "next";
import { getMember, getAllMemberIds } from "../../../lib/queries.ts";
import { MemberProfile } from "./MemberProfile.tsx";

interface PageProps {
  params: { bioguideId: string };
}

/**
 * For the static export, pre-render one shell per known member. Returns [] when
 * Supabase is unconfigured (e.g. a build with no secrets) or for the non-export
 * build, where pages resolve on demand. The shell fetches live data client-side.
 */
export async function generateStaticParams() {
  if (process.env.STATIC_EXPORT !== "true") return [];
  const ids = await getAllMemberIds();
  // output:export needs at least one path for a dynamic route. When there is no
  // data yet (e.g. the first build, before ingestion), emit a single unreachable
  // shell that renders "not found"; real builds generate one page per member.
  if (ids.length === 0) return [{ bioguideId: "_" }];
  return ids.map((bioguideId) => ({ bioguideId }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const member = await getMember(params.bioguideId);
  if (!member) return { title: "Member" };
  return {
    title: member.full_name,
    description: `Congressional record for ${member.full_name} (${member.party ?? "?"}-${member.state ?? "?"}).`,
  };
}

export default function MemberProfilePage() {
  return <MemberProfile />;
}
