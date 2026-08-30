/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Vercel terminates TLS and serves these on every response. The CSP is deliberately
  // pragmatic: Next's hydration needs inline scripts, Tailwind needs inline styles, and
  // rendered creatives are data: URLs — so it hardens what it can (no framing, no plugin
  // objects, locked base-uri/form-action) without breaking the app.
  poweredByHeader: false,
  async headers() {
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "media-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      'upgrade-insecure-requests',
    ].join('; ');

    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(self), geolocation=(), interest-cohort=()' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
        ],
      },
    ];
  },
  // The Brand Builder accepts a logo and a few images, uploaded through a server action.
  experimental: { serverActions: { bodySizeLimit: '6mb' } },
  // Workspace packages ship TypeScript source, so Next compiles them with the app.
  transpilePackages: [
    '@morrowlane/agents',
    '@morrowlane/analytics',
    '@morrowlane/brand-engine',
    '@morrowlane/campaign-engine',
    '@morrowlane/content-engine',
    '@morrowlane/crawl-engine',
    '@morrowlane/database',
    '@morrowlane/shared',
    '@morrowlane/social',
    '@morrowlane/ui',
  ],
  eslint: { ignoreDuringBuilds: true },
  webpack: (config) => {
    // Workspace source uses ESM-style ".js" specifiers that resolve to ".ts" files.
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js'],
      '.jsx': ['.tsx', '.jsx'],
    };
    return config;
  },
};

export default nextConfig;
