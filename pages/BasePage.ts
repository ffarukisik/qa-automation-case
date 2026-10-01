import { Page } from '@playwright/test';
import { appears } from '../support/wait';

const cookieBannerHandled = new WeakSet<Page>();

export abstract class BasePage {
  protected constructor(protected readonly page: Page) {}

  /**
   * Accepts the consent banner if it shows up. The wait happens once per page, not on every call.
   */
  protected async acceptCookiesIfPresent(): Promise<void> {
    if (cookieBannerHandled.has(this.page)) return;

    const acceptButton = this.page
      .getByRole('button', { name: /kabul et/i })
      .or(this.page.getByText(/^kabul et$/i))
      .first();
    if (await appears(acceptButton, 3_000)) await acceptButton.click().catch(() => undefined);

    cookieBannerHandled.add(this.page);
  }
}
