/** Pure helpers for reading the search result grid (no browser needed, unit-testable). */

export interface RawCard {
  href: string;
  title: string;
  priceText: string;
  /** Distance from the top of the document, so scrolling does not change it. */
  top: number;
  isAd: boolean;
}

export interface ListedCard {
  href: string;
  title: string;
  price: number;
  top: number;
}

/**
 * Runs inside the browser (Locator.evaluateAll), so it must stay self-contained.
 * A product card is an <li> that shows a final price. Sponsored blocks ("Reklam") are
 * flagged through the `hepsiads` class of their container.
 */
export function extractRawCards(items: Element[]): RawCard[] {
  return items.map((item) => {
    const link = item.querySelector('a[href*="-p-"], a[href*="-pm-"]');
    const title = item.querySelector('[data-test-id^="title-"]');
    const price = item.querySelector('[data-test-id^="final-price-"]');
    return {
      href: link?.getAttribute('href') ?? '',
      title: (title?.textContent ?? link?.getAttribute('title') ?? '').replace(/\s+/g, ' ').trim(),
      priceText: price?.textContent ?? '',
      top: item.getBoundingClientRect().top + window.scrollY,
      isAd: !!item.closest('[class*="hepsiads"]') || !!item.querySelector('[class*="hepsiads"]'),
    };
  });
}

/** "15.253,62 TL" -> 15253.62 (Turkish number format). NaN when there is no number. */
export function parsePrice(text: string): number {
  const digits = text.replace(/[^\d,]/g, '');
  return /\d/.test(digits) ? Number(digits.replace(',', '.')) : Number.NaN;
}

/** Organic cards only: no ads, with a link and a readable price. DOM order is kept. */
export function toOrganicCards(raw: RawCard[]): ListedCard[] {
  return raw
    .filter((card) => !card.isAd && card.href)
    .map((card) => ({ href: card.href, title: card.title, price: parsePrice(card.priceText), top: card.top }))
    .filter((card) => !Number.isNaN(card.price));
}

/** Cards whose top edges are within the tolerance share a row. Rows are ordered top to bottom. */
export function groupIntoRows<T extends { top: number }>(cards: T[], tolerance = 20): T[][] {
  const rows: T[][] = [];
  for (const card of [...cards].sort((a, b) => a.top - b.top)) {
    const row = rows.find((r) => Math.abs(r[0].top - card.top) <= tolerance);
    if (row) row.push(card);
    else rows.push([card]);
  }
  return rows;
}
