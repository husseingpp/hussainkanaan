import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "CongressTracker", template: "%s — CongressTracker" },
  description:
    "Non-partisan accountability for every member of the US Congress — what they promised, and what they actually did. Every claim is sourced.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-gray-900 focus:px-3 focus:py-2 focus:text-sm focus:text-white"
        >
          Skip to content
        </a>
        {process.env.NEXT_PUBLIC_DEMO === "true" && (
          <div className="bg-amber-100 text-amber-900 text-center text-xs sm:text-sm px-4 py-2 border-b border-amber-200">
            <strong>Demo data.</strong> Every member, bill, vote and promise here
            is fictional — placeholder records to preview the interface. No real
            person is represented.
          </div>
        )}
        <header className="bg-white border-b border-gray-200">
          <nav
            className="mx-auto max-w-6xl px-4 sm:px-6 h-14 flex items-center justify-between"
            aria-label="Main navigation"
          >
            <Link
              href="/"
              className="text-lg font-semibold tracking-tight hover:text-blue-700"
            >
              CongressTracker
            </Link>
            <div className="flex items-center gap-5">
              <Link
                href="/"
                className="text-sm text-gray-500 hover:text-gray-900"
              >
                Members
              </Link>
              <Link
                href="/wings"
                className="text-sm text-gray-500 hover:text-gray-900"
              >
                Wings
              </Link>
              <Link
                href="/bills"
                className="text-sm text-gray-500 hover:text-gray-900"
              >
                Bills
              </Link>
              <Link
                href="/compare"
                className="text-sm text-gray-500 hover:text-gray-900"
              >
                Compare
              </Link>
              <Link
                href="/methodology"
                className="text-sm text-gray-500 hover:text-gray-900"
              >
                Methodology
              </Link>
            </div>
          </nav>
        </header>

        <main id="main" className="flex-1">
          {children}
        </main>

        <footer className="border-t border-gray-200 mt-12">
          <p className="mx-auto max-w-6xl px-4 sm:px-6 py-6 text-xs text-gray-400">
            Every factual claim about a real person is traceable to a source.
            Wing classifications use an external, sourced ideology metric —
            see{" "}
            <Link href="/methodology" className="underline hover:text-gray-600">
              methodology
            </Link>
            .{" "}
            <Link href="/admin" className="underline hover:text-gray-600">
              Reviewer sign-in
            </Link>
            .
          </p>
        </footer>
      </body>
    </html>
  );
}
