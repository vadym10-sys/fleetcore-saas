# Backend API

Base URL for local development: `http://localhost:4000`.

All endpoints except `/health` and `/auth/login` require either a JWT bearer token or the local development tenant header:

```http
authorization: Bearer <accessToken>
```

Local development fallback:

```http
x-tenant-id: tenant_atlas
content-type: application/json
```

Write operations are role-protected. The default seeded owner account can perform all MVP operations.

## System

### `GET /health`

Returns API health and enabled platform modules.

### `GET /readiness`

Returns deploy readiness and verifies that the API can reach PostgreSQL. Use this for Render health checks, uptime monitors, and release verification.

```json
{
  "data": {
    "ok": true,
    "checks": {
      "database": "ok",
      "migrations": "ok"
    }
  }
}
```

## Authentication

### `POST /auth/login`

Development login endpoint. It returns an HMAC-signed JWT access token.

```json
{
  "email": "founder@atlas.example",
  "password": "development-only"
}
```

Returns `accessToken`, `tenantId`, `companyId`, and `user`.

## Dashboard

### `GET /dashboard`

Returns active rentals, available vehicles, utilization, monthly revenue, and overdue invoice count.

## Companies

### `GET /companies`

Returns tenant companies.

### `GET /companies/:companyId`

Returns one company.

## Fleet

### `GET /fleet/vehicles`

Returns vehicles.

### `GET /fleet/vehicles/:vehicleId`

Returns one vehicle.

### `POST /fleet/vehicles`

Creates a vehicle.

```json
{
  "vin": "5YJYGDEE1MF000004",
  "plateNumber": "EV-4096",
  "make": "Tesla",
  "model": "Model 3",
  "year": 2025,
  "status": "available",
  "location": "Amsterdam",
  "odometerKm": 1200,
  "dailyRate": 110
}
```

### `PATCH /fleet/vehicles/:vehicleId`

Updates vehicle fields.

## Customers

### `GET /customers`

Returns customers.

### `GET /customers/:customerId`

Returns one customer.

### `POST /customers`

Creates a customer.

```json
{
  "displayName": "Nova Retail Group",
  "email": "fleet@novaretail.example",
  "phone": "+1 415 000 0101",
  "type": "business",
  "riskLevel": "low"
}
```

### `PATCH /customers/:customerId`

Updates customer fields.

## Rentals

### `GET /rentals`

Returns rental bookings.

### `GET /rentals/:rentalId`

Returns one rental.

### `POST /rentals`

Creates a rental.

```json
{
  "customerId": "cus_001",
  "vehicleId": "veh_002",
  "status": "reserved",
  "pickupAt": "2026-06-19T10:30:00.000Z",
  "returnAt": "2026-06-26T10:30:00.000Z",
  "totalAmount": 1148,
  "depositAmount": 800
}
```

### `PATCH /rentals/:rentalId`

Updates rental fields.

### `POST /rentals/:rentalId/return`

Closes an active/reserved rental and marks the vehicle as available in one transaction.

```json
{
  "odometerKm": 42100,
  "finalAmount": 826,
  "returnedAt": "2026-06-21T09:00:00.000Z"
}
```

## Finance

### `GET /finance/invoices`

Returns invoices.

### `GET /finance/invoices/:invoiceId`

Returns one invoice.

### `POST /finance/invoices`

Creates an invoice. The API calculates `total = subtotal + tax`.

```json
{
  "customerId": "cus_001",
  "rentalId": "ren_001",
  "status": "issued",
  "currency": "USD",
  "subtotal": 826,
  "tax": 165.2,
  "dueAt": "2026-06-24T23:59:59.000Z"
}
```

### `PATCH /finance/invoices/:invoiceId`

Updates invoice fields. If `subtotal` or `tax` changes, `total` is recalculated.

### `GET /finance/payments`

Returns recorded invoice payments.

### `POST /finance/invoices/:invoiceId/payments`

Creates a payment. If cumulative payments cover invoice total, the invoice becomes `paid`.

```json
{
  "amount": 991.2,
  "currency": "USD",
  "method": "manual",
  "reference": "manual-001",
  "paidAt": "2026-06-18T12:00:00.000Z"
}
```

## GPS

### `GET /gps/devices`

Returns the latest GPS device state per connected vehicle.

### `POST /gps/devices`

Creates or updates a GPS device state by provider and external device id.

```json
{
  "vehicleId": "veh_001",
  "provider": "traccar",
  "externalDeviceId": "traccar-veh-001",
  "status": "online",
  "latitude": 41.3874,
  "longitude": 2.1686,
  "speedKph": 72,
  "lastSignalAt": "2026-06-18T12:00:00.000Z"
}
```

## Documents

### `GET /documents`

Returns the unified Document Center records from the new DMS layer. Supports optional query filters: `query`, `category`, `status`, `entityType`, and `entityId`.

Example:

```http
GET /documents?entityType=vehicle&entityId=veh_001
```

### `GET /documents/vehicles`

Returns vehicle documents. Optional query: `?vehicleId=veh_001`.

### `POST /documents/vehicles`

Stores vehicle document metadata. The MVP stores file URLs; binary upload storage should be connected to S3/R2/GCS for production.

```json
{
  "vehicleId": "veh_001",
  "type": "insurance",
  "title": "Insurance certificate",
  "fileUrl": "https://example.com/insurance.pdf",
  "expiresAt": "2027-06-18T00:00:00.000Z"
}
```
