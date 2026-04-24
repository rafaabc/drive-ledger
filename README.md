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
├── resources/
│   └── swagger.json                  # OpenAPI 3.0 spec for Swagger UI
├── .env.example                      # Environment variable template
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

## Author

[rafaabc](https://github.com/rafaabc)

## License

ISC
