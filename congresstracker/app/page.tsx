import Link from "next/link";

// Phase 1 placeholder. The member list (Phase 4) wires this page to Supabase.
// Until then it makes ZERO factual claims about any real person — by design.
export default function Home() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <p className="text-sm font-medium uppercase tracking-wide text-gray-500">
        Non-partisan accountability
      </p>
      <h1 className="mt-2 text-4xl font-bold tracking-tight">CongressTracker</h1>
      <p className="mt-4 text-lg text-gray-700">
        Every member of the US Congress: who they are, what they{" "}
        <strong>promised</strong> before being elected, and what they{" "}
        <strong>actually did</strong> in office — votes, sponsored bills, and
        bills passed. The same member can be viewed through a{" "}
        <span className="font-medium text-wing-left">left</span>,{" "}
        <span className="font-medium text-wing-center">center</span>, and{" "}
        <span className="font-medium text-wing-right">right</span> lens.
      </p>

      <p className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
        Every factual claim about a real person is traceable to a source. No
        source, no display — enforced by the database itself. Wing
        classifications use an external, sourced ideology metric, explained on
        the{" "}
        <Link href="/methodology" className="font-medium underline">
          methodology
        </Link>{" "}
        page.
      </p>

      <p className="mt-8 text-sm text-gray-500">
        Status: scaffolding complete (Phase 1 — schema). The member directory
        and profiles arrive in a later phase.
      </p>
    </main>
  );
}
