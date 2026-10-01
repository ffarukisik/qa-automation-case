import { expect, Locator, Page } from '@playwright/test';
import { annotate } from '../../support/observe';
import { lowestRating, parseRating, RatedSeller } from '../../support/sellers';
import { appears } from '../../support/wait';

/** How long the "Diğer satıcılar" section gets to render before the product counts as single-seller. */
const SELLER_SECTION_WAIT_MS = Number(process.env.SELLER_SECTION_WAIT_MS ?? 6_000);

/** "Tümünü gör" opens the full seller list as a drawer that covers the page. */
const SELLER_DRAWER = '[data-drawer-type="overlay"]';

/**
 * From a seller name, climb to the outermost element that still holds exactly one seller and
 * not the section heading: the complete seller row with name, rating and buttons.
 */
const SELLER_ROW =
  'xpath=ancestor::*[count(.//*[@data-test-id="merchant-name"])=1 ' +
  'and not(.//*[contains(normalize-space(text()),"iğer") and contains(normalize-space(text()),"atıcılar")])][last()]';

/**
 * Where the sellers were read from:
 * - drawer:  "Tümünü gör" opened the full list (many sellers)
 * - preview: only the in-page "Diğer satıcılar" section exists (fewer than 4 other sellers)
 * - single:  the product has no other sellers, only the main seller
 */
export type SellerSource = 'drawer' | 'preview' | 'single';

export interface SellerSelection extends RatedSeller {
  source: SellerSource;
}

export interface Seller extends SellerSelection {
  row: Locator;
  /** Present when the seller has its own "Sepete ekle" button. */
  addToCart?: Locator;
  /** Present when the row only offers "Ürüne git" (opens that seller's offer page). */
  goToProduct?: Locator;
}

const clean = (text: string): string => text.replace(/\s+/g, ' ').trim();

/** Reads all sellers of a product page, whatever way the page presents them. */
export class SellerList {
  private drawerUnavailableFor?: string;

  constructor(private readonly page: Page) {}

  /** Every seller: the whole drawer, or the main seller plus the in-page rows. */
  async collect(): Promise<Seller[]> {
    await this.waitUntilReady();

    if (await this.openDrawer()) {
      // Only the drawer is read: the page behind it repeats some sellers with only "Ürüne git",
      // and those rows are covered by the drawer and cannot be clicked.
      await expect(this.drawer.getByTestId('merchant-name').first()).toBeVisible({ timeout: 20_000 });
      await this.scrollToLastRow();
      return this.nonEmpty(await this.readRows(this.drawer, 'drawer'));
    }

    const section = await this.previewSection();
    const rows = section ? await this.readRows(section, 'preview') : [];
    const source: SellerSource = rows.length ? 'preview' : 'single';
    const main = await this.readMainSeller(source);
    return this.nonEmpty(main ? [main, ...rows.filter((row) => row.name !== main.name)] : rows);
  }

  /**
   * Reads the ratings straight from the DOM, independently of the row logic in collect(), so a test
   * can verify that the chosen seller really has the lowest rating on the page.
   */
  async lowestListedRating(): Promise<number | undefined> {
    await this.collect(); // makes sure the complete list is open
    const texts = await this.page.getByTestId('merchant-rating').filter({ visible: true }).allInnerTexts();
    return lowestRating(texts.map(parseRating));
  }

  private get drawer(): Locator {
    return this.page
      .locator(SELLER_DRAWER)
      .filter({ has: this.page.getByTestId('merchant-name') })
      .first();
  }

  private get mainSellerLink(): Locator {
    return this.page.locator('a[href*="/magaza/"]').filter({ visible: true }).first();
  }

  private get heading(): Locator {
    return this.page
      .getByText(/diğer satıcılar/i)
      .filter({ visible: true })
      .first();
  }

  private nonEmpty(sellers: Seller[]): Seller[] {
    if (!sellers.length) throw new Error('No seller with an add-to-cart or "Ürüne git" action was found.');
    return sellers;
  }

  /** The buy box is rendered once the main seller link is there; only then is it decided which sellers exist. */
  private async waitUntilReady(): Promise<void> {
    await expect(this.mainSellerLink, 'The main seller of the product was not found').toBeVisible({
      timeout: 20_000,
    });
  }

  /** Opens "Tümünü gör" when the product has that button. Returns true when the drawer is open. */
  private async openDrawer(): Promise<boolean> {
    if (await this.drawer.isVisible()) return true;
    if (this.drawerUnavailableFor === this.page.url()) return false;

    // "No section" is only concluded after the section had time to render.
    if (await appears(this.heading, SELLER_SECTION_WAIT_MS)) {
      const showAll = this.page
        .getByRole('button', { name: /tümünü gör/i })
        .filter({ visible: true })
        .first();
      if (await showAll.count()) {
        await showAll.evaluate((node) => node.scrollIntoView({ block: 'center' }));
        await showAll.click();
        await appears(this.drawer, 8_000);
      }
    }

    const opened = await this.drawer.isVisible();
    if (opened) annotate('seller-list', 'Opened the full seller list ("Tümünü gör")');
    else this.drawerUnavailableFor = this.page.url();
    return opened;
  }

  /** The in-page "Diğer satıcılar" section (heading plus rows), if the product has other sellers. */
  private async previewSection(): Promise<Locator | undefined> {
    if (!(await this.heading.count())) return undefined;
    const section = this.heading.locator('xpath=ancestor::*[.//*[@data-test-id="merchant-name"]][1]');
    return (await section.count()) ? section : undefined;
  }

  /** The drawer can load more rows while scrolling: scroll until the row count stops growing. */
  private async scrollToLastRow(): Promise<void> {
    const names = this.drawer.getByTestId('merchant-name');
    let previous = -1;
    for (let attempt = 0; attempt < 15; attempt++) {
      const current = await names.count();
      if (current === previous) return;
      previous = current;
      await names
        .last()
        .scrollIntoViewIfNeeded({ timeout: 3_000 })
        .catch(() => undefined);
      await this.page.waitForTimeout(500);
    }
  }

  /** Seller rows below a scope, read through data-test-id="merchant-name" / "merchant-rating". */
  private async readRows(scope: Locator, source: SellerSource): Promise<Seller[]> {
    const names = scope.getByTestId('merchant-name');
    const sellers: Seller[] = [];

    for (let i = 0; i < (await names.count()); i++) {
      const nameElement = names.nth(i);
      if (!(await nameElement.isVisible())) continue;

      const name = clean(await nameElement.innerText());
      const row = nameElement.locator(SELLER_ROW);
      if (!name || !(await row.count())) continue;

      const ratingElement = row.getByTestId('merchant-rating').first();
      const rating = (await ratingElement.count()) ? parseRating(await ratingElement.innerText()) : undefined;

      // A row has either its own "Sepete ekle" or only "Ürüne git"; anything else is ambiguous.
      const addToCart = row
        .getByTestId('addToCart')
        .or(row.getByRole('button', { name: /^sepete ekle$/i }))
        .filter({ visible: true });
      const goToProduct = row
        .getByRole('button', { name: /^ürüne git$/i })
        .or(row.getByRole('link', { name: /^ürüne git$/i }))
        .filter({ visible: true });
      const canAdd = (await addToCart.count()) === 1;
      const canNavigate = !canAdd && (await goToProduct.count()) === 1;
      if (!canAdd && !canNavigate) continue;

      const seller: Seller = {
        name,
        rating,
        source,
        row,
        addToCart: canAdd ? addToCart : undefined,
        goToProduct: canNavigate ? goToProduct : undefined,
      };

      // The same seller can appear twice: keep the row that can add to the cart directly.
      const existing = sellers.findIndex((s) => s.name === name);
      if (existing === -1) sellers.push(seller);
      else if (!sellers[existing].addToCart && seller.addToCart) sellers[existing] = seller;
    }
    return sellers;
  }

  /** The main seller next to the price and the product's own "Sepete ekle" button. */
  private async readMainSeller(source: SellerSource): Promise<Seller | undefined> {
    const name = clean(await this.mainSellerLink.innerText());
    if (!name) return undefined;

    // The closest surrounding element with a rating that is not the "Diğer satıcılar" section.
    const ratingBox = this.mainSellerLink.locator(
      'xpath=ancestor::*[.//*[@data-test-id="merchant-rating"] ' +
        'and not(.//*[contains(normalize-space(text()),"atıcılar")])][1]',
    );
    const ratingText = (await ratingBox.count())
      ? await ratingBox.getByTestId('merchant-rating').first().innerText()
      : '';

    return {
      name,
      rating: parseRating(ratingText),
      source,
      row: this.mainSellerLink,
      addToCart: this.page.getByTestId('addToCart').filter({ visible: true }).first(),
    };
  }
}
