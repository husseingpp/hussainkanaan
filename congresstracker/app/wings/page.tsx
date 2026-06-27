import { Suspense } from "react";
import { WingsBrowser } from "./WingsBrowser.tsx";

export const metadata = {
  title: "Left / Center / Right",
  description:
    "Members of Congress grouped into left, center and right by a sourced ideology metric (DW-NOMINATE).",
};

export default function WingsPage() {
  return (
    <Suspense>
      <WingsBrowser />
    </Suspense>
  );
}
