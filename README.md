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

Copy `.env.example` to `.env` for local development or Render environment setup.

## Production Environment Validation

FleetCore supports two runtime modes:

- **Pilot mode**: `PRODUCTION=false` or unset. Missing Stripe, email, WhatsApp, Telegram, S3, monitoring and legal-doc variables do not block startup. `/status` reports them as `missing`.
- **Commercial production mode**: `PRODUCTION=true`. The API validates required production variables at startup and exits before serving traffic when anything critical is missing.

Required when `PRODUCTION=true`:

- Core: `DATABASE_URL`, `JWT_SECRET`, `WEB_ORIGIN`, `API_PUBLIC_URL`
- Stripe: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_GROWTH`, `STRIPE_PRICE_ENTERPRISE`
- Email: `RESEND_API_KEY` or `SMTP_URL`
- WhatsApp: `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`
- Telegram: `TELEGRAM_BOT_TOKEN`
- Object storage: `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`
- Monitoring: `SENTRY_DSN`, `MONITORING_DSN` or `UPTIME_MONITOR_URL`
- Legal/GDPR: `PRIVACY_POLICY_URL`, `TERMS_URL`, `GDPR_DOCS_URL`

Use `https://fleetcore-web.onrender.com/status` or `GET /status` on the API to see each integration as `connected`, `missing` or `test_mode`.

### Transactional Email

FleetCore sends notifications through one delivery service with `email`, `whatsapp`, and `telegram` channels.

Global notification controls:

- `NOTIFICATION_MODE=mock` records delivery rows without external sending.
- `NOTIFICATION_MODE=live` allows provider adapters to send when credentials exist.
- `NOTIFICATION_RETRY_ATTEMPTS=2` retries failed provider calls before marking delivery as failed.
- `NOTIFICATION_TEST_MODE=true` suppresses external delivery.
- `NOTIFICATION_SEND_IN_TEST=true` explicitly allows external sends during tests.

Email provider selection:

- `EMAIL_PROVIDER=resend` uses `RESEND_API_KEY`.
- `EMAIL_PROVIDER=smtp` uses `SMTP_URL`.
- `EMAIL_PROVIDER=log` records delivery rows without sending external email.

Messaging provider adapters:

- WhatsApp uses Meta WhatsApp Cloud API with `WHATSAPP_ACCESS_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID`.
- Telegram uses Bot API with `TELEGRAM_BOT_TOKEN`; recipient must be a Telegram `chat_id`.

Supported transactional emails:

- welcome email after company registration;
- password reset link;
- email verification / magic link;
- payment success after verified Stripe webhook;
- payment failed after verified Stripe webhook;
- admin notification from `POST /delivery/messages`.

Safety defaults:

- `NODE_ENV=test` and `EMAIL_TEST_MODE=true` suppress external delivery.
- `NODE_ENV=test` and `NOTIFICATION_TEST_MODE=true` suppress WhatsApp and Telegram delivery.
- Set `EMAIL_SEND_IN_TEST=true` only when you intentionally want a test run to send real emails.
- Delivery errors are logged by the API and stored on `delivery_messages.error`.

### Stripe Checkout and Webhooks

FleetCore creates Stripe Checkout Sessions on `POST /billing/checkout`, but does not grant paid-plan access during checkout creation. Plan access is synchronized only after a verified Stripe webhook confirms payment or an active subscription event.

Local webhook test:

```bash
stripe listen --forward-to localhost:4000/billing/stripe/webhook
```

Copy the `whsec_...` value printed by Stripe CLI into `STRIPE_WEBHOOK_SECRET`, then trigger events from Stripe CLI or Stripe Dashboard. Failed payments move the subscription to `past_due`; duplicate webhook events are ignored by Stripe event id.

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
- [Information Architecture](./docs/INFORMATION_ARCHITECTURE.md)
- [Deployment Runbook](./docs/DEPLOYMENT_RUNBOOK.md)
- [Investor Readiness](./docs/INVESTOR_READINESS.md)
