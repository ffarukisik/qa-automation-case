import { Locator, Page, test } from '@playwright/test';

/**
 * Helpers that make a live run easy to follow: phase timings in the console, highlighted
 * elements on the page, and annotations / screenshots in the HTML report.
 */

/** Pause after highlighting an element so it can be seen while watching. 0 in headless runs. */
export const DEMO_PAUSE_MS = Number(
  process.env.DEMO_PAUSE_MS ?? (process.env.HEADLESS === 'true' ? 0 : 1500),
);

/** Runs a phase and, with TIMING=true, prints how long it took (to find slow steps). */
export async function timed<T>(label: string, action: () => Promise<T>): Promise<T> {
  const start = Date.now();
  try {
    return await action();
  } finally {
    if (process.env.TIMING === 'true')
      console.log(`[timing] ${label}: ${((Date.now() - start) / 1000).toFixed(1)}s`);
  }
}

/** Adds a visible note to the HTML report (Annotations section) and to the console. */
export function annotate(type: string, description: string): void {
  test.info().annotations.push({ type, description });
  console.log(`[${type}] ${description}`);
}

export async function attachText(name: string, text: string): Promise<void> {
  await test.info().attach(name, { body: text, contentType: 'text/plain' });
}

export async function highlight(target: Locator, color = '#e11d48'): Promise<void> {
  await target
    .evaluate((el, c) => {
      const style = (el as HTMLElement).style;
      style.outline = `4px solid ${c}`;
      style.outlineOffset = '2px';
    }, color)
    .catch(() => undefined);
}

/** Scrolls to (and highlights) an element, pauses briefly, and attaches a screenshot to the report. */
export async function showAndCapture(page: Page, name: string, target?: Locator): Promise<void> {
  if (target) {
    await target.scrollIntoViewIfNeeded().catch(() => undefined);
    await highlight(target);
  }
  if (DEMO_PAUSE_MS > 0) await page.waitForTimeout(DEMO_PAUSE_MS);
  const body = await page.screenshot().catch(() => undefined);
  if (body) await test.info().attach(name, { body, contentType: 'image/png' });
}
