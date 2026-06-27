import { Suspense } from "react";
import { BillsBrowser } from "./BillsBrowser.tsx";

export const metadata = {
  title: "Bills",
  description: "Bills before the US Congress, sourced from congress.gov.",
};

// Filters live in the URL query string (useSearchParams), so the browser part
// sits inside a Suspense boundary. Data is fetched client-side.
export default function BillListPage() {
  return (
    <Suspense>
      <BillsBrowser />
    </Suspense>
  );
}
