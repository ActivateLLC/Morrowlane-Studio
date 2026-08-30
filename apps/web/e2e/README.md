# Browser smoke suite

`smoke.mjs` boots the app in demo mode (zero-config), signs into the seeded demo
workspace, and walks every route asserting each renders without a page-level or
console error, plus a mobile no-horizontal-overflow check on the busiest screens.

```bash
pnpm --filter @morrowlane/web e2e          # spawns its own dev server on :3110
BASE_URL=http://localhost:3100 pnpm --filter @morrowlane/web e2e   # reuse a running server
```

It uses the Playwright **core** library (globally available in the remote container
at `/opt/node22/lib/node_modules/playwright/index.mjs`) with the pre-installed
Chromium — no `@playwright/test` dependency and no `playwright install`. Override the
browser binary with `PW_CHROMIUM=/path/to/chrome` if the pinned build changes.
