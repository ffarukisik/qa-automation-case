import { expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { RESPONSES_DIR } from '../api/InvoiceClient';
import { Given, When, Then } from './fixtures';

const EXPECTED_INVOICE_LINK = 'http://abc.com/invoice.pdf';

async function readSavedResponse<T>(filename: string): Promise<T> {
  return JSON.parse(await fs.readFile(path.join(RESPONSES_DIR, filename), 'utf8')) as T;
}

Given('the invoice API mock server is available', async ({ invoice }) => {
  expect(await invoice.client.isAvailable()).toBe(true);
});

When('a token is requested with valid credentials', async ({ invoice }) => {
  invoice.token = await invoice.client.token(
    process.env.API_USER ?? 'testuser',
    process.env.API_PASSWORD ?? 'testpass',
  );
  expect(invoice.token).toBeTruthy();
});

When('the invoice is viewed for barcode {string}', async ({ invoice }, barcode: string) => {
  await invoice.client.viewInvoice(barcode);
});

When('the invoice is sent for barcode {string}', async ({ invoice }, barcode: string) => {
  await invoice.client.sendInvoice(invoice.token, barcode);
});

Then(
  'the viewInvoice response for barcode {string} should be saved to a file',
  async ({}, barcode: string) => {
    const saved = await readSavedResponse<{ InvoiceLink?: string; Result?: { success?: boolean } }>(
      `viewInvoice-${barcode}.json`,
    );
    expect(saved.InvoiceLink).toBe(EXPECTED_INVOICE_LINK);
    expect(saved.Result?.success).toBe(true);
  },
);

Then(
  'the sendInvoice response for barcode {string} should be saved to a file',
  async ({}, barcode: string) => {
    const saved = await readSavedResponse<{ Barcode?: string; Result?: { success?: boolean } }>(
      `sendInvoice-${barcode}.json`,
    );
    expect(saved.Barcode).toBe(barcode);
    expect(saved.Result?.success).toBe(true);
  },
);

When(
  'sendInvoice is called with an invalid token for barcode {string}',
  async ({ invoice }, barcode: string) => {
    invoice.lastSendInvoiceStatus = await invoice.client.getSendInvoiceStatus('invalid-token', barcode);
  },
);

Then('sendInvoice should return unauthorized', async ({ invoice }) => {
  expect(invoice.lastSendInvoiceStatus).toBe(401);
});
