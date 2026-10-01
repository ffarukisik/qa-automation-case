# Hepsiburada QA Automation Case

UI test (Hepsiburada) and API test (mock invoice server) written with **Playwright + TypeScript + BDD (playwright-bdd)**.

## What is covered

| Case item                                                                                                                                       | Where                                                              |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| 1. Login, search "cep telefonu", price filter 15.000-20.000 TL, random product from the bottom row, lowest-rated seller to the cart, cart check | `features/shopping.feature`                                        |
| 2. Mock server with `token`, `viewInvoice`, `sendInvoice`; responses written to files                                                           | `mock-server/`, `features/invoice.feature`, `artifacts/responses/` |
| 3. Browser is a parameter                                                                                                                       | `BROWSER=chromium\|firefox\|webkit\|all`                           |
| 4. BDD                                                                                                                                          | Gherkin in `features/`, steps in `steps/`                          |
| 5. Report                                                                                                                                       | Playwright HTML report (`playwright-report/`)                      |
| 6. Screenshot on failure (bonus)                                                                                                                | screenshot, video and trace are kept for failed scenarios          |
| 7. Docker (bonus)                                                                                                                               | `Dockerfile`, `Dockerfile.mock`, `docker-compose.yml`              |
| 8. Parallel run (bonus)                                                                                                                         | `fullyParallel`; API scenarios write one file per barcode          |

## Requirements

- Node.js 22 or newer (what CI and Docker use)
- Google Chrome (the Chromium project runs on the installed Chrome) or Playwright's own browsers
- A Hepsiburada test account for the UI scenario
- Docker (optional)

## Quick start

```bash
npm ci
npx playwright install        # only needed for Firefox/WebKit or the bundled Chromium
cp .env.example .env          # PowerShell: copy .env.example .env
# fill in TEST_USER and TEST_PASSWORD in .env
npm test
npm run report                # opens the HTML report
```

`npm test` starts the mock server automatically. Never commit `.env` or `.auth/`.

## Commands

| Command                                                                        | What it runs                                         |
| ------------------------------------------------------------------------------ | ---------------------------------------------------- |
| `npm test`                                                                     | everything (API, rules, UI)                          |
| `npm run test:api`                                                             | API scenarios only                                   |
| `npm run test:rules`                                                           | pure selection rules only (no browser, no site)      |
| `npm run test:ui`                                                              | UI scenario only                                     |
| `npm run test:debug`                                                           | Playwright UI mode (interactive debugging)           |
| `npm run test:firefox` / `test:webkit` / `test:chromium` / `test:all-browsers` | UI scenario in that browser                          |
| `npm run auth`                                                                 | log in by hand once and save the session (see below) |
| `npm run typecheck`, `npm run format:check`                                    | TypeScript and formatting checks                     |

PowerShell does not support `VAR=value npm test`: put values in `.env`, or use `$env:HEADLESS="true"; npm test`.

## Configuration (`.env`)

| Variable                                                | Meaning                                                                |
| ------------------------------------------------------- | ---------------------------------------------------------------------- |
| `TEST_USER`, `TEST_PASSWORD`                            | Hepsiburada account                                                    |
| `BROWSER`                                               | `chromium` (default), `firefox`, `webkit`, `all`                       |
| `HEADLESS`                                              | `false` (default) shows the browser; use `true` for CI/Docker          |
| `WORKERS`                                               | parallel workers                                                       |
| `BROWSER_CHANNEL` / `BROWSER_EXECUTABLE`                | installed Chrome (default) / bundled Chromium (empty) / a given binary |
| `DEMO_PAUSE_MS`                                         | pause after highlighting a selection in headed runs (default 1500)     |
| `TIMING=true`                                           | print how long each step of the UI scenario takes                      |
| `CART_URL`, `SELLER_SECTION_WAIT_MS`                    | optional overrides                                                     |
| `API_BASE_URL`, `MOCK_PORT`, `API_USER`, `API_PASSWORD` | mock server                                                            |

## Login

The case asks for a login, so the scenario **logs in through the UI first** (account menu, "Giriş Yap", e-mail and password). A login counts only when the home page then no longer offers "Giriş Yap".

Hepsiburada may refuse automated logins with the generic error `(N1E2)` or a security page. This is a site-side control and the tests do not try to hide the automation from it. If the UI login fails, the scenario **falls back to a session saved by hand**:

```bash
npm run auth        # opens a normal Chrome window: log in manually, then press Enter in the terminal
npm run test:ui
```

The session is stored in `.auth/hepsiburada.json` (git-ignored, it contains login cookies). The HTML report states which way was used (annotation `login`). Without a saved session, a failed UI login fails the test with the reason.

The rejected form attempt costs about 20 s per run. To skip it (for example while developing), leave `TEST_USER` and `TEST_PASSWORD` empty: the saved session is then used directly.

## How the UI scenario decides

**Bottom row.** The result list scrolls endlessly (the site appends further pages), so it has no real bottom. The bottom row is the **last visual row of the first results page**: the first 36 organic products, sponsored cards excluded. Later pages are never candidates.

**Lowest-rated seller.** Every layout of the product page is covered:

| Situation                                    | Sellers compared                                                  |
| -------------------------------------------- | ----------------------------------------------------------------- |
| No other sellers                             | the main seller                                                   |
| Fewer than 4 other sellers (no "Tümünü gör") | main seller + the in-page "Diğer satıcılar" rows                  |
| Many sellers ("Tümünü gör" opens a drawer)   | every seller in the drawer, scrolled until the list stops growing |

The lowest rating wins; on a tie the seller listed first is used; a seller without a rating only wins if nobody is rated. A seller listed with only "Ürüne git" is opened first and added from that seller's own offer page, which must show that seller.

**Checks.** An independent step reads all ratings on the page and compares the minimum with the chosen seller's rating. After adding, the site's confirmation must appear, and the cart page must hold a line with the chosen product **and** the chosen seller on the same line.

These rules are plain functions (`support/sellers.ts`, `support/listing.ts`, `support/cart.ts`) and are tested without the site in `features/rules.feature`.

## Watching a run

Chosen rows and sellers are highlighted and screenshotted into the HTML report; annotations name the bottom-row pick, the sellers found, the way the product was added and the cart line. With `TIMING=true` each step prints its duration.

## Docker

```bash
docker compose up --build --abort-on-container-exit                         # API + rules + UI
TEST_SCRIPT=test:api docker compose up --build --abort-on-container-exit    # API only
```

Reports and response files appear in `playwright-report/`, `test-results/`, `artifacts/`. The UI scenario needs credentials or a saved session (`.auth/` is mounted) and access to the live site. The container runs headless on the bundled Chromium, which the site rejects far more often, so the UI scenario is best-effort there; the API and rule scenarios are deterministic.

## Continuous integration

`.github/workflows/tests.yml` runs type check, formatting check, and the API and rule scenarios on every push, with Node and inside Docker Compose. The UI scenario is not part of CI: it needs a real account and the live site.

## Project structure

```text
features/       Gherkin: shopping (UI), invoice (API), rules (pure logic)
steps/          step definitions; fixtures.ts holds per-scenario state
pages/          Page Objects; components/SellerList.ts reads the seller list
support/        pure rules (sellers, listing, cart), waits, report helpers, saved session
api/            API client for the invoice steps
mock-server/    token / viewInvoice / sendInvoice mock (Express)
scripts/        `npm run auth` session capture
```

## Known limitations

- The UI scenario depends on the live site: its markup, security checks or stock can change.
- The bottom row is defined on the first results page (see above).
- After the price filter the site sometimes keeps showing the old list although the address changed; the test then reloads the page once. This is a workaround for a site quirk.
- The `.auth/` session and the `.env` credentials stay on your machine: they are git-ignored and must not be shared.
- Firefox and WebKit runs need `npx playwright install`.
