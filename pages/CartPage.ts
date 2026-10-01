import { expect, Frame, Locator, Page } from '@playwright/test';
import { CartLine, extractCartLines, isSameProduct, isSameSeller } from '../support/cart';
import { annotate, showAndCapture } from '../support/observe';

const CART_URL = process.env.CART_URL ?? 'https://checkout.hepsiburada.com/sepetim';
/** One <li> per product line; the class carries a build hash, so only its stable prefix is used. */
const CART_LINE = 'li[class*="basket_items"]';

export class CartPage {
  constructor(private readonly page: Page) {}

  async assertProductAndSeller(productTitle: string, sellerName: string): Promise<void> {
    await this.open();

    const matches = (line: CartLine) =>
      isSameProduct(line.title, productTitle) && isSameSeller(line.seller, sellerName);
    let lines: CartLine[] = [];

    try {
      await expect
        .poll(
          async () => {
            lines = await this.page.locator(CART_LINE).evaluateAll(extractCartLines);
            return lines.some(matches);
          },
          { timeout: 20_000 },
        )
        .toBe(true);
    } catch (error) {
      throw new Error(
        `The cart has no line for "${productTitle}" from seller "${sellerName}". Cart lines: ${JSON.stringify(lines)}`,
        { cause: error },
      );
    }

    annotate(
      'cart',
      `Found "${productTitle}" from seller "${sellerName}" (${lines.length} line(s) in the cart)`,
    );
    await showAndCapture(this.page, 'cart-line', this.page.locator(CART_LINE).nth(lines.findIndex(matches)));
  }

  /**
   * Opens the cart. The site is not consistent about it: typing the checkout address can end on the
   * home page, and so can a first click. So every way is tried in turn and none is trusted by its URL
   * alone: the cart counts as open only when its product lines are actually visible.
   * The order starts with what a user does right after adding (the dialog's "Sepete git"), then the
   * header link, then the address, then the header link again from wherever the site left us.
   */
  private async open(): Promise<void> {
    const visited: string[] = [];
    const record = (frame: Frame) => {
      if (frame === this.page.mainFrame()) visited.push(frame.url());
    };
    this.page.on('framenavigated', record);

    const dialogButton = this.page
      .getByRole('button', { name: /^sepete git$/i })
      .or(this.page.getByRole('link', { name: /^sepete git$/i }))
      .filter({ visible: true })
      .first();
    const headerLink = this.page
      .locator('a[href*="checkout.hepsiburada.com/sepetim"]')
      .filter({ visible: true })
      .first();

    const attempts: [string, () => Promise<boolean>][] = [
      ['dialog "Sepete git"', () => this.clickIfPresent(dialogButton)],
      ['header cart link', () => this.clickIfPresent(headerLink)],
      ['direct address', () => this.goToAddress()],
      ['header cart link (again)', () => this.clickIfPresent(headerLink)],
    ];

    try {
      const outcomes: string[] = [];
      for (const [name, attempt] of attempts) {
        if (!(await attempt())) {
          outcomes.push(`${name}: not available`);
          continue;
        }
        if (await this.cartIsShown()) {
          annotate('cart-navigation', `Cart opened through: ${name}`);
          return;
        }
        outcomes.push(`${name}: did not show the cart`);
      }
      throw new Error(
        `The cart page did not open. ${outcomes.join('; ')}. Pages visited: ${visited.join(' > ')}`,
      );
    } finally {
      this.page.off('framenavigated', record);
    }
  }

  /** A dialog or sticky element can cover the link: fall back to a DOM click, which still navigates. */
  private async clickIfPresent(link: Locator): Promise<boolean> {
    if (!(await link.count())) return false;
    try {
      await link.click({ timeout: 5_000 });
    } catch {
      await link.evaluate((node) => (node as HTMLElement).click()).catch(() => undefined);
    }
    return true;
  }

  private async goToAddress(): Promise<boolean> {
    await this.page.goto(CART_URL, { waitUntil: 'domcontentloaded' });
    return true;
  }

  private async cartIsShown(): Promise<boolean> {
    return this.page
      .locator(CART_LINE)
      .first()
      .waitFor({ state: 'visible', timeout: 10_000 })
      .then(() => true)
      .catch(() => false);
  }
}
