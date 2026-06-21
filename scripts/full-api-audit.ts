import assert from "node:assert/strict";
import { buildServer } from "../apps/api/src/app.js";

type JsonResponse = {
  data?: unknown;
  error?: string;
};

let token = "";
let app: Awaited<ReturnType<typeof buildServer>>;

async function request<T extends JsonResponse = JsonResponse>(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  url: string,
  options: { auth?: boolean; payload?: unknown; status?: number } = {},
) {
  const response = await app.inject({
    headers: options.auth ? { authorization: `Bearer ${token}` } : undefined,
    method,
    payload: options.payload,
    url,
  });
  assert.equal(response.statusCode, options.status ?? 200, `${method} ${url}: ${response.statusCode} ${response.body}`);
  return response.json<T>();
}

async function main() {
app = await buildServer();
try {
  await app.ready();

  const suffix = Date.now();
  const login = await request<{ data: { accessToken: string } }>("POST", "/auth/login", {
    payload: { email: "founder@atlas.example", password: "development-only" },
  });
  token = login.data.accessToken;

  await request("GET", "/health");
  await request("GET", "/dashboard", { auth: true });
  await request("POST", "/auth/demo");
  await request("GET", "/fleet/vehicles", { status: 401 });
  await request("GET", "/companies", { auth: true });
  await request("GET", "/auth/team", { auth: true });
  await request("GET", "/auth/audit-log", { auth: true });

  const company = (await request<{ data: Array<{ id: string }> }>("GET", "/companies", { auth: true })).data[0];
  await request("GET", `/companies/${company.id}`, { auth: true });
  await request("PATCH", `/companies/${company.id}`, {
    auth: true,
    payload: { brandColor: "#2346d8", tradingName: "Best Rent Cars" },
  });

  const profile = await request("PATCH", "/auth/me", {
    auth: true,
    payload: { fullName: `Audit Owner ${suffix}`, photoUrl: "https://example.com/avatar.png" },
  });
  assert.ok(profile.data);

  await request("POST", "/auth/team", {
    auth: true,
    payload: {
      email: `manager-${suffix}@fleetcore.example`,
      fullName: "Audit Manager",
      password: "development-only",
      role: "manager",
    },
    status: 201,
  });

  const customer = (await request<{ data: { id: string } }>("POST", "/customers", {
    auth: true,
    payload: {
      displayName: "Audit Customer",
      email: `audit-customer-${suffix}@fleetcore.example`,
      phone: "+48600123456",
      riskLevel: "low",
      type: "individual",
    },
    status: 201,
  })).data;
  await request("GET", "/customers", { auth: true });
  await request("GET", `/customers/${customer.id}`, { auth: true });
  await request("PATCH", `/customers/${customer.id}`, { auth: true, payload: { phone: "+48600999999" } });

  const vehicle = (await request<{ data: { id: string; odometerKm: number } }>("POST", "/fleet/vehicles", {
    auth: true,
    payload: {
      dailyRate: 199,
      location: "Warsaw",
      make: "BMW",
      model: "X5",
      odometerKm: 31000,
      plateNumber: `AUD-${suffix}`,
      status: "available",
      vin: `AUDITVIN${suffix}`,
      year: 2025,
    },
    status: 201,
  })).data;
  await request("GET", `/fleet/vehicles/${vehicle.id}`, { auth: true });
  await request("PATCH", `/fleet/vehicles/${vehicle.id}`, { auth: true, payload: { status: "available" } });

  await request("POST", "/gps/devices", {
    auth: true,
    payload: {
      externalDeviceId: `gps-${suffix}`,
      latitude: 52.2297,
      longitude: 21.0122,
      provider: "manual",
      speedKph: 42,
      status: "online",
      vehicleId: vehicle.id,
    },
    status: 201,
  });
  await request("GET", "/gps/devices", { auth: true });

  await request("POST", "/documents/vehicles", {
    auth: true,
    payload: {
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      fileUrl: "https://example.com/insurance.pdf",
      title: "Insurance",
      type: "insurance",
      vehicleId: vehicle.id,
    },
    status: 201,
  });
  await request("GET", `/documents/vehicles?vehicleId=${vehicle.id}`, { auth: true });

  const upload = (await request<{ data: { id: string } }>("POST", "/uploads", {
    auth: true,
    payload: {
      base64: Buffer.from("audit-file").toString("base64"),
      mimeType: "text/plain",
      originalName: "audit.txt",
    },
    status: 201,
  })).data;
  await request("GET", "/uploads", { auth: true });
  await app.inject({ headers: { authorization: `Bearer ${token}` }, method: "GET", url: `/uploads/${upload.id}` }).then((res) => {
    assert.equal(res.statusCode, 200, `GET /uploads/${upload.id}: ${res.statusCode}`);
  });
  await app.inject({ headers: { authorization: `Bearer ${token}` }, method: "GET", url: `/uploads/${upload.id}/audit.txt` }).then((res) => {
    assert.equal(res.statusCode, 200, `GET /uploads/${upload.id}/audit.txt: ${res.statusCode}`);
  });

  const pickupAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const returnAt = new Date(Date.now() + 34 * 24 * 60 * 60 * 1000).toISOString();
  const rental = (await request<{ data: { id: string } }>("POST", "/rentals", {
    auth: true,
    payload: {
      customerId: customer.id,
      depositAmount: 500,
      pickupAt,
      returnAt,
      status: "reserved",
      totalAmount: 796,
      vehicleId: vehicle.id,
    },
    status: 201,
  })).data;
  await request("GET", "/rentals", { auth: true });
  await request("GET", `/rentals/${rental.id}`, { auth: true });
  await request("GET", `/rentals/${rental.id}/flow`, { auth: true });
  await app.inject({ headers: { authorization: `Bearer ${token}` }, method: "GET", url: `/rentals/${rental.id}/contract.pdf` }).then((res) => {
    assert.equal(res.statusCode, 200, `GET /rentals/${rental.id}/contract.pdf: ${res.statusCode}`);
    assert.equal(res.headers["content-type"], "application/pdf");
  });
  await request("PATCH", `/rentals/${rental.id}`, { auth: true, payload: { status: "active" } });

  await request("POST", "/operations/expenses", {
    auth: true,
    payload: { amount: 45, category: "cleaning", currency: "EUR", note: "Audit cleaning", vehicleId: vehicle.id },
    status: 201,
  });
  await request("GET", "/operations/expenses", { auth: true });

  await request("POST", "/operations/service-records", {
    auth: true,
    payload: { cost: 120, note: "Audit service", odometerKm: vehicle.odometerKm, status: "planned", type: "inspection", vehicleId: vehicle.id },
    status: 201,
  });
  await request("GET", `/operations/service-records?vehicleId=${vehicle.id}`, { auth: true });

  await request("POST", "/operations/customer-documents", {
    auth: true,
    payload: { customerId: customer.id, fileUrl: "https://example.com/passport.pdf", title: "Passport", type: "passport", verified: false },
    status: 201,
  });
  await request("GET", `/operations/customer-documents?customerId=${customer.id}`, { auth: true });

  await request("POST", "/operations/rental-checklists", {
    auth: true,
    payload: {
      depositConfirmed: true,
      documentsOk: true,
      exteriorOk: true,
      fuelLevel: 90,
      interiorOk: true,
      notes: "Pickup audit",
      odometerKm: vehicle.odometerKm,
      phase: "pickup",
      photoUrls: [],
      rentalId: rental.id,
    },
    status: 201,
  });
  await request("GET", `/operations/rental-checklists?rentalId=${rental.id}`, { auth: true });

  const contract = (await request<{ data: { id: string; publicUrl: string } }>("POST", "/operations/rental-contracts", {
    auth: true,
    payload: {
      documentUrl: "https://example.com/contract.pdf",
      rentalId: rental.id,
      sentVia: "whatsapp",
      status: "sent",
    },
    status: 201,
  })).data;
  await request("GET", "/operations/rental-contracts", { auth: true });
  const publicContractUrl = new URL(contract.publicUrl);
  await app.inject({ method: "GET", url: `${publicContractUrl.pathname}${publicContractUrl.search}` }).then((res) => {
    assert.equal(res.statusCode, 200, `GET public contract: ${res.statusCode}`);
  });
  await app.inject({
    headers: { "content-type": "application/x-www-form-urlencoded" },
    method: "POST",
    payload: "signerName=Audit%20Customer",
    url: `${publicContractUrl.pathname}/sign${publicContractUrl.search}`,
  }).then((res) => {
    assert.equal(res.statusCode, 200, `POST public contract sign: ${res.statusCode}`);
  });
  await request("GET", `/operations/rental-contract-events?contractId=${contract.id}`, { auth: true });

  await request("POST", "/operations/rental-checklists", {
    auth: true,
    payload: {
      depositConfirmed: true,
      documentsOk: true,
      exteriorOk: true,
      fuelLevel: 80,
      interiorOk: true,
      notes: "Return audit",
      odometerKm: vehicle.odometerKm + 200,
      phase: "return",
      photoUrls: [],
      rentalId: rental.id,
    },
    status: 201,
  });
  await request("POST", `/rentals/${rental.id}/return`, {
    auth: true,
    payload: { finalAmount: 796, odometerKm: vehicle.odometerKm + 200, returnedAt: returnAt },
  });

  const invoice = (await request<{ data: { id: string } }>("POST", "/finance/invoices", {
    auth: true,
    payload: {
      currency: "EUR",
      customerId: customer.id,
      dueAt: returnAt,
      rentalId: rental.id,
      status: "issued",
      subtotal: 796,
      tax: 0,
    },
    status: 201,
  })).data;
  await request("GET", "/finance/invoices", { auth: true });
  await request("GET", `/finance/invoices/${invoice.id}`, { auth: true });
  await request("PATCH", `/finance/invoices/${invoice.id}`, { auth: true, payload: { status: "paid" } });
  await request("POST", `/finance/invoices/${invoice.id}/payments`, {
    auth: true,
    payload: { amount: 796, currency: "EUR", method: "manual", reference: `audit-${suffix}` },
    status: 201,
  });
  await request("GET", "/finance/payments", { auth: true });

  await request("POST", "/operations/client-intake/public", {
    payload: {
      companyId: company.id,
      customer: {
        displayName: "Public Intake Audit",
        email: `public-intake-${suffix}@fleetcore.example`,
        phone: "+48600555111",
        type: "individual",
      },
      files: [{
        base64: Buffer.from("passport").toString("base64"),
        documentType: "passport",
        mimeType: "text/plain",
        originalName: "passport.txt",
        title: "Passport",
      }],
      note: "Audit public intake",
      tenantId: "tenant_atlas",
    },
    status: 201,
  });

  await request("DELETE", `/fleet/vehicles/${vehicle.id}`, { auth: true, status: 409 });

  console.log("FULL_API_AUDIT_OK");
} finally {
  await app.close();
}
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
