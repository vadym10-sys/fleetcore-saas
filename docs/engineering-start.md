# Engineering Start

## Default Stack

- Web: Next.js, React, TypeScript.
- API: Fastify, TypeScript.
- Database: PostgreSQL.
- Cache and realtime state: Redis.
- Package manager: pnpm workspace.

## Architecture Direction

Start as a modular monolith with strong domain boundaries. Split services later only when product load, team ownership, or isolation requirements justify it.

## First Domain Boundaries

- Identity and tenancy
- Fleet inventory
- Rental lifecycle
- Customers and drivers
- GPS device state
- Finance
- Maintenance

## Immediate Next Tasks

1. Install Node.js and pnpm.
2. Add real Next.js app directory in `apps/web`.
3. Replace API placeholder with Fastify bootstrap.
4. Add database schema and migrations.
5. Add authentication and tenant context.

