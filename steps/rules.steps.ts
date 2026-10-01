import { expect } from '@playwright/test';
import { isSameProduct, isSameSeller } from '../support/cart';
import { groupIntoRows, parsePrice } from '../support/listing';
import { parseRating, pickLowestRated, RatedSeller } from '../support/sellers';
import { When, Then } from './fixtures';

/** "A:9,8;B:n/a" -> sellers with a name and an optional rating. */
function parseSellers(text: string): RatedSeller[] {
  return text.split(';').map((entry) => {
    const [name, rating] = entry.split(':');
    return { name, rating: parseRating(rating) };
  });
}

const show = (value: number | undefined): string =>
  value === undefined || Number.isNaN(value) ? 'none' : String(value);

When('the lowest-rated seller is chosen from {string}', async ({ rules }, sellers: string) => {
  rules.result = pickLowestRated(parseSellers(sellers)).name;
});

When('the rating is read from {string}', async ({ rules }, text: string) => {
  rules.result = show(parseRating(text));
});

When('the price is read from {string}', async ({ rules }, text: string) => {
  rules.result = show(parsePrice(text));
});

When('the bottom row is taken from products at tops {string}', async ({ rules }, tops: string) => {
  const rows = groupIntoRows(tops.split(',').map((top) => ({ top: Number(top) })));
  rules.result = String(rows[rows.length - 1].length);
});

When(
  'the cart title {string} is compared with the product {string}',
  async ({ rules }, cart: string, product: string) => {
    rules.result = isSameProduct(cart, product) ? 'yes' : 'no';
  },
);

When(
  'the cart seller {string} is compared with the seller {string}',
  async ({ rules }, cart: string, seller: string) => {
    rules.result = isSameSeller(cart, seller) ? 'yes' : 'no';
  },
);

Then('the result should be {string}', async ({ rules }, expected: string) => {
  expect(rules.result).toBe(expected);
});
