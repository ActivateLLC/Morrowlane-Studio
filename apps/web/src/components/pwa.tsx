'use client';

import { useEffect } from 'react';

/** Registers the service worker once the page is interactive. */
export function PwaRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // An unregistered worker just means no offline fallback; never break the app for it.
    });
  }, []);
  return null;
}
