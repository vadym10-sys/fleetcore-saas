import type { Company, Customer, CustomerDocument, DashboardMetrics, Expense, FileObject, GpsDevice, Invoice, Payment, Rental, RentalContract, RentalContractEvent, ServiceRecord, User, Vehicle, VehicleDocument } from "@fleetcore/shared";
import { createHash } from "node:crypto";
import type { TenantScope } from "../lib/access-control.js";
import { pool } from "./client.js";
import { createId } from "../lib/http.js";
import { mapCompany, mapCustomer, mapCustomerDocument, mapExpense, mapFileObject, mapGpsDevice, mapInvoice, mapPayment, mapRental, mapRentalContract, mapRentalContractEvent, mapServiceRecord, mapUser, mapVehicle, mapVehicleDocument } from "./mappers.js";
import type {
  customerInput,
  customerPatchInput,
  customerDocumentInput,
  expenseInput,
  fileUploadInput,
  gpsDeviceInput,
  invoiceInput,
  invoicePatchInput,
  paymentInput,
  registerCompanyInput,
  rentalReturnInput,
  rentalContractInput,
  rentalInput,
  rentalPatchInput,
  serviceRecordInput,
  teamMemberInput,
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
type RegisterCompanyInput = z.infer<typeof registerCompanyInput>;
type ExpenseInput = z.infer<typeof expenseInput>;
type ServiceRecordInput = z.infer<typeof serviceRecordInput>;
type CustomerDocumentInput = z.infer<typeof customerDocumentInput>;
type RentalContractInput = z.infer<typeof rentalContractInput>;
type FileUploadInput = z.infer<typeof fileUploadInput>;
type TeamMemberInput = z.infer<typeof teamMemberInput>;
export type AuthTokenType = "refresh" | "password_reset" | "email_verification";
export type AuditLogInput = {
  action: string;
  actorEmail?: string | undefined;
  companyId?: string | undefined;
  entityId?: string | undefined;
  entityType?: string | undefined;
  ipAddress?: string | undefined;
  metadata?: Record<string, unknown>;
  tenantId?: string | undefined;
  userAgent?: string | undefined;
  userId?: string | undefined;
};

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

export async function createCompanyAccount(input: RegisterCompanyInput, passwordHash: string): Promise<{ company: Company; user: User }> {
  const client = await pool.connect();
  const tenantId = createId("tenant");
  const companyId = createId("company");
  const userId = createId("user");
  try {
    await client.query("begin");

    const duplicate = await client.query("select 1 from users where lower(email) = lower($1) limit 1", [input.owner.email]);
    if (duplicate.rowCount) {
      await client.query("rollback");
      throw new Error("EMAIL_ALREADY_REGISTERED");
    }

    await client.query(
      `insert into tenants (id, name)
       values ($1, $2)`,
      [tenantId, input.company.tradingName],
    );

    const companyResult = await client.query(
      `insert into companies (
        id, tenant_id, legal_name, trading_name, country, currency, plan, fleet_size_limit
      ) values ($1, $2, $3, $4, $5, $6, $7, $8)
      returning *`,
      [
        companyId,
        tenantId,
        input.company.legalName,
        input.company.tradingName,
        input.company.country,
        input.company.currency,
        input.company.plan,
        input.company.fleetSizeLimit,
      ],
    );

    const userResult = await client.query(
      `insert into users (
        id, tenant_id, company_id, email, password_hash, full_name, role
      ) values ($1, $2, $3, $4, $5, $6, 'owner')
      returning *`,
      [userId, tenantId, companyId, input.owner.email.toLowerCase(), passwordHash, input.owner.fullName],
    );

    await client.query("commit");
    return {
      company: mapCompany(companyResult.rows[0]),
      user: mapUser(userResult.rows[0]),
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function touchUserLogin(userId: string) {
  await pool.query("update users set last_login_at = now(), updated_at = now() where id = $1", [userId]);
}

export async function updateUserPassword(userId: string, passwordHash: string) {
  await pool.query("update users set password_hash = $2, updated_at = now() where id = $1", [userId, passwordHash]);
}

export async function markUserEmailVerified(userId: string) {
  const result = await pool.query(
    "update users set email_verified_at = coalesce(email_verified_at, now()), updated_at = now() where id = $1 returning *",
    [userId],
  );
  return result.rows[0] ? mapUser(result.rows[0]) : undefined;
}

export async function createAuthToken(input: {
  companyId?: string | undefined;
  expiresAt: Date;
  ipAddress?: string | undefined;
  tenantId?: string | undefined;
  tokenHash: string;
  type: AuthTokenType;
  userAgent?: string | undefined;
  userId?: string | undefined;
}) {
  const id = createId("auth");
  await pool.query(
    `insert into auth_tokens (
      id, tenant_id, company_id, user_id, type, token_hash, expires_at, user_agent, ip_address
    ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      id,
      input.tenantId,
      input.companyId,
      input.userId,
      input.type,
      input.tokenHash,
      input.expiresAt.toISOString(),
      input.userAgent,
      input.ipAddress,
    ],
  );
  return { id, expiresAt: input.expiresAt };
}

export async function getActiveAuthToken(tokenHash: string, type: AuthTokenType): Promise<{ expiresAt: Date; id: string; user: User } | undefined> {
  const result = await pool.query(
    `select auth_tokens.id as auth_token_id, auth_tokens.expires_at, users.*
     from auth_tokens
     join users on users.id = auth_tokens.user_id
     where auth_tokens.token_hash = $1
       and auth_tokens.type = $2
       and auth_tokens.used_at is null
       and auth_tokens.revoked_at is null
       and auth_tokens.expires_at > now()
     limit 1`,
    [tokenHash, type],
  );
  const row = result.rows[0];
  if (!row) return undefined;
  return {
    expiresAt: row.expires_at instanceof Date ? row.expires_at : new Date(String(row.expires_at)),
    id: String(row.auth_token_id),
    user: mapUser(row),
  };
}

export async function markAuthTokenUsed(tokenId: string) {
  await pool.query("update auth_tokens set used_at = now() where id = $1", [tokenId]);
}

export async function revokeAuthToken(tokenHash: string, type: AuthTokenType) {
  await pool.query(
    "update auth_tokens set revoked_at = now() where token_hash = $1 and type = $2 and revoked_at is null",
    [tokenHash, type],
  );
}

export async function revokeUserRefreshTokens(userId: string) {
  await pool.query(
    "update auth_tokens set revoked_at = now() where user_id = $1 and type = 'refresh' and revoked_at is null",
    [userId],
  );
}

export async function writeAuditLog(input: AuditLogInput) {
  await pool.query(
    `insert into audit_log (
      id, tenant_id, company_id, user_id, actor_email, action, entity_type, entity_id, metadata, ip_address, user_agent
    ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11)`,
    [
      createId("audit"),
      input.tenantId,
      input.companyId,
      input.userId,
      input.actorEmail,
      input.action,
      input.entityType,
      input.entityId,
      JSON.stringify(input.metadata ?? {}),
      input.ipAddress,
      input.userAgent,
    ],
  );
}

export async function listAuditLogs(scope: TenantScope, limit = 100) {
  const result = await pool.query(
    `select id, actor_email, action, entity_type, entity_id, metadata, ip_address, user_agent, created_at
     from audit_log
     where tenant_id = $1 and company_id = $2
     order by created_at desc
     limit $3`,
    [scope.tenantId, scope.companyId, limit],
  );
  return result.rows.map((row) => ({
    id: String(row.id),
    action: String(row.action),
    actorEmail: row.actor_email ? String(row.actor_email) : undefined,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    entityId: row.entity_id ? String(row.entity_id) : undefined,
    entityType: row.entity_type ? String(row.entity_type) : undefined,
    ipAddress: row.ip_address ? String(row.ip_address) : undefined,
    metadata: row.metadata as Record<string, unknown>,
    userAgent: row.user_agent ? String(row.user_agent) : undefined,
  }));
}

export async function createFileObject(scope: TenantScope, input: FileUploadInput, publicUrlForId: (id: string, originalName: string) => string, uploadedByUserId?: string): Promise<FileObject> {
  const fileId = createId("file");
  const data = Buffer.from(input.base64, "base64");
  const sha256 = createHash("sha256").update(data).digest("hex");
  const result = await pool.query(
    `insert into file_objects (
      id, tenant_id, company_id, original_name, mime_type, size_bytes, data,
      storage_provider, storage_key, sha256, uploaded_by_user_id
    ) values ($1, $2, $3, $4, $5, $6, $7, 'database', $8, $9, $10)
    returning id, tenant_id, company_id, original_name, mime_type, size_bytes, storage_provider, storage_key, sha256, created_at, updated_at`,
    [
      fileId,
      scope.tenantId,
      scope.companyId,
      input.originalName,
      input.mimeType,
      data.byteLength,
      data,
      fileId,
      sha256,
      uploadedByUserId ?? null,
    ],
  );
  return mapFileObject(result.rows[0], publicUrlForId(fileId, input.originalName));
}

export async function listFileObjects(scope: TenantScope, publicUrlForId: (id: string, originalName: string) => string): Promise<FileObject[]> {
  const result = await pool.query(
    `select id, tenant_id, company_id, original_name, mime_type, size_bytes, storage_provider, storage_key, sha256, created_at, updated_at
     from file_objects
     where tenant_id = $1 and company_id = $2
     order by created_at desc`,
    [scope.tenantId, scope.companyId],
  );
  return result.rows.map((row) => mapFileObject(row, publicUrlForId(String(row.id), String(row.original_name))));
}

export async function getFileObjectMetadata(scope: TenantScope, fileId: string, publicUrlForId: (id: string, originalName: string) => string): Promise<FileObject | undefined> {
  const result = await pool.query(
    `select id, tenant_id, company_id, original_name, mime_type, size_bytes, storage_provider, storage_key, sha256, created_at, updated_at
     from file_objects
     where tenant_id = $1 and company_id = $2 and id = $3`,
    [scope.tenantId, scope.companyId, fileId],
  );
  if (!result.rows[0]) return undefined;
  return mapFileObject(result.rows[0], publicUrlForId(fileId, String(result.rows[0].original_name)));
}

export async function getFileObject(fileId: string): Promise<{ companyId: string; data: Buffer; mimeType: string; originalName: string; sha256?: string; tenantId: string } | undefined> {
  const result = await pool.query(
    "select tenant_id, company_id, original_name, mime_type, data, sha256 from file_objects where id = $1",
    [fileId],
  );
  if (!result.rows[0]) return undefined;
  return {
    tenantId: String(result.rows[0].tenant_id),
    companyId: String(result.rows[0].company_id),
    data: result.rows[0].data as Buffer,
    mimeType: String(result.rows[0].mime_type),
    originalName: String(result.rows[0].original_name),
    ...(result.rows[0].sha256 ? { sha256: String(result.rows[0].sha256) } : {}),
  };
}

export async function listCompanies(scope: TenantScope) {
  const result = await pool.query(
    "select * from companies where tenant_id = $1 order by trading_name asc",
    [scope.tenantId],
  );
  return result.rows.map(mapCompany);
}

export async function getCompany(scope: TenantScope, companyId: string) {
  const result = await pool.query(
    "select * from companies where tenant_id = $1 and id = $2",
    [scope.tenantId, companyId],
  );
  return result.rows[0] ? mapCompany(result.rows[0]) : undefined;
}

export async function getUserByEmail(email: string): Promise<User | undefined> {
  const result = await pool.query(
    "select * from users where lower(email) = lower($1) order by created_at desc limit 1",
    [email],
  );
  return result.rows[0] ? mapUser(result.rows[0]) : undefined;
}

export async function getUserCredentialsByEmail(email: string): Promise<{ passwordHash: string; user: User } | undefined> {
  const result = await pool.query(
    "select * from users where lower(email) = lower($1) order by created_at desc limit 1",
    [email],
  );
  return result.rows[0] ? { passwordHash: String(result.rows[0].password_hash), user: mapUser(result.rows[0]) } : undefined;
}

export async function listTeamUsers(scope: TenantScope): Promise<User[]> {
  const result = await pool.query(
    "select * from users where tenant_id = $1 and company_id = $2 order by role asc, full_name asc",
    [scope.tenantId, scope.companyId],
  );
  return result.rows.map(mapUser);
}

export async function createTeamUser(scope: TenantScope, input: TeamMemberInput, passwordHash: string): Promise<User> {
  const duplicate = await pool.query("select 1 from users where lower(email) = lower($1) limit 1", [input.email]);
  if (duplicate.rowCount) {
    throw new Error("EMAIL_ALREADY_REGISTERED");
  }

  const result = await pool.query(
    `insert into users (
      id, tenant_id, company_id, email, password_hash, full_name, role
    ) values ($1, $2, $3, $4, $5, $6, $7)
    returning *`,
    [createId("user"), scope.tenantId, scope.companyId, input.email.toLowerCase(), passwordHash, input.fullName, input.role],
  );
  return mapUser(result.rows[0]);
}

export async function updateUserProfile(userId: string, fullName: string): Promise<User | undefined> {
  const result = await pool.query(
    "update users set full_name = $2, updated_at = now() where id = $1 returning *",
    [userId, fullName],
  );
  return result.rows[0] ? mapUser(result.rows[0]) : undefined;
}

export async function listVehicles(scope: TenantScope): Promise<Vehicle[]> {
  const result = await pool.query(
    "select * from vehicles where tenant_id = $1 and company_id = $2 order by created_at asc",
    [scope.tenantId, scope.companyId],
  );
  return result.rows.map(mapVehicle);
}

export async function getVehicle(scope: TenantScope, vehicleId: string) {
  const result = await pool.query(
    "select * from vehicles where tenant_id = $1 and company_id = $2 and id = $3",
    [scope.tenantId, scope.companyId, vehicleId],
  );
  return result.rows[0] ? mapVehicle(result.rows[0]) : undefined;
}

export async function createVehicle(scope: TenantScope, input: VehicleInput): Promise<Vehicle> {
  const result = await pool.query(
    `insert into vehicles (
      id, tenant_id, company_id, vin, plate_number, make, model, year,
      status, location, odometer_km, daily_rate
    ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    returning *`,
    [
      createId("veh"),
      scope.tenantId,
      scope.companyId,
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

export async function updateVehicle(scope: TenantScope, vehicleId: string, input: VehiclePatchInput) {
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
    4,
  );
  if (!patch.sql) return getVehicle(scope, vehicleId);

  const result = await pool.query(
    `update vehicles set ${patch.sql}, updated_at = now() where tenant_id = $1 and company_id = $2 and id = $3 returning *`,
    [scope.tenantId, scope.companyId, vehicleId, ...patch.values],
  );
  return result.rows[0] ? mapVehicle(result.rows[0]) : undefined;
}

export async function deleteVehicle(scope: TenantScope, vehicleId: string) {
  const rentalReferences = await pool.query(
    "select 1 from rentals where tenant_id = $1 and company_id = $2 and vehicle_id = $3 limit 1",
    [scope.tenantId, scope.companyId, vehicleId],
  );
  if (rentalReferences.rowCount) return { deleted: false, reason: "vehicle_has_rentals" as const };

  const result = await pool.query(
    "delete from vehicles where tenant_id = $1 and company_id = $2 and id = $3 returning id",
    [scope.tenantId, scope.companyId, vehicleId],
  );
  return { deleted: Boolean(result.rowCount), reason: result.rowCount ? undefined : "not_found" as const };
}

export async function listCustomers(scope: TenantScope): Promise<Customer[]> {
  const result = await pool.query(
    "select * from customers where tenant_id = $1 and company_id = $2 order by created_at asc",
    [scope.tenantId, scope.companyId],
  );
  return result.rows.map(mapCustomer);
}

export async function getCustomer(scope: TenantScope, customerId: string) {
  const result = await pool.query(
    "select * from customers where tenant_id = $1 and company_id = $2 and id = $3",
    [scope.tenantId, scope.companyId, customerId],
  );
  return result.rows[0] ? mapCustomer(result.rows[0]) : undefined;
}

export async function createCustomer(scope: TenantScope, input: CustomerInput): Promise<Customer> {
  const result = await pool.query(
    `insert into customers (
      id, tenant_id, company_id, display_name, email, phone, type, risk_level
    ) values ($1, $2, $3, $4, $5, $6, $7, $8)
    returning *`,
    [
      createId("cus"),
      scope.tenantId,
      scope.companyId,
      input.displayName,
      input.email,
      input.phone,
      input.type,
      input.riskLevel,
    ],
  );
  return mapCustomer(result.rows[0]);
}

export async function updateCustomer(scope: TenantScope, customerId: string, input: CustomerPatchInput) {
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
    4,
  );
  if (!patch.sql) return getCustomer(scope, customerId);

  const result = await pool.query(
    `update customers set ${patch.sql}, updated_at = now() where tenant_id = $1 and company_id = $2 and id = $3 returning *`,
    [scope.tenantId, scope.companyId, customerId, ...patch.values],
  );
  return result.rows[0] ? mapCustomer(result.rows[0]) : undefined;
}

export async function listRentals(scope: TenantScope): Promise<Rental[]> {
  const result = await pool.query(
    "select * from rentals where tenant_id = $1 and company_id = $2 order by created_at asc",
    [scope.tenantId, scope.companyId],
  );
  return result.rows.map(mapRental);
}

export async function getRental(scope: TenantScope, rentalId: string) {
  const result = await pool.query(
    "select * from rentals where tenant_id = $1 and company_id = $2 and id = $3",
    [scope.tenantId, scope.companyId, rentalId],
  );
  return result.rows[0] ? mapRental(result.rows[0]) : undefined;
}

export async function hasRentalReferences(scope: TenantScope, customerId?: string, vehicleId?: string) {
  const customerResult = customerId
    ? await pool.query("select 1 from customers where tenant_id = $1 and company_id = $2 and id = $3", [scope.tenantId, scope.companyId, customerId])
    : { rowCount: 1 };
  const vehicleResult = vehicleId
    ? await pool.query("select 1 from vehicles where tenant_id = $1 and company_id = $2 and id = $3", [scope.tenantId, scope.companyId, vehicleId])
    : { rowCount: 1 };

  return Boolean(customerResult.rowCount && vehicleResult.rowCount);
}

export async function createRental(scope: TenantScope, input: RentalInput): Promise<Rental> {
  const result = await pool.query(
    `insert into rentals (
      id, tenant_id, company_id, customer_id, vehicle_id, status,
      pickup_at, return_at, total_amount, deposit_amount
    ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    returning *`,
    [
      createId("ren"),
      scope.tenantId,
      scope.companyId,
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

export async function updateRental(scope: TenantScope, rentalId: string, input: RentalPatchInput) {
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
    4,
  );
  if (!patch.sql) return getRental(scope, rentalId);

  const result = await pool.query(
    `update rentals set ${patch.sql}, updated_at = now() where tenant_id = $1 and company_id = $2 and id = $3 returning *`,
    [scope.tenantId, scope.companyId, rentalId, ...patch.values],
  );
  return result.rows[0] ? mapRental(result.rows[0]) : undefined;
}

export async function returnRental(scope: TenantScope, rentalId: string, input: RentalReturnInput) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const rentalResult = await client.query(
      `update rentals
       set status = 'closed',
           return_at = $4,
           total_amount = coalesce($5, total_amount),
           updated_at = now()
       where tenant_id = $1 and company_id = $2 and id = $3 and status in ('active', 'return_due', 'reserved')
       returning *`,
      [scope.tenantId, scope.companyId, rentalId, input.returnedAt, input.finalAmount ?? null],
    );
    if (!rentalResult.rows[0]) {
      await client.query("rollback");
      return undefined;
    }

    await client.query(
      `update vehicles
       set status = 'available', odometer_km = greatest(odometer_km, $4), updated_at = now()
       where tenant_id = $1 and company_id = $2 and id = $3`,
      [scope.tenantId, scope.companyId, rentalResult.rows[0].vehicle_id, input.odometerKm],
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

export async function listInvoices(scope: TenantScope): Promise<Invoice[]> {
  const result = await pool.query(
    "select * from invoices where tenant_id = $1 and company_id = $2 order by created_at asc",
    [scope.tenantId, scope.companyId],
  );
  return result.rows.map(mapInvoice);
}

export async function getInvoice(scope: TenantScope, invoiceId: string) {
  const result = await pool.query(
    "select * from invoices where tenant_id = $1 and company_id = $2 and id = $3",
    [scope.tenantId, scope.companyId, invoiceId],
  );
  return result.rows[0] ? mapInvoice(result.rows[0]) : undefined;
}

export async function createInvoice(scope: TenantScope, input: InvoiceInput): Promise<Invoice> {
  const invoiceCount = await pool.query("select count(*) from invoices where tenant_id = $1 and company_id = $2", [scope.tenantId, scope.companyId]);
  const invoiceNumber = `INV-${new Date().getFullYear()}-${String(Number(invoiceCount.rows[0]?.count ?? 0) + 1).padStart(4, "0")}`;
  const result = await pool.query(
    `insert into invoices (
      id, tenant_id, company_id, customer_id, rental_id, invoice_number,
      status, currency, subtotal, tax, due_at
    ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    returning *`,
    [
      createId("inv"),
      scope.tenantId,
      scope.companyId,
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

export async function updateInvoice(scope: TenantScope, invoiceId: string, input: InvoicePatchInput) {
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
    4,
  );
  if (!patch.sql) return getInvoice(scope, invoiceId);

  const result = await pool.query(
    `update invoices set ${patch.sql}, updated_at = now() where tenant_id = $1 and company_id = $2 and id = $3 returning *`,
    [scope.tenantId, scope.companyId, invoiceId, ...patch.values],
  );
  return result.rows[0] ? mapInvoice(result.rows[0]) : undefined;
}

export async function listPayments(scope: TenantScope): Promise<Payment[]> {
  const result = await pool.query(
    "select * from payments where tenant_id = $1 and company_id = $2 order by paid_at desc, created_at desc",
    [scope.tenantId, scope.companyId],
  );
  return result.rows.map(mapPayment);
}

export async function createInvoicePayment(scope: TenantScope, invoiceId: string, input: PaymentInput): Promise<Payment | undefined> {
  const invoice = await getInvoice(scope, invoiceId);
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
        scope.tenantId,
        scope.companyId,
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
         when (select coalesce(sum(amount), 0) from payments where tenant_id = $1 and company_id = $2 and invoice_id = $3) >= total then 'paid'
         else status
       end,
       updated_at = now()
       where tenant_id = $1 and company_id = $2 and id = $3`,
      [scope.tenantId, scope.companyId, invoiceId],
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

export async function listGpsDevices(scope: TenantScope): Promise<GpsDevice[]> {
  const result = await pool.query(
    "select * from gps_devices where tenant_id = $1 and company_id = $2 order by last_signal_at desc",
    [scope.tenantId, scope.companyId],
  );
  return result.rows.map(mapGpsDevice);
}

export async function upsertGpsDevice(scope: TenantScope, input: GpsDeviceInput): Promise<GpsDevice | undefined> {
  if (!(await getVehicle(scope, input.vehicleId))) return undefined;

  const existingVehicleDevice = await pool.query(
    `update gps_devices
     set provider = $4,
         external_device_id = $5,
         status = $6,
         latitude = $7,
         longitude = $8,
         speed_kph = $9,
         last_signal_at = $10,
         updated_at = now()
     where tenant_id = $1 and company_id = $2 and vehicle_id = $3
     returning *`,
    [
      scope.tenantId,
      scope.companyId,
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
      scope.tenantId,
      scope.companyId,
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

export async function listVehicleDocuments(scope: TenantScope, vehicleId?: string): Promise<VehicleDocument[]> {
  const result = await pool.query(
    `select * from vehicle_documents
     where tenant_id = $1 and company_id = $2 and ($3::text is null or vehicle_id = $3)
     order by created_at desc`,
    [scope.tenantId, scope.companyId, vehicleId ?? null],
  );
  return result.rows.map(mapVehicleDocument);
}

export async function createVehicleDocument(scope: TenantScope, input: VehicleDocumentInput): Promise<VehicleDocument | undefined> {
  if (!(await getVehicle(scope, input.vehicleId))) return undefined;

  const result = await pool.query(
    `insert into vehicle_documents (
      id, tenant_id, company_id, vehicle_id, type, title, file_url, expires_at
    ) values ($1, $2, $3, $4, $5, $6, $7, $8)
    returning *`,
    [
      createId("doc"),
      scope.tenantId,
      scope.companyId,
      input.vehicleId,
      input.type,
      input.title,
      input.fileUrl,
      input.expiresAt ?? null,
    ],
  );
  return mapVehicleDocument(result.rows[0]);
}

export async function customerExists(scope: TenantScope, customerId: string) {
  const result = await pool.query(
    "select 1 from customers where tenant_id = $1 and company_id = $2 and id = $3",
    [scope.tenantId, scope.companyId, customerId],
  );
  return Boolean(result.rowCount);
}

export async function calculateDashboardMetrics(scope: TenantScope): Promise<DashboardMetrics> {
  const result = await pool.query(
    `select
      (select count(*)::int from rentals where tenant_id = $1 and company_id = $2 and status = 'active') as active_rentals,
      (select count(*)::int from vehicles where tenant_id = $1 and company_id = $2 and status = 'available') as available_vehicles,
      (select count(*)::int from vehicles where tenant_id = $1 and company_id = $2 and status = 'rented') as rented_vehicles,
      (select greatest(count(*), 1)::int from vehicles where tenant_id = $1 and company_id = $2) as total_vehicles,
      (select coalesce(sum(total), 0)::float from invoices where tenant_id = $1 and company_id = $2) as monthly_revenue,
      (select count(*)::int from invoices where tenant_id = $1 and company_id = $2 and status = 'overdue') as overdue_invoices`,
    [scope.tenantId, scope.companyId],
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

export async function listExpenses(scope: TenantScope): Promise<Expense[]> {
  const result = await pool.query(
    "select * from expenses where tenant_id = $1 and company_id = $2 order by spent_at desc, created_at desc",
    [scope.tenantId, scope.companyId],
  );
  return result.rows.map(mapExpense);
}

export async function createExpense(scope: TenantScope, input: ExpenseInput): Promise<Expense | undefined> {
  if (input.vehicleId && !(await getVehicle(scope, input.vehicleId))) return undefined;

  const result = await pool.query(
    `insert into expenses (
      id, tenant_id, company_id, vehicle_id, category, amount, currency, spent_at, note
    ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    returning *`,
    [
      createId("exp"),
      scope.tenantId,
      scope.companyId,
      input.vehicleId ?? null,
      input.category,
      input.amount,
      input.currency,
      input.spentAt,
      input.note,
    ],
  );
  return mapExpense(result.rows[0]);
}

export async function listServiceRecords(scope: TenantScope, vehicleId?: string): Promise<ServiceRecord[]> {
  const result = await pool.query(
    `select * from service_records
     where tenant_id = $1 and company_id = $2 and ($3::text is null or vehicle_id = $3)
     order by service_at desc, created_at desc`,
    [scope.tenantId, scope.companyId, vehicleId ?? null],
  );
  return result.rows.map(mapServiceRecord);
}

export async function createServiceRecord(scope: TenantScope, input: ServiceRecordInput): Promise<ServiceRecord | undefined> {
  if (!(await getVehicle(scope, input.vehicleId))) return undefined;

  const result = await pool.query(
    `insert into service_records (
      id, tenant_id, company_id, vehicle_id, type, odometer_km, status, service_at, cost, note
    ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    returning *`,
    [
      createId("svc"),
      scope.tenantId,
      scope.companyId,
      input.vehicleId,
      input.type,
      input.odometerKm,
      input.status,
      input.serviceAt,
      input.cost,
      input.note,
    ],
  );
  return mapServiceRecord(result.rows[0]);
}

export async function listCustomerDocuments(scope: TenantScope, customerId?: string): Promise<CustomerDocument[]> {
  const result = await pool.query(
    `select * from customer_documents
     where tenant_id = $1 and company_id = $2 and ($3::text is null or customer_id = $3)
     order by created_at desc`,
    [scope.tenantId, scope.companyId, customerId ?? null],
  );
  return result.rows.map(mapCustomerDocument);
}

export async function createCustomerDocument(scope: TenantScope, input: CustomerDocumentInput): Promise<CustomerDocument | undefined> {
  if (!(await customerExists(scope, input.customerId))) return undefined;

  const result = await pool.query(
    `insert into customer_documents (
      id, tenant_id, company_id, customer_id, type, title, file_url, verified
    ) values ($1, $2, $3, $4, $5, $6, $7, $8)
    returning *`,
    [
      createId("cdoc"),
      scope.tenantId,
      scope.companyId,
      input.customerId,
      input.type,
      input.title,
      input.fileUrl,
      input.verified,
    ],
  );
  return mapCustomerDocument(result.rows[0]);
}

export async function listRentalContracts(scope: TenantScope): Promise<RentalContract[]> {
  const result = await pool.query(
    `select *, null as public_url
     from rental_contracts
     where tenant_id = $1 and company_id = $2
     order by created_at desc`,
    [scope.tenantId, scope.companyId],
  );
  return result.rows.map(mapRentalContract);
}

export async function listRentalContractEvents(scope: TenantScope, contractId?: string): Promise<RentalContractEvent[]> {
  const result = await pool.query(
    `select *
     from rental_contract_events
     where tenant_id = $1
       and company_id = $2
       and ($3::text is null or contract_id = $3)
     order by created_at desc`,
    [scope.tenantId, scope.companyId, contractId ?? null],
  );
  return result.rows.map(mapRentalContractEvent);
}

export async function createRentalContractEvent(input: {
  actorLabel?: string | undefined;
  channel: RentalContractEvent["channel"];
  companyId: string;
  contractId: string;
  customerId: string;
  eventType: RentalContractEvent["eventType"];
  metadata?: Record<string, unknown>;
  rentalId: string;
  tenantId: string;
}): Promise<RentalContractEvent> {
  const result = await pool.query(
    `insert into rental_contract_events (
      id, tenant_id, company_id, contract_id, rental_id, customer_id, event_type, channel, actor_label, metadata
    ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
    returning *`,
    [
      createId("cevt"),
      input.tenantId,
      input.companyId,
      input.contractId,
      input.rentalId,
      input.customerId,
      input.eventType,
      input.channel,
      input.actorLabel ?? null,
      JSON.stringify(input.metadata ?? {}),
    ],
  );
  return mapRentalContractEvent(result.rows[0]);
}

export async function createRentalContract(scope: TenantScope, input: RentalContractInput): Promise<RentalContract | undefined> {
  const rental = await getRental(scope, input.rentalId);
  if (!rental) return undefined;
  const publicOrigin = process.env.API_PUBLIC_URL ?? process.env.WEB_ORIGIN ?? "http://localhost:4000";
  const publicToken = input.status === "draft" ? null : createId("contract_public");
  const publicTokenHash = publicToken ? createHash("sha256").update(publicToken).digest("hex") : null;

  const result = await pool.query(
    `insert into rental_contracts (
      id, tenant_id, company_id, rental_id, customer_id, status, document_url, sent_via, signed_at,
      sent_at, viewed_at, public_token_hash
    ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    on conflict (tenant_id, company_id, rental_id)
    do update set
      status = excluded.status,
      document_url = excluded.document_url,
      sent_via = excluded.sent_via,
      sent_at = coalesce(excluded.sent_at, rental_contracts.sent_at),
      viewed_at = coalesce(excluded.viewed_at, rental_contracts.viewed_at),
      signed_at = excluded.signed_at,
      public_token_hash = coalesce(excluded.public_token_hash, rental_contracts.public_token_hash),
      updated_at = now()
    returning *, case when public_token_hash is not null then $13 || '/operations/rental-contracts/public/' || id else null end as public_url`,
    [
      createId("ctr"),
      scope.tenantId,
      scope.companyId,
      input.rentalId,
      rental.customerId,
      input.status,
      input.documentUrl,
      input.sentVia,
      input.signedAt ?? null,
      input.status === "sent" || input.status === "viewed" || input.status === "signed" ? new Date().toISOString() : null,
      input.status === "viewed" || input.status === "signed" ? new Date().toISOString() : null,
      publicTokenHash,
      publicOrigin,
    ],
  );
  const contract = mapRentalContract(result.rows[0]);
  return publicToken ? { ...contract, publicUrl: `${publicOrigin}/operations/rental-contracts/public/${contract.id}?token=${publicToken}` } : contract;
}

export async function getPublicRentalContract(contractId: string, publicToken: string) {
  const publicOrigin = process.env.API_PUBLIC_URL ?? process.env.WEB_ORIGIN ?? "http://localhost:4000";
  const tokenHash = createHash("sha256").update(publicToken).digest("hex");
  const result = await pool.query(
    `update rental_contracts
     set status = case when status = 'sent' then 'viewed' else status end,
         viewed_at = coalesce(viewed_at, now()),
         updated_at = now()
     where id = $1 and public_token_hash = $2 and status in ('sent', 'viewed', 'signed')
     returning *, $3 || '/operations/rental-contracts/public/' || id as public_url`,
    [contractId, tokenHash, publicOrigin],
  );
  const contract = result.rows[0] ? mapRentalContract(result.rows[0]) : undefined;
  return contract ? { ...contract, publicUrl: `${publicOrigin}/operations/rental-contracts/public/${contract.id}?token=${publicToken}` } : undefined;
}

export async function signPublicRentalContract(contractId: string, publicToken: string, signerName: string) {
  const publicOrigin = process.env.API_PUBLIC_URL ?? process.env.WEB_ORIGIN ?? "http://localhost:4000";
  const tokenHash = createHash("sha256").update(publicToken).digest("hex");
  const result = await pool.query(
    `update rental_contracts
     set status = 'signed',
         viewed_at = coalesce(viewed_at, now()),
         signed_at = now(),
         updated_at = now()
     where id = $1 and public_token_hash = $2 and status in ('sent', 'viewed')
     returning *, $3 || '/operations/rental-contracts/public/' || id as public_url`,
    [contractId, tokenHash, publicOrigin],
  );
  if (!result.rows[0]) return undefined;
  const contract = mapRentalContract(result.rows[0]);
  return {
    contract: { ...contract, publicUrl: `${publicOrigin}/operations/rental-contracts/public/${contract.id}?token=${publicToken}` },
    signerName,
  };
}
