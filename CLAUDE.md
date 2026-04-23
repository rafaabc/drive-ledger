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

## API

Swagger UI at `GET /api-docs` (served from `resources/swagger.json`).

| Prefix | Auth required | Description |
|---|---|---|
| `/api/auth` | No | `POST /register`, `POST /login` |
| `/api/expenses` | Yes (Bearer JWT) | CRUD + `GET /summary` |

Auth: `Authorization: Bearer <token>` header. JWT decoded into `req.user` (`{ id, username }`).

## Expense domain rules

Valid categories: `Fuel`, `Maintenance`, `Insurance`, `Parking`, `Toll`, `Tax`, `Other`.

- **Fuel**: requires `litres` and `price_per_litre` (both positive numbers); `amount` is auto-computed as `litres * price_per_litre` (rounded to 2 decimals). Do not pass `amount`.
- **Non-Fuel**: requires `amount` (positive number). Do not pass `litres` or `price_per_litre`.
- `date` must not be in the future.

`GET /api/expenses` supports `?category=`, `?year=`, `?month=` filters.  
`GET /api/expenses/summary` requires `?year=`; optional `?month=` and `?category=`.
