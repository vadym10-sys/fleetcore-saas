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
