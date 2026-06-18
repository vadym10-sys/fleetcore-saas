# Deployment

The repository is deploy-ready for a Docker-capable platform such as Render, Railway, Fly.io, or a Kubernetes cluster.

## Required Environment Variables

API:

```bash
DATABASE_URL=postgresql://...
JWT_SECRET=<strong-random-secret>
WEB_ORIGIN=https://your-web-domain.example
PORT=4000
```

Web:

```bash
NEXT_PUBLIC_API_URL=https://your-api-domain.example
PORT=3000
```

## Database Migration

Run migrations before starting the API:

```bash
pnpm db:migrate
```

The migration runner stores applied files in `schema_migrations`.

## Render Blueprint

`infra/render/render.yaml` defines:

- PostgreSQL database
- API Docker service
- Web Docker service

After creating the Render blueprint, set:

- `WEB_ORIGIN` on `fleetcore-api` to the deployed web URL
- `NEXT_PUBLIC_API_URL` on `fleetcore-web` to the deployed API URL

Then run `pnpm db:migrate` against the production `DATABASE_URL`.

## Local Production Check

```bash
pnpm db:migrate
pnpm build
pnpm --filter @fleetcore/api start
pnpm --filter @fleetcore/web start
```
