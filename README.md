# FleetCore SaaS

FleetCore SaaS is the production codebase for a multi-tenant fleet, rental, GPS, customer, and finance platform.

## Repository Layout

- `apps/web` - customer-facing SaaS web application.
- `apps/api` - backend API and domain services.
- `packages/shared` - shared TypeScript types, constants, and domain contracts.
- `packages/config` - shared linting, TypeScript, and build configuration.
- `infra` - local infrastructure, Docker, deployment, and environment templates.
- `docs` - product, architecture, and engineering decisions.
- `scripts` - developer automation.

## First Build Target

The first MVP should include:

- tenant-aware authentication and organization setup;
- fleet inventory;
- rental booking lifecycle;
- customer records;
- finance primitives for invoices, deposits, and payments;
- GPS device state and alert ingestion foundation.

## Local Development

```bash
pnpm install
pnpm db:up
pnpm db:migrate
pnpm dev:api
```

The backend uses PostgreSQL through the API repository layer. Startup seed data is inserted idempotently when the API boots.

## MVP API Surface

- `POST /auth/login`
- `GET /dashboard`
- `GET /companies`
- `GET /companies/:companyId`
- `GET /fleet/vehicles`
- `GET /fleet/vehicles/:vehicleId`
- `POST /fleet/vehicles`
- `PATCH /fleet/vehicles/:vehicleId`
- `GET /customers`
- `GET /customers/:customerId`
- `POST /customers`
- `PATCH /customers/:customerId`
- `GET /rentals`
- `GET /rentals/:rentalId`
- `POST /rentals`
- `PATCH /rentals/:rentalId`
- `POST /rentals/:rentalId/return`
- `GET /finance/invoices`
- `GET /finance/invoices/:invoiceId`
- `POST /finance/invoices`
- `PATCH /finance/invoices/:invoiceId`
- `GET /finance/payments`
- `POST /finance/invoices/:invoiceId/payments`
- `GET /gps/devices`
- `POST /gps/devices`
- `GET /documents/vehicles`
- `POST /documents/vehicles`

All non-auth MVP endpoints accept `authorization: Bearer <accessToken>`. Local development also accepts `x-tenant-id: tenant_atlas`.

See [docs/backend-api.md](./docs/backend-api.md) for payload examples.
See [docs/deployment.md](./docs/deployment.md) for Docker and Render deployment notes.

## Due Diligence Docs

- [Architecture](./docs/ARCHITECTURE.md)
- [Security](./docs/SECURITY.md)
- [Data Model](./docs/DATA_MODEL.md)
- [Deployment Runbook](./docs/DEPLOYMENT_RUNBOOK.md)
- [Investor Readiness](./docs/INVESTOR_READINESS.md)
