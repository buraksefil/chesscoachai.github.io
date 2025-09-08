// next.config.ts
import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  output: 'export',           // GH Pages için statik export
  images: { unoptimized: true },
  trailingSlash: true,

  // Lockfile uyarısını sustur (workspace root yanlış algılanmasın)
  outputFileTracingRoot: path.join(__dirname),

  // 👉 Build sırasında ESLint'i yok say
  eslint: {
    ignoreDuringBuilds: true,
  },

  // (Opsiyonel) TS tip hataları varsa build'i durdurmasın
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;

