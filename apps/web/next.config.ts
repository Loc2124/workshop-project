import { config as loadDotenv } from 'dotenv';
import { resolve } from 'node:path';
import type { NextConfig } from 'next';

loadDotenv({ path: resolve(process.cwd(), '..', '..', '.env') });

const apiUrl = process.env.API_INTERNAL_URL ?? 'http://localhost:4000';

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
