# Ward Civic Issue Portal

Wardline is a full-stack civic complaint management portal for a local ward. Residents can register, report civic issues, follow status history, and see administrator remarks. Ward administrators can review the complete queue, update status and priority, and leave progress notes.

## Features

- Citizen registration with development OTP verification
- JWT authentication with bcrypt password hashing
- Forgot-password flow with OTP
- Citizen dashboard and issue history
- Issue reporting with JPG/PNG image support up to 5 MB
- Search and status/category/priority/ward filtering
- Issue detail pages with status history
- Administrator dashboard with summary counts and category workload
- Admin issue management, remarks, status, priority, and delete actions
- REST API with consistent JSON responses
- In-memory models designed for later SQL replacement
- Responsive interface for desktop, tablet, and mobile

## Stack

- React, TypeScript, Vite, Wouter, TanStack Query
- Node.js, Express, TypeScript
- JWT and bcrypt
- OpenAPI-first typed client generation
- Mock/in-memory data for the initial version

## Run

From the workspace root:

```bash
pnpm install
pnpm --filter @workspace/api-server run dev
pnpm --filter @workspace/ward-civic-portal run dev
```

The project workflows start these services automatically in Replit.

## Demo accounts

These accounts are pre-seeded and OTP verified:

| Role | Email | Password |
| --- | --- | --- |
| Citizen | `citizen@example.com` | `citizen123` |
| Administrator | `admin@example.com` | `admin123` |

## Development OTP mode

New registration and password reset codes are kept in memory for five minutes, can be used once, and allow five incorrect attempts. In development mode the API logs the code using the server logger:

```text
[DEV OTP] OTP generated for resident@example.com
```

The code is intentionally not returned to the browser. A real SMS or email provider can replace the OTP service later.

## API

The shared OpenAPI contract lives at `lib/api-spec/openapi.yaml`. Generated React hooks are in `lib/api-client-react`.

### Authentication

- `POST /api/auth/register`
- `POST /api/auth/send-otp`
- `POST /api/auth/verify-otp`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`

### Issues

- `GET /api/issues`
- `POST /api/issues`
- `GET /api/issues/:id`
- `PUT /api/issues/:id`
- `PATCH /api/issues/:id/status`
- `PATCH /api/issues/:id/priority`
- `DELETE /api/issues/:id`

### Profile and dashboards

- `GET /api/users/profile`
- `PUT /api/users/profile`
- `GET /api/dashboard/citizen`
- `GET /api/dashboard/admin`

Protected endpoints use `Authorization: Bearer <token>`.

## Environment

Copy `artifacts/api-server/.env.example` when running the API outside the managed workflow. The current implementation uses `SESSION_SECRET` when available and falls back to the documented development secret only for local development.

## Future SQL integration

Controllers and routes are kept separate from the in-memory model layer. To add PostgreSQL or MySQL later, replace the in-memory collections and model operations in the API layer with repository implementations that map to:

- `users`
- `otp_verifications`
- `issues`
- `issue_status_history`

The frontend API contract and routes can remain unchanged.