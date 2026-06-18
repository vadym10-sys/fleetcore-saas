# MVP Product Plan

## Goal

Ship the first usable SaaS version for fleet and rental operators: authentication, companies, fleet, rentals, customers, and finance in one tenant-aware operating console.

## MVP Modules

### Authentication

- Email/password login.
- Tenant and company context attached to every request.
- Initial roles: owner, admin, fleet manager, finance manager, support.

### Companies

- Organization profile.
- Plan and fleet limits.
- Country and currency settings.

### Fleet

- Vehicle list.
- Vehicle creation.
- Status tracking: available, rented, maintenance, offline.
- Location, odometer, and daily rate.

### Rentals

- Booking creation.
- Lifecycle: quote, reserved, active, return due, closed.
- Customer and vehicle assignment.
- Deposit and total rental amount.

### Customers

- Business and individual customer profiles.
- Risk level.
- Contact details.

### Finance

- Invoice list.
- Invoice creation.
- Status: draft, issued, paid, overdue, void.
- Tax and total calculation.

## Current Implementation State

- Shared TypeScript domain contracts exist in `packages/shared`.
- Fastify API skeleton exists in `apps/api`.
- Next.js app shell exists in `apps/web`.
- PostgreSQL persistence is wired through API repositories.
- Startup seed data is inserted idempotently into PostgreSQL.
- Auth is a development stub until credential storage, sessions, and RBAC are implemented.

## Next Development Sprint

1. Install Node.js and pnpm.
2. Add real login, password hashing, JWT/session validation, and RBAC middleware.
3. Connect the web app to the API through a typed client.
4. Add create/edit forms for vehicles, customers, rentals, and invoices.
5. Add tests for tenant isolation and finance calculations.
6. Add GPS device, position, and alert persistence.
7. Add deployment, CI, backups, and observability.
