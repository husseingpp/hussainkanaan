import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/lib/i18n/request.ts");

// STATIC_EXPORT=1 produces a static preview (GitHub Pages, served from a
// sub-path). The real deployment runs on Cloudflare Workers via OpenNext.
const isStaticExport = process.env.STATIC_EXPORT === "1";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  // This app lives in a sub-folder of the portfolio repo; pin the tracing root here.
  outputFileTracingRoot: fileURLToPath(new URL(".", import.meta.url)),
  ...(isStaticExport && {
    output: "export",
    basePath,
    trailingSlash: true,
    images: { unoptimized: true },
  }),
};

export default withNextIntl(nextConfig);

if (process.env.NODE_ENV === "development") {
  void import("@opennextjs/cloudflare").then((m) => m.initOpenNextCloudflareForDev());
}
