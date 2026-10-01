import { request } from '@playwright/test';
import { test as base, createBdd } from 'playwright-bdd';
import { InvoiceClient } from '../api/InvoiceClient';
import { SellerSelection } from '../pages/ProductPage';

/** Per-scenario state shared between UI steps (replaces module-level globals). */
export interface ShoppingState {
  priceRange?: { min: number; max: number };
  productTitle: string;
  productPrice: number;
  seller?: SellerSelection;
}

/** Per-scenario state shared between API steps. */
export interface InvoiceState {
  client: InvoiceClient;
  token: string;
  lastSendInvoiceStatus: number;
}

/** Result of the last pure rule that was evaluated (rules feature). */
export interface RuleState {
  result: string;
}

export const test = base.extend<{ shopping: ShoppingState; invoice: InvoiceState; rules: RuleState }>({
  rules: async ({}, use) => {
    await use({ result: '' });
  },

  shopping: async ({}, use) => {
    await use({ productTitle: '', productPrice: 0 });
  },

  invoice: async ({}, use) => {
    const context = await request.newContext({
      baseURL: process.env.API_BASE_URL ?? 'http://127.0.0.1:3001',
    });
    await use({ client: new InvoiceClient(context), token: '', lastSendInvoiceStatus: 0 });
    await context.dispose();
  },
});

export const { Given, When, Then } = createBdd(test);
