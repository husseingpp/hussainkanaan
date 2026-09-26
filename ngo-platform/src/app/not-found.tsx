import Link from "next/link";
import "./globals.css";

// Rendered outside any locale, so no translations are available; keep it bilingual.
export default function NotFound() {
  return (
    <html lang="ar" dir="rtl">
      <body className="grid min-h-dvh place-items-center text-center">
        <div>
          <h1 className="text-3xl font-bold">404</h1>
          <p className="mt-2" lang="ar">الصفحة غير موجودة</p>
          <p lang="en" dir="ltr">Page not found</p>
          <Link href="/" className="mt-4 inline-block text-primary underline">
            ←
          </Link>
        </div>
      </body>
    </html>
  );
}
