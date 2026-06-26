import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CongressTracker",
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
      <body>{children}</body>
    </html>
  );
}
