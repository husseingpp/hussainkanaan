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
                href="/bills"
                className="text-sm text-gray-500 hover:text-gray-900"
              >
                Bills
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

        <main className="flex-1">{children}</main>

        <footer className="border-t border-gray-200 mt-12">
          <p className="mx-auto max-w-6xl px-4 sm:px-6 py-6 text-xs text-gray-400">
            Every factual claim about a real person is traceable to a source.
            Wing classifications use an external, sourced ideology metric —
            see{" "}
            <Link href="/methodology" className="underline hover:text-gray-600">
              methodology
            </Link>
            .
          </p>
        </footer>
      </body>
    </html>
  );
}
