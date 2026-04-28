[![unit/integration/api/e2e-tests](https://github.com/rafaabc/drive-ledger/actions/workflows/qa.yml/badge.svg)](https://github.com/rafaabc/drive-ledger/actions/workflows/qa.yml)

# Drive Ledger

> Full-stack vehicle expense manager — Node.js/Express REST API with a React SPA, JWT authentication, and spending summaries by period.

> https://github.com/user-attachments/assets/aa83e4c7-adfd-422d-8088-3656878346d4

 

## Description

Drive Ledger is a full-stack vehicle expense management application. The backend is a Node.js/Express REST API that lets users log and analyze expenses by category (fuel, maintenance, insurance, tolls, and more), with JWT-based authentication and user isolation. The frontend is a React SPA (Vite) that consumes the API. Data is stored in-memory — no database setup required.

## Dependencies

- **Node.js** v18 or higher

No external services or databases are required.

## Technologies Used

**Backend**

| Package | Version | Purpose |
|---|---|---|
| express | ^5.2.1 | HTTP framework |
| jsonwebtoken | ^9.0.3 | JWT auth |
| bcryptjs | ^3.0.3 | Password hashing |
| dotenv | ^17.4.2 | Environment variables |
| swagger-ui-express | ^5.0.1 | API docs |

**Frontend**

| Package | Version | Purpose |
|---|---|---|
| react | ^18.3.1 | UI framework |
| react-router-dom | ^6.26.2 | Client-side routing |
| vite | ^5.4.8 | Dev server and bundler |

## Installation and Setup

1. Clone and install:

```bash
git clone https://github.com/rafaabc/drive-ledger.git
cd drive-ledger
npm install
```

2. Create the environment file:

```bash
cp .env.example .env
```

| Variable | Description | Example |
|---|---|---|
| `PORT` | Server port | `3000` |
| `JWT_SECRET` | JWT signing key | `supersecretkey` |
| `JWT_EXPIRES_IN` | Token expiry | `1h` |
| `BASE_URL` | Base URL for API tests | `http://localhost:3000` |

3. Start the backend:

```bash
npm run dev   # development (hot reload)
npm start     # production
```

4. Install and start the frontend:

```bash
cd frontend
npm install
npm run dev   # available at http://localhost:5173
```

> The backend must be running on port 3000 before starting the frontend. Vite proxies `/api/*` to port 3000 automatically.

## Features

### API Endpoints

**Auth** — no JWT required

| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/register` | Register a new user |
| POST | `/api/auth/login` | Login and receive a JWT |

**Expenses** — `Authorization: Bearer <token>` required

| Method | Path | Description |
|---|---|---|
| GET | `/api/expenses` | List expenses (`?category`, `?year`, `?month`) |
| POST | `/api/expenses` | Create an expense |
| GET | `/api/expenses/:id` | Get an expense |
| PUT | `/api/expenses/:id` | Update an expense |
| DELETE | `/api/expenses/:id` | Delete an expense |
| GET | `/api/expenses/summary` | Totals by category (`?year` required) |

Swagger UI available at `http://localhost:3000/api-docs`. For validation rules, see [Expense Domain Rules](https://github.com/rafaabc/drive-ledger/wiki/03-%E2%80%90-Expense-Domain-Rules) in the wiki.

### Test Commands

| Command | Scope | Runner |
|---|---|---|
| `npm run test:unit` | Unit — services, models, middleware | Node.js native |
| `npm run test:integration` | Integration — cross-layer flows | Node.js native |
| `npm run test:backend` | Unit + integration | Node.js native |
| `npm run test:api` | API contracts (server must be running) | Mocha + Supertest |
| `npm run test:api:report` | API tests + HTML report in `reports/` | Mochawesome |
| `cd frontend && npm run test:front` | Frontend unit tests | Jest + Testing Library |
| `cd frontend && npm run test:e2e` | E2E (both servers must be running) | Playwright |

## File Structure

```
drive-ledger/
├── frontend/
│   ├── src/             # React app source
│   ├── test/            # Frontend unit tests
│   └── e2e/             # Playwright E2E tests
├── src/
│   ├── routes/          # HTTP route definitions
│   ├── controllers/     # HTTP response mapping
│   ├── services/        # Business logic and validation
│   ├── models/          # In-memory data stores
│   ├── middleware/       # JWT auth middleware
│   ├── app.js           # Express app setup
│   └── server.js        # Entry point
├── test/
│   ├── unit/            # Isolated function tests
│   ├── integration/     # Cross-layer flow tests
│   └── api/             # HTTP contract tests
├── resources/
│   └── swagger.json     # OpenAPI 3.0 spec
└── .env.example
```

## Author

[rafaabc](https://github.com/rafaabc)

## License

MIT
