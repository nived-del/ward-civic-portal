# Ward Civic Issue Portal

Wardline lets residents report ward-level civic issues and lets administrators manage those reports from submission through resolution.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server
- `pnpm --filter @workspace/ward-civic-portal run dev` — run the web portal
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- Data: in-memory mock models, SQL-ready boundary
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/ward-civic-portal` — responsive React/Vite frontend
- `artifacts/api-server/src/routes/civic.ts` — auth, issue, profile, and dashboard API
- `lib/api-spec/openapi.yaml` — source-of-truth API contract
- `lib/api-client-react` — generated React Query client
- `artifacts/ward-civic-portal/README.md` — product and API documentation

## Architecture decisions

- The first version intentionally uses mock/in-memory data so the complete citizen/admin workflow runs without SQL.
- The shared OpenAPI contract generates the frontend client and keeps the later SQL migration from changing the UI.
- Authentication uses the explicitly requested JWT/bcrypt flow; `SESSION_SECRET` is reused as the development signing secret when `JWT_SECRET` is absent.
- OTP values stay server-side and are only logged in development mode; the frontend never receives them.

## Product

Residents can register with OTP, sign in, report issues with optional images, search their history, and follow status updates. Administrators can review every ward report, filter the queue, update status and priority, and leave remarks.

## User preferences

- Keep the first version focused on ward-level civic issue reporting and tracking; avoid unrelated features.

## Gotchas

- The API uses in-memory collections; restarting the API resets newly registered users and newly created issues.
- Demo accounts are pre-seeded and already verified.
- Run API codegen after changing `lib/api-spec/openapi.yaml`.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
