/** Pure seller rules (no browser needed, unit-tested in features/rules.feature). */

export interface RatedSeller {
  name: string;
  /** Undefined when the seller has no rating yet. */
  rating?: number;
}

/** "9,8" / "10,0" / "9.8" -> number between 0 and 10, otherwise undefined. */
export function parseRating(text: string): number | undefined {
  const value = Number.parseFloat(text.trim().replace(',', '.'));
  return Number.isNaN(value) || value < 0 || value > 10 ? undefined : value;
}

/** Unrated sellers sort last, so they only win when nobody is rated. */
const sortable = (seller: RatedSeller): number => seller.rating ?? Number.POSITIVE_INFINITY;

/** The lowest-rated seller. On a tie the seller listed first wins. */
export function pickLowestRated<T extends RatedSeller>(sellers: readonly T[]): T {
  if (!sellers.length) throw new Error('There is no seller to choose from.');
  return sellers.reduce((lowest, seller) => (sortable(seller) < sortable(lowest) ? seller : lowest));
}

/** The lowest rating among rated sellers, or undefined when nobody is rated. */
export function lowestRating(ratings: readonly (number | undefined)[]): number | undefined {
  const rated = ratings.filter((rating): rating is number => rating !== undefined);
  return rated.length ? Math.min(...rated) : undefined;
}
