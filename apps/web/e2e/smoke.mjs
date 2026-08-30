/**
 * Browser smoke suite. Boots the web app in demo mode (zero-config: memory store,
 * local composer, seeded demo workspace), signs into the demo workspace, and walks
 * every route asserting it renders without a page-level error or console error.
 *
 * Self-contained so it runs in CI and in the remote container without extra install:
 * it uses the globally-available `playwright` core library with the pre-installed
 * Chromium, and it spawns/tears down its own Next dev server on a spare port.
 *
 *   node apps/web/e2e/smoke.mjs            # spawns the server itself
 *   BASE_URL=http://localhost:3100 node apps/web/e2e/smoke.mjs   # reuse a running one
 */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const require = createRequire(import.meta.url);
// The remote container ships Playwright globally; fall back to a local resolve.
const playwrightPath = '/opt/node22/lib/node_modules/playwright/index.mjs';
const { chromium } = await import(playwrightPath).catch(() => import('playwright'));

const CHROMIUM_EXECUTABLE = process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const webDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.E2E_PORT ?? 3110);
const providedBase = process.env.BASE_URL;
const baseUrl = providedBase ?? `http://localhost:${PORT}`;

const failures = [];
const record = (route, message) => failures.push(`${route}: ${message}`);

async function waitForServer(url, timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { redirect: 'manual' });
      if (res.status < 500) return true;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

let server = null;
async function startServer() {
  if (providedBase) return; // caller manages the server
  server = spawn('npx', ['next', 'dev', '-p', String(PORT)], {
    cwd: webDir,
    env: { ...process.env },
    stdio: 'ignore',
  });
  const ok = await waitForServer(baseUrl);
  if (!ok) throw new Error(`web app did not become ready on ${baseUrl}`);
}

function stopServer() {
  if (server && !server.killed) server.kill('SIGTERM');
}

/** Visits a path and reports console errors + obvious Next error-boundary text. */
async function visit(context, path, { expectText } = {}) {
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });
  page.on('pageerror', (e) => consoleErrors.push(String(e)));
  try {
    const res = await page.goto(`${baseUrl}${path}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    if (!res || res.status() >= 400) record(path, `HTTP ${res ? res.status() : 'no response'}`);
    await page.waitForLoadState('load').catch(() => {});
    // innerText is rendered, visible text only — unlike textContent it excludes the
    // inline RSC flight payload in <script> tags, which serializes Next's not-found
    // template and would false-match the error scan below.
    const body = await page.innerText('body').catch(() => '');
    if (/Application error|This page could not be found|Internal Server Error/i.test(body)) {
      record(path, 'rendered an error page');
    }
    if (expectText && !(body ?? '').includes(expectText)) {
      record(path, `expected to find “${expectText}”`);
    }
    // Filter dev-server noise: favicon 404s, React DevTools hint, and the HMR/websocket
    // long-poll that `next dev` keeps open (ERR_CONNECTION_REFUSED / webpack-hmr).
    const real = consoleErrors.filter(
      (e) => !/favicon|Download the React DevTools|webpack-hmr|ERR_CONNECTION_REFUSED|hot-update/i.test(e),
    );
    if (real.length) record(path, `console errors: ${real.slice(0, 2).join(' | ')}`);
    return page;
  } catch (err) {
    record(path, `threw ${err instanceof Error ? err.message : String(err)}`);
    return page;
  }
}

async function run() {
  await startServer();
  const browser = await chromium.launch({ executablePath: CHROMIUM_EXECUTABLE });
  const context = await browser.newContext();

  // 1. Enter the demo workspace from sign-in.
  const signIn = await context.newPage();
  await signIn.goto(`${baseUrl}/sign-in`, { waitUntil: 'networkidle' });
  const demoButton = signIn.getByRole('button', { name: /demo workspace/i });
  if (await demoButton.count()) {
    await demoButton.first().click();
    await signIn.waitForLoadState('networkidle');
  }
  // The single-brand demo redirects `/` straight into `/brands/{id}`. The demo action
  // seeds the workspace before it redirects, but under `next dev` the first authenticated
  // render can land before the cookie/seed settle, so poll `/` a few times.
  let brandId = null;
  for (let attempt = 0; attempt < 6 && !brandId; attempt += 1) {
    await signIn.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
    await signIn.waitForLoadState('load').catch(() => {});
    brandId = signIn.url().match(/\/brands\/([^/?#]+)/)?.[1] ?? null;
    if (!brandId) {
      const href = await signIn.locator('a[href^="/brands/"]').first().getAttribute('href').catch(() => null);
      brandId = href?.match(/\/brands\/([^/?#]+)/)?.[1] ?? null;
    }
    if (!brandId) await new Promise((r) => setTimeout(r, 1500));
  }
  if (!brandId) record('/', 'could not reach a brand workspace after demo sign-in');
  await signIn.close();

  // 2. Walk the top-level and per-brand routes.
  await visit(context, '/settings');

  if (brandId) {
    const base = `/brands/${brandId}`;
    const routes = ['', '/studio', '/remix', '/campaigns', '/calendar', '/library', '/connections', '/intelligence', '/analytics', '/brain'];
    for (const r of routes) await visit(context, `${base}${r}`);

    // Detail routes: follow a real link so the id is valid.
    const lib = await visit(context, `${base}/library`);
    const itemHref = await lib.locator(`a[href^="${base}/library/"]`).first().getAttribute('href').catch(() => null);
    if (itemHref) await visit(context, itemHref);
    await lib.close();

    const camp = await visit(context, `${base}/campaigns`);
    const campHref = await camp.locator(`a[href^="${base}/campaigns/"]`).first().getAttribute('href').catch(() => null);
    if (campHref) await visit(context, campHref);
    await camp.close();
  }

  // 3. Mobile: zero horizontal overflow on the busiest screens.
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } });
  for (const r of brandId ? ['', '/calendar', '/analytics'] : []) {
    const page = await mobile.newPage();
    await page.goto(`${baseUrl}/brands/${brandId}${r}`, { waitUntil: 'networkidle' });
    const overflow = await page.evaluate(() => document.scrollingElement.scrollWidth - window.innerWidth);
    if (overflow > 1) record(`mobile ${r || '(today)'}`, `horizontal overflow of ${overflow}px`);
    await page.close();
  }
  await mobile.close();

  await context.close();
  await browser.close();
}

try {
  await run();
} catch (err) {
  record('suite', err instanceof Error ? err.message : String(err));
} finally {
  stopServer();
}

if (failures.length) {
  console.error(`\n✗ smoke suite: ${failures.length} issue(s)`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('\n✓ smoke suite: every route rendered clean');
process.exit(0);
