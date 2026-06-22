# FleetCore QA Functional Readiness

Date: 2026-06-22
Scope: Web app, API, database-backed endpoints, auth, rentals, documents, uploads, mobile smoke.

## Verification Run

| Check | Result |
| --- | --- |
| `pnpm lint` | Pass |
| `pnpm --filter @fleetcore/web test` | Pass, 5/5 |
| `pnpm --filter @fleetcore/web build` | Pass |
| `pnpm --filter @fleetcore/api build` | Pass |
| `pnpm --filter @fleetcore/api test` | Pass, 23/23 |
| `pnpm exec playwright test` | Pass, 6 passed / 6 expected skipped |

## Scores

| Area | Score | Status | Why |
| --- | ---: | --- | --- |
| Authentication | 8/10 | Strong | Login, demo, registration, refresh, logout, email verification and password reset are covered by API tests. Needs real email provider verification in production. |
| Multi-tenant data isolation | 8/10 | Strong | API rejects unauthenticated tenant fallback and registration creates isolated tenant data. Needs broader cross-tenant negative tests for every module. |
| Backend API | 8/10 | Strong | Core endpoints for fleet, rentals, finance, GPS, uploads, documents and operations pass integration tests. Needs API contract docs/OpenAPI and rate limits. |
| Database integrity | 7/10 | Good | Rental overlap, invalid dates, overpayments and return settlement rules are tested. Needs more constraints for document-folder ownership and stronger migration rollback checks. |
| Rental flow | 8/10 | Strong | E2E creates a rental, enables send actions, closes return and finds rental in global search. Needs more edge cases: partial payment, damage on return, deposit refund. |
| Documents and uploads | 7/10 | Good | Uploads are stored and served by API; contracts and public signing are tested. Dashboard folders currently store folder structure in browser storage, not PostgreSQL. |
| Dashboard folders | 6/10 | Usable but needs hardening | Users can create folders, add notes, upload files and open file links. Weak point: folders/notes are localStorage, so they are not shared across managers/devices yet. |
| Frontend buttons/forms | 8/10 | Strong | Static tests reject inert buttons/forms; E2E covers primary create actions and section navigation. Needs broader per-section CRUD E2E. |
| Mobile UX | 7/10 | Good | Mobile demo login and drawer navigation pass. Needs full mobile CRUD coverage for rental, files and forms. |
| Search and AI search | 7/10 | Good | Global search and AI search are covered. Needs production OpenAI key behavior, voice permission fallback and result-ranking tests. |
| Finance | 7/10 | Good | Invoice creation and overpayment rejection are tested. Needs deposit lifecycle and refund accounting E2E. |
| GPS/maps | 6/10 | Partial | GPS state API and UI entry point are covered. Needs provider integration tests and map rendering checks with real Google/Apple map configuration. |
| Calendly | 6/10 | Partial | UI uses Calendly and old calendar is removed. Needs real webhook/API sync from Calendly reservations into rentals. |
| Design system consistency | 7/10 | Good | Buttons, cards, modals and mobile shell are mostly consistent. Needs component extraction from monolithic dashboard file. |
| Performance | 6/10 | Needs work | Web build is healthy, first load JS is acceptable for MVP. Needs lazy loading, bundle analysis and dashboard component split. |
| Monitoring/observability | 5/10 | Weak | API logs exist. Needs frontend error tracking, production alerting, uptime checks and deploy health gates. |
| CI/CD release safety | 6/10 | Needs work | Manual test/deploy process works. Needs GitHub Actions gate for lint, build, API tests and Playwright before deploy. |

## Overall Score

FleetCore functional readiness: **7.1/10**.

The product is usable as an MVP demo and early pilot SaaS. The biggest gap is not button wiring anymore; it is persistence, production-grade workflows and automated release gates.

## Highest Priority Weak Points

1. Move dashboard folders and folder notes from `localStorage` to PostgreSQL.
   - Value: folders become shared across owner/manager, laptop/phone, and remain after browser reset.
   - Impact: high.

2. Add full CRUD E2E per module.
   - Vehicles: create, edit, upload photo, delete/blocked delete.
   - Customers: create, assign vehicle, upload ID, open profile.
   - Rentals: create, send, pay, return, close, search.
   - Documents: upload, preview, filter, attach to vehicle/customer/rental.
   - Finance: payment, overpayment rejection, deposit refund.

3. Add CI quality gate before deployment.
   - Required commands: lint, web test, web build, api build, api test, Playwright.
   - Deploy only after all green.

4. Add production monitoring.
   - Frontend error tracking.
   - API error alerts.
   - Render deploy health verification.
   - Database connection and migration alerts.

5. Replace mock/external placeholders with real provider integrations.
   - Calendly reservation sync.
   - WhatsApp Business API.
   - Email provider.
   - Telegram bot/API.
   - Google Maps production key verification.

## What Is Working Now

- Demo login and account entry.
- Main desktop navigation.
- Mobile drawer navigation.
- Global search.
- AI search fallback without OpenAI key.
- Create action sheet.
- Rental workflow create/send/close path.
- API auth/session lifecycle.
- B2B company registration.
- Owner profile/team manager API.
- Company branding API.
- Vehicle create/delete/photo API.
- Customer create API.
- Upload storage and file serving.
- Rental validation and return settlement guards.
- Contracts, public signing and contract events.
- Payments and overpayment prevention.
- GPS device upsert.
- Public client intake.
- Audit log access.

## What Still Needs Manual Product QA

- Test on real iPhone Safari and Android Chrome.
- Upload large PDF/photo files in production.
- Test files from dashboard folders across refresh, logout and another device.
- Test real WhatsApp/Telegram/email send paths when providers are connected.
- Test real Calendly booking-to-rental sync after webhook integration.
- Test Google Maps key limits and rendering in production.
- Test slow network and Render cold start behavior.

## Recommended Next Engineering Sprint

1. Build backend tables and API for dashboard folders.
2. Add Playwright E2E for folder create, note add, file upload and file open.
3. Add GitHub Actions CI for all QA commands.
4. Add production health check script after Render deploy.
5. Add frontend error boundary and user-facing error states for failed uploads/actions.

