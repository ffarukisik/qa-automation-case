import { Locator } from '@playwright/test';

/**
 * True if the element becomes visible within the timeout.
 * `locator.isVisible()` never waits (its timeout option is ignored), so use this instead
 * whenever an element may still be rendering.
 */
export async function appears(target: Locator, timeout: number): Promise<boolean> {
  return target
    .waitFor({ state: 'visible', timeout })
    .then(() => true)
    .catch(() => false);
}

/** Types like a user: focus, clear, then key by key. */
export async function typeLikeUser(input: Locator, value: string, delay = 40): Promise<void> {
  await input.click();
  await input.fill('');
  await input.pressSequentially(value, { delay });
}
