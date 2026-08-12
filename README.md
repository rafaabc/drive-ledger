[![CI](https://github.com/rafaabc/norevify/actions/workflows/ci.yml/badge.svg)](https://github.com/rafaabc/norevify/actions/workflows/ci.yml)

# Norevify

**Live:** https://app.norevify.com

A full-stack vehicle expense tracker — built to practise and demonstrate production-grade Next.js development **and QA/test engineering**, covering the full stack from database modelling to a four-layer automated test suite and CI/CD.

This repository is **source-available for portfolio review** — see the [License](#license) note below.

---

## Testing & Quality

The test suite mirrors the practical test pyramid: fast, numerous unit tests at the base; fewer, slower end-to-end tests at the top; each layer answering a question the layers below it can't.

| Layer         | Files | Cases | Tooling                                  | What it answers                                                                      |
| ------------- | ----: | ----: | ---------------------------------------- | ------------------------------------------------------------------------------------ |
| Backend unit  |    26 |   399 | Node test runner + `node:assert`         | Does each service/model function behave correctly in isolation?                      |
| Frontend unit |    55 |   367 | Vitest + Testing Library                 | Do components and hooks render/behave correctly given props and state?               |
| Integration   |    12 |     — | Node test runner, in-memory Mongo        | Do services + models + middleware collaborate correctly through real internal flows? |
| API           |     9 |     — | Mocha + Chai + Supertest                 | Does the live HTTP contract (status codes, payloads, auth) hold end-to-end?          |
| E2E           |    14 |     — | Playwright (Chromium), Page Object Model | Do real user journeys work in a real browser against a real deployment?              |

**116 test files** across the four layers. Backend and frontend unit suites run with coverage in CI (`c8` / `vitest --coverage`); integration tests boot an in-memory MongoDB per file so they run with zero external dependencies; API and E2E run against a real built-and-started Next.js server.

CI enforces this pipeline in order — each stage gates the next, so a broken foundation never wastes time on the layers above it:

```
lint → audit → test-unit → test-integration → test-api → e2e
```

### QA process, not just automation

The [closed issues](../../issues?q=is%3Aissue+is%3Aclosed) in this repo are real findings from structured usability testing sessions on the live app — written as repro steps + expected/actual + severity, the format enforced by this repo's [bug report template](.github/ISSUE_TEMPLATE/bug_report.md). They cover things automated tests don't catch on their own: ambiguous form labels, a missing password-strength indicator, a crash discovered only by walking through the real signup→expense flow as a user would.

Interactive API documentation: **[`/api-docs`](https://app.norevify.com/api-docs)** (OpenAPI 3.0, generated from the actual route handlers).

---

## Features

- **Expense tracking** — log fuel, maintenance, insurance, tolls, and more; filter by category and period; recurring rules for expenses that repeat
- **Multi-vehicle** — track any number of vehicles per account (free tier: 1 vehicle)
- **Maintenance reminders** — date- and odometer-based triggers with optional recurrence; automatic status progression (`upcoming → dueSoon → overdue`); email digest via a scheduled cron job
- **Odometer tracking** — fuel entries update current km per vehicle, which drives km-based reminder status
- **Income & profit tracking** — log income per vehicle; profit, profit/day, and profit/km summaries (pro tier)
- **Tax-ready reports** — CSV/PDF exports of expenses, income, and profit summaries (pro tier)
- **Spending summaries** — category totals and trend charts by month and year
- **Billing** — Stripe Checkout + Customer Portal for self-service subscription management
- **Authentication** — email/password + Google OAuth; password recovery via email; rate limiting, account lockout, breach-password checks (HaveIBeenPwned), bot detection on auth endpoints
- **Admin panel** — internal ops view for user/plan management, gated by server-enforced roles
- **Internationalisation** — PT-BR and English; preference persisted across sessions
- **PWA** — installable on Android and iOS; displays an update toast on new deploy
- **Responsive** — fully usable at mobile widths via CSS-only layout

---

## Tech stack

| Layer                | Technologies                                                                                       |
| -------------------- | -------------------------------------------------------------------------------------------------- |
| Frontend             | Next.js 16 (App Router), React                                                                     |
| Backend              | Next.js Route Handlers, Node.js                                                                    |
| Database             | MongoDB (Mongoose)                                                                                 |
| Auth                 | JWT, Google OAuth 2.0, Bcrypt                                                                      |
| Payments             | Stripe (Checkout, Customer Portal, webhooks)                                                       |
| Email                | Resend                                                                                             |
| Internationalisation | react-i18next                                                                                      |
| Monitoring           | Sentry, PostHog                                                                                    |
| Testing              | Playwright (E2E), Vitest (frontend unit), Mocha + Supertest (API), Node test runner (backend unit) |
| CI                   | GitHub Actions                                                                                     |
| Hosting              | Vercel Fluid Compute                                                                               |

---

## Screenshots

<table>
  <tr>
    <td><img src="screenshots/dashboard.png" alt="Dashboard" width="420"/></td>
    <td><img src="screenshots/summary.png" alt="Summary" width="420"/></td>
  </tr>
  <tr>
    <td><img src="screenshots/expenses.png" alt="Expenses" width="420"/></td>
    <td><img src="screenshots/reminders.png" alt="Reminders" width="420"/></td>
  </tr>
</table>

---

## Architecture

Single-repo Next.js app — React frontend and REST API in the same codebase, deployed to Vercel Fluid Compute as a monolith. Route Handlers are the API layer; all business logic lives in `lib/services/` and is covered by the four test layers above.

---

## Quick start

**Prerequisites:** Node.js 18+, MongoDB (local or Atlas)

```bash
git clone https://github.com/rafaabc/norevify.git
cd norevify
npm install
cp .env.example .env   # fill in the required values
npm run dev            # http://localhost:3000
```

Swagger UI (API docs): `http://localhost:3000/api-docs`

### Run tests

```bash
npm run test:unit         # backend + frontend unit tests
npm run test:integration  # service-layer integration tests
npm run test:api          # API tests (requires running server)
npm run test:e2e          # Playwright E2E (requires running server)
```

### CI pipeline

```
lint → audit → test-unit → test-integration → test-api → e2e
```

---

## Author

**Rafael** — [LinkedIn](https://www.linkedin.com/in/rafael-albuquerque-qa/) · [GitHub](https://github.com/rafaabc)

---

## License

**Proprietary — all rights reserved.** See [LICENSE](LICENSE). This repository is public for portfolio review only: not open source, and **not accepting outside contributions** — see [CONTRIBUTING.md](CONTRIBUTING.md). Found a bug? [Issues](../../issues) are open. Found a vulnerability? See [SECURITY.md](SECURITY.md) instead of filing a public issue.
