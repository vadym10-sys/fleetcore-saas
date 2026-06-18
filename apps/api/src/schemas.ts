import { z } from "zod";

export const loginInput = z.object({
  email: z.string().email().default("founder@atlas.example"),
  password: z.string().min(8).default("development-only"),
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
  provider: z.enum(["traccar", "wialon", "navixy", "gpswox", "manual"]).default("manual"),
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
