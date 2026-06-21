# Deployment Runbook

Use this runbook for Render or another Docker-capable host.

## Required Services

- PostgreSQL database.
- API service from `apps/api`.
- Web service from `apps/web`.

## Required Environment

API:

```bash
NODE_ENV=production
DATABASE_URL=postgresql://...
JWT_SECRET=<strong-random-secret>
WEB_ORIGIN=https://fleetcore-web.example
PORT=4000
MAX_UPLOAD_BODY_BYTES=12582912
ALLOW_DEV_TENANT_HEADER=0
```

Web:

```bash
NODE_ENV=production
NEXT_PUBLIC_API_URL=https://fleetcore-api.example
PORT=3000
```

## Release Steps

1. Pull the latest `main` commit.
2. Install dependencies with `pnpm install --frozen-lockfile`.
3. Run `pnpm db:migrate` against production `DATABASE_URL`.
4. Build with `pnpm build`.
5. Start API and web services.
6. Verify:
   - `GET /health` returns `200`.
   - `GET /readiness` returns `200` and `database: ok`.
   - Web login, demo login, registration, dashboard, fleet, customers, rentals, documents, and finance screens load.

## Rollback

1. Roll back the web service to the previous successful deploy.
2. Roll back the API service to the previous successful deploy.
3. If a migration introduced irreversible schema changes, restore from the latest verified backup.

## Monitoring

Minimum production checks:

- Uptime monitor: `/health`.
- Readiness monitor: `/readiness`.
- API error rate.
- Web client error rate.
- Database connection count.
- Slow query log.

