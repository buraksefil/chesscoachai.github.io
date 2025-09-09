// next.config.ts
import type { NextConfig } from "next";

const isGh = process.env.GH_PAGES === "true";         // export:docs sırasında set edeceğiz
const repo = "chesscoachai.github.io";

// GH Pages için mutlak assetPrefix kullanıyoruz (preload linkleri de doğru olsun)
const prefixPath   = isGh ? `/${repo}` : "";
const assetPrefix  = isGh ? `https://buraksefil.github.io/${repo}` : undefined;

const nextConfig: NextConfig = {
  output: "export",
  basePath: prefixPath,
  assetPrefix,
  trailingSlash: true,
  images: { unoptimized: true },

  // GH Pages eksportunda tip/lint hatasına takılma:
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig;
