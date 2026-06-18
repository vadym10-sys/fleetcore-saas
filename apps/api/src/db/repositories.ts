import type { Customer, DashboardMetrics, GpsDevice, Invoice, Payment, Rental, User, Vehicle, VehicleDocument } from "@fleetcore/shared";
import { defaultCompanyId, defaultTenantId } from "./constants.js";
import { pool } from "./client.js";
import { createId } from "../lib/http.js";
import { mapCompany, mapCustomer, mapGpsDevice, mapInvoice, mapPayment, mapRental, mapUser, mapVehicle, mapVehicleDocument } from "./mappers.js";
import type {
  customerInput,
  customerPatchInput,
  gpsDeviceInput,
  invoiceInput,
  invoicePatchInput,
  paymentInput,
  rentalReturnInput,
  rentalInput,
  rentalPatchInput,
  vehicleDocumentInput,
  vehicleInput,
  vehiclePatchInput,
} from "../schemas.js";
import type { z } from "zod";

type VehicleInput = z.infer<typeof vehicleInput>;
type VehiclePatchInput = z.infer<typeof vehiclePatchInput>;
type CustomerInput = z.infer<typeof customerInput>;
type CustomerPatchInput = z.infer<typeof customerPatchInput>;
type RentalInput = z.infer<typeof rentalInput>;
type RentalPatchInput = z.infer<typeof rentalPatchInput>;
type InvoiceInput = z.infer<typeof invoiceInput>;
type InvoicePatchInput = z.infer<typeof invoicePatchInput>;
type PaymentInput = z.infer<typeof paymentInput>;
type GpsDeviceInput = z.infer<typeof gpsDeviceInput>;
type VehicleDocumentInput = z.infer<typeof vehicleDocumentInput>;
type RentalReturnInput = z.infer<typeof rentalReturnInput>;

type PatchValue = string | number | undefined;

function patchSet(
  patch: Record<string, PatchValue>,
  columnMap: Record<string, string>,
  firstParamIndex: number,
) {
  const entries = Object.entries(patch).filter(([, value]) => value !== undefined);
  return {
    values: entries.map(([, value]) => value),
    sql: entries.map(([key], index) => `${columnMap[key]} = $${firstParamIndex + index}`).join(", "),
  };
}

export async function listCompanies() {
  const result = await pool.query(
    "select * from companies where tenant_id = $1 order by trading_name asc",
    [defaultTenantId],
  );
  return result.rows.map(mapCompany);
}

export async function getCompany(companyId: string) {
  const result = await pool.query(
    "select * from companies where tenant_id = $1 and id = $2",
    [defaultTenantId, companyId],
  );
  return result.rows[0] ? mapCompany(result.rows[0]) : undefined;
}

export async function getUserByEmail(email: string): Promise<User | undefined> {
  const result = await pool.query(
    "select * from users where tenant_id = $1 and email = $2",
    [defaultTenantId, email],
  );
  return result.rows[0] ? mapUser(result.rows[0]) : undefined;
}

export async function getUserCredentialsByEmail(email: string): Promise<{ passwordHash: string; user: User } | undefined> {
  const result = await pool.query(
    "select * from users where tenant_id = $1 and email = $2",
    [defaultTenantId, email],
  );
  return result.rows[0] ? { passwordHash: String(result.rows[0].password_hash), user: mapUser(result.rows[0]) } : undefined;
}

export async function listVehicles(): Promise<Vehicle[]> {
  const result = await pool.query(
    "select * from vehicles where tenant_id = $1 order by created_at asc",
    [defaultTenantId],
  );
  return result.rows.map(mapVehicle);
}

export async function getVehicle(vehicleId: string) {
  const result = await pool.query(
    "select * from vehicles where tenant_id = $1 and id = $2",
    [defaultTenantId, vehicleId],
  );
  return result.rows[0] ? mapVehicle(result.rows[0]) : undefined;
}

export async function createVehicle(input: VehicleInput): Promise<Vehicle> {
  const result = await pool.query(
    `insert into vehicles (
      id, tenant_id, company_id, vin, plate_number, make, model, year,
      status, location, odometer_km, daily_rate
    ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    returning *`,
    [
      createId("veh"),
      defaultTenantId,
      defaultCompanyId,
      input.vin,
      input.plateNumber,
      input.make,
      input.model,
      input.year,
      input.status,
      input.location,
      input.odometerKm,
      input.dailyRate,
    ],
  );
  return mapVehicle(result.rows[0]);
}

export async function updateVehicle(vehicleId: string, input: VehiclePatchInput) {
  const patch = patchSet(
    {
      vin: input.vin,
      plateNumber: input.plateNumber,
      make: input.make,
      model: input.model,
      year: input.year,
      status: input.status,
      location: input.location,
      odometerKm: input.odometerKm,
      dailyRate: input.dailyRate,
    },
    {
      vin: "vin",
      plateNumber: "plate_number",
      make: "make",
      model: "model",
      year: "year",
      status: "status",
      location: "location",
      odometerKm: "odometer_km",
      dailyRate: "daily_rate",
    },
    3,
  );
  if (!patch.sql) return getVehicle(vehicleId);

  const result = await pool.query(
    `update vehicles set ${patch.sql}, updated_at = now() where tenant_id = $1 and id = $2 returning *`,
    [defaultTenantId, vehicleId, ...patch.values],
  );
  return result.rows[0] ? mapVehicle(result.rows[0]) : undefined;
}

export async function listCustomers(): Promise<Customer[]> {
  const result = await pool.query(
    "select * from customers where tenant_id = $1 order by created_at asc",
    [defaultTenantId],
  );
  return result.rows.map(mapCustomer);
}

export async function getCustomer(customerId: string) {
  const result = await pool.query(
    "select * from customers where tenant_id = $1 and id = $2",
    [defaultTenantId, customerId],
  );
  return result.rows[0] ? mapCustomer(result.rows[0]) : undefined;
}

export async function createCustomer(input: CustomerInput): Promise<Customer> {
  const result = await pool.query(
    `insert into customers (
      id, tenant_id, company_id, display_name, email, phone, type, risk_level
    ) values ($1, $2, $3, $4, $5, $6, $7, $8)
    returning *`,
    [
      createId("cus"),
      defaultTenantId,
      defaultCompanyId,
      input.displayName,
      input.email,
      input.phone,
      input.type,
      input.riskLevel,
    ],
  );
  return mapCustomer(result.rows[0]);
}

export async function updateCustomer(customerId: string, input: CustomerPatchInput) {
  const patch = patchSet(
    {
      displayName: input.displayName,
      email: input.email,
      phone: input.phone,
      type: input.type,
      riskLevel: input.riskLevel,
    },
    {
      displayName: "display_name",
      email: "email",
      phone: "phone",
      type: "type",
      riskLevel: "risk_level",
    },
    3,
  );
  if (!patch.sql) return getCustomer(customerId);

  const result = await pool.query(
    `update customers set ${patch.sql}, updated_at = now() where tenant_id = $1 and id = $2 returning *`,
    [defaultTenantId, customerId, ...patch.values],
  );
  return result.rows[0] ? mapCustomer(result.rows[0]) : undefined;
}

export async function listRentals(): Promise<Rental[]> {
  const result = await pool.query(
    "select * from rentals where tenant_id = $1 order by created_at asc",
    [defaultTenantId],
  );
  return result.rows.map(mapRental);
}

export async function getRental(rentalId: string) {
  const result = await pool.query(
    "select * from rentals where tenant_id = $1 and id = $2",
    [defaultTenantId, rentalId],
  );
  return result.rows[0] ? mapRental(result.rows[0]) : undefined;
}

export async function hasRentalReferences(customerId?: string, vehicleId?: string) {
  const customerResult = customerId
    ? await pool.query("select 1 from customers where tenant_id = $1 and id = $2", [defaultTenantId, customerId])
    : { rowCount: 1 };
  const vehicleResult = vehicleId
    ? await pool.query("select 1 from vehicles where tenant_id = $1 and id = $2", [defaultTenantId, vehicleId])
    : { rowCount: 1 };

  return Boolean(customerResult.rowCount && vehicleResult.rowCount);
}

export async function createRental(input: RentalInput): Promise<Rental> {
  const result = await pool.query(
    `insert into rentals (
      id, tenant_id, company_id, customer_id, vehicle_id, status,
      pickup_at, return_at, total_amount, deposit_amount
    ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    returning *`,
    [
      createId("ren"),
      defaultTenantId,
      defaultCompanyId,
      input.customerId,
      input.vehicleId,
      input.status,
      input.pickupAt,
      input.returnAt,
      input.totalAmount,
      input.depositAmount,
    ],
  );
  return mapRental(result.rows[0]);
}

export async function updateRental(rentalId: string, input: RentalPatchInput) {
  const patch = patchSet(
    {
      customerId: input.customerId,
      vehicleId: input.vehicleId,
      status: input.status,
      pickupAt: input.pickupAt,
      returnAt: input.returnAt,
      totalAmount: input.totalAmount,
      depositAmount: input.depositAmount,
    },
    {
      customerId: "customer_id",
      vehicleId: "vehicle_id",
      status: "status",
      pickupAt: "pickup_at",
      returnAt: "return_at",
      totalAmount: "total_amount",
      depositAmount: "deposit_amount",
    },
    3,
  );
  if (!patch.sql) return getRental(rentalId);

  const result = await pool.query(
    `update rentals set ${patch.sql}, updated_at = now() where tenant_id = $1 and id = $2 returning *`,
    [defaultTenantId, rentalId, ...patch.values],
  );
  return result.rows[0] ? mapRental(result.rows[0]) : undefined;
}

export async function returnRental(rentalId: string, input: RentalReturnInput) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const rentalResult = await client.query(
      `update rentals
       set status = 'closed',
           return_at = $3,
           total_amount = coalesce($4, total_amount),
           updated_at = now()
       where tenant_id = $1 and id = $2 and status in ('active', 'return_due', 'reserved')
       returning *`,
      [defaultTenantId, rentalId, input.returnedAt, input.finalAmount ?? null],
    );
    if (!rentalResult.rows[0]) {
      await client.query("rollback");
      return undefined;
    }

    await client.query(
      `update vehicles
       set status = 'available', odometer_km = greatest(odometer_km, $3), updated_at = now()
       where tenant_id = $1 and id = $2`,
      [defaultTenantId, rentalResult.rows[0].vehicle_id, input.odometerKm],
    );
    await client.query("commit");

    return mapRental(rentalResult.rows[0]);
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function listInvoices(): Promise<Invoice[]> {
  const result = await pool.query(
    "select * from invoices where tenant_id = $1 order by created_at asc",
    [defaultTenantId],
  );
  return result.rows.map(mapInvoice);
}

export async function getInvoice(invoiceId: string) {
  const result = await pool.query(
    "select * from invoices where tenant_id = $1 and id = $2",
    [defaultTenantId, invoiceId],
  );
  return result.rows[0] ? mapInvoice(result.rows[0]) : undefined;
}

export async function createInvoice(input: InvoiceInput): Promise<Invoice> {
  const invoiceCount = await pool.query("select count(*) from invoices where tenant_id = $1", [defaultTenantId]);
  const invoiceNumber = `INV-${new Date().getFullYear()}-${String(Number(invoiceCount.rows[0]?.count ?? 0) + 1).padStart(4, "0")}`;
  const result = await pool.query(
    `insert into invoices (
      id, tenant_id, company_id, customer_id, rental_id, invoice_number,
      status, currency, subtotal, tax, due_at
    ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    returning *`,
    [
      createId("inv"),
      defaultTenantId,
      defaultCompanyId,
      input.customerId,
      input.rentalId ?? null,
      invoiceNumber,
      input.status,
      input.currency,
      input.subtotal,
      input.tax,
      input.dueAt,
    ],
  );
  return mapInvoice(result.rows[0]);
}

export async function updateInvoice(invoiceId: string, input: InvoicePatchInput) {
  const patch = patchSet(
    {
      customerId: input.customerId,
      rentalId: input.rentalId,
      status: input.status,
      currency: input.currency,
      subtotal: input.subtotal,
      tax: input.tax,
      dueAt: input.dueAt,
    },
    {
      customerId: "customer_id",
      rentalId: "rental_id",
      status: "status",
      currency: "currency",
      subtotal: "subtotal",
      tax: "tax",
      dueAt: "due_at",
    },
    3,
  );
  if (!patch.sql) return getInvoice(invoiceId);

  const result = await pool.query(
    `update invoices set ${patch.sql}, updated_at = now() where tenant_id = $1 and id = $2 returning *`,
    [defaultTenantId, invoiceId, ...patch.values],
  );
  return result.rows[0] ? mapInvoice(result.rows[0]) : undefined;
}

export async function listPayments(): Promise<Payment[]> {
  const result = await pool.query(
    "select * from payments where tenant_id = $1 order by paid_at desc, created_at desc",
    [defaultTenantId],
  );
  return result.rows.map(mapPayment);
}

export async function createInvoicePayment(invoiceId: string, input: PaymentInput): Promise<Payment | undefined> {
  const invoice = await getInvoice(invoiceId);
  if (!invoice) return undefined;

  const client = await pool.connect();
  try {
    await client.query("begin");
    const paymentResult = await client.query(
      `insert into payments (
        id, tenant_id, company_id, invoice_id, customer_id, amount,
        currency, method, reference, paid_at
      ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      returning *`,
      [
        createId("pay"),
        defaultTenantId,
        defaultCompanyId,
        invoiceId,
        invoice.customerId,
        input.amount,
        input.currency,
        input.method,
        input.reference ?? null,
        input.paidAt,
      ],
    );
    await client.query(
      `update invoices
       set status = case
         when (select coalesce(sum(amount), 0) from payments where tenant_id = $1 and invoice_id = $2) >= total then 'paid'
         else status
       end,
       updated_at = now()
       where tenant_id = $1 and id = $2`,
      [defaultTenantId, invoiceId],
    );
    await client.query("commit");

    return mapPayment(paymentResult.rows[0]);
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function listGpsDevices(): Promise<GpsDevice[]> {
  const result = await pool.query(
    "select * from gps_devices where tenant_id = $1 order by last_signal_at desc",
    [defaultTenantId],
  );
  return result.rows.map(mapGpsDevice);
}

export async function upsertGpsDevice(input: GpsDeviceInput): Promise<GpsDevice | undefined> {
  if (!(await getVehicle(input.vehicleId))) return undefined;

  const existingVehicleDevice = await pool.query(
    `update gps_devices
     set provider = $3,
         external_device_id = $4,
         status = $5,
         latitude = $6,
         longitude = $7,
         speed_kph = $8,
         last_signal_at = $9,
         updated_at = now()
     where tenant_id = $1 and vehicle_id = $2
     returning *`,
    [
      defaultTenantId,
      input.vehicleId,
      input.provider,
      input.externalDeviceId,
      input.status,
      input.latitude,
      input.longitude,
      input.speedKph,
      input.lastSignalAt,
    ],
  );
  if (existingVehicleDevice.rows[0]) {
    return mapGpsDevice(existingVehicleDevice.rows[0]);
  }

  const result = await pool.query(
    `insert into gps_devices (
      id, tenant_id, company_id, vehicle_id, provider, external_device_id,
      status, latitude, longitude, speed_kph, last_signal_at
    ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    on conflict (tenant_id, provider, external_device_id)
    do update set
      vehicle_id = excluded.vehicle_id,
      status = excluded.status,
      latitude = excluded.latitude,
      longitude = excluded.longitude,
      speed_kph = excluded.speed_kph,
      last_signal_at = excluded.last_signal_at,
      updated_at = now()
    returning *`,
    [
      createId("gps"),
      defaultTenantId,
      defaultCompanyId,
      input.vehicleId,
      input.provider,
      input.externalDeviceId,
      input.status,
      input.latitude,
      input.longitude,
      input.speedKph,
      input.lastSignalAt,
    ],
  );
  return mapGpsDevice(result.rows[0]);
}

export async function listVehicleDocuments(vehicleId?: string): Promise<VehicleDocument[]> {
  const result = await pool.query(
    `select * from vehicle_documents
     where tenant_id = $1 and ($2::text is null or vehicle_id = $2)
     order by created_at desc`,
    [defaultTenantId, vehicleId ?? null],
  );
  return result.rows.map(mapVehicleDocument);
}

export async function createVehicleDocument(input: VehicleDocumentInput): Promise<VehicleDocument | undefined> {
  if (!(await getVehicle(input.vehicleId))) return undefined;

  const result = await pool.query(
    `insert into vehicle_documents (
      id, tenant_id, company_id, vehicle_id, type, title, file_url, expires_at
    ) values ($1, $2, $3, $4, $5, $6, $7, $8)
    returning *`,
    [
      createId("doc"),
      defaultTenantId,
      defaultCompanyId,
      input.vehicleId,
      input.type,
      input.title,
      input.fileUrl,
      input.expiresAt ?? null,
    ],
  );
  return mapVehicleDocument(result.rows[0]);
}

export async function customerExists(customerId: string) {
  const result = await pool.query(
    "select 1 from customers where tenant_id = $1 and id = $2",
    [defaultTenantId, customerId],
  );
  return Boolean(result.rowCount);
}

export async function calculateDashboardMetrics(): Promise<DashboardMetrics> {
  const result = await pool.query(
    `select
      (select count(*)::int from rentals where tenant_id = $1 and status = 'active') as active_rentals,
      (select count(*)::int from vehicles where tenant_id = $1 and status = 'available') as available_vehicles,
      (select count(*)::int from vehicles where tenant_id = $1 and status = 'rented') as rented_vehicles,
      (select greatest(count(*), 1)::int from vehicles where tenant_id = $1) as total_vehicles,
      (select coalesce(sum(total), 0)::float from invoices where tenant_id = $1) as monthly_revenue,
      (select count(*)::int from invoices where tenant_id = $1 and status = 'overdue') as overdue_invoices`,
    [defaultTenantId],
  );
  const row = result.rows[0];

  return {
    activeRentals: Number(row.active_rentals),
    availableVehicles: Number(row.available_vehicles),
    fleetUtilization: Math.round((Number(row.rented_vehicles) / Number(row.total_vehicles)) * 100),
    monthlyRevenue: Number(row.monthly_revenue),
    overdueInvoices: Number(row.overdue_invoices),
  };
}
