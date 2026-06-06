/** @type {import('next').NextConfig} */

// When deploying to GitHub Pages the site is served from a sub-path
// (https://<user>.github.io/<repo>/), so production builds need a basePath.
// Local `npm run dev` keeps the root path for convenience.
const isProd = process.env.NODE_ENV === "production";
const repo = "hussainkanaan";

const nextConfig = {
  reactStrictMode: true,
  output: "export",
  images: { unoptimized: true },
  basePath: isProd ? `/${repo}` : "",
  assetPrefix: isProd ? `/${repo}/` : "",
  trailingSlash: true,
};

export default nextConfig;
