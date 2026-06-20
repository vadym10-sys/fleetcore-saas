import type { Company, Customer, CustomerDocument, Expense, FileObject, GpsDevice, Invoice, Payment, Rental, RentalContract, ServiceRecord, User, Vehicle, VehicleDocument } from "@fleetcore/shared";

type DbRow = Record<string, unknown>;

function iso(value: unknown) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return String(value);
}

function number(value: unknown) {
  return Number(value);
}

export function mapCompany(row: DbRow): Company {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    legalName: String(row.legal_name),
    tradingName: String(row.trading_name),
    country: String(row.country).trim(),
    currency: String(row.currency).trim(),
    plan: row.plan as Company["plan"],
    fleetSizeLimit: number(row.fleet_size_limit),
  };
}

export function mapUser(row: DbRow): User {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    companyId: String(row.company_id),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    email: String(row.email),
    fullName: String(row.full_name),
    role: row.role as User["role"],
  };
}

export function mapVehicle(row: DbRow): Vehicle {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    companyId: String(row.company_id),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    vin: String(row.vin),
    plateNumber: String(row.plate_number),
    make: String(row.make),
    model: String(row.model),
    year: number(row.year),
    status: row.status as Vehicle["status"],
    location: String(row.location),
    odometerKm: number(row.odometer_km),
    dailyRate: number(row.daily_rate),
  };
}

export function mapCustomer(row: DbRow): Customer {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    companyId: String(row.company_id),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    displayName: String(row.display_name),
    email: String(row.email),
    phone: String(row.phone),
    type: row.type as Customer["type"],
    riskLevel: row.risk_level as Customer["riskLevel"],
  };
}

export function mapRental(row: DbRow): Rental {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    companyId: String(row.company_id),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    customerId: String(row.customer_id),
    vehicleId: String(row.vehicle_id),
    status: row.status as Rental["status"],
    pickupAt: iso(row.pickup_at),
    returnAt: iso(row.return_at),
    totalAmount: number(row.total_amount),
    depositAmount: number(row.deposit_amount),
  };
}

export function mapInvoice(row: DbRow): Invoice {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    companyId: String(row.company_id),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    customerId: String(row.customer_id),
    ...(row.rental_id ? { rentalId: String(row.rental_id) } : {}),
    invoiceNumber: String(row.invoice_number),
    status: row.status as Invoice["status"],
    currency: String(row.currency).trim(),
    subtotal: number(row.subtotal),
    tax: number(row.tax),
    total: number(row.total),
    dueAt: iso(row.due_at),
  };
}

export function mapPayment(row: DbRow): Payment {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    companyId: String(row.company_id),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    invoiceId: String(row.invoice_id),
    customerId: String(row.customer_id),
    amount: number(row.amount),
    currency: String(row.currency).trim(),
    method: row.method as Payment["method"],
    ...(row.reference ? { reference: String(row.reference) } : {}),
    paidAt: iso(row.paid_at),
  };
}

export function mapGpsDevice(row: DbRow): GpsDevice {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    companyId: String(row.company_id),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    vehicleId: String(row.vehicle_id),
    provider: row.provider as GpsDevice["provider"],
    externalDeviceId: String(row.external_device_id),
    status: row.status as GpsDevice["status"],
    latitude: number(row.latitude),
    longitude: number(row.longitude),
    speedKph: number(row.speed_kph),
    lastSignalAt: iso(row.last_signal_at),
  };
}

export function mapVehicleDocument(row: DbRow): VehicleDocument {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    companyId: String(row.company_id),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    vehicleId: String(row.vehicle_id),
    type: row.type as VehicleDocument["type"],
    title: String(row.title),
    fileUrl: String(row.file_url),
    ...(row.expires_at ? { expiresAt: iso(row.expires_at) } : {}),
  };
}

export function mapExpense(row: DbRow): Expense {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    companyId: String(row.company_id),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    ...(row.vehicle_id ? { vehicleId: String(row.vehicle_id) } : {}),
    category: row.category as Expense["category"],
    amount: number(row.amount),
    currency: String(row.currency).trim(),
    spentAt: iso(row.spent_at),
    note: String(row.note),
  };
}

export function mapServiceRecord(row: DbRow): ServiceRecord {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    companyId: String(row.company_id),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    vehicleId: String(row.vehicle_id),
    type: row.type as ServiceRecord["type"],
    odometerKm: number(row.odometer_km),
    status: row.status as ServiceRecord["status"],
    serviceAt: iso(row.service_at),
    cost: number(row.cost),
    note: String(row.note),
  };
}

export function mapCustomerDocument(row: DbRow): CustomerDocument {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    companyId: String(row.company_id),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    customerId: String(row.customer_id),
    type: row.type as CustomerDocument["type"],
    title: String(row.title),
    fileUrl: String(row.file_url),
    verified: Boolean(row.verified),
  };
}

export function mapRentalContract(row: DbRow): RentalContract {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    companyId: String(row.company_id),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    rentalId: String(row.rental_id),
    customerId: String(row.customer_id),
    status: row.status as RentalContract["status"],
    documentUrl: String(row.document_url),
    ...(row.public_url ? { publicUrl: String(row.public_url) } : {}),
    sentVia: row.sent_via as RentalContract["sentVia"],
    ...(row.sent_at ? { sentAt: iso(row.sent_at) } : {}),
    ...(row.viewed_at ? { viewedAt: iso(row.viewed_at) } : {}),
    ...(row.signed_at ? { signedAt: iso(row.signed_at) } : {}),
  };
}

export function mapFileObject(row: DbRow, publicUrl: string): FileObject {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    companyId: String(row.company_id),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    originalName: String(row.original_name),
    mimeType: String(row.mime_type),
    sizeBytes: number(row.size_bytes),
    storageProvider: (row.storage_provider ? String(row.storage_provider) : "database") as FileObject["storageProvider"],
    ...(row.storage_key ? { storageKey: String(row.storage_key) } : {}),
    ...(row.sha256 ? { sha256: String(row.sha256) } : {}),
    publicUrl,
  };
}
