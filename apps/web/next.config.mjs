/** @type {import('next').NextConfig} */
const apiBase = process.env.API_URL || 'http://localhost:4000';

const isExport = process.env.NEXT_EXPORT === 'true';

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ["@business-suite/shared"],
  ...(isExport
    ? {
        output: 'export',
        trailingSlash: false,
      }
    : {
        async headers() {
          return [
            {
              source: '/:path*',
              headers: [
                {
                  key: 'X-Content-Type-Options',
                  value: 'nosniff',
                },
                {
                  key: 'X-Frame-Options',
                  value: 'SAMEORIGIN',
                },
                {
                  key: 'Referrer-Policy',
                  value: 'strict-origin-when-cross-origin',
                },
                {
                  key: 'Permissions-Policy',
                  value: 'camera=(), microphone=(), geolocation=()',
                },
              ],
            },
          ];
        },
        async rewrites() {
          return [
            {
              source: '/api/:path*',
              destination: `${apiBase}/api/:path*`,
            },
          ];
        },
      }),
};

export default nextConfig;
