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

test("demo login returns the seeded owner account without a password", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/auth/demo",
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().data.user.email, "founder@atlas.example");
  assert.equal(response.json().data.user.role, "owner");
  assert.equal(typeof response.json().data.accessToken, "string");
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

test("owner can update profile and add a manager account", async () => {
  const email = `team-owner-${Date.now()}@rental.example`;
  const managerEmail = `manager-${Date.now()}@rental.example`;
  const register = await app.inject({
    method: "POST",
    url: "/auth/register-company",
    payload: {
      company: {
        country: "PL",
        currency: "EUR",
        fleetSizeLimit: 16,
        legalName: "Team Rental Sp. z o.o.",
        plan: "starter",
        tradingName: "Team Rental",
      },
      owner: {
        email,
        fullName: "Team Owner",
        password: "secure-pass-123",
      },
    },
  });
  assert.equal(register.statusCode, 201);
  const ownerToken = register.json().data.accessToken;

  const profile = await app.inject({
    headers: { authorization: `Bearer ${ownerToken}` },
    method: "PATCH",
    payload: {
      fullName: "Updated Team Owner",
      photoUrl: "https://cdn.fleetcore.test/profile/team-owner.png",
    },
    url: "/auth/me",
  });
  assert.equal(profile.statusCode, 200);
  assert.equal(profile.json().data.fullName, "Updated Team Owner");
  assert.equal(profile.json().data.photoUrl, "https://cdn.fleetcore.test/profile/team-owner.png");

  const createdManager = await app.inject({
    headers: { authorization: `Bearer ${ownerToken}` },
    method: "POST",
    payload: {
      email: managerEmail,
      fullName: "Rental Manager",
      password: "manager-pass-123",
      role: "manager",
    },
    url: "/auth/team",
  });
  assert.equal(createdManager.statusCode, 201);
  assert.equal(createdManager.json().data.role, "manager");

  const team = await app.inject({
    headers: { authorization: `Bearer ${ownerToken}` },
    method: "GET",
    url: "/auth/team",
  });
  assert.equal(team.statusCode, 200);
  assert.ok(team.json().data.some((item: { email: string }) => item.email === managerEmail));

  const managerLogin = await app.inject({
    method: "POST",
    payload: { email: managerEmail, password: "manager-pass-123" },
    url: "/auth/login",
  });
  assert.equal(managerLogin.statusCode, 200);
  assert.equal(managerLogin.json().data.user.role, "manager");
});

test("owner can update company branding and billing profile", async () => {
  const companies = await app.inject({
    headers: { authorization: `Bearer ${token}` },
    method: "GET",
    url: "/companies",
  });
  assert.equal(companies.statusCode, 200);
  const company = companies.json().data[0];

  const updated = await app.inject({
    headers: { authorization: `Bearer ${token}` },
    method: "PATCH",
    payload: {
      billingEmail: "billing@atlas.example",
      brandColor: "#123abc",
      businessAddress: "Marbella HQ, Spain",
      contractFooter: "Thank you for choosing Atlas Rentals.",
      iban: "PL61109010140000071219812874",
      logoUrl: "https://example.com/logo.png",
      taxId: "PL1234567890",
      tradingName: "Atlas Premium Rentals",
    },
    url: `/companies/${company.id}`,
  });
  assert.equal(updated.statusCode, 200);
  assert.equal(updated.json().data.brandColor, "#123abc");
  assert.equal(updated.json().data.billingEmail, "billing@atlas.example");
  assert.equal(updated.json().data.logoUrl, "https://example.com/logo.png");
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

test("authenticated API can attach and remove a custom vehicle photo", async () => {
  const create = await app.inject({
    headers: { authorization: `Bearer ${token}` },
    method: "POST",
    payload: {
      dailyRate: 95,
      location: "Marbella",
      make: "Tesla",
      model: "Model Y",
      odometerKm: 2200,
      plateNumber: `PHOTO-${Date.now()}`,
      status: "available",
      vin: `VINPHOTO${Date.now()}`,
      year: 2025,
    },
    url: "/fleet/vehicles",
  });
  assert.equal(create.statusCode, 201);
  const vehicle = create.json().data;

  const withPhoto = await app.inject({
    headers: { authorization: `Bearer ${token}` },
    method: "PATCH",
    payload: { photoUrl: "https://example.com/vehicles/tesla-model-y.jpg" },
    url: `/fleet/vehicles/${vehicle.id}`,
  });
  assert.equal(withPhoto.statusCode, 200);
  assert.equal(withPhoto.json().data.photoUrl, "https://example.com/vehicles/tesla-model-y.jpg");

  const withoutPhoto = await app.inject({
    headers: { authorization: `Bearer ${token}` },
    method: "PATCH",
    payload: { photoUrl: null },
    url: `/fleet/vehicles/${vehicle.id}`,
  });
  assert.equal(withoutPhoto.statusCode, 200);
  assert.equal(withoutPhoto.json().data.photoUrl, undefined);
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

test("rental API rejects invalid dates, overlapping bookings and settlement without return act", async () => {
  const suffix = Date.now();
  const customerResponse = await app.inject({
    headers: { authorization: `Bearer ${token}` },
    method: "POST",
    payload: {
      displayName: "Validation Customer",
      email: `validation-${suffix}@rental.example`,
      phone: "+48600111222",
      riskLevel: "low",
      type: "individual",
    },
    url: "/customers",
  });
  assert.equal(customerResponse.statusCode, 201);
  const customer = customerResponse.json().data;

  const vehicleResponse = await app.inject({
    headers: { authorization: `Bearer ${token}` },
    method: "POST",
    payload: {
      dailyRate: 110,
      location: "Warsaw",
      make: "BMW",
      model: "X5",
      odometerKm: 14000,
      plateNumber: `VAL-${suffix}`,
      status: "available",
      vin: `VALIDATION${suffix}`,
      year: 2024,
    },
    url: "/fleet/vehicles",
  });
  assert.equal(vehicleResponse.statusCode, 201);
  const vehicle = vehicleResponse.json().data;
  const pickupAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
  const returnAt = new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString();

  const invalidDates = await app.inject({
    headers: { authorization: `Bearer ${token}` },
    method: "POST",
    payload: {
      customerId: customer.id,
      depositAmount: 300,
      pickupAt: returnAt,
      returnAt: pickupAt,
      status: "reserved",
      totalAmount: 600,
      vehicleId: vehicle.id,
    },
    url: "/rentals",
  });
  assert.equal(invalidDates.statusCode, 422);

  const rentalResponse = await app.inject({
    headers: { authorization: `Bearer ${token}` },
    method: "POST",
    payload: {
      customerId: customer.id,
      depositAmount: 300,
      pickupAt,
      returnAt,
      status: "reserved",
      totalAmount: 600,
      vehicleId: vehicle.id,
    },
    url: "/rentals",
  });
  assert.equal(rentalResponse.statusCode, 201);
  const rental = rentalResponse.json().data;

  const overlap = await app.inject({
    headers: { authorization: `Bearer ${token}` },
    method: "POST",
    payload: {
      customerId: customer.id,
      depositAmount: 300,
      pickupAt: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
      returnAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      status: "reserved",
      totalAmount: 700,
      vehicleId: vehicle.id,
    },
    url: "/rentals",
  });
  assert.equal(overlap.statusCode, 409);

  const settlementBlocked = await app.inject({
    headers: { authorization: `Bearer ${token}` },
    method: "POST",
    payload: {
      finalAmount: 600,
      odometerKm: vehicle.odometerKm + 100,
    },
    url: `/rentals/${rental.id}/return`,
  });
  assert.equal(settlementBlocked.statusCode, 422);

  const returnAct = await app.inject({
    headers: { authorization: `Bearer ${token}` },
    method: "POST",
    payload: {
      depositConfirmed: true,
      documentsOk: true,
      exteriorOk: true,
      fuelLevel: 75,
      interiorOk: true,
      notes: "Return validation act",
      odometerKm: vehicle.odometerKm + 100,
      phase: "return",
      photoUrls: [],
      rentalId: rental.id,
    },
    url: "/operations/rental-checklists",
  });
  assert.equal(returnAct.statusCode, 201);

  const settlement = await app.inject({
    headers: { authorization: `Bearer ${token}` },
    method: "POST",
    payload: {
      finalAmount: 600,
      odometerKm: vehicle.odometerKm + 100,
      returnedAt: returnAt,
    },
    url: `/rentals/${rental.id}/return`,
  });
  assert.equal(settlement.statusCode, 200);
  assert.equal(settlement.json().data.status, "closed");
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

  const checklist = await app.inject({
    headers: { authorization: `Bearer ${token}` },
    method: "POST",
    payload: {
      depositConfirmed: true,
      documentsOk: true,
      exteriorOk: true,
      fuelLevel: 80,
      interiorOk: true,
      notes: "Pickup checklist",
      odometerKm: vehicle.odometerKm,
      phase: "pickup",
      photoUrls: [],
      rentalId: rental.id,
    },
    url: "/operations/rental-checklists",
  });
  assert.equal(checklist.statusCode, 201);
  assert.equal(checklist.json().data.rentalId, rental.id);
  assert.equal(checklist.json().data.phase, "pickup");

  const checklists = await app.inject({
    headers: { authorization: `Bearer ${token}` },
    method: "GET",
    url: `/operations/rental-checklists?rentalId=${rental.id}`,
  });
  assert.equal(checklists.statusCode, 200);
  assert.ok(checklists.json().data.some((item: { phase: string }) => item.phase === "pickup"));

  const flow = await app.inject({
    headers: { authorization: `Bearer ${token}` },
    method: "GET",
    url: `/rentals/${rental.id}/flow`,
  });
  assert.equal(flow.statusCode, 200);
  assert.equal(flow.json().data.rental.id, rental.id);
  assert.equal(typeof flow.json().data.contractPdfUrl, "string");
  assert.ok(Array.isArray(flow.json().data.steps));

  const pdf = await app.inject({
    headers: { authorization: `Bearer ${token}` },
    method: "GET",
    url: `/rentals/${rental.id}/contract.pdf`,
  });
  assert.equal(pdf.statusCode, 200);
  assert.equal(pdf.headers["content-type"], "application/pdf");
  assert.match(pdf.body.slice(0, 8), /%PDF-1.4/);

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

  const events = await app.inject({
    headers: { authorization: `Bearer ${token}` },
    method: "GET",
    url: `/operations/rental-contract-events?contractId=${contract.json().data.id}`,
  });
  assert.equal(events.statusCode, 200);
  assert.ok(events.json().data.some((item: { eventType: string }) => item.eventType === "sent"));
  assert.ok(events.json().data.some((item: { eventType: string }) => item.eventType === "viewed"));
  assert.ok(events.json().data.some((item: { eventType: string }) => item.eventType === "signed"));
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

test("public client intake creates a customer and uploaded documents", async () => {
  const response = await app.inject({
    method: "POST",
    payload: {
      companyId: "company_atlas",
      customer: {
        displayName: "Public Intake Client",
        email: "public-intake@example.com",
        phone: "+48 600 222 333",
        type: "individual",
      },
      files: [{
        base64: Buffer.from("passport scan").toString("base64"),
        documentType: "passport",
        mimeType: "text/plain",
        originalName: "passport.txt",
        title: "Passport",
      }],
      note: "Arriving at airport",
      tenantId: "tenant_atlas",
    },
    url: "/operations/client-intake/public",
  });

  assert.equal(response.statusCode, 201);
  assert.equal(response.json().data.customer.email, "public-intake@example.com");
  assert.equal(response.json().data.documents.length, 1);
  assert.equal(response.json().data.documents[0].type, "passport");
});
