import { Suspense } from "react";
import { MemberList } from "./MemberList.tsx";

// The member list reads URL filters with useSearchParams, which must sit inside
// a Suspense boundary for the static export. Data is fetched client-side.
export default function MemberListPage() {
  return (
    <Suspense>
      <MemberList />
    </Suspense>
  );
}
