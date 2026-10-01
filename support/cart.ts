/** Pure helpers for reading the cart page (no browser needed, unit-testable). */

export interface CartLine {
  title: string;
  seller: string;
}

const clean = (text: string | null | undefined): string => (text ?? '').replace(/\s+/g, ' ').trim();

/**
 * Runs inside the browser (Locator.evaluateAll), so it must stay self-contained.
 * The cart groups its lines per seller: a group holds the seller header and the list of
 * product lines, so a line's seller is found through its group. The seller name is read from
 * the link only, so icons next to it cannot leak into the name.
 */
export function extractCartLines(items: Element[]): CartLine[] {
  const text = (value: string | null | undefined) => (value ?? '').replace(/\s+/g, ' ').trim();
  return items.map((item) => ({
    title: text(item.querySelector('[class*="product_name"]')?.textContent),
    seller: text(
      item.closest('[class*="product_cart"]')?.querySelector('[class*="merchant_link"] a')?.textContent,
    ),
  }));
}

/** Case-insensitive, Turkish-aware ("İ" -> "i"), whitespace-insensitive. */
export function normalize(text: string): string {
  return clean(text).toLocaleLowerCase('tr');
}

/** The cart omits the brand prefix of the product page title, so one title may contain the other. */
export function isSameProduct(cartTitle: string, productTitle: string): boolean {
  const cart = normalize(cartTitle);
  const product = normalize(productTitle);
  return cart !== '' && product !== '' && (product.includes(cart) || cart.includes(product));
}

export function isSameSeller(cartSeller: string, expectedSeller: string): boolean {
  return normalize(cartSeller) !== '' && normalize(cartSeller) === normalize(expectedSeller);
}
