// next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'export',           // static export
  images: { unoptimized: true },
  trailingSlash: true,        // /game -> /game/index.html
};

export default nextConfig;
