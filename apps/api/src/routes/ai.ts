import type { FastifyPluginAsync } from "fastify";
import type { FleetDocument, GpsDevice, Invoice, Payment, Rental, Vehicle, Customer } from "@fleetcore/shared";
import {
  listCustomers,
  listFleetDocuments,
  listGpsDevices,
  listInvoices,
  listPayments,
  listRentals,
  listVehicles,
} from "../db/repositories.js";
import { getTenantScope } from "../lib/access-control.js";
import { envelope } from "../lib/http.js";
import { aiSearchInput } from "../schemas.js";

type AiSearchKind = "customer" | "document" | "finance" | "gps" | "rental" | "vehicle";

type AiSearchItem = {
  id: string;
  kind: AiSearchKind;
  label: string;
  meta: string;
  score: number;
  customerId?: string;
  documentId?: string;
  invoiceId?: string;
  paymentId?: string;
  rentalId?: string;
  section: "Bookings" | "Drivers/Clients" | "Finance" | "GPS" | "Service" | "Vehicles";
  vehicleId?: string;
};

type OpenAiSearchPlan = {
  intent?: string;
  terms?: string[];
};

function tokenize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}@+.-]+/gu, " ")
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length >= 2)
    .slice(0, 12);
}

function uniqTerms(terms: string[]) {
  return Array.from(new Set(terms.map((term) => term.toLowerCase().trim()).filter(Boolean))).slice(0, 16);
}

function scoreText(text: string, terms: string[]) {
  const normalized = text.toLowerCase();
  const compact = normalized.replace(/\s+/g, "");
  return terms.reduce((score, term) => {
    if (!term) return score;
    const compactTerm = term.replace(/\s+/g, "");
    if (normalized === term || compact === compactTerm) return score + 10;
    if (normalized.includes(term)) return score + 5;
    if (compact.includes(compactTerm)) return score + 4;
    return score;
  }, 0);
}

function buildVehicleText(vehicle: Vehicle) {
  return [
    vehicle.id,
    vehicle.plateNumber,
    vehicle.vin,
    vehicle.make,
    vehicle.model,
    vehicle.year,
    vehicle.status,
    vehicle.location,
    vehicle.dailyRate,
    vehicle.odometerKm,
  ].join(" ");
}

function buildCustomerText(customer: Customer) {
  return [customer.id, customer.displayName, customer.email, customer.phone, customer.type, customer.riskLevel].join(" ");
}

function buildRentalText(rental: Rental, vehicle?: Vehicle, customer?: Customer, invoice?: Invoice) {
  return [
    rental.id,
    rental.status,
    rental.pickupAt,
    rental.returnAt,
    rental.totalAmount,
    rental.depositAmount,
    vehicle ? buildVehicleText(vehicle) : "",
    customer ? buildCustomerText(customer) : "",
    invoice?.status,
    invoice?.invoiceNumber,
    invoice?.total,
  ].join(" ");
}

function buildDocumentText(document: FleetDocument) {
  return [
    document.id,
    document.title,
    document.category,
    document.type,
    document.status,
    document.documentNumber,
    document.tags.join(" "),
    document.links.map((link) => `${link.entityType} ${link.entityId}`).join(" "),
  ].join(" ");
}

function buildFinanceText(invoice: Invoice, payment: Payment | undefined, customer?: Customer) {
  return [
    invoice.id,
    invoice.invoiceNumber,
    invoice.status,
    invoice.currency,
    invoice.total,
    invoice.dueAt,
    customer ? buildCustomerText(customer) : "",
    payment?.id,
    payment?.method,
    payment?.reference,
    payment?.amount,
  ].join(" ");
}

function buildGpsText(device: GpsDevice, vehicle?: Vehicle) {
  return [
    device.id,
    device.provider,
    device.externalDeviceId,
    device.status,
    device.speedKph,
    device.lastSignalAt,
    vehicle ? buildVehicleText(vehicle) : "",
  ].join(" ");
}

async function createSearchPlan(query: string): Promise<OpenAiSearchPlan> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { intent: "local", terms: tokenize(query) };

  const response = await fetch("https://api.openai.com/v1/responses", {
    body: JSON.stringify({
      input: [
        {
          content: [
            {
              text: `Extract concise FleetCore SaaS search terms from this user request. Return only JSON with keys "intent" and "terms". Query: ${query}`,
              type: "input_text",
            },
          ],
          role: "user",
        },
      ],
      max_output_tokens: 180,
      model: process.env.OPENAI_SEARCH_MODEL ?? "gpt-4.1-mini",
    }),
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) return { intent: "local", terms: tokenize(query) };
  const payload = await response.json() as { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }> };
  const text = payload.output_text ?? payload.output?.flatMap((item) => item.content ?? []).map((item) => item.text ?? "").join("\n") ?? "";
  try {
    const parsed = JSON.parse(text) as OpenAiSearchPlan;
    return {
      intent: typeof parsed.intent === "string" ? parsed.intent : "ai_search",
      terms: Array.isArray(parsed.terms) ? uniqTerms([...tokenize(query), ...parsed.terms.filter((term): term is string => typeof term === "string")]) : tokenize(query),
    };
  } catch {
    return { intent: "ai_search", terms: tokenize(`${query} ${text}`) };
  }
}

export const aiRoutes: FastifyPluginAsync = async (app) => {
  app.post("/ai/search", async (request, reply) => {
    const parsed = aiSearchInput.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid AI search payload", issues: parsed.error.flatten() });
    }

    const scope = getTenantScope(request);
    const [vehicles, customers, rentals, invoices, payments, documents, gpsDevices] = await Promise.all([
      listVehicles(scope),
      listCustomers(scope),
      listRentals(scope),
      listInvoices(scope),
      listPayments(scope),
      listFleetDocuments(scope),
      listGpsDevices(scope),
    ]);
    const plan = await createSearchPlan(parsed.data.query);
    const terms = uniqTerms([...(plan.terms ?? []), ...tokenize(parsed.data.query)]);

    const items: AiSearchItem[] = [
      ...vehicles.map((vehicle) => ({
        id: `vehicle-${vehicle.id}`,
        kind: "vehicle" as const,
        label: `${vehicle.make} ${vehicle.model}`,
        meta: `${vehicle.plateNumber} · VIN ${vehicle.vin} · ${vehicle.status}`,
        score: scoreText(buildVehicleText(vehicle), terms),
        section: "Vehicles" as const,
        vehicleId: vehicle.id,
      })),
      ...customers.map((customer) => ({
        customerId: customer.id,
        id: `customer-${customer.id}`,
        kind: "customer" as const,
        label: customer.displayName,
        meta: `${customer.phone} · ${customer.email}`,
        score: scoreText(buildCustomerText(customer), terms),
        section: "Drivers/Clients" as const,
      })),
      ...rentals.map((rental) => {
        const vehicle = vehicles.find((item) => item.id === rental.vehicleId);
        const customer = customers.find((item) => item.id === rental.customerId);
        const invoice = invoices.find((item) => item.rentalId === rental.id);
        return {
          ...(customer?.id ? { customerId: customer.id } : {}),
          id: `rental-${rental.id}`,
          kind: "rental" as const,
          label: `${customer?.displayName ?? "Клиент"} · ${vehicle?.plateNumber ?? "без номера"}`,
          meta: `${rental.status} · ${vehicle?.make ?? "Авто"} ${vehicle?.model ?? ""} · ${rental.totalAmount} · депозит ${rental.depositAmount}`,
          rentalId: rental.id,
          score: scoreText(buildRentalText(rental, vehicle, customer, invoice), terms),
          section: "Bookings" as const,
          ...(vehicle?.id ? { vehicleId: vehicle.id } : {}),
        };
      }),
      ...documents.map((document) => ({
        documentId: document.id,
        id: `document-${document.id}`,
        kind: "document" as const,
        label: document.title,
        meta: `${document.category} · ${document.status}${document.expiresAt ? ` · ${document.expiresAt.slice(0, 10)}` : ""}`,
        score: scoreText(buildDocumentText(document), terms),
        section: "Service" as const,
      })),
      ...invoices.map((invoice) => {
        const customer = customers.find((item) => item.id === invoice.customerId);
        const payment = payments.find((item) => item.invoiceId === invoice.id);
        return {
          ...(customer?.id ? { customerId: customer.id } : {}),
          id: `finance-${invoice.id}`,
          invoiceId: invoice.id,
          kind: "finance" as const,
          label: `${invoice.invoiceNumber} · ${invoice.status}`,
          meta: `${customer?.displayName ?? "Клиент"} · ${invoice.total} ${invoice.currency} · due ${invoice.dueAt.slice(0, 10)}`,
          ...(payment?.id ? { paymentId: payment.id } : {}),
          score: scoreText(buildFinanceText(invoice, payment, customer), terms),
          section: "Finance" as const,
        };
      }),
      ...gpsDevices.map((device) => {
        const vehicle = vehicles.find((item) => item.id === device.vehicleId);
        return {
          id: `gps-${device.id}`,
          kind: "gps" as const,
          label: `${vehicle?.plateNumber ?? "GPS"} · ${device.provider}`,
          meta: `${device.status} · ${device.speedKph} km/h · ${device.lastSignalAt.slice(0, 16)}`,
          score: scoreText(buildGpsText(device, vehicle), terms),
          section: "GPS" as const,
          ...(vehicle?.id ? { vehicleId: vehicle.id } : {}),
        };
      }),
    ];

    const results = items
      .filter((item) => item.score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, 12);

    return envelope({
      mode: process.env.OPENAI_API_KEY ? "openai" : "local",
      query: parsed.data.query,
      summary: results.length
        ? `Найдено ${results.length}. Я понял запрос как: ${terms.slice(0, 5).join(", ")}.`
        : `Ничего не найдено по запросу: ${parsed.data.query}`,
      terms,
      intent: plan.intent ?? "search",
      results,
    });
  });
};
