import { expect } from '@playwright/test';
import { CartPage } from '../pages/CartPage';
import { LoginPage } from '../pages/LoginPage';
import { ProductPage } from '../pages/ProductPage';
import { SearchPage } from '../pages/SearchPage';
import { timed } from '../support/observe';
import { Given, When, Then } from './fixtures';

Given('the user is logged in', async ({ page }) => {
  await timed('step: logged in', () => new LoginPage(page).ensureLoggedIn());
});

When('the user searches for {string}', async ({ page }, term: string) => {
  await timed('step: search', () => new SearchPage(page).search(term));
});

When(
  'the user filters the price between {int} and {int} TL',
  async ({ page, shopping }, min: number, max: number) => {
    await timed('step: price filter', () => new SearchPage(page).filterPrice(min, max));
    shopping.priceRange = { min, max };
  },
);

When('the user selects a random product from the bottom row', async ({ page, shopping }) => {
  const { min, max } = shopping.priceRange!;
  await timed('step: select product', async () => {
    const product = await new SearchPage(page).selectRandomProductFromBottomRow(min, max);
    shopping.productPrice = product.price;
    shopping.productTitle = await new ProductPage(page).getProductTitle();
  });

  expect(shopping.productTitle).not.toBe('');
  expect(shopping.productPrice).toBeGreaterThanOrEqual(min);
  expect(shopping.productPrice).toBeLessThanOrEqual(max);
});

When('the user selects the lowest-rated seller', async ({ page, shopping }) => {
  shopping.seller = await timed('step: lowest-rated seller', () =>
    new ProductPage(page).selectLowestRatedSeller(),
  );
  expect(shopping.seller.name).not.toBe('');
});

Then(
  'the selected seller should have the lowest rating among all listed sellers',
  async ({ page, shopping }) => {
    const productPage = new ProductPage(page);
    const lowestListedRating = await productPage.getLowestRatingListedOnPage();
    expect(
      shopping.seller!.rating,
      `Selected "${shopping.seller!.name}" (${shopping.seller!.rating ?? 'no rating'}) but the page lists: ${await productPage.describeListedSellers()}`,
    ).toBe(lowestListedRating);
  },
);

When('the user adds the selected seller product to the cart', async ({ page, shopping }) => {
  await timed('step: add to cart', () => new ProductPage(page).addSelectedSellerToCart(shopping.seller!));
});

Then('the selected product and seller should be displayed in the cart', async ({ page, shopping }) => {
  await timed('step: verify cart', () =>
    new CartPage(page).assertProductAndSeller(shopping.productTitle, shopping.seller!.name),
  );
});
