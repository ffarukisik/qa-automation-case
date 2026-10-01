import 'dotenv/config';
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { AUTH_STATE_PATH } from '../support/session';

const baseUrl = process.env.BASE_URL ?? 'https://www.hepsiburada.com';
const debugPort = Number(process.env.CHROME_DEBUG_PORT ?? 9222);
const profileDir = path.resolve(process.env.CHROME_PROFILE_DIR ?? '.auth/chrome-profile');

function findChrome(): string {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;

  const candidates: string[] =
    process.platform === 'win32'
      ? [
          `${process.env.PROGRAMFILES}\\Google\\Chrome\\Application\\chrome.exe`,
          `${process.env['PROGRAMFILES(X86)']}\\Google\\Chrome\\Application\\chrome.exe`,
          `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
        ]
      : process.platform === 'darwin'
        ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']
        : [
            '/usr/bin/google-chrome',
            '/usr/bin/google-chrome-stable',
            '/usr/bin/chromium',
            '/usr/bin/chromium-browser',
          ];

  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) {
    throw new Error('Google Chrome was not found. Set CHROME_PATH to your chrome executable.');
  }
  return found;
}

async function waitForDebugEndpoint(): Promise<string> {
  const endpoint = `http://127.0.0.1:${debugPort}`;
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      const response = await fetch(`${endpoint}/json/version`);
      if (response.ok) return endpoint;
    } catch {
      // Chrome is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Chrome did not expose the debugging endpoint on port ${debugPort}.`);
}

/**
 * Opens a normal Google Chrome process (started by this script, without Playwright's
 * automation switches) with a dedicated profile, lets you log in by hand, then reads the
 * resulting cookies through the debugging port and stores them for the tests.
 *
 * The dedicated profile (.auth/chrome-profile) keeps you logged in between runs.
 * Chrome does not allow remote debugging on the default profile, hence the separate one.
 */
async function main(): Promise<void> {
  fs.mkdirSync(profileDir, { recursive: true });

  const chromeProcess = spawn(
    findChrome(),
    [
      `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${profileDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      baseUrl,
    ],
    { stdio: 'ignore' },
  );

  try {
    const endpoint = await waitForDebugEndpoint();

    console.log('\nLog in to Hepsiburada manually in the Chrome window that just opened.');
    console.log('When you are logged in, come back here and press Enter to save the session...');
    await new Promise<void>((resolve) => process.stdin.once('data', () => resolve()));

    const browser = await chromium.connectOverCDP(endpoint);
    const context = browser.contexts()[0];
    if (!context) throw new Error('No browser context found in the running Chrome.');

    fs.mkdirSync(path.dirname(AUTH_STATE_PATH), { recursive: true });
    await context.storageState({ path: AUTH_STATE_PATH });
    await browser.close();
    console.log(`Session saved to ${AUTH_STATE_PATH}`);
  } finally {
    chromeProcess.kill();
  }
}

// Exit explicitly: the stdin listener used to wait for Enter would otherwise keep the process alive.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
