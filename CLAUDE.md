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
