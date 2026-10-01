# QA Automation Case

UI test and API test (mock invoice server) written with **Playwright + TypeScript + BDD (playwright-bdd)**.

## Overview

This project implements the provided QA automation case with:

* Playwright + TypeScript
* BDD / Gherkin
* UI and API test automation
* Business-rule validation
* Cross-browser execution
* Playwright HTML reporting
* Failure screenshots, video and trace
* Docker / Docker Compose
* GitHub Actions CI

**Target application:** Hepsiburada

---

## What is covered

| Requirement              | Implementation                                             |
| ------------------------ | ---------------------------------------------------------- |
| Login                    | Hepsiburada login with saved-session fallback              |
| Search                   | Search for `cep telefonu`                                  |
| Price filter             | 15,000–20,000 TL                                           |
| Product selection        | Random product from the bottom row                         |
| Seller selection         | Lowest-rated seller                                        |
| Cart                     | Add selected seller's product                              |
| Cart verification        | Product and seller validation                              |
| API authentication       | `POST /token`                                              |
| Invoice lookup           | `GET /viewInvoice`                                         |
| Invoice submission       | `POST /sendInvoice`                                        |
| Response files           | Successful API responses written to `artifacts/responses/` |
| Browser parameterization | Chromium / Firefox / WebKit / all                          |
| BDD                      | Gherkin + `playwright-bdd`                                 |
| Reporting                | Playwright HTML report                                     |
| Failure artifacts        | Screenshot, video and trace                                |
| Parallel execution       | Playwright `fullyParallel`                                 |
| Docker                   | Docker Compose setup                                       |
| CI                       | Type checking, formatting, API and business-rule tests     |

---

## Requirements

* Node.js 22+
* Playwright browsers
* A Hepsiburada test account for the UI scenario
* Docker *(optional)*

---

## Quick Start

Install dependencies:

```bash
npm ci
npx playwright install
```

Create the environment file.

**PowerShell:**

```powershell
Copy-Item .env.example .env
```

Configure the required values in `.env`:

```text
TEST_USER=
TEST_PASSWORD=
```

Run the test suite:

```bash
npm test
```

Open the HTML report:

```bash
npm run report
```

---

## Commands

### Full test suite

```bash
npm test
```

### API tests

```bash
npm run test:api
```

### Business-rule tests

```bash
npm run test:rules
```

### UI tests

```bash
npm run test:ui
```

### Debug

```bash
npm run test:debug
```

### Browser selection

```bash
npm run test:chromium
npm run test:firefox
npm run test:webkit
npm run test:all-browsers
```

### Authentication

```bash
npm run auth
```

### Type checking

```bash
npm run typecheck
```

### Formatting check

```bash
npm run format:check
```

---

## Configuration

The main runtime settings are controlled through `.env`.

| Variable                 | Description                              |
| ------------------------ | ---------------------------------------- |
| `TEST_USER`              | Hepsiburada test account                 |
| `TEST_PASSWORD`          | Hepsiburada password                     |
| `BROWSER`                | `chromium`, `firefox`, `webkit` or `all` |
| `HEADLESS`               | Headless/headed execution                |
| `WORKERS`                | Playwright worker count                  |
| `BROWSER_CHANNEL`        | Browser channel                          |
| `BROWSER_EXECUTABLE`     | Custom browser executable                |
| `DEMO_PAUSE_MS`          | Pause used during headed runs            |
| `TIMING`                 | Timing output                            |
| `CART_URL`               | Optional cart URL                        |
| `SELLER_SECTION_WAIT_MS` | Optional seller-section wait             |
| `API_BASE_URL`           | Mock API base URL                        |
| `MOCK_PORT`              | Mock API port                            |
| `API_USER`               | Mock API username                        |
| `API_PASSWORD`           | Mock API password                        |

---

## Test Strategy

### UI

The main UI scenario follows the required business flow:

```text
Login
  ↓
Search "cep telefonu"
  ↓
Apply 15,000–20,000 TL filter
  ↓
Select a random product from the bottom row
  ↓
Open product detail
  ↓
Find the lowest-rated seller
  ↓
Add the seller's product to cart
  ↓
Verify product and seller in cart
```

### API

The mock invoice service covers:

```text
POST /token
GET  /viewInvoice?barcode={barcode}
POST /sendInvoice
```

Successful `viewInvoice` and `sendInvoice` response bodies are written to:

```text
artifacts/responses/
```

### Business rules

Core decisions are validated independently from the live website, including:

* Product listing normalization
* Organic/sponsored product filtering
* Bottom-row calculation
* Seller rating comparison
* Cart-line validation

---

## How the UI scenario decides

### Bottom row

The bottom row is defined as the **last visual row of the first results page**.

The first 36 organic products are considered. Sponsored products are excluded.

Products from later pages are not candidates.

### Lowest-rated seller

The seller selection logic handles the available product-page layouts:

* If there are no other sellers, the main seller is used.
* If the visible seller list is limited, the main seller and visible seller rows are considered.
* If `Tümünü gör` is available, the complete seller drawer is considered.
* If a seller only provides `Ürüne git`, the seller's own offer page is opened before adding the product.

The lowest available rating is selected.

If ratings are tied, the first listed seller is used.

Unrated sellers are considered only when no rated seller is available.

### Cart verification

The cart verification checks that the selected product and selected seller are associated with the same cart line.

---

## Authentication

Hepsiburada may reject automated login attempts with an `N1E2` security response.

The framework does not attempt to bypass the site's security controls.

If normal UI login is rejected, an authenticated browser session can be created manually:

```bash
npm run auth
```

After completing the normal login flow, the session is stored locally in:

```text
.auth/hepsiburada.json
```

The `.auth` directory is git-ignored and must not be committed.

---

## Watching a run

Selected products and sellers are highlighted during headed runs.

Annotations and screenshots are attached to the Playwright HTML report.

Timing information can be enabled through:

```text
TIMING=true
```

---

## Reporting

Playwright HTML reporting is enabled by default.

Failed tests retain:

* Screenshot
* Video
* Trace

Report output:

```text
playwright-report/
```

Test artifacts:

```text
test-results/
```

---

## Docker

The project includes:

* `Dockerfile`
* `Dockerfile.mock`
* `docker-compose.yml`

Run the full setup:

```bash
docker compose up --build --abort-on-container-exit
```

Run API tests only:

```bash
TEST_SCRIPT=test:api docker compose up --build --abort-on-container-exit
```

The UI scenario depends on the live Hepsiburada environment and may be affected by site-side security controls in the container.

API and business-rule scenarios are deterministic.

---

## CI

GitHub Actions runs deterministic quality checks including:

* TypeScript type checking
* Formatting validation
* API tests
* Business-rule tests
* Docker-based execution

The live UI scenario is not executed in CI because it requires a real Hepsiburada account and authenticated session and depends on the live website environment.

---

## Project Structure

```text
.
├── .github/
│   └── workflows/
├── api/
├── features/
├── mock-server/
├── pages/
├── scripts/
├── steps/
├── support/
├── .env.example
├── Dockerfile
├── Dockerfile.mock
├── docker-compose.yml
├── package.json
├── playwright.config.ts
├── tsconfig.json
└── README.md
```

### Directory responsibilities

| Directory      | Responsibility                      |
| -------------- | ----------------------------------- |
| `features/`    | Gherkin scenarios                   |
| `steps/`       | BDD step definitions                |
| `pages/`       | Page Objects and UI interactions    |
| `support/`     | Business rules and reusable helpers |
| `api/`         | API client                          |
| `mock-server/` | Mock invoice service                |
| `scripts/`     | Authentication/session utilities    |

---

## Known Limitations

* The UI scenario depends on the live Hepsiburada website.
* Website markup, security controls and product availability may change.
* The bottom row is defined against the first results page.
* Authentication may require a locally generated saved session.
* Firefox and WebKit require the corresponding Playwright browser binaries.

