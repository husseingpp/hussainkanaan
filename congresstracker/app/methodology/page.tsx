import Link from "next/link";

export const metadata = {
  title: "Methodology — CongressTracker",
};

// Describes HOW the site works. Contains no factual claims about individuals,
// so it is safe to author directly (unlike promises/votes, which are sourced).
export default function Methodology() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <Link href="/" className="text-sm text-gray-500 underline">
        ← CongressTracker
      </Link>
      <h1 className="mt-4 text-3xl font-bold tracking-tight">Methodology</h1>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">Sourcing</h2>
        <p className="text-gray-700">
          Every factual claim about a real person — every promise and every
          recorded vote — carries a source URL. If a claim has no source, it is
          not displayed. This is enforced at the database layer, not just in the
          UI.
        </p>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">Where the data comes from</h2>
        <ul className="list-disc space-y-1 pl-6 text-gray-700">
          <li>
            <strong>Members &amp; bills:</strong>{" "}
            <a
              className="underline"
              href="https://api.congress.gov"
              target="_blank"
              rel="noreferrer"
            >
              api.congress.gov
            </a>
            .
          </li>
          <li>
            <strong>Roll-call votes:</strong> parsed from official House Clerk
            and Senate roll-call XML, because Congress.gov does not expose clean
            member-level vote positions.
          </li>
          <li>
            <strong>Promises:</strong> seeded and human-reviewed, each linked to
            where the promise was made. A status of <em>kept</em>,{" "}
            <em>broken</em>, or <em>partial</em> is a reviewer judgement backed
            by a cited source — never auto-generated. The default is{" "}
            <em>unverified</em>.
          </li>
        </ul>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">Left / center / right</h2>
        <p className="text-gray-700">
          Wing classification is descriptive, not pejorative. It is derived from
          an external, published ideology metric (e.g. DW-NOMINATE), not a score
          we invent. Each member&apos;s classification links back to the metric
          it came from.
        </p>
      </section>
    </main>
  );
}
