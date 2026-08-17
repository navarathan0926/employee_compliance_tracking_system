# Employee Compliance Tracking System

Tracks employee compliance records (visas, certifications, background checks, training) with automated expiry detection and a reporting dashboard.

This is a **monorepo**. Each service is set up and run independently — there is no Docker Compose or root `npm install`.

| Service | Stack | Local default |
|---|---|---|
| [`backend/`](./backend/) | NestJS, TypeScript, TypeORM, MySQL | `http://localhost:3000/api` |
| [`frontend/`](./frontend/) | SvelteKit, TypeScript | `http://localhost:5173` |
| [`expiry-job/`](./expiry-job/) | Python | `python src/main.py` (manual run) |

---

## Prerequisites

- **Node.js** LTS (20+)
- **Python** 3.9+
- **MySQL** 8 running locally
- **npm** (comes with Node.js)

Optional (only if you want EventBridge/SQS locally): Docker + [LocalStack](https://app.localstack.cloud).

---

## Quick start (local)

Do these in order. The frontend and expiry job both depend on the API.

### 1. Clone and create the database

```sql
CREATE DATABASE compliance_tracking;
```

The e2e database (`compliance_tracking_e2e`) is created automatically on first `npm run test:e2e` if the MySQL user has `CREATE` privilege.

### 2. Backend

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env` and set at least:

- `DATABASE_USER` / `DATABASE_PASSWORD` / `DATABASE_NAME`
- `JWT_SECRET` (32+ characters; `openssl rand -base64 48`)
- `SEED_ADMIN_USERNAME` / `SEED_ADMIN_PASSWORD` — dashboard login
- `SEED_SERVICE_USERNAME` / `SEED_SERVICE_PASSWORD` — expiry job login

Then:

```bash
npm install
npm run migration:run
npm run seed
npm run start:dev
```

API: `http://localhost:3000/api`  
Swagger (non-production): `http://localhost:3000/api/docs`

Login with the seeded admin credentials:

```http
POST /api/auth/login
{ "username": "<SEED_ADMIN_USERNAME>", "password": "<SEED_ADMIN_PASSWORD>" }
```

### 3. Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Dashboard: `http://localhost:5173`  
Log in with the same admin user as the backend.

`PUBLIC_API_BASE_URL` in `frontend/.env` should stay `http://localhost:3000/api` for local development. The backend CORS allowlist (`CORS_ALLOWED_ORIGINS`) must include `http://localhost:5173`.

### 4. Expiry job (optional)

The job never talks to MySQL. It logs in to the API, evaluates `active`/`expiring` records, PATCHes status changes, and (optionally) publishes one EventBridge event.

```bash
cd expiry-job
pip install -r requirements.txt
cp .env.example .env
```

Set `SERVICE_ACCOUNT_USERNAME` / `SERVICE_ACCOUNT_PASSWORD` to match the backend seed service account. For expiry logic only (no AWS):

```env
SKIP_EVENT_PUBLISH=true
```

With the backend still running:

```bash
python src/main.py
```

Full LocalStack (EventBridge + SQS) steps: [`expiry-job/README.md`](./expiry-job/README.md).

---

## Run commands

### Backend (`backend/`)

| Command | Purpose |
|---|---|
| `npm run start:dev` | Dev server with watch |
| `npm run start:prod` | Production (`node dist/main` after `npm run build`) |
| `npm run migration:run` | Apply TypeORM migrations |
| `npm run seed` | Upsert admin + expiry-job users |
| `npm run test` | Unit tests |
| `npm run test:e2e` | End-to-end tests |
| `npm run lint` | ESLint |

### Frontend (`frontend/`)

| Command | Purpose |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Production static build |
| `npm run preview` | Preview the production build |
| `npm run test` | Vitest (unit) |
| `npm run lint` | Prettier + ESLint |

### Expiry job (`expiry-job/`)

| Command | Purpose |
|---|---|
| `python src/main.py` | Run the job once |
| `python -m pytest` | Tests (HTTP mocked) |
| `python scripts/bootstrap_localstack.py` | Create LocalStack bus/queue/rule |

---

## Environment files

Each service loads **its own** `.env`. Copy from the matching example — never commit real `.env` files.

| Template | Copy to |
|---|---|
| [`backend/.env.example`](./backend/.env.example) | `backend/.env` |
| [`frontend/.env.example`](./frontend/.env.example) | `frontend/.env` |
| [`expiry-job/.env.example`](./expiry-job/.env.example) | `expiry-job/.env` |
| [`.env.example`](./.env.example) | Catalog of all keys (reference only) |

---

## Demo data (Postman)

Seed creates users only, not employees or records. To load sample compliance data, import [`postman/`](./postman/) into Postman and run **Seed All Demo Data**. See [`postman/README.md`](./postman/README.md).

---

## Docs

| Doc | Contents |
|---|---|
| [`docs/architecture-decisions.md`](./docs/architecture-decisions.md) | Why NestJS / Python job / EventBridge, etc. |
| [`docs/api-doc.md`](./docs/api-doc.md) | API contract |
| [`docs/db-schema.md`](./docs/db-schema.md) | Database schema |
| [`docs/process-flow.md`](./docs/process-flow.md) | Expiry job, renewal, dashboard flows |
| [`docs/security.md`](./docs/security.md) | Auth, secrets, validation |
| [`docs/phases/README.md`](./docs/phases/README.md) | Implementation phases |
| [`infra/aws/`](./infra/aws/) | AWS deployment (RDS, EB, Lambda, Amplify) |
