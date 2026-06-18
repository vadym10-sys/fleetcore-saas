import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { buildServer } from "./app.js";

const app = await buildServer();
let token = "";

before(async () => {
  await app.ready();
});

after(async () => {
  await app.close();
});

test("health endpoint exposes platform modules", async () => {
  const response = await app.inject({ method: "GET", url: "/health" });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().data.ok, true);
});

test("login returns a signed access token", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: { email: "founder@atlas.example", password: "development-only" },
  });

  assert.equal(response.statusCode, 200);
  token = response.json().data.accessToken;
  assert.equal(typeof token, "string");
  assert.equal(token.split(".").length, 3);
});

test("B2B company registration creates an isolated tenant account", async () => {
  const email = `owner-${Date.now()}@rental.example`;
  const response = await app.inject({
    method: "POST",
    url: "/auth/register-company",
    payload: {
      company: {
        country: "PL",
        currency: "EUR",
        fleetSizeLimit: 12,
        legalName: "Warsaw Rental Sp. z o.o.",
        plan: "starter",
        tradingName: "Warsaw Rental",
      },
      owner: {
        email,
        fullName: "Owner Warsaw",
        password: "secure-pass-123",
      },
    },
  });

  assert.equal(response.statusCode, 201);
  const session = response.json().data;
  assert.equal(session.user.email, email);
  assert.equal(session.user.role, "owner");
  assert.equal(typeof session.accessToken, "string");

  const vehicles = await app.inject({
    headers: { authorization: `Bearer ${session.accessToken}` },
    method: "GET",
    url: "/fleet/vehicles",
  });

  assert.equal(vehicles.statusCode, 200);
  assert.deepEqual(vehicles.json().data, []);
});

test("authenticated API can create an invoice payment", async () => {
  const invoices = await app.inject({
    headers: { authorization: `Bearer ${token}` },
    method: "GET",
    url: "/finance/invoices",
  });
  const invoice = invoices.json().data[0];

  const response = await app.inject({
    headers: { authorization: `Bearer ${token}` },
    method: "POST",
    payload: {
      amount: 1,
      currency: invoice.currency,
      method: "manual",
      reference: `test-${Date.now()}`,
    },
    url: `/finance/invoices/${invoice.id}/payments`,
  });

  assert.equal(response.statusCode, 201);
  assert.equal(response.json().data.invoiceId, invoice.id);
});

test("authenticated API can upsert GPS state", async () => {
  const vehicles = await app.inject({
    headers: { authorization: `Bearer ${token}` },
    method: "GET",
    url: "/fleet/vehicles",
  });
  const vehicle = vehicles.json().data[0];

  const response = await app.inject({
    headers: { authorization: `Bearer ${token}` },
    method: "POST",
    payload: {
      externalDeviceId: `test-${vehicle.id}`,
      latitude: 41.3874,
      longitude: 2.1686,
      provider: "traccar",
      speedKph: 10,
      status: "online",
      vehicleId: vehicle.id,
    },
    url: "/gps/devices",
  });

  assert.equal(response.statusCode, 201);
  assert.equal(response.json().data.vehicleId, vehicle.id);
});

test("authenticated API can manage business operations", async () => {
  const vehicles = await app.inject({
    headers: { authorization: `Bearer ${token}` },
    method: "GET",
    url: "/fleet/vehicles",
  });
  const vehicle = vehicles.json().data[0];

  const customers = await app.inject({
    headers: { authorization: `Bearer ${token}` },
    method: "GET",
    url: "/customers",
  });
  const customer = customers.json().data[0];

  const rentals = await app.inject({
    headers: { authorization: `Bearer ${token}` },
    method: "GET",
    url: "/rentals",
  });
  const rental = rentals.json().data[0];

  const expense = await app.inject({
    headers: { authorization: `Bearer ${token}` },
    method: "POST",
    payload: {
      amount: 125,
      category: "maintenance",
      currency: "EUR",
      note: "Brake inspection",
      vehicleId: vehicle.id,
    },
    url: "/operations/expenses",
  });
  assert.equal(expense.statusCode, 201);
  assert.equal(expense.json().data.vehicleId, vehicle.id);

  const service = await app.inject({
    headers: { authorization: `Bearer ${token}` },
    method: "POST",
    payload: {
      cost: 125,
      note: "Annual inspection",
      odometerKm: vehicle.odometerKm,
      status: "completed",
      type: "inspection",
      vehicleId: vehicle.id,
    },
    url: "/operations/service-records",
  });
  assert.equal(service.statusCode, 201);

  const customerDocument = await app.inject({
    headers: { authorization: `Bearer ${token}` },
    method: "POST",
    payload: {
      customerId: customer.id,
      fileUrl: "https://example.com/passport.pdf",
      title: "Passport scan",
      type: "passport",
      verified: true,
    },
    url: "/operations/customer-documents",
  });
  assert.equal(customerDocument.statusCode, 201);
  assert.equal(customerDocument.json().data.customerId, customer.id);

  const contract = await app.inject({
    headers: { authorization: `Bearer ${token}` },
    method: "POST",
    payload: {
      documentUrl: "https://example.com/contract.pdf",
      rentalId: rental.id,
      sentVia: "whatsapp",
      status: "sent",
    },
    url: "/operations/rental-contracts",
  });
  assert.equal(contract.statusCode, 201);
  assert.equal(contract.json().data.rentalId, rental.id);
});
