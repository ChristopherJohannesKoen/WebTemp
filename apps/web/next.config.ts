import type { NextConfig } from 'next';

const apiOrigin = process.env.API_ORIGIN ?? 'http://localhost:4000';

const nextConfig: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  experimental: {
    authInterrupts: true,
    externalDir: true
  },
  transpilePackages: ['@packages/contracts', '@packages/shared', '@packages/ui'],
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${apiOrigin}/api/:path*`
      }
    ];
  }
};

export default nextConfig;
