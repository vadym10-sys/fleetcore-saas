import { z } from "zod";

export const loginInput = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8),
});

export const registerCompanyInput = z.object({
  company: z.object({
    country: z.string().length(2).default("US"),
    currency: z.string().length(3).default("USD"),
    fleetSizeLimit: z.number().int().positive().max(100_000).default(25),
    legalName: z.string().min(2),
    plan: z.enum(["starter", "growth", "enterprise"]).default("starter"),
    tradingName: z.string().min(2),
  }),
  owner: z.object({
    email: z.string().trim().toLowerCase().email(),
    fullName: z.string().trim().min(2),
    password: z.string().min(8),
  }),
});

export const refreshTokenInput = z.object({
  refreshToken: z.string().min(32),
});

export const logoutInput = z.object({
  refreshToken: z.string().min(32).optional(),
});

export const passwordResetRequestInput = z.object({
  email: z.string().trim().toLowerCase().email(),
});

export const passwordResetInput = z.object({
  password: z.string().min(8),
  token: z.string().min(32),
});

export const emailVerificationRequestInput = z.object({
  email: z.string().trim().toLowerCase().email().optional(),
});

export const emailVerificationInput = z.object({
  token: z.string().min(32),
});

export const profileUpdateInput = z.object({
  fullName: z.string().trim().min(2).max(120),
});

export const teamMemberInput = z.object({
  email: z.string().trim().toLowerCase().email(),
  fullName: z.string().trim().min(2).max(120),
  password: z.string().min(8),
  role: z.enum(["admin", "fleet_manager", "finance_manager", "support"]).default("fleet_manager"),
});

export const vehicleInput = z.object({
  vin: z.string().min(6),
  plateNumber: z.string().min(2),
  make: z.string().min(1),
  model: z.string().min(1),
  year: z.number().int().min(1980),
  status: z.enum(["available", "rented", "maintenance", "offline"]).default("available"),
  location: z.string().min(1),
  odometerKm: z.number().int().nonnegative().default(0),
  dailyRate: z.number().nonnegative(),
  photoUrl: z.string().url().nullable().optional(),
});

export const vehiclePatchInput = vehicleInput.partial();

export const customerInput = z.object({
  displayName: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(5),
  type: z.enum(["individual", "business"]),
  riskLevel: z.enum(["low", "medium", "high"]).default("low"),
});

export const customerPatchInput = customerInput.partial();

export const rentalInput = z.object({
  customerId: z.string().min(1),
  vehicleId: z.string().min(1),
  status: z.enum(["quote", "reserved", "active", "return_due", "closed"]).default("quote"),
  pickupAt: z.string().datetime(),
  returnAt: z.string().datetime(),
  totalAmount: z.number().nonnegative(),
  depositAmount: z.number().nonnegative(),
});

export const rentalPatchInput = rentalInput.partial();

export const invoiceInput = z.object({
  customerId: z.string().min(1),
  rentalId: z.string().min(1).optional(),
  status: z.enum(["draft", "issued", "paid", "overdue", "void"]).default("draft"),
  currency: z.string().length(3).default("USD"),
  subtotal: z.number().nonnegative(),
  tax: z.number().nonnegative(),
  dueAt: z.string().datetime(),
});

export const invoicePatchInput = invoiceInput.partial();

export const paymentInput = z.object({
  amount: z.number().positive(),
  currency: z.string().length(3).default("USD"),
  method: z.enum(["cash", "card", "bank_transfer", "stripe", "manual"]).default("manual"),
  reference: z.string().min(1).optional(),
  paidAt: z.string().datetime().default(() => new Date().toISOString()),
});

export const gpsDeviceInput = z.object({
  vehicleId: z.string().min(1),
  provider: z.enum([
    "traccar",
    "wialon",
    "navixy",
    "gpswox",
    "samsara",
    "geotab",
    "teltonika",
    "ruptela",
    "queclink",
    "concox",
    "motive",
    "fleet_complete",
    "webfleet",
    "verizon_connect",
    "api_webhook",
    "manual",
  ]).default("manual"),
  externalDeviceId: z.string().min(1),
  status: z.enum(["online", "offline", "idle"]).default("online"),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  speedKph: z.number().nonnegative().default(0),
  lastSignalAt: z.string().datetime().default(() => new Date().toISOString()),
});

export const vehicleDocumentInput = z.object({
  vehicleId: z.string().min(1),
  type: z.enum(["insurance", "registration", "inspection", "rental_contract", "other"]),
  title: z.string().min(2),
  fileUrl: z.string().url(),
  expiresAt: z.string().datetime().optional(),
});

export const rentalReturnInput = z.object({
  odometerKm: z.number().int().nonnegative(),
  finalAmount: z.number().nonnegative().optional(),
  returnedAt: z.string().datetime().default(() => new Date().toISOString()),
});

export const expenseInput = z.object({
  vehicleId: z.string().min(1).optional(),
  category: z.enum(["maintenance", "insurance", "fuel", "cleaning", "parking", "other"]).default("other"),
  amount: z.number().nonnegative(),
  currency: z.string().length(3).default("EUR"),
  spentAt: z.string().datetime().default(() => new Date().toISOString()),
  note: z.string().min(1).default("Business expense"),
});

export const serviceRecordInput = z.object({
  vehicleId: z.string().min(1),
  type: z.enum(["inspection", "oil", "repair", "tires", "other"]).default("inspection"),
  odometerKm: z.number().int().nonnegative(),
  status: z.enum(["planned", "completed"]).default("planned"),
  serviceAt: z.string().datetime().default(() => new Date().toISOString()),
  cost: z.number().nonnegative().default(0),
  note: z.string().min(1).default("Service record"),
});

export const customerDocumentInput = z.object({
  customerId: z.string().min(1),
  type: z.enum(["passport", "id_card", "driver_license", "other"]).default("passport"),
  title: z.string().min(2),
  fileUrl: z.string().url(),
  verified: z.boolean().default(false),
});

export const rentalContractInput = z.object({
  rentalId: z.string().min(1),
  documentUrl: z.string().url().default("https://example.com/fleetcore/rental-contract.pdf"),
  sentVia: z.enum(["email", "whatsapp", "manual"]).default("whatsapp"),
  status: z.enum(["draft", "sent", "viewed", "signed"]).default("sent"),
  signedAt: z.string().datetime().optional(),
});

export const publicContractSignatureInput = z.object({
  signerName: z.string().trim().min(2),
});

export const fileUploadInput = z.object({
  base64: z.string().min(1),
  mimeType: z.string().min(1).max(120).default("application/octet-stream"),
  originalName: z.string().min(1).max(255),
});
