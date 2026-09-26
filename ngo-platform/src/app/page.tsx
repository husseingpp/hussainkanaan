import { redirect } from "next/navigation";
import { getDefaultLocale } from "@/lib/i18n/locales";

export default async function RootPage() {
  const { code, dir } = await getDefaultLocale();
  if (process.env.STATIC_EXPORT !== "1") redirect(`/${code}`);

  // Static hosting can't send a 307, so fall back to an HTML refresh.
  const href = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/${code}/`;
  return (
    <html lang={code} dir={dir}>
      <head>
        <meta httpEquiv="refresh" content={`0; url=${href}`} />
        <link rel="canonical" href={href} />
      </head>
      <body>
        <a href={href}>{href}</a>
      </body>
    </html>
  );
}
