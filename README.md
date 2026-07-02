[![CI](https://github.com/rafaabc/norevify/actions/workflows/ci.yml/badge.svg)](https://github.com/rafaabc/norevify/actions/workflows/ci.yml)

# Norevify

**Live:** https://app.norevify.com

A full-stack vehicle expense tracker — built to practise and demonstrate production-grade Next.js development, covering the full stack from database modelling to E2E testing and CI/CD.

---

## Features

- **Expense tracking** — log fuel, maintenance, insurance, tolls, and more; filter by category and period
- **Maintenance reminders** — date- and odometer-based triggers with optional recurrence; automatic status progression (`upcoming → dueSoon → overdue`)
- **Odometer tracking** — fuel entries update current km, which drives km-based reminder status
- **Spending summaries** — category totals and trend charts by month and year
- **Authentication** — email/password + Google OAuth; password recovery via email
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

Single-repo Next.js app — React frontend and REST API in the same codebase, deployed to Vercel Fluid Compute as a monolith. Route Handlers are the API layer; all business logic lives in `lib/services/` and is covered by four test layers: backend unit → integration → API → E2E.

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

Proprietary. All rights reserved — see [LICENSE](LICENSE).
