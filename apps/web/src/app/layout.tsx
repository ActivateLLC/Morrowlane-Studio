import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { PwaRegister } from '@/components/pwa';
import './globals.css';

// Absolute URLs for link previews. Vercel injects VERCEL_PROJECT_PRODUCTION_URL; the
// custom domain overrides it via NEXT_PUBLIC_SITE_URL when set.
const siteUrl =
  process.env['NEXT_PUBLIC_SITE_URL'] ??
  (process.env['VERCEL_PROJECT_PRODUCTION_URL']
    ? `https://${process.env['VERCEL_PROJECT_PRODUCTION_URL']}`
    : 'https://morrowlane.creai.dev');

const TAGLINE = 'Turn your business into a content engine.';
const SUMMARY =
  'Morrowlane learns your business, plans the campaign, writes every post, and schedules it across your channels — then tells you what to do next.';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: 'Morrowlane Studio', template: '%s · Morrowlane Studio' },
  description: TAGLINE,
  applicationName: 'Morrowlane Studio',
  manifest: '/manifest.webmanifest',
  openGraph: {
    type: 'website',
    siteName: 'Morrowlane Studio',
    title: 'Morrowlane Studio',
    description: SUMMARY,
    url: siteUrl,
    images: [{ url: '/icons/icon-512.png', width: 512, height: 512, alt: 'Morrowlane Studio' }],
  },
  twitter: {
    card: 'summary',
    title: 'Morrowlane Studio',
    description: SUMMARY,
    images: ['/icons/icon-512.png'],
  },
  // The product is a private workspace; only the sign-in surface should ever be indexed.
  robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
  appleWebApp: {
    capable: true,
    title: 'Morrowlane',
    statusBarStyle: 'black-translucent',
  },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/icons/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Keeps the iOS status bar and Android system chrome in the shell colour.
  themeColor: '#0c1512',
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
