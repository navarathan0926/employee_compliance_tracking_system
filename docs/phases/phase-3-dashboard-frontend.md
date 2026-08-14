# Phase 3 — Dashboard Frontend (SvelteKit)

**Goal:** Login + dashboard consuming Phase 1 API.

**Done when:** User logs in, sees metrics cards and expiring-soon table with date filter.

**Depends on:** Phase 1 API (Phase 2 not required for UI, but run job once to see `expiring`/`expired` data).

---

## Prerequisites

- Phase 1 API running
- `frontend/.env` with `PUBLIC_API_BASE_URL=http://localhost:3000/api`
- CORS on backend includes frontend origin (`http://localhost:5173`)

---

## Tasks

### 3.1 Scaffold

- [ ] SvelteKit app under `frontend/`
- [ ] `src/lib/types.ts`, `src/lib/api.ts` (Bearer token on requests)

### 3.2 Auth UI

- [ ] `/login` — form → `POST /auth/login` → store JWT
- [ ] Redirect to dashboard; clear token on logout
- [ ] Handle 401 → back to login

### 3.3 Dashboard

- [ ] `GET /dashboard/metrics` → metric cards (active / expiring / expired)
- [ ] `GET /dashboard/expiring?days=30` (or custom range via `DateRangeFilter`)
- [ ] `RecordsTable` + `StatusBadge` components
- [ ] Loading and error states

### 3.4 Optional (time permitting)

- [ ] Department/type breakdown toggles
- [ ] Paginated compliance list page

### 3.5 Tests

- [ ] API client / utils tests if non-trivial logic added

---

## Commands

```bash
cd frontend
npm install
npm run dev
npm run build
```

---

## References

- `docs/api-doc.md` (dashboard response shapes)
- `AGENTS.md` frontend structure
