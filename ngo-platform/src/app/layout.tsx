import type { ReactNode } from "react";
import "./globals.css";

// <html> is rendered by app/[locale]/layout.tsx so `lang` and `dir` come from the locale row.
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
