import { expect, Page } from '@playwright/test';
import { BasePage } from './BasePage';
import { annotate, highlight, showAndCapture, timed } from '../support/observe';
import { appears } from '../support/wait';
import { extractRawCards, groupIntoRows, ListedCard, toOrganicCards } from '../support/listing';

export interface SelectedProduct {
  href: string;
  price: number;
}

// Product detail URLs look like /<slug>-p-HBCV000... or -pm-HBC...
const PRODUCT_LINK = 'a[href*="-p-"], a[href*="-pm-"]';

/** A product card is a list item that shows its final price (the test id carries a numeric suffix). */
const PRODUCT_CARD = 'li:has([data-test-id^="final-price-"])';

/**
 * The site renders results in pages of 36 products and loads the next page only while
 * scrolling. Right after the filter is applied the first page is complete in the DOM,
 * and that page is what "the bottom row" refers to.
 */
const FIRST_PAGE_SIZE = 36;

export class SearchPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async search(term: string): Promise<void> {
    if (!/hepsiburada\.com/i.test(this.page.url()) || /giris\./i.test(this.page.url())) {
      await this.page.goto('/', {
        waitUntil: 'domcontentloaded',
      });
    }

    await timed('search > cookie banner', () => this.acceptCookiesIfPresent());

    const searchArea = this.page.locator('div[class*="initialComponent-"]').first();

    // Clicking the hero box makes the site replace it with the real search input (class
    // "searchBarContent-"). Typing into the old one loses the text, so wait for the new one.
    const searchInput = this.page.getByRole('searchbox', { name: 'Site içinde ara' });
    const replacedInput = this.page.locator(
      'input[data-test-id="search-bar-input"][class*="searchBarContent-"]',
    );

    await timed('search > open search box', async () => {
      await searchArea.click();
      // Only a short wait: on some page variants this selector never matches (it cost a full 10 s
      // after a rejected login), and the retry in the next step covers a re-rendered input anyway.
      await appears(replacedInput, 3_000);
      await searchInput.waitFor({ state: 'visible', timeout: 10_000 });
    });

    await timed('search > enter search text', async () => {
      // The input can still be re-rendered right after it appears: retry until the text stays.
      await expect(async () => {
        await searchInput.fill(term);
        await expect(searchInput).toHaveValue(term, { timeout: 1_500 });
      }).toPass({ timeout: 10_000 });
    });

    await timed('search > submit', async () => {
      await searchInput.press('Enter');
    });

    await timed('search > results are shown', async () => {
      await expect(this.page.locator(PRODUCT_LINK).first()).toBeVisible({
        timeout: 10_000,
      });
    });
  }

  async filterPrice(min: number, max: number): Promise<void> {
    await this.acceptCookiesIfPresent();

    const minInput = this.page.getByPlaceholder(/^en az$/i).first();

    const maxInput = this.page.getByPlaceholder(/^en çok$/i).first();

    await minInput.scrollIntoViewIfNeeded().catch(() => undefined);

    await expect(minInput).toBeVisible({
      timeout: 15_000,
    });

    await expect(maxInput).toBeVisible();

    await minInput.fill(String(min));
    await maxInput.fill(String(max));

    await timed('filter > apply price range', async () => {
      await maxInput.press('Enter');

      const filterInUrl = new RegExp(`filtreler=fiyat(:|%3A)${min}-${max}`, 'i');

      const rangeApplied = (timeout: number) =>
        this.page
          .waitForURL((url) => filterInUrl.test(url.toString()), {
            timeout,
          })
          .then(() => true)
          .catch(() => false);

      let applied = await rangeApplied(4_000);

      for (let level = 1; level <= 4 && !applied; level++) {
        const container = maxInput.locator(`xpath=ancestor::*[${level}]`);

        const controls = container
          .locator('button, [role="button"], a')
          .filter({
            hasNotText: /temizle/i,
          })
          .filter({
            visible: true,
          });

        if (!(await controls.count())) {
          continue;
        }

        await controls
          .last()
          .click()
          .catch(() => undefined);

        applied = await rangeApplied(5_000);
      }

      if (!applied) {
        const html = await maxInput
          .locator('xpath=ancestor::*[3]')
          .evaluate((element) => element.outerHTML.slice(0, 2_000))
          .catch(() => '(container HTML unavailable)');

        throw new Error(
          `Price filter ${min}-${max} was not applied (URL did not change). ` +
            `Filter container HTML:\n${html}`,
        );
      }
    });

    let seen: ListedCard[] = [];

    const firstResultInRange = async (): Promise<boolean> => {
      seen = await this.readOrganicCards();

      const firstPrice = seen[0]?.price;

      return firstPrice !== undefined && firstPrice >= min && firstPrice <= max;
    };

    const listRefreshed = (timeout: number) =>
      expect
        .poll(firstResultInRange, { timeout })
        .toBe(true)
        .then(
          () => true,
          () => false,
        );

    // The address already holds the filter, but the page can keep showing the old list.
    // If it does not refresh by itself, reload once so the filtered list is rendered.
    if (!(await listRefreshed(5_000))) {
      annotate('filter', 'The list did not refresh after the address changed: reloading the page');
      await this.page.reload({ waitUntil: 'domcontentloaded' });
    }

    try {
      await expect.poll(firstResultInRange, { timeout: 20_000 }).toBe(true);
    } catch (error) {
      // Say what the page showed, so a stale list, a promo price or an empty page can be told apart.
      const firstCards = seen.slice(0, 5).map(({ title, price }) => ({ title: title.slice(0, 50), price }));
      throw new Error(
        `The first result did not refresh to the ${min}-${max} TL price range.\n` +
          `Page: ${this.page.url()}\nOrganic cards read: ${seen.length}\nFirst cards: ${JSON.stringify(firstCards)}`,
        { cause: error },
      );
    }
  }

  async selectRandomProductFromBottomRow(min: number, max: number): Promise<SelectedProduct> {
    await this.page.evaluate(() => window.scrollTo(0, 0));

    const organic = await this.readOrganicCards();

    const firstPage = organic.slice(0, FIRST_PAGE_SIZE);

    const rows = groupIntoRows(firstPage);

    const bottomRow = rows[rows.length - 1] ?? [];

    const candidates = bottomRow.filter((card) => card.price >= min && card.price <= max);

    if (!candidates.length) {
      throw new Error(
        `No card in the bottom row is priced between ${min} and ${max} TL: ` + JSON.stringify(bottomRow),
      );
    }

    const chosen = candidates[Math.floor(Math.random() * candidates.length)];

    annotate(
      'bottom-row',
      `${firstPage.length} products on the first page ` +
        `(${organic.length} organic cards read), ` +
        `${rows.length} rows. ` +
        `Bottom row has ${bottomRow.length} cards. ` +
        `Picked #${firstPage.indexOf(chosen) + 1}: ` +
        `"${chosen.title}" - ${chosen.price} TL`,
    );

    const card = (item: ListedCard) =>
      this.page
        .locator(PRODUCT_CARD)
        .filter({
          has: this.page.locator(`a[href=${JSON.stringify(item.href)}]`),
        })
        .first();

    for (const item of bottomRow) {
      await highlight(card(item), '#2563eb');
    }

    await showAndCapture(this.page, 'selected-product-bottom-row', card(chosen));

    await this.page.goto(new URL(chosen.href, this.page.url()).toString(), {
      waitUntil: 'domcontentloaded',
    });

    await expect(this.page).toHaveURL(/-pm?-/i);

    return {
      href: chosen.href,
      price: chosen.price,
    };
  }

  private async readOrganicCards(): Promise<ListedCard[]> {
    const raw = await this.page.locator(PRODUCT_CARD).evaluateAll(extractRawCards);

    return toOrganicCards(raw);
  }
}
