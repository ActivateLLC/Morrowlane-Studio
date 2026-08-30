import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { PwaRegister } from '@/components/pwa';
import './globals.css';

export const metadata: Metadata = {
  title: 'Morrowlane Studio',
  description: 'Turn your business into a content engine.',
  applicationName: 'Morrowlane Studio',
  manifest: '/manifest.webmanifest',
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
