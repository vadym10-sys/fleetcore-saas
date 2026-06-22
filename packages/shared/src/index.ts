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

export type UserRole = "owner" | "manager";

export interface User extends TenantScopedEntity {
  email: string;
  fullName: string;
  role: UserRole;
  companyId: string;
  photoUrl?: string;
}

export interface Company extends TenantScopedEntity {
  legalName: string;
  tradingName: string;
  country: string;
  currency: string;
  plan: "starter" | "growth" | "enterprise";
  fleetSizeLimit: number;
  logoUrl?: string;
  brandColor: string;
  billingEmail?: string;
  taxId?: string;
  iban?: string;
  businessAddress?: string;
  contractFooter?: string;
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
  photoUrl?: string;
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

export type DocumentCategory =
  | "customer_identity"
  | "vehicle_compliance"
  | "rental_contract"
  | "rental_handover"
  | "payment"
  | "damage"
  | "service"
  | "company"
  | "other";

export type DocumentStatus = "draft" | "pending_review" | "valid" | "expired" | "rejected" | "archived";

export type DocumentSource = "upload" | "generated" | "client_intake" | "contract_flow" | "system";

export interface DocumentLink {
  entityId: string;
  entityType: "customer" | "vehicle" | "rental" | "contract" | "invoice" | "payment" | "damage" | "service_record" | "company";
  relationType: string;
}

export interface FleetDocument extends TenantScopedEntity {
  companyId: string;
  category: DocumentCategory;
  currentVersionId?: string;
  documentNumber?: string;
  expiresAt?: string;
  issuedAt?: string;
  links: DocumentLink[];
  metadata: Record<string, unknown>;
  source: DocumentSource;
  status: DocumentStatus;
  tags: string[];
  title: string;
  type: string;
  verifiedAt?: string;
}

export interface RentalContract extends TenantScopedEntity {
  companyId: string;
  rentalId: string;
  customerId: string;
  status: "draft" | "sent" | "viewed" | "signed";
  documentUrl: string;
  publicUrl?: string;
  sentVia: "email" | "telegram" | "whatsapp" | "manual";
  sentAt?: string;
  viewedAt?: string;
  signedAt?: string;
}

export interface RentalContractEvent {
  id: string;
  tenantId: TenantId;
  companyId: string;
  contractId: string;
  rentalId: string;
  customerId: string;
  eventType: "created" | "sent" | "viewed" | "signed";
  channel: "email" | "telegram" | "whatsapp" | "manual" | "public_link";
  actorLabel?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface RentalChecklist {
  id: string;
  tenantId: TenantId;
  companyId: string;
  rentalId: string;
  vehicleId: string;
  customerId: string;
  phase: "pickup" | "return";
  odometerKm: number;
  fuelLevel: number;
  exteriorOk: boolean;
  interiorOk: boolean;
  documentsOk: boolean;
  depositConfirmed: boolean;
  notes: string;
  photoUrls: string[];
  createdAt: string;
  updatedAt: string;
}

export type RentalFlowStepKey = "booking" | "contract" | "payment" | "pickup" | "activeRental" | "return" | "deposit" | "closed";
export type RentalFlowStepStatus = "done" | "current" | "blocked" | "pending";

export interface RentalFlowStep {
  key: RentalFlowStepKey;
  label: string;
  status: RentalFlowStepStatus;
  detail: string;
  actionLabel?: string;
}

export interface RentalFlow {
  rental: Rental;
  customer: Customer;
  vehicle: Vehicle;
  contract?: RentalContract;
  invoice?: Invoice;
  paidAmount: number;
  checklists: RentalChecklist[];
  contractPdfUrl: string;
  nextAction?: RentalFlowStep;
  steps: RentalFlowStep[];
}

export interface FileObject extends TenantScopedEntity {
  companyId: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  storageProvider: "database" | "s3";
  storageKey?: string;
  sha256?: string;
  publicUrl: string;
}

export interface DashboardFolderFile {
  addedAt: string;
  file: FileObject;
  id: string;
}

export interface DashboardFolderNote {
  createdAt: string;
  id: string;
  text: string;
  updatedAt: string;
}

export interface DashboardFolder extends TenantScopedEntity {
  companyId: string;
  files: DashboardFolderFile[];
  name: string;
  notes: DashboardFolderNote[];
}

export type SubscriptionStatus = "trialing" | "active" | "past_due" | "canceled" | "incomplete";

export interface Subscription extends TenantScopedEntity {
  cancelAt?: string;
  companyId: string;
  currentPeriodEnd?: string;
  currentPeriodStart?: string;
  externalCustomerId?: string;
  externalSubscriptionId?: string;
  plan: Company["plan"];
  provider: "manual" | "stripe";
  status: SubscriptionStatus;
}

export interface BillingCheckoutSession {
  checkoutUrl?: string;
  mode: "manual" | "stripe";
  message: string;
  subscription: Subscription;
}

export type DeliveryChannel = "email" | "telegram" | "whatsapp";
export type DeliveryStatus = "queued" | "sent" | "failed";

export interface DeliveryMessage extends TenantScopedEntity {
  channel: DeliveryChannel;
  companyId: string;
  entityId?: string;
  entityType: "rental" | "contract" | "client_intake" | "system";
  error?: string;
  recipient: string;
  sentAt?: string;
  status: DeliveryStatus;
  subject?: string;
}

export interface ComplianceExport {
  auditLogs: Array<Record<string, unknown>>;
  company: Company;
  customers: Customer[];
  dashboardFolders: DashboardFolder[];
  documents: FleetDocument[];
  files: FileObject[];
  generatedAt: string;
  invoices: Invoice[];
  payments: Payment[];
  rentals: Rental[];
  serviceRecords: ServiceRecord[];
  teamUsers: User[];
  vehicles: Vehicle[];
}

export interface SystemStatus {
  checks: {
    database: "ok" | "error";
    migrations: "ok" | "unknown";
    storage: "database" | "s3";
  };
  commercialReadiness: {
    billingConfigured: boolean;
    emailConfigured: boolean;
    objectStorageConfigured: boolean;
    telegramConfigured: boolean;
    whatsappConfigured: boolean;
  };
  ok: boolean;
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
