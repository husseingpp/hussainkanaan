/**
 * Two build modes, selected by the STATIC_EXPORT env var:
 *
 *  - default (Vercel / `npm run dev`): a normal Next.js server build.
 *  - STATIC_EXPORT=true (`npm run build:static`): a fully static export for
 *    GitHub Pages. All data is fetched in the browser from Supabase (the anon
 *    key is RLS-gated read-only), so the static shell stays live. The site is
 *    served from a subpath of the portfolio Pages site, hence basePath.
 */
const isStatic = process.env.STATIC_EXPORT === "true";

// Where the export is mounted on GitHub Pages:
// husseingpp.github.io/hussainkanaan/congresstracker
const basePath = "/hussainkanaan/congresstracker";

/** @type {import('next').NextConfig} */
const nextConfig = isStatic
  ? {
      reactStrictMode: true,
      output: "export",
      basePath,
      assetPrefix: basePath,
      trailingSlash: true,
      // next/image's optimizer needs a server; static export uses raw <img>.
      images: { unoptimized: true },
    }
  : {
      reactStrictMode: true,
      images: {
        remotePatterns: [
          {
            protocol: "https",
            hostname: "www.congress.gov",
            pathname: "/img/member/**",
          },
        ],
      },
    };

export default nextConfig;
