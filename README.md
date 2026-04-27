# Drive Ledger

> REST API for tracking vehicle expenses by category, with JWT authentication and spending summaries.

## Description

Drive Ledger is a Node.js/Express REST API that lets users log and analyze vehicle-related expenses such as fuel, maintenance, insurance, and tolls. Each user manages their own expense records in an isolated context. Data is stored in-memory, so it resets on server restart — no database setup required.

## Dependencies

- **Node.js** v18 or higher

No external services or databases are required.

## Technologies Used

| Package | Version | Purpose |
|---|---|---|
| express | ^5.2.1 | HTTP framework |
| jsonwebtoken | ^9.0.3 | JWT generation and verification |
| bcryptjs | ^3.0.3 | Password hashing |
| dotenv | ^17.4.2 | Environment variable loading |
| swagger-ui-express | ^5.0.1 | Interactive API documentation |
| nodemon | ^3.1.14 | Dev server with hot reload |

## Installation and Setup

1. Clone the repository:

```bash
git clone https://github.com/rafaabc/drive-ledger.git
cd drive-ledger
```

2. Install dependencies:

```bash
npm install
```

3. Create the environment file:

```bash
cp .env.example .env
```

4. Fill in the required environment variables:

| Variable | Description | Example |
|---|---|---|
| `PORT` | Port the server listens on | `3000` |
| `JWT_SECRET` | Secret key used to sign JWTs | `supersecretkey` |
| `JWT_EXPIRES_IN` | Token expiry duration | `1h` |
| `BASE_URL` | Base URL for the API test suite | `http://localhost:3000` |

5. Start the server:

```bash
# Production
npm start

# Development (hot reload)
npm run dev
```

The API will be available at `http://localhost:3000`.  
Interactive API docs (Swagger UI) are available at `http://localhost:3000/api-docs`.

## Features

### Authentication

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | No | Register a new user |
| POST | `/api/auth/login` | No | Login and receive a JWT |

All requests to `/api/expenses/*` require the header:

```
Authorization: Bearer <token>
```

### Expenses

| Method | Path | Description |
|---|---|---|
| GET | `/api/expenses` | List expenses (supports `?category`, `?year`, `?month` filters) |
| POST | `/api/expenses` | Create a new expense |
| GET | `/api/expenses/:id` | Get a single expense by ID |
| PUT | `/api/expenses/:id` | Update an expense |
| DELETE | `/api/expenses/:id` | Delete an expense |
| GET | `/api/expenses/summary` | Totals by category for a period (`?year` required; `?month`, `?category` optional) |

### Expense Categories and Validation Rules

Valid categories: `Fuel`, `Maintenance`, `Insurance`, `Parking`, `Toll`, `Tax`, `Other`.

- **Fuel**: provide `litres` and `price_per_litre` (both positive numbers). `amount` is auto-calculated as `litres x price_per_litre` (rounded to 2 decimals). Do not pass `amount`.
- **Non-Fuel**: provide `amount` (positive number). Do not pass `litres` or `price_per_litre`.
- `date` must not be in the future.

## File Structure

```
drive-ledger/
├── src/
│   ├── app.js                        # Express app setup and middleware
│   ├── server.js                     # Entry point — starts the HTTP server
│   ├── routes/
│   │   ├── auth.routes.js            # /api/auth endpoints
│   │   └── expenses.routes.js        # /api/expenses endpoints (auth middleware applied globally)
│   ├── controllers/
│   │   ├── auth.controller.js        # Maps auth service results to HTTP responses
│   │   └── expenses.controller.js    # Maps expense service results to HTTP responses
│   ├── services/
│   │   ├── auth.service.js           # Registration, login, password hashing logic
│   │   └── expenses.service.js       # Expense validation, CRUD, summary calculation
│   ├── models/
│   │   ├── user.model.js             # In-memory user store with CRUD helpers
│   │   └── expense.model.js          # In-memory expense store with CRUD helpers
│   └── middleware/
│       └── auth.middleware.js        # JWT verification middleware
├── test/
│   ├── unit/                         # Native Node.js test runner — isolated function tests
│   ├── integration/                  # Native Node.js test runner — cross-layer flow tests
│   └── api/
│       ├── base/
│       │   └── api-base.js           # Shared base: request, expect, BASE_URL, authHeader(), createAndLoginUser()
│       ├── hooks/
│       │   └── auth.js               # Root before hook — registers and logs in primary user
│       ├── fixtures/                 # JSON test data (auth, expenses, summary)
│       ├── auth/                     # US-01 and US-02 API tests
│       ├── expenses/                 # US-03 API tests
│       └── summary/                  # US-04 API tests
├── resources/
│   └── swagger.json                  # OpenAPI 3.0 spec for Swagger UI
├── .env.example                      # Environment variable template
├── .mocharc.js                       # Mocha configuration for API tests
├── package.json
└── CLAUDE.md
```

## Testing

### Unit Tests

Unit tests validate isolated functions and business rules in the `services`, `models`, and `middleware` layers using the native Node.js Test Runner — no external libraries required.

### Test Structure

```
test/
└── unit/
    ├── services/   # Business logic tests (auth + expenses)
    ├── models/     # In-memory store CRUD tests
    └── middleware/ # JWT auth middleware logic tests
```

### Running Tests

```bash
npm run test:unit
```

### Code Coverage

```bash
npm run test:unit:coverage
```

An HTML report will be generated in the `coverage/` directory.

### Integration Tests

Integration tests validate how multiple internal layers collaborate — how a service uses the model, how middleware context flows into service logic, and how multi-step operations maintain consistency. They use real implementations with no mocks and no HTTP calls.

#### Test Structure

```
test/
└── integration/
    ├── auth/       # Auth flow: register → login → token validity + no-lockout
    ├── expenses/   # Expense flow: create → list → update → delete → summary
    └── middleware/ # Middleware hand-off: token enforcement → req.user → service
```

#### Running Integration Tests

```bash
npm run test:integration
```

#### Code Coverage

```bash
npm run test:integration:coverage
```

#### Running All Tests

```bash
npm run test:all
```

### API Tests

API tests validate HTTP contracts — status codes, response bodies, and header assertions — against a live running server. They use Mocha, Chai, and Supertest, and cover all 53 test conditions from US-01 to US-04.

#### Requirements

The API server must be running before executing the suite:

```bash
npm run dev
```

#### Test Structure

```
test/api/
├── base/
│   └── api-base.js   # Shared: request, expect, BASE_URL, CATEGORIES, authHeader(), createAndLoginUser()
├── hooks/
│   └── auth.js       # Root before hook — registers and logs in a primary user once for the suite
├── fixtures/         # JSON test data for data-driven tests
├── auth/             # US-01 (Registration) + US-02 (Login) tests
├── expenses/         # US-03 (Expense CRUD) tests
└── summary/          # US-04 (Summary by period) tests
```

#### Running API Tests

```bash
npm run test:api
```

#### HTML Report

```bash
npm run test:api:report
```

Generates an HTML report in the `reports/` directory.

## Frontend

A React single-page application that consumes the Drive Ledger API.

### Stack

| Package | Version | Purpose |
|---|---|---|
| react | ^18.3.1 | UI framework |
| react-dom | ^18.3.1 | DOM renderer |
| react-router-dom | ^6.26.2 | Client-side routing |
| vite | ^5.4.8 | Dev server and bundler |

### Setup

> The backend must be running on port 3000 before starting the frontend.

```bash
# Terminal A — backend
npm run dev

# Terminal B — frontend
cd frontend
npm install
npm run dev
```

The UI will be available at **http://localhost:5173**.

Vite proxies all `/api/*` requests to `http://localhost:3000` — no CORS configuration required.

### Environment

Copy `frontend/.env.example` to `frontend/.env` if you need to override the API base URL:

```
VITE_API_BASE_URL=/api
```

### Pages

| Route | Description |
|---|---|
| `/login` | Sign in with username and password |
| `/register` | Create a new account |
| `/expenses` | List all expenses with category/year/month filters; sorted by date descending |
| `/expenses/new` | Create a new expense |
| `/expenses/:id` | View a single expense |
| `/expenses/:id/edit` | Edit an existing expense |
| `/summary` | View spending totals by category for a given period |

## Frontend Unit Tests

### Objective

Validate isolated frontend logic — services, utilities, context, components, and pages — without hitting real APIs or starting a server.

### Stack

- **Jest** + **jsdom** — test runner and DOM simulation
- **@testing-library/react** — component rendering and queries
- **c8** — code coverage (HTML report)

### Directory Structure

```
frontend/test/
├── services/       # apiService fetch/auth/CRUD tests
├── utils/          # formatDate, decodeJwt, categories
├── context/        # AuthContext state and event handling
├── routes/         # ProtectedRoute auth redirect
├── components/     # AmountField, CategorySelect, DateField, ErrorBanner,
│                   # ExpenseRow, FuelFields, Loading, Navbar
└── pages/          # LoginPage, RegisterPage, ExpensesListPage,
                    # ExpenseDetailPage, ExpenseFormPage, SummaryPage, NotFoundPage
```

### Running Tests (from `frontend/`)

```bash
npm run test:front
npm run test:front:coverage
```

## E2E Tests

End-to-end tests drive a real Chromium browser through the full stack — React frontend (Vite) + Express backend — covering all four user stories (US-01 to US-04).

### Stack

- **Playwright Test** — browser automation and test runner
- **Page Object Model** — one class per page/feature, no assertions inside POMs
- **APIRequestContext** — direct API calls for setup (register + seed expenses) without going through the UI

### Requirements

Both servers must be running before executing the suite:

```bash
# Terminal A — backend (port 3000)
npm run dev

# Terminal B — frontend (port 5173)
cd frontend
npm run dev
```

### Directory Structure

```
frontend/e2e/
├── fixtures/
│   ├── api.ts          # createAndLoginUser(), createExpenseViaApi() helpers
│   └── test-data.ts    # CATEGORIES list, date helpers (todayISO, tomorrowISO, currentYear)
├── pages/
│   ├── BasePage.ts
│   ├── LoginPage.ts
│   ├── RegisterPage.ts
│   ├── ExpensesListPage.ts
│   ├── ExpenseFormPage.ts
│   ├── ExpenseDetailPage.ts
│   └── SummaryPage.ts
└── tests/
    ├── auth/
    │   ├── register.spec.ts       # US-01: registration happy path + validation
    │   ├── login.spec.ts          # US-02: login, wrong credentials, protected routes
    │   └── logout-session.spec.ts # US-02: logout flow + expired token redirect
    ├── expenses/
    │   ├── create-expense.spec.ts     # US-03: create (all categories, Fuel auto-calc, validation)
    │   ├── view-edit-expense.spec.ts  # US-03: detail view + edit + non-existent ID error
    │   ├── delete-expense.spec.ts     # US-03: delete with confirm modal
    │   ├── filter-expenses.spec.ts    # US-03: category/year/month filters + empty state
    │   └── cross-user-isolation.spec.ts # US-03: users cannot access each other's expenses
    └── summary/
        └── summary.spec.ts        # US-04: totals, monthly rows, category filter, empty states
```

### Running Tests (from `frontend/`)

```bash
# Headless (default)
npm run test:e2e

# Headed — watch the browser
npm run test:e2e:headed

# Interactive Playwright UI
npm run test:e2e:ui

# Open the last HTML report
npm run test:e2e:report
```

### Design Notes

| Decision | Reason |
|---|---|
| `workers: 1`, `fullyParallel: false` | In-memory backend has no isolation between concurrent requests — sequential execution prevents cross-test state corruption |
| Fresh user per spec file | Each spec calls `createAndLoginUser()` in `beforeAll`; shared user within a file accumulates state, but files never collide |
| JWT injected via `page.addInitScript()` | Faster than UI login; decouples auth tests from CRUD tests |
| Vite dev server (not production build) | Dev server's `/api/*` proxy routes requests to the backend — production builds do not include this proxy |
| TC-04-06 skipped | SummaryPage uses a single `<select>` for category; multi-category filter is not implemented in the UI (wiki marks this "E2E — pending UI implementation") |

### Skipped Scenarios

| TC | Reason |
|---|---|
| TC-04-06 | Multi-category summary filter not implemented in the UI — single `<select>` only. Enable once a multi-select widget is added. |

## Author

[rafaabc](https://github.com/rafaabc)

## License

ISC
