import { config as loadDotenv } from 'dotenv';
import { resolve } from 'node:path';
import type { NextConfig } from 'next';

loadDotenv({ path: resolve(process.cwd(), '..', '..', '.env') });

const configuredApiUrl =
  process.env.API_INTERNAL_URL ??
  (process.env.NODE_ENV === 'production' ? undefined : 'http://localhost:4000');

if (!configuredApiUrl) {
  throw new Error('API_INTERNAL_URL is required when building for production.');
}

let apiOrigin: string;
try {
  const parsedApiUrl = new URL(configuredApiUrl);
  if (
    !['http:', 'https:'].includes(parsedApiUrl.protocol) ||
    parsedApiUrl.pathname !== '/' ||
    parsedApiUrl.search ||
    parsedApiUrl.hash
  ) {
    throw new Error();
  }
  apiOrigin = parsedApiUrl.origin;
} catch {
  throw new Error(
    'API_INTERNAL_URL must be an HTTP(S) origin without a path, query, or fragment.',
  );
}

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${apiOrigin}/:path*`,
      },
    ];
  },
};

export default nextConfig;
