import Link from "next/link";
import { DW_NOMINATE_CENTER_THRESHOLD, VOTEVIEW_URL } from "../../lib/constants.ts";

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
          an external, published ideology metric — we do not invent a partisan
          score. We use{" "}
          <a
            className="underline"
            href={VOTEVIEW_URL}
            target="_blank"
            rel="noreferrer"
          >
            DW-NOMINATE
          </a>
          , the widely-cited measure of congressional voting behaviour published
          by Voteview. Its first dimension runs from roughly −1 (most liberal) to
          +1 (most conservative).
        </p>
        <p className="text-gray-700">
          We place a member into a wing purely by where that published score
          falls, using a single fixed cutoff:
        </p>
        <ul className="list-disc space-y-1 pl-6 text-gray-700">
          <li>
            <strong>Left</strong> — first-dimension score at or below −
            {DW_NOMINATE_CENTER_THRESHOLD}.
          </li>
          <li>
            <strong>Center</strong> — between −{DW_NOMINATE_CENTER_THRESHOLD} and
            +{DW_NOMINATE_CENTER_THRESHOLD}.
          </li>
          <li>
            <strong>Right</strong> — first-dimension score at or above +
            {DW_NOMINATE_CENTER_THRESHOLD}.
          </li>
        </ul>
        <p className="text-gray-700">
          The cutoff is a presentation choice; the raw score is always shown next
          to the wing on each member&apos;s profile, and every classification
          links back to the exact Voteview dataset it came from. A member with no
          published DW-NOMINATE score is shown with no wing — we never guess.
        </p>
      </section>
    </main>
  );
}
