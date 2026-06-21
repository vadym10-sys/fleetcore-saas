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
   - `GET /version` returns the expected API service metadata and deployment commit.
   - Web login, demo login, registration, dashboard, fleet, customers, rentals, documents, and finance screens load.

## Render Deployment

The canonical Render Blueprint is in the repository root: `render.yaml`.

Expected services:

- `fleetcore-api`
- `fleetcore-web`
- `fleetcore-postgres`

Both web services have `autoDeploy: true`. If a push to `main` does not deploy a service, check that the Render service is connected to the same GitHub repository and branch.

Manual API deploy command:

```bash
RENDER_API_KEY=... \
RENDER_API_SERVICE_ID=srv_... \
RENDER_WEB_SERVICE_ID=srv_... \
pnpm deploy:render
```

Manual dashboard fallback:

1. Open Render Dashboard.
2. Open `fleetcore-api`.
3. Click `Manual Deploy`.
4. Select `Deploy latest commit`.
5. Repeat for `fleetcore-web`.

Production verification:

```bash
curl -fsS https://fleetcore-api.onrender.com/health
curl -fsS https://fleetcore-api.onrender.com/version
curl -fsS -I https://fleetcore-web.onrender.com
```

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
