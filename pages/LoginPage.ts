import { expect, Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';
import { annotate } from '../support/observe';
import { hasSavedSession, restoreSavedSession } from '../support/session';
import { appears, typeLikeUser } from '../support/wait';

const LOGIN_URL = process.env.LOGIN_URL ?? 'https://giris.hepsiburada.com/';

const firstLine = (error: Error): string => error.message.split('\n')[0];

export class LoginPage extends BasePage {
  private readonly accountMenu: Locator;
  private readonly emailInput: Locator;
  private readonly passwordInput: Locator;
  private readonly submitButton: Locator;

  constructor(page: Page) {
    super(page);
    this.accountMenu = page.getByTestId('account').first();
    this.emailInput = page
      .locator('#txtUserName')
      .or(page.getByPlaceholder(/e-posta adresi/i))
      .first();
    this.passwordInput = page
      .locator('input#txtPassword')
      .or(page.getByPlaceholder(/^şifre$/i))
      .first();
    this.submitButton = page
      .locator('#btnLogin')
      .or(page.getByRole('button', { name: /^giriş yap$/i }))
      .first();
  }

  /**
   * The case asks for a login, so the UI login is tried first. If the site refuses it (generic
   * N1E2 error, wrong-credentials message, timeout) the saved session is used instead, and the
   * report says which way was taken. Without a saved session the UI failure is the test failure.
   */
  async ensureLoggedIn(): Promise<void> {
    const { TEST_USER: user, TEST_PASSWORD: password } = process.env;

    let uiFailure: Error;
    if (user && password) {
      try {
        await this.open();
        await this.login(user, password);
        await this.assertLoggedIn('The UI login');
        annotate('login', 'Logged in through the UI');
        return;
      } catch (error) {
        uiFailure = error as Error;
      }
    } else {
      uiFailure = new Error('TEST_USER and TEST_PASSWORD are not set.');
    }

    if (!hasSavedSession()) {
      throw new Error(
        `UI login failed and there is no saved session (run "npm run auth"). ${firstLine(uiFailure)}`,
        {
          cause: uiFailure,
        },
      );
    }

    annotate('login', `UI login failed, continuing with the saved session. Reason: ${firstLine(uiFailure)}`);
    await restoreSavedSession(this.page.context());
    await this.assertLoggedIn('The saved session');
  }

  /** Opens the login form like a user: home page, hover the account menu, click "Giriş Yap". */
  async open(): Promise<void> {
    await this.page.goto('/', { waitUntil: 'domcontentloaded' });
    await this.acceptCookiesIfPresent();

    if (await appears(this.accountMenu, 10_000)) {
      await this.accountMenu.hover();
      const loginLink = this.page
        .locator('#login')
        .or(this.page.getByRole('link', { name: /giriş yap/i }))
        .first();
      if (await appears(loginLink, 5_000)) await loginLink.click();
    }

    // The direct login URL is only the fallback if the form was not reached through the header.
    if (!(await appears(this.emailInput, 10_000))) {
      await this.page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });
    }
  }

  /** Proof of a login: the home page no longer offers "Giriş Yap". */
  private async assertLoggedIn(what: string): Promise<void> {
    await this.page.goto('/', { waitUntil: 'domcontentloaded' });
    await this.acceptCookiesIfPresent();
    const loginEntry = this.page.getByText(/^giriş yap$/i).first();
    await expect(loginEntry, `${what} is not logged in: the home page still offers "Giriş Yap".`).toBeHidden({
      timeout: 15_000,
    });
  }

  async login(username: string, password: string): Promise<void> {
    await expect(this.emailInput).toBeVisible({ timeout: 20_000 });
    await typeLikeUser(this.emailInput, username);

    // Some login variants reveal the password field only after the e-mail step.
    if (!(await this.passwordInput.isVisible())) await this.submitButton.click();

    await expect(this.passwordInput).toBeVisible({ timeout: 15_000 });
    await typeLikeUser(this.passwordInput, password);
    await this.submitButton.click();
    await this.waitForLoginOutcome();
  }

  /**
   * The login goes through an OAuth redirect chain (giris -> oauth -> www). Wait until the browser
   * is back on the main site, or until the site shows its generic "(N1E2)" error or a form error.
   */
  private async waitForLoginOutcome(): Promise<void> {
    const siteError = this.page.getByText(/N1E2|Beklenmeyen bir hata oluştu/i).first();
    const formError = this.page.getByTestId('inline-alert-label').first();

    const outcome = await Promise.race([
      siteError.waitFor({ state: 'visible', timeout: 30_000 }).then(() => 'site-error' as const),
      formError.waitFor({ state: 'visible', timeout: 30_000 }).then(() => 'form-error' as const),
      this.page
        .waitForURL((url) => !/^(giris|oauth)\./i.test(url.hostname), { timeout: 30_000 })
        .then(() => 'logged-in' as const),
    ]).catch(() => 'timeout' as const);

    if (outcome === 'site-error') {
      throw new Error('Hepsiburada rejected the login with its generic error (N1E2).');
    }
    if (outcome === 'form-error') {
      throw new Error(`Hepsiburada rejected the login: ${(await formError.innerText()).trim()}`);
    }
    if (outcome === 'timeout') {
      throw new Error('The login did not complete within 30 s and no error was shown.');
    }
  }
}
