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
  assert.equal(typeof response.json().data.refreshToken, "string");
  assert.equal(typeof response.json().data.accessTokenExpiresAt, "string");
  assert.equal(token.split(".").length, 3);
});

test("refresh and logout manage SaaS sessions", async () => {
  const login = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: { email: "founder@atlas.example", password: "development-only" },
  });
  assert.equal(login.statusCode, 200);
  const refreshToken = login.json().data.refreshToken;

  const refreshed = await app.inject({
    method: "POST",
    payload: { refreshToken },
    url: "/auth/refresh",
  });
  assert.equal(refreshed.statusCode, 200);
  assert.equal(typeof refreshed.json().data.accessToken, "string");
  assert.notEqual(refreshed.json().data.refreshToken, refreshToken);

  const reused = await app.inject({
    method: "POST",
    payload: { refreshToken },
    url: "/auth/refresh",
  });
  assert.equal(reused.statusCode, 401);

  const logout = await app.inject({
    method: "POST",
    payload: { refreshToken: refreshed.json().data.refreshToken },
    url: "/auth/logout",
  });
  assert.equal(logout.statusCode, 200);

  const afterLogout = await app.inject({
    method: "POST",
    payload: { refreshToken: refreshed.json().data.refreshToken },
    url: "/auth/refresh",
  });
  assert.equal(afterLogout.statusCode, 401);
});

test("password reset and email verification tokens work", async () => {
  const email = `security-${Date.now()}@rental.example`;
  const register = await app.inject({
    method: "POST",
    url: "/auth/register-company",
    payload: {
      company: {
        country: "PL",
        currency: "EUR",
        fleetSizeLimit: 8,
        legalName: "Security Rental Sp. z o.o.",
        plan: "starter",
        tradingName: "Security Rental",
      },
      owner: {
        email,
        fullName: "Security Owner",
        password: "secure-pass-123",
      },
    },
  });
  assert.equal(register.statusCode, 201);
  const session = register.json().data;

  const verification = await app.inject({
    headers: { authorization: `Bearer ${session.accessToken}` },
    method: "POST",
    payload: { email },
    url: "/auth/request-email-verification",
  });
  assert.equal(verification.statusCode, 200);
  assert.equal(typeof verification.json().data.verificationToken, "string");

  const verified = await app.inject({
    method: "POST",
    payload: { token: verification.json().data.verificationToken },
    url: "/auth/verify-email",
  });
  assert.equal(verified.statusCode, 200);

  const resetRequest = await app.inject({
    method: "POST",
    payload: { email },
    url: "/auth/request-password-reset",
  });
  assert.equal(resetRequest.statusCode, 200);
  assert.equal(typeof resetRequest.json().data.resetToken, "string");

  const reset = await app.inject({
    method: "POST",
    payload: { password: "new-secure-pass-456", token: resetRequest.json().data.resetToken },
    url: "/auth/reset-password",
  });
  assert.equal(reset.statusCode, 200);

  const oldLogin = await app.inject({
    method: "POST",
    payload: { email, password: "secure-pass-123" },
    url: "/auth/login",
  });
  assert.equal(oldLogin.statusCode, 401);

  const newLogin = await app.inject({
    method: "POST",
    payload: { email, password: "new-secure-pass-456" },
    url: "/auth/login",
  });
  assert.equal(newLogin.statusCode, 200);
});

test("login rejects empty credentials", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: {},
  });

  assert.equal(response.statusCode, 400);
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

test("authenticated API can delete a vehicle without rental history", async () => {
  const plateNumber = `DEL-${Date.now()}`;
  const create = await app.inject({
    headers: { authorization: `Bearer ${token}` },
    method: "POST",
    payload: {
      dailyRate: 88,
      location: "Warsaw",
      make: "Audi",
      model: "A6",
      odometerKm: 1200,
      plateNumber,
      status: "available",
      vin: `VINDEL${Date.now()}`,
      year: 2024,
    },
    url: "/fleet/vehicles",
  });
  assert.equal(create.statusCode, 201);
  const vehicle = create.json().data;

  const gps = await app.inject({
    headers: { authorization: `Bearer ${token}` },
    method: "POST",
    payload: {
      externalDeviceId: `geotab-${vehicle.id}`,
      latitude: 52.2297,
      longitude: 21.0122,
      provider: "geotab",
      speedKph: 0,
      status: "idle",
      vehicleId: vehicle.id,
    },
    url: "/gps/devices",
  });
  assert.equal(gps.statusCode, 201);
  assert.equal(gps.json().data.provider, "geotab");

  const deleted = await app.inject({
    headers: { authorization: `Bearer ${token}` },
    method: "DELETE",
    url: `/fleet/vehicles/${vehicle.id}`,
  });
  assert.equal(deleted.statusCode, 200);
  assert.equal(deleted.json().data.deleted, true);

  const readDeleted = await app.inject({
    headers: { authorization: `Bearer ${token}` },
    method: "GET",
    url: `/fleet/vehicles/${vehicle.id}`,
  });
  assert.equal(readDeleted.statusCode, 404);
});

test("authenticated API stores and serves uploaded files", async () => {
  const content = "FleetCore upload smoke test";
  const upload = await app.inject({
    headers: { authorization: `Bearer ${token}`, "x-forwarded-proto": "https" },
    method: "POST",
    payload: {
      base64: Buffer.from(content).toString("base64"),
      mimeType: "text/plain",
      originalName: "smoke-document.txt",
    },
    url: "/uploads",
  });

  assert.equal(upload.statusCode, 201);
  const file = upload.json().data;
  assert.equal(file.originalName, "smoke-document.txt");
  assert.equal(file.mimeType, "text/plain");
  assert.equal(file.sizeBytes, Buffer.byteLength(content));
  assert.equal(file.storageProvider, "database");
  assert.equal(typeof file.sha256, "string");
  assert.equal(new URL(file.publicUrl).protocol, "https:");

  const list = await app.inject({
    headers: { authorization: `Bearer ${token}` },
    method: "GET",
    url: "/uploads",
  });
  assert.equal(list.statusCode, 200);
  assert.ok(list.json().data.some((item: { id: string }) => item.id === file.id));

  const metadata = await app.inject({
    headers: { authorization: `Bearer ${token}` },
    method: "GET",
    url: `/uploads/${file.id}`,
  });
  assert.equal(metadata.statusCode, 200);
  assert.equal(metadata.json().data.sha256, file.sha256);

  const download = await app.inject({
    method: "GET",
    url: new URL(file.publicUrl).pathname,
  });

  assert.equal(download.statusCode, 200);
  assert.equal(download.headers["content-type"], "text/plain");
  assert.equal(download.headers.etag, `"${file.sha256}"`);
  assert.equal(download.body, content);
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
  assert.equal(contract.json().data.status, "sent");
  assert.equal(typeof contract.json().data.publicUrl, "string");

  const publicUrl = new URL(contract.json().data.publicUrl);
  const viewed = await app.inject({
    method: "GET",
    url: `${publicUrl.pathname}${publicUrl.search}`,
  });
  assert.equal(viewed.statusCode, 200);
  assert.match(viewed.body, /Electronic signature/);

  const afterView = await app.inject({
    headers: { authorization: `Bearer ${token}` },
    method: "GET",
    url: "/operations/rental-contracts",
  });
  assert.equal(afterView.statusCode, 200);
  assert.equal(afterView.json().data.find((item: { id: string }) => item.id === contract.json().data.id).status, "viewed");

  const signed = await app.inject({
    headers: { "content-type": "application/x-www-form-urlencoded" },
    method: "POST",
    payload: "signerName=Jane%20Customer",
    url: `${publicUrl.pathname}/sign${publicUrl.search}`,
  });
  assert.equal(signed.statusCode, 200);
  assert.match(signed.body, /Signed/);

  const afterSign = await app.inject({
    headers: { authorization: `Bearer ${token}` },
    method: "GET",
    url: "/operations/rental-contracts",
  });
  assert.equal(afterSign.statusCode, 200);
  const signedContract = afterSign.json().data.find((item: { id: string }) => item.id === contract.json().data.id);
  assert.equal(signedContract.status, "signed");
  assert.equal(typeof signedContract.signedAt, "string");
});

test("owners can read company audit log", async () => {
  const response = await app.inject({
    headers: { authorization: `Bearer ${token}` },
    method: "GET",
    url: "/auth/audit-log",
  });

  assert.equal(response.statusCode, 200);
  assert.ok(Array.isArray(response.json().data));
  assert.ok(response.json().data.some((entry: { action: string }) => entry.action.startsWith("auth.")));
  assert.ok(response.json().data.some((entry: { action: string }) => entry.action === "file.uploaded"));
  assert.ok(response.json().data.some((entry: { action: string }) => entry.action === "rental.contract.signed"));
});
