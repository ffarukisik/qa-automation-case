import { expect, Locator, Page } from '@playwright/test';
import { SellerList, Seller, SellerSelection } from './components/SellerList';
import { annotate, attachText, highlight, showAndCapture } from '../support/observe';
import { pickLowestRated } from '../support/sellers';

export type { SellerSelection } from './components/SellerList';

export class ProductPage {
  private readonly sellers: SellerList;

  constructor(private readonly page: Page) {
    this.sellers = new SellerList(page);
  }

  async getProductTitle(): Promise<string> {
    const title = this.page.locator('h1').first();
    await expect(title).toBeVisible({ timeout: 20_000 });
    return (await title.innerText()).replace(/\s+/g, ' ').trim();
  }

  /**
   * Picks the lowest-rated seller among ALL sellers of the product: the whole "Tümünü gör" list,
   * or the main seller plus the in-page "Diğer satıcılar" rows, or the main seller alone.
   */
  async selectLowestRatedSeller(): Promise<SellerSelection> {
    const sellers = await this.sellers.collect();
    const lowest = pickLowestRated(sellers);

    annotate(
      'sellers',
      `${sellers.length} seller(s) read from "${lowest.source}", lowest: ${lowest.name} (${lowest.rating ?? 'no rating'})`,
    );
    await attachText('seller-ratings', this.describe(sellers, lowest));

    for (const seller of sellers) await highlight(seller.row, '#2563eb');
    await showAndCapture(this.page, 'lowest-rated-seller', lowest.row);

    return { name: lowest.name, rating: lowest.rating, source: lowest.source };
  }

  /** The lowest rating listed on the page, read independently from the seller selection. */
  getLowestRatingListedOnPage(): Promise<number | undefined> {
    return this.sellers.lowestListedRating();
  }

  async describeListedSellers(): Promise<string> {
    const sellers = await this.sellers.collect();
    return JSON.stringify(sellers.map(({ name, rating }) => ({ name, rating })));
  }

  async addSelectedSellerToCart(selected: SellerSelection): Promise<void> {
    const seller = await this.findSeller(selected.name);

    if (seller.addToCart) {
      annotate(
        'add-to-cart',
        `${selected.name} (${selected.rating ?? 'no rating'}) via its own "Sepete ekle" button`,
      );
      await this.clickAddToCart(seller.addToCart);
      return;
    }

    // The seller is listed with "Ürüne git" only. That opens the seller's own offer page, where
    // this seller is the main seller with a regular "Sepete ekle" button.
    annotate('add-to-cart', `${selected.name} via "Ürüne git" and the main "Sepete ekle" button`);
    const offerPage = await this.openOfferPage(seller.goToProduct!, selected.name);
    const offerProduct = new ProductPage(offerPage);
    await offerProduct.clickAddToCart(offerPage.getByTestId('addToCart').filter({ visible: true }).first());
    if (offerPage !== this.page) await offerPage.close();
  }

  private async findSeller(name: string): Promise<Seller> {
    const seller = (await this.sellers.collect()).find((candidate) => candidate.name === name);
    // Never fall back to another seller: that would violate the "lowest-rated seller" requirement.
    if (!seller) throw new Error(`Could not find the selected seller on the product page: ${name}`);
    return seller;
  }

  /** "Ürüne git" may open a new tab or navigate the current one; the offer page must show this seller. */
  private async openOfferPage(goToProduct: Locator, sellerName: string): Promise<Page> {
    const urlBefore = this.page.url();
    await this.centerElement(goToProduct);

    const [popup] = await Promise.all([
      this.page
        .context()
        .waitForEvent('page', { timeout: 5_000 })
        .catch(() => undefined),
      goToProduct.click({ timeout: 10_000 }),
    ]);

    const offerPage = popup ?? this.page;
    if (!popup) await this.page.waitForURL((url) => url.toString() !== urlBefore, { timeout: 20_000 });

    const mainSeller = offerPage.locator('a[href*="/magaza/"]').filter({ visible: true }).first();
    await expect(mainSeller, `The offer page does not show seller "${sellerName}"`).toContainText(
      sellerName,
      {
        timeout: 20_000,
      },
    );
    return offerPage;
  }

  private async clickAddToCart(button: Locator): Promise<void> {
    await expect(button).toBeVisible({ timeout: 15_000 });
    await this.centerElement(button);
    await showAndCapture(this.page, 'add-to-cart-button', button);
    await button.click({ timeout: 10_000 });

    await expect(
      this.page
        .getByText(/ürün sepete eklendi|ürün sepetinizde/i)
        .filter({ visible: true })
        .first(),
    ).toBeVisible({ timeout: 15_000 });
    await showAndCapture(this.page, 'added-to-cart');
  }

  /** Centers the element: a sticky header or the drawer's own header cannot cover it. */
  private async centerElement(element: Locator): Promise<void> {
    await element.evaluate((node) =>
      node.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' }),
    );
  }

  private describe(sellers: Seller[], lowest: Seller): string {
    return sellers
      .map(
        (s) =>
          `${s === lowest ? '>> ' : '   '}${s.name} - ${s.rating ?? 'n/a'}${s.addToCart ? '' : '  (only "Ürüne git")'}`,
      )
      .join('\n');
  }
}
