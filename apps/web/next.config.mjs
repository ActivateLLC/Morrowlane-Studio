/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
