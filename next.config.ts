// next.config.ts
import type { NextConfig } from "next";

const isGh = process.env.GH_PAGES === "true";           // ← build’te set edeceğiz
const repo = "chesscoachai.github.io";                  // ← repo adın

const nextConfig: NextConfig = {
  output: "export",                                     // next export yerine bu
  basePath: isGh ? `/${repo}` : "",
  assetPrefix: isGh ? `/${repo}/` : undefined,
  trailingSlash: true,
  images: { unoptimized: true },

  // GH Pages build’inde lint/type hatalarına takılma:
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig;
