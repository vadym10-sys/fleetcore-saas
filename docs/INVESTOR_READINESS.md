# Investor Readiness

This document summarizes FleetCore as if a buyer or investor is evaluating whether the company can become a serious vertical SaaS business.

## What Is Strong

- Clear vertical: fleet rental and operations for B2B operators.
- Real multi-tenant architecture foundation.
- Full-stack TypeScript with shared contracts.
- PostgreSQL-backed backend, not only frontend mock data.
- Core modules exist: auth, companies, fleet, customers, rentals, finance, GPS, documents, uploads, operations.
- Owner/manager role model matches the target customer.
- Public customer intake/contract flow exists as a directionally strong differentiator.
- Product language is moving toward operational workflows instead of generic dashboards.

## What Still Blocks A Premium Sale

- Billing is not yet integrated with Stripe subscriptions.
- File storage is still MVP-grade and must move to object storage.
- Monitoring and error tracking are not yet production-grade.
- Tenant isolation is application-enforced; database Row Level Security should be added before enterprise deals.
- Frontend still needs continued feature extraction from the main dashboard workspace.
- Internationalization needs full coverage for demo data, statuses, notifications, and form labels.
- Automated tests need broader coverage for every user-critical button and mobile workflow.

## Current Readiness Rating

- Product demo: strong beta.
- Small paid pilot: possible after storage, billing, and monitoring are connected.
- Enterprise sale: not ready yet.
- Acquisition-grade due diligence: needs security hardening, operating metrics, billing history, customer proof, and documented infrastructure controls.

## Highest-ROI Next Sprint

1. Stripe subscription billing and plan enforcement.
2. S3/R2/GCS file storage with signed URLs.
3. Sentry, uptime monitoring, and deploy health checks.
4. Row Level Security and tenant-isolation tests.
5. Full i18n cleanup across statuses, forms, notifications, and demo data.
6. Continue extracting `dashboard-client.tsx` into feature modules.
7. Add Playwright coverage for owner registration, login, vehicle, customer, rental, contract, document upload, payment, and mobile navigation.

