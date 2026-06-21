# Security

FleetCore currently targets a controlled B2B SaaS beta. Security is designed around tenant isolation, owner/manager access, API validation, and auditability.

## Authentication

- Email/password login.
- JWT access tokens.
- Refresh tokens stored server-side by hash.
- Logout revokes refresh tokens.
- Email verification and password reset token flows exist.
- Auth endpoints include basic rate limiting controls.

## Roles

The product intentionally keeps roles simple:

- `owner` - full company access, billing/admin/team authority.
- `manager` - operational access for fleet, rentals, customers, documents, and finance actions allowed by API policy.

## Tenant Isolation

Application repositories scope protected data by tenant and company. This is the primary B2B data boundary in the current architecture.

Hardening before enterprise launch:

- Add PostgreSQL Row Level Security.
- Add automated tenant-isolation tests for every repository method.
- Add admin audit views for access and mutation history.

## API Validation

API inputs are validated with shared schemas before repository writes. Invalid state transitions should return explicit errors instead of silently creating inconsistent business state.

## Files

The MVP supports file records and DB-backed file content. This is acceptable for product validation, but not for scale.

Production requirement:

- Move binary files to S3, Cloudflare R2, or Google Cloud Storage.
- Keep only metadata and access policy in PostgreSQL.
- Add virus scanning for passports, IDs, contracts, and vehicle documents.
- Add signed URLs with short expiry.

## Operational Security Gaps

Required before larger customers:

- Sentry or equivalent error monitoring.
- Uptime monitoring on `/health` and `/readiness`.
- Automated database backups and restore drills.
- Secrets rotation runbook.
- CSP/security headers review on web.
- Formal privacy policy, DPA, and GDPR data deletion workflow.

