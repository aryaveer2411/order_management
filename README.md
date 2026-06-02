# Order Management System

A full-stack inventory and order management application with a FastAPI backend and React frontend.

## Live Demo

| | URL |
|-|-----|
| Frontend | https://order-management-black.vercel.app/ |
| Backend API | https://order-management-pgl3.onrender.com |
| API Docs (Swagger) | https://order-management-pgl3.onrender.com/docs |

> The backend is hosted on Render's free tier and may take ~30 seconds to wake up on first request.

## Overview

Multi-tenant system where each user manages their own isolated set of products, customers, and orders. Key capabilities:

- JWT authentication with rotating refresh tokens stored in `HttpOnly` cookies
- Product inventory with automatic stock deduction on order creation and restoration on deletion
- Paginated listings for products, customers, and orders
- Dashboard with aggregate stats and low-stock alerts, backed by Redis cache
- Rate limiting on auth endpoints (IP-based via slowapi + per-username via Redis)
- Deadlock-safe concurrent order processing (consistent product lock ordering)

## Tech Stack

| Layer    | Technology                                 |
|----------|--------------------------------------------|
| Backend  | Python 3.11, FastAPI, SQLAlchemy 2, Pydantic v2 |
| Database | PostgreSQL 15                              |
| Cache    | Redis 7                                    |
| Frontend | React 18, Vite, Axios, React Router, Tailwind CSS |
| Auth     | JWT (HS256) + HttpOnly refresh token cookie |

## Project Structure

```
order_mgmt_system/
├── docker-compose.yml
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── seed.py                  # Seed script (50 customers, products, orders)
│   ├── app/
│   │   ├── main.py              # App entry point, CORS, rate limit handler
│   │   ├── models.py            # SQLAlchemy models
│   │   ├── schemas.py           # Pydantic request/response schemas
│   │   ├── database.py          # DB engine and session factory
│   │   ├── auth.py              # JWT utilities, refresh token rotation
│   │   ├── cache.py             # Redis helpers (get/set/delete/pattern)
│   │   ├── limiter.py           # slowapi limiter instance
│   │   └── routers/
│   │       ├── auth.py          # /auth/register, /login, /refresh, /logout
│   │       ├── products.py      # /products CRUD + Redis cache
│   │       ├── customers.py     # /customers CRUD
│   │       ├── orders.py        # /orders CRUD + stock management
│   │       └── dashboard.py     # /dashboard aggregates
│   └── tests/
│       ├── conftest.py          # pytest fixtures (SQLite in-memory, mocked Redis)
│       ├── helpers.py           # register_and_login helper
│       ├── test_auth.py         # register, login, refresh, logout, reuse detection
│       ├── test_products.py     # CRUD, pagination, SKU conflict, tenant isolation
│       ├── test_customers.py    # CRUD, pagination, email validation, tenant isolation
│       ├── test_orders.py       # stock deduction, multi-item, validation, tenant isolation
│       └── test_dashboard.py    # counts, low-stock, tenant isolation
└── frontend/
    └── src/
        ├── api/client.js        # Axios instance with auto token refresh
        ├── context/AuthContext.jsx
        ├── pages/               # Dashboard, Products, Customers, Orders, Login, Register
        └── components/          # Navbar, ProtectedLayout, Pagination, Toast
```

## Running with Docker Compose

### 1. Create a `.env` file in the project root

```env
# PostgreSQL
POSTGRES_USER=postgres
POSTGRES_PASSWORD=changeme
POSTGRES_DB=ordermgmt

# Backend
DATABASE_URL=postgresql://postgres:changeme@localhost:5432/ordermgmt
REDIS_URL=redis://localhost:6379/0
JWT_SECRET=replace-with-a-long-random-secret
ALLOWED_ORIGINS=http://localhost

# Frontend (used at build time)
VITE_API_URL=http://localhost:8000
```

> `DATABASE_URL` and `REDIS_URL` in `.env` are used for local development only. Docker Compose overrides them with internal service hostnames (`db`, `redis`) automatically.

### 2. Start all services

```bash
docker compose up --build
```

- Frontend: http://localhost
- Backend API: http://localhost:8000
- API docs (Swagger): http://localhost:8000/docs

## Local Development (without Docker)

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Set environment variables
export DATABASE_URL=postgresql://postgres:changeme@localhost:5432/ordermgmt
export REDIS_URL=redis://localhost:6379/0
export JWT_SECRET=your-secret-here

uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend
npm install
VITE_API_URL=http://localhost:8000 npm run dev
```

## Git Hook (Pre-commit Tests)

A pre-commit hook runs both backend and frontend tests before every commit. Since `.git/hooks` is not tracked by git, you need to set it up manually after cloning:

```bash
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/sh

ROOT="$(git rev-parse --show-toplevel)"

echo "Running backend tests..."
cd "$ROOT/backend" && python3 -m pytest
BACKEND_EXIT=$?

echo "Running frontend tests..."
cd "$ROOT/frontend" && npm run test:run
FRONTEND_EXIT=$?

if [ $BACKEND_EXIT -ne 0 ] || [ $FRONTEND_EXIT -ne 0 ]; then
  echo "Tests failed. Commit aborted."
  exit 1
fi

exit 0
EOF
chmod +x .git/hooks/pre-commit
```

## Testing

The backend has a full pytest suite that runs against an in-memory SQLite database with Redis mocked — no external services needed.

```bash
cd backend
pip install pytest pytest-anyio httpx
pytest tests/
```

Test infrastructure (`tests/conftest.py`):
- SQLite in-memory with `StaticPool` so all sessions share one DB
- `SELECT FOR UPDATE` patched to a no-op (SQLite doesn't support it)
- Redis replaced with `MagicMock` — no real Redis instance required
- `slowapi` rate-limit counters reset before each test

Coverage:
- **Auth**: registration, login, token refresh, logout, refresh token reuse/revocation (theft detection)
- **Products**: CRUD, pagination, duplicate SKU (409), invalid inputs (422), multi-tenant isolation
- **Customers**: CRUD, pagination, duplicate email (409), invalid email (422), multi-tenant isolation
- **Orders**: stock deduction, multi-item totals, insufficient stock, duplicate product IDs, empty items, stock restoration on delete, multi-tenant isolation
- **Dashboard**: aggregate counts, low-stock list, multi-tenant isolation

## Seeding Sample Data

With the backend running, populate 50 customers, 50 products, and 50 orders:

```bash
python backend/seed.py
```

This creates a user `seed_admin` / `SeedPass123!` and inserts all data under that account.

## API Reference

All endpoints except `/auth/register` and `/auth/login` require a `Bearer` token in the `Authorization` header.

### Auth

| Method | Path             | Description                              |
|--------|------------------|------------------------------------------|
| POST   | `/auth/register` | Create a new account                     |
| POST   | `/auth/login`    | Login; returns access token + sets `rt` cookie |
| POST   | `/auth/refresh`  | Rotate refresh token; returns new access token |
| POST   | `/auth/logout`   | Revoke refresh token and clear cookie    |

### Products

| Method | Path               | Description                                          |
|--------|--------------------|------------------------------------------------------|
| GET    | `/products`        | List products (paginated, Redis-cached)              |
| POST   | `/products`        | Create a product                                     |
| GET    | `/products/{id}`   | Get a product                                        |
| PUT    | `/products/{id}`   | Replace a product                                    |
| DELETE | `/products/{id}`   | Delete a product (409 if product has existing orders)|

### Customers

| Method | Path                | Description                                                      |
|--------|---------------------|------------------------------------------------------------------|
| GET    | `/customers`        | List customers (paginated)                                       |
| POST   | `/customers`        | Create a customer                                                |
| GET    | `/customers/{id}`   | Get a customer                                                   |
| DELETE | `/customers/{id}`   | Delete a customer (cascade-deletes orders, restores their stock) |

### Orders

| Method | Path             | Description                              |
|--------|------------------|------------------------------------------|
| GET    | `/orders`        | List orders (paginated)                  |
| POST   | `/orders`        | Create an order (deducts stock)          |
| GET    | `/orders/{id}`   | Get an order                             |
| DELETE | `/orders/{id}`   | Delete an order (restores stock)         |

### Dashboard

| Method | Path         | Description                                                               |
|--------|--------------|---------------------------------------------------------------------------|
| GET    | `/dashboard` | Totals + low-stock products + threshold (cached for 60s)                 |

### Health

| Method | Path      | Description          |
|--------|-----------|----------------------|
| GET    | `/health` | Returns `{"status": "ok"}` |

## Environment Variables

| Variable                  | Default          | Description                                      |
|---------------------------|------------------|--------------------------------------------------|
| `DATABASE_URL`            | required         | PostgreSQL connection string                     |
| `REDIS_URL`               | required         | Redis connection string                          |
| `JWT_SECRET`              | required         | Secret key for signing JWTs                      |
| `ALLOWED_ORIGINS`         | `http://localhost:5173` | Comma-separated CORS origins              |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `15`         | Access token lifetime in minutes                 |
| `REFRESH_TOKEN_EXPIRE_DAYS`   | `14`         | Refresh token lifetime in days                   |
| `LOW_STOCK_THRESHOLD`     | `10`             | Stock level that triggers a low-stock alert      |
| `DASHBOARD_CACHE_TTL`     | `60`             | Dashboard Redis cache TTL in seconds             |
| `PRODUCTS_CACHE_TTL`      | `30`             | Products list Redis cache TTL in seconds         |
| `LOGIN_RATE_LIMIT`        | `10/minute`      | IP-based rate limit for `/auth/login`            |
| `SECURE_COOKIES`          | `1`              | Set to `0` to disable `Secure` flag on cookies (local HTTP dev) |
