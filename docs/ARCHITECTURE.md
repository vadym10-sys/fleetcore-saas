# Architecture

FleetCore is a multi-tenant B2B SaaS for rental operations, fleet management, customer CRM, GPS state, documents, finance, and operational workflows.

## System Shape

- `apps/web` - Next.js web application for owners and managers.
- `apps/api` - Fastify API with PostgreSQL-backed domain repositories.
- `packages/shared` - shared TypeScript contracts used by web and API.
- `infra/postgres/migrations` - ordered PostgreSQL schema migrations.
- `infra/render/render.yaml` - Render blueprint for database, API, and web services.

## Runtime Flow

1. A company owner registers or signs in.
2. The API resolves the authenticated user, role, tenant, and company.
3. All protected repository queries are scoped by `tenant_id` and `company_id`.
4. The web app consumes typed API responses and renders the operational workspace.
5. Documents, rentals, vehicles, customers, invoices, payments, GPS devices, and audit events stay under the company tenant boundary.

## Multi-Tenancy

FleetCore uses row-level tenant separation in application repositories:

- `tenants` own the customer workspace.
- `companies` sit under a tenant.
- `users` belong to a tenant and company.
- Business entities include `tenant_id`, and most operational entities also include `company_id`.

Production hardening recommendation: add database-level Row Level Security before enterprise rollout.

## Backend Modules

- Auth: register, login, refresh, logout, email verification, password reset, profile update, team members.
- Fleet: vehicles, status, photos, document metadata, GPS state.
- Customers: customer CRM, customer documents, customer-to-vehicle assignment.
- Rentals: booking lifecycle, return flow, contracts, checklist, public intake/contract links.
- Finance: invoices, payments, expenses, deposits and operational money flows.
- Operations: alerts, tasks, service records, documents, audit activity.
- Uploads: file metadata and DB-backed file content for MVP.

## Current Production Posture

FleetCore is suitable for controlled beta usage. Before selling as a high-trust enterprise product, the next infrastructure upgrades should be object storage, managed backups, monitoring, billing, and stronger database isolation.

