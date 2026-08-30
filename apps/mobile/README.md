# Morrowlane mobile (Capacitor)

Wraps the deployed web app in native iOS/Android shells for store distribution.
The web app itself is already installable everywhere as a PWA (`apps/web/public/
manifest.webmanifest` + `sw.js`); this wrapper exists for App Store / Play Store
presence and, later, native capabilities (push notifications, share sheets).

The config uses Capacitor's remote-server mode: the shell loads
https://morrowlane-studio.vercel.app, so every web deploy updates the apps
without a store release. (Store review allows this for apps whose core
experience is the web product; add native value — push via @capacitor/push-
notifications is the usual first one — before submission.)

## Building (needs Xcode / Android Studio — not possible in CI here)

```bash
cd apps/mobile
pnpm install
pnpm add:ios       # or add:android
pnpm sync
pnpm open:ios      # opens Xcode; set the signing team, then archive
```

Icons: reuse `apps/web/public/icons/icon-512.png` as the source asset in the
native projects (Xcode asset catalog / Android Studio image asset).
