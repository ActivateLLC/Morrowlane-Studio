# Cross-platform

One codebase, four surfaces. The web app is the product everywhere; nothing forks.

| Surface | How | Status |
| --- | --- | --- |
| Web (desktop browsers) | Next.js app on Vercel | live |
| Installed desktop app (Mac/Windows/Linux) | PWA install from Chrome/Edge (address-bar install icon) | live |
| iPhone / Android home screen | PWA: Add to Home Screen → standalone, themed, offline fallback | live |
| App Store / Play Store | Capacitor shells in `apps/mobile` loading the deployed site | scaffolded — needs Xcode/Android Studio + store accounts |

## The PWA layer

- `public/manifest.webmanifest` — identity, standalone display, portrait, brand
  colours, regular + maskable icons, app shortcuts.
- `public/sw.js` — a deliberately conservative service worker: hashed build assets
  and icons cache-first (their names change every deploy), navigations always
  network-first so the app is never stale, and an offline fallback page
  (`public/offline.html`). Nothing dynamic — sessions, server actions, API
  responses — is ever cached.
- Root layout metadata — manifest link, apple-touch-icon, `black-translucent`
  status bar, `theme_color` matching the shell, `viewport-fit=cover` so the UI
  extends behind the iPhone notch (the tab bar already pads the safe area).

iOS installs get the full standalone treatment (Safari → Share → Add to Home
Screen); Android and desktop Chromium browsers offer install natively.

## The store layer

`apps/mobile` holds a Capacitor config in remote-server mode: the native shell
loads the deployed site, so web deploys update the store apps instantly. Native
builds require Xcode / Android Studio and store accounts, so they run on a
developer machine, not CI. Add native value (push notifications are the natural
first) before store submission.
