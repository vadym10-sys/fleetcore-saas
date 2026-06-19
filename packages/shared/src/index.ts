export const platformModules = [
  "identity",
  "companies",
  "fleet",
  "rentals",
  "customers",
  "gps",
  "finance",
  "maintenance",
] as const;

export type PlatformModule = (typeof platformModules)[number];

export type TenantId = string;

export interface TenantScopedEntity {
  id: string;
  tenantId: TenantId;
  createdAt: string;
  updatedAt: string;
}

export type UserRole = "owner" | "admin" | "fleet_manager" | "finance_manager" | "support";

export interface User extends TenantScopedEntity {
  email: string;
  fullName: string;
  role: UserRole;
  companyId: string;
}

export interface Company extends TenantScopedEntity {
  legalName: string;
  tradingName: string;
  country: string;
  currency: string;
  plan: "starter" | "growth" | "enterprise";
  fleetSizeLimit: number;
}

export type VehicleStatus = "available" | "rented" | "maintenance" | "offline";

export interface Vehicle extends TenantScopedEntity {
  companyId: string;
  vin: string;
  plateNumber: string;
  make: string;
  model: string;
  year: number;
  status: VehicleStatus;
  location: string;
  odometerKm: number;
  dailyRate: number;
}

export type RentalStatus = "quote" | "reserved" | "active" | "return_due" | "closed";

export interface Customer extends TenantScopedEntity {
  companyId: string;
  displayName: string;
  email: string;
  phone: string;
  type: "individual" | "business";
  riskLevel: "low" | "medium" | "high";
}

export interface Rental extends TenantScopedEntity {
  companyId: string;
  customerId: string;
  vehicleId: string;
  status: RentalStatus;
  pickupAt: string;
  returnAt: string;
  totalAmount: number;
  depositAmount: number;
}

export type InvoiceStatus = "draft" | "issued" | "paid" | "overdue" | "void";

export interface Invoice extends TenantScopedEntity {
  companyId: string;
  customerId: string;
  rentalId?: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  currency: string;
  subtotal: number;
  tax: number;
  total: number;
  dueAt: string;
}

export type PaymentMethod = "cash" | "card" | "bank_transfer" | "stripe" | "manual";

export interface Payment extends TenantScopedEntity {
  companyId: string;
  invoiceId: string;
  customerId: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
  reference?: string;
  paidAt: string;
}

export type GpsProvider =
  | "traccar"
  | "wialon"
  | "navixy"
  | "gpswox"
  | "samsara"
  | "geotab"
  | "teltonika"
  | "ruptela"
  | "queclink"
  | "concox"
  | "motive"
  | "fleet_complete"
  | "webfleet"
  | "verizon_connect"
  | "api_webhook"
  | "manual";
export type GpsDeviceStatus = "online" | "offline" | "idle";

export interface GpsDevice extends TenantScopedEntity {
  companyId: string;
  vehicleId: string;
  provider: GpsProvider;
  externalDeviceId: string;
  status: GpsDeviceStatus;
  latitude: number;
  longitude: number;
  speedKph: number;
  lastSignalAt: string;
}

export type VehicleDocumentType = "insurance" | "registration" | "inspection" | "rental_contract" | "other";

export interface VehicleDocument extends TenantScopedEntity {
  companyId: string;
  vehicleId: string;
  type: VehicleDocumentType;
  title: string;
  fileUrl: string;
  expiresAt?: string;
}

export type ExpenseCategory = "maintenance" | "insurance" | "fuel" | "cleaning" | "parking" | "other";

export interface Expense extends TenantScopedEntity {
  companyId: string;
  vehicleId?: string;
  category: ExpenseCategory;
  amount: number;
  currency: string;
  spentAt: string;
  note: string;
}

export interface ServiceRecord extends TenantScopedEntity {
  companyId: string;
  vehicleId: string;
  type: "inspection" | "oil" | "repair" | "tires" | "other";
  odometerKm: number;
  status: "planned" | "completed";
  serviceAt: string;
  cost: number;
  note: string;
}

export interface CustomerDocument extends TenantScopedEntity {
  companyId: string;
  customerId: string;
  type: "passport" | "id_card" | "driver_license" | "other";
  title: string;
  fileUrl: string;
  verified: boolean;
}

export interface RentalContract extends TenantScopedEntity {
  companyId: string;
  rentalId: string;
  customerId: string;
  status: "draft" | "sent" | "signed";
  documentUrl: string;
  sentVia: "email" | "whatsapp" | "manual";
  signedAt?: string;
}

export interface FileObject extends TenantScopedEntity {
  companyId: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  publicUrl: string;
}

export interface DashboardMetrics {
  activeRentals: number;
  availableVehicles: number;
  fleetUtilization: number;
  monthlyRevenue: number;
  overdueInvoices: number;
}

export interface AuthSession {
  accessToken: string;
  accessTokenExpiresAt: string;
  tenantId: TenantId;
  companyId: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
  user: User;
}

export interface ApiEnvelope<T> {
  data: T;
}
