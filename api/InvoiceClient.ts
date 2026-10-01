import { APIRequestContext, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

/** Responses of successful calls are written here, one file per barcode. */
export const RESPONSES_DIR = path.join(process.cwd(), 'artifacts', 'responses');

export interface ViewInvoiceResponse {
  InvoiceLink: string;
  Result: { success: boolean };
}

export interface SendInvoiceResponse {
  Result: { success: boolean };
  Barcode: string;
}

export class InvoiceClient {
  constructor(private readonly request: APIRequestContext) {}

  async isAvailable(): Promise<boolean> {
    const response = await this.request.get('/viewInvoice?barcode=health').catch(() => undefined);
    return response?.ok() ?? false;
  }

  async token(user: string, pass: string): Promise<string> {
    const response = await this.request.post('/token', { headers: { user, pass } });
    await expect(response).toBeOK();
    const body = (await response.json()) as { token?: string };
    if (!body.token) throw new Error('Token was not returned by /token.');
    return body.token;
  }

  async viewInvoice(barcode: string): Promise<ViewInvoiceResponse> {
    const response = await this.request.get(`/viewInvoice?barcode=${encodeURIComponent(barcode)}`);
    await expect(response).toBeOK();
    const body = (await response.json()) as ViewInvoiceResponse;

    expect(body.Result?.success).toBe(true);
    expect(body.InvoiceLink).toBe('http://abc.com/invoice.pdf');
    await this.writeResponse(`viewInvoice-${barcode}.json`, body);
    return body;
  }

  async sendInvoice(token: string, barcode: string): Promise<SendInvoiceResponse> {
    const response = await this.postSendInvoice(token, barcode);
    await expect(response).toBeOK();
    const body = (await response.json()) as SendInvoiceResponse;

    expect(body.Result?.success).toBe(true);
    expect(body.Barcode).toBe(barcode);
    await this.writeResponse(`sendInvoice-${barcode}.json`, body);
    return body;
  }

  async getSendInvoiceStatus(token: string, barcode: string): Promise<number> {
    return (await this.postSendInvoice(token, barcode)).status();
  }

  private postSendInvoice(token: string, barcode: string) {
    return this.request.post('/sendInvoice', { headers: { token }, data: { Barcode: barcode } });
  }

  private async writeResponse(filename: string, body: unknown): Promise<void> {
    await fs.mkdir(RESPONSES_DIR, { recursive: true });
    await fs.writeFile(path.join(RESPONSES_DIR, filename), JSON.stringify(body, null, 2), 'utf8');
  }
}
