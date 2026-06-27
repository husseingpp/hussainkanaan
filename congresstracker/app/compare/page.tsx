import { Suspense } from "react";
import { CompareView } from "./CompareView.tsx";

export const metadata = {
  title: "Compare members",
  description:
    "Compare two members of Congress side by side — wing, record, and promises, all source-linked.",
};

export default function ComparePage() {
  return (
    <Suspense>
      <CompareView />
    </Suspense>
  );
}
