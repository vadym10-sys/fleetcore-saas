# Data Model

FleetCore data is organized around a B2B tenant, one or more companies, users, and operational records.

## Core Ownership

- `tenants` - top-level SaaS workspace.
- `companies` - business operating entity inside a tenant.
- `users` - owner and manager accounts.
- `audit_logs` - important account and business events.

## Fleet

- `vehicles` - make, model, plate, VIN, status, location, odometer, rate, photo metadata.
- `gps_devices` - provider, external id, online/offline state, coordinates, speed, last signal.
- `vehicle_documents` - insurance, technical inspection, registration, service and rental-related documents.
- `service_records` - maintenance tasks, mileage, due dates, cost and status.

## Customers

- `customers` - business or individual customer profile, contact data, risk level.
- `customer_documents` - passport/ID, license, signed forms and other customer files.
- Customer profile screens should show active rentals, previous rentals, documents, payments, and assigned vehicles.

## Rentals

- `rentals` - vehicle, customer, status, pickup/return dates, total, deposit.
- `rental_contracts` - PDF/document workflow, public link, send/open/sign status.
- `rental_contract_events` - contract activity timeline for WhatsApp, Telegram, email, open and sign events.
- `rental_checklists` - pickup/return condition, fuel, mileage, damages and final handover.

## Finance

- `invoices` - invoice status, subtotal, tax, total, due date.
- `payments` - invoice payments and manual payment tracking.
- `expenses` - operational expense records by vehicle/rental/company.

## File Storage

Current MVP:

- File metadata and file content can be persisted through the API.
- Records carry ownership metadata for tenant/company/entity relation.

Production target:

- Store file bytes in object storage.
- Store metadata, access policy, expiry, and business relation in PostgreSQL.

