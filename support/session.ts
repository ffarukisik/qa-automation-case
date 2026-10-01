import { BrowserContext, Cookie } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

/** Location of the browser session saved by `npm run auth`. */
export const AUTH_STATE_PATH = path.resolve(process.env.AUTH_STATE ?? '.auth/hepsiburada.json');

interface SavedSession {
  cookies: Cookie[];
  origins: { origin: string; localStorage: { name: string; value: string }[] }[];
}

export function hasSavedSession(): boolean {
  return fs.existsSync(AUTH_STATE_PATH);
}

/**
 * Loads the saved session into a running browser context (cookies and local storage), replacing
 * whatever a failed login attempt left behind. It is applied only when the UI login was refused.
 */
export async function restoreSavedSession(context: BrowserContext): Promise<void> {
  const session = JSON.parse(fs.readFileSync(AUTH_STATE_PATH, 'utf8')) as SavedSession;

  await context.clearCookies();
  await context.addCookies(session.cookies);
  for (const { origin, localStorage } of session.origins) {
    await context.addInitScript(
      ({ origin: target, items }) => {
        if (location.origin === target)
          for (const { name, value } of items) window.localStorage.setItem(name, value);
      },
      { origin, items: localStorage },
    );
  }
}
