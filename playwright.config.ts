import { defineConfig } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';
import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config();

const testDir = defineBddConfig({
  paths: ['features/**/*.feature'],
  require: ['steps/**/*.ts'],
});

const browser = (process.env.BROWSER ?? 'chromium').toLowerCase();
if (browser !== 'all' && !['chromium', 'firefox', 'webkit'].includes(browser)) {
  throw new Error(`Unsupported BROWSER "${browser}". Use chromium, firefox, webkit or all.`);
}

/**
 * Chromium runs on the locally installed Google Chrome by default (`channel: 'chrome'`).
 * Set BROWSER_CHANNEL= (empty) to use Playwright's bundled Chromium instead (e.g. in Docker),
 * or BROWSER_EXECUTABLE=/path/to/chrome to point at a specific binary.
 */
const executablePath = process.env.BROWSER_EXECUTABLE || undefined;
const channel = executablePath ? undefined : (process.env.BROWSER_CHANNEL ?? 'chrome') || undefined;

// No `devices['Desktop Chrome']` spread for Chromium on purpose: it hard-codes a
// user-agent string that would not match the real installed Chrome version.
const uiProjectMap = {
  chromium: {
    name: 'chromium',
    use: {
      browserName: 'chromium' as const,
      channel,
      viewport: { width: 1366, height: 768 },
      launchOptions: { executablePath },
    },
  },
  firefox: {
    name: 'firefox',
    use: { browserName: 'firefox' as const, viewport: { width: 1366, height: 768 } },
  },
  webkit: { name: 'webkit', use: { browserName: 'webkit' as const, viewport: { width: 1366, height: 768 } } },
};

const uiProjects = (
  browser === 'all' ? Object.values(uiProjectMap) : [uiProjectMap[browser as keyof typeof uiProjectMap]]
).map((project) => ({ ...project, grep: /@ui/ }));

export default defineConfig({
  testDir,
  // The UI scenario is one long end-to-end flow on a live site; the 30 s default is too short.
  timeout: 180_000,
  fullyParallel: true,
  workers: process.env.WORKERS ? Number(process.env.WORKERS) : undefined,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['html', { outputFolder: 'playwright-report', open: 'never' }], ['list']],
  use: {
    baseURL: process.env.BASE_URL ?? 'https://www.hepsiburada.com',
    // Hepsiburada exposes stable selectors through data-test-id (not data-testid).
    testIdAttribute: 'data-test-id',
    locale: 'tr-TR',
    timezoneId: 'Europe/Istanbul',
    // Headed by default: headless browsers are far more likely to be rejected by the site.
    // Set HEADLESS=true for CI / Docker.
    headless: process.env.HEADLESS === 'true',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    // API scenarios need no browser. They run exactly once, even with BROWSER=all,
    // so parallel projects never write the same response file concurrently.
    { name: 'api', grep: /@api/ },
    // Pure selection rules: no browser, no site.
    { name: 'rules', grep: /@rules/ },
    ...uiProjects,
  ],
  outputDir: path.join(process.cwd(), 'test-results'),
  webServer:
    process.env.START_MOCK === 'false'
      ? undefined
      : {
          command: 'npm run mock',
          url: `${process.env.API_BASE_URL ?? 'http://127.0.0.1:3001'}/viewInvoice?barcode=health`,
          reuseExistingServer: true,
          timeout: 30_000,
        },
});
