# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Start production
npm start

# Start with hot reload
npm run dev

# Install dependencies
npm install
```

No test runner is configured yet (`npm test` exits with error).

## Environment

Copy `.env.example` to `.env` and fill in:

```
PORT=3000
JWT_SECRET=your-secret
JWT_EXPIRES_IN=1h
BASE_URL=http://localhost:3000
```

## Architecture

Layered Express.js REST API with **in-memory storage** (no database — data resets on restart).

```
routes → controllers → services → models
```

- **routes**: wire HTTP verbs to controller functions; `expenses.routes.js` applies `authMiddleware` globally
- **controllers**: thin try/catch wrappers that map service results to HTTP responses
- **services**: all business logic and validation; throw errors with `.status` property (picked up by controllers)
- **models**: in-memory arrays with CRUD helpers; `user.model.js` and `expense.model.js`

Error convention: `makeError(status, message)` in each service creates an `Error` with a `.status` field. Controllers read `err.status || 500`.

## Unit Tests

- Framework: Node.js native Test Runner (`node:test`) + `node:assert`
- No external test libraries (no Mocha, Jest, Chai, Supertest)
- Test files live in `test/unit/`, mirroring the source structure

### Test layers covered
- `services/` — business logic
- `models/` — data validation and in-memory store
- `middleware/` — JWT auth logic

### Scripts
- `npm run test:unit` — run all unit tests
- `npm run test:unit:coverage` — run tests with c8 code coverage (HTML report in `coverage/`)

### Conventions
- Pattern: AAA (Arrange, Act, Assert)
- Test naming: `should <behavior> when <condition>`
- In-memory store is reset via `_reset()` in `beforeEach` to guarantee test isolation (helper exported from both models)
- No HTTP/endpoint tests here — those belong to the API test layer

## API

Swagger UI at `GET /api-docs` (served from `resources/swagger.json`).

| Prefix | Auth required | Description |
|---|---|---|
| `/api/auth` | No | `POST /register`, `POST /login` |
| `/api/expenses` | Yes (Bearer JWT) | CRUD + `GET /summary` |

Auth: `Authorization: Bearer <token>` header. JWT decoded into `req.user` (`{ id, username }`).

## Expense domain rules

Valid categories: `Fuel`, `Maintenance`, `Insurance`, `Parking`, `Toll`, `Tax`, `Other`.

- **Fuel**: requires `litres` and `price_per_litre` (both positive numbers); `amount` is auto-computed as `litres * price_per_litre` (rounded to 2 decimals). Passing `amount` → 400 error.
- **Non-Fuel**: requires `amount` (positive number). Do not pass `litres` or `price_per_litre`.
- **PATCH/PUT Fuel**: `amount` is ignored in the merge — only `litres`/`price_per_litre` can change the computed amount.
- `date` must not be in the future.

`GET /api/expenses` supports `?category=`, `?year=`, `?month=` filters.  
`GET /api/expenses/summary` requires `?year=` (must not be in the future); optional `?month=` and `?category=`.

## Integration Tests

- Framework: Node.js native Test Runner (`node:test`) + `node:assert`
- No mocks, no HTTP calls — real internal collaborators only
- Test files live in `test/integration/`, organized by flow (not by source layer)

### What integration tests cover
- Service ↔ model collaboration (real in-memory store)
- Middleware → service context hand-off (decoded `req.user.id` drives real service calls)
- Multi-step internal flows: register → login → create expense → summary
- Cross-layer CRUD state consistency: create → update → delete → verify via read

### What they do NOT cover
- Isolated function logic — that's unit tests in `test/unit/`
- HTTP contracts, status codes, response bodies — that's API tests in `test/api/`

### Scripts
- `npm run test:integration` — run all integration tests
- `npm run test:integration:coverage` — run with c8 coverage report
- `npm run test:all` — run unit + integration suites together

### Conventions
- Pattern: AAA (Arrange, Act, Assert)
- Files named `<flow>.flow.test.js` under `test/integration/`
- Both in-memory stores reset via `_reset()` in `beforeEach`
- No mocking of internal modules — real implementations only

## API Tests

- Framework: Mocha + Chai + Supertest; HTML reports via Mochawesome
- **Requires a running server** — start with `npm run dev` before executing the suite
- Test files live in `test/api/`, organized by feature (auth, expenses, summary)

### Structure
- `test/api/base/api-base.js` — shared base: exports `request`, `expect`, `BASE_URL`, `CATEGORIES`, `authHeader()`, `createAndLoginUser(prefix)`
- `test/api/hooks/auth.js` — root `before` hook: registers and logs in a primary user; exports `getToken()`, `getUser()`, `uniqueUsername(prefix)`
- `test/api/fixtures/` — JSON test data per feature (data-driven testing)

### Scripts
- `npm run test:api` — run all API tests (spec reporter)
- `npm run test:api:report` — run tests and generate HTML report in `reports/`

### Conventions
- Pattern: AAA (Arrange, Act, Assert)
- Test naming: `[TC-XX-YY] should <behavior> when <condition>`
- All tests run against a live server; `BASE_URL` read from `.env` (defaults to `http://localhost:3000`)
- Root hook registers and logs in a primary user once before the suite; tests that need extra users call `createAndLoginUser(prefix)` from the base

## Frontend Unit Tests

- Framework: Jest + jsdom (`jest-environment-jsdom`), Babel transform for JSX/ESM
- React testing: `@testing-library/react` + `@testing-library/jest-dom` + `@testing-library/user-event`
- `import.meta.env` is shimmed to `process.env` via an inline Babel plugin in `babel.config.cjs`
- CSS Modules stubbed via `identity-obj-proxy`; coverage via `c8`
- Test files live in `frontend/test/`, mirroring `frontend/src/`

### Scripts (run from `frontend/`)
- `npm run test:front` — run all unit tests
- `npm run test:front:watch` — watch mode
- `npm run test:front:coverage` — c8 coverage (HTML report in `frontend/coverage/`)

### Conventions
- Pattern: AAA (Arrange, Act, Assert)
- No real HTTP calls — `global.fetch` is mocked in service tests; `apiService` is mocked at module level in component/page tests
- `localStorage` cleared in `beforeEach` via `jest.setup.js`
- Fake timers (`jest.useFakeTimers`) used for date-sensitive tests

## Frontend

Location: `frontend/` at the project root.

### Stack

- **React 18** + **Vite 5** — dev server on `:5173`, proxies `/api/*` to backend `:3000` (no CORS package needed)
- **react-router-dom v6** — client-side routing with `<ProtectedRoute>`
- **Plain CSS Modules** — scoped per component/page; global base in `src/styles/globals.css`

### Commands

```bash
cd frontend
npm install
npm run dev      # dev server on :5173
npm run build    # production build to dist/
npm run preview  # preview production build
```

### HTTP layer

All HTTP calls go through `src/services/apiService.js` — never call `fetch()` directly in components.

```js
// Auth
authApi.register({ username, password })
authApi.login({ username, password })          // returns { token }

// Expenses
expensesApi.list({ category, year, month })
expensesApi.get(id)
expensesApi.create(data)
expensesApi.update(id, data)
expensesApi.remove(id)
expensesApi.summary({ year, month, category })
```

To add a new endpoint: export a new function from `apiService.js` that calls the internal `request()` helper. Do not add `fetch()` calls elsewhere.

### Auth

- JWT stored in `localStorage` key `'token'`.
- `AuthContext` (`src/context/AuthContext.jsx`) exposes `{ token, isAuthed, username, login, logout }`.
- `username` is decoded from the JWT payload client-side — avoids a separate `/me` endpoint.
- `ProtectedRoute` (`src/routes/ProtectedRoute.jsx`) redirects to `/login` if `!isAuthed`.
- 401/403 responses clear the token and dispatch a `window` `'auth:logout'` event; `AuthContext` listens and redirects to `/login` with a "Session expired" banner.
- Register does not auto-login — on success, navigates to `/login` with `state.justRegistered`.

### Display behavior

- Expenses list (`ExpensesListPage`) sorts by `date` descending (newest first) client-side after each fetch — insertion order from the API is ignored.

### Naming conventions

- Pages: `*Page.jsx` in `src/pages/`
- Components: PascalCase in `src/components/`
- Services: `*Api` object exported from `src/services/apiService.js`
- CSS Modules: `*.module.css` co-located with the component/page
