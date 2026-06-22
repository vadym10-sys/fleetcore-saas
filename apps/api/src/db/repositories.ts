import type { BillingCheckoutSession, Company, ComplianceExport, Customer, CustomerDocument, DashboardFolder, DashboardFolderFile, DashboardFolderNote, DeliveryMessage, DashboardMetrics, Expense, FileObject, FleetDocument, GpsDevice, Invoice, Payment, Rental, RentalChecklist, RentalContract, RentalContractEvent, RentalFlow, RentalFlowStep, ServiceRecord, Subscription, User, Vehicle, VehicleDocument } from "@fleetcore/shared";
import { createHash } from "node:crypto";
import type { TenantScope } from "../lib/access-control.js";
import { pool } from "./client.js";
import { createId } from "../lib/http.js";
import { mapCompany, mapCustomer, mapCustomerDocument, mapExpense, mapFileObject, mapFleetDocument, mapGpsDevice, mapInvoice, mapPayment, mapRental, mapRentalChecklist, mapRentalContract, mapRentalContractEvent, mapServiceRecord, mapUser, mapVehicle, mapVehicleDocument } from "./mappers.js";
import type {
  customerInput,
  customerPatchInput,
  companyBrandingInput,
  customerDocumentInput,
  dashboardFolderFileInput,
  dashboardFolderInput,
  dashboardFolderNoteInput,
  dashboardFolderPatchInput,
  dataSubjectRequestInput,
  deliveryMessageInput,
  expenseInput,
  fileUploadInput,
  gpsDeviceInput,
  invoiceInput,
  invoicePatchInput,
  paymentInput,
  registerCompanyInput,
  rentalReturnInput,
  rentalContractInput,
  rentalChecklistInput,
  rentalInput,
  rentalPatchInput,
  profileUpdateInput,
  serviceRecordInput,
  subscriptionCheckoutInput,
  subscriptionSyncInput,
  teamMemberInput,
  vehicleDocumentInput,
  vehicleInput,
  vehiclePatchInput,
} from "../schemas.js";
import type { z } from "zod";

type VehicleInput = z.infer<typeof vehicleInput>;
type VehiclePatchInput = z.infer<typeof vehiclePatchInput>;
type CompanyBrandingInput = z.infer<typeof companyBrandingInput>;
type CustomerInput = z.infer<typeof customerInput>;
type CustomerPatchInput = z.infer<typeof customerPatchInput>;
type RentalInput = z.infer<typeof rentalInput>;
type RentalPatchInput = z.infer<typeof rentalPatchInput>;
type RentalChecklistInput = z.infer<typeof rentalChecklistInput>;
type ProfileUpdateInput = z.infer<typeof profileUpdateInput>;
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
type DashboardFolderInput = z.infer<typeof dashboardFolderInput>;
type DashboardFolderPatchInput = z.infer<typeof dashboardFolderPatchInput>;
type DashboardFolderFileInput = z.infer<typeof dashboardFolderFileInput>;
type DashboardFolderNoteInput = z.infer<typeof dashboardFolderNoteInput>;
type DataSubjectRequestInput = z.infer<typeof dataSubjectRequestInput>;
type DeliveryMessageInput = z.infer<typeof deliveryMessageInput>;
type RentalContractInput = z.infer<typeof rentalContractInput>;
type FileUploadInput = z.infer<typeof fileUploadInput>;
type SubscriptionCheckoutInput = z.infer<typeof subscriptionCheckoutInput>;
type SubscriptionSyncInput = z.infer<typeof subscriptionSyncInput>;
type TeamMemberInput = z.infer<typeof teamMemberInput>;

export class PaymentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentValidationError";
  }
}

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

type PatchValue = null | number | string | undefined;

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

export async function createCompanyAccount(input: RegisterCompanyInput, passwordHash: string, consentMeta: {
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
} = {}): Promise<{ company: Company; user: User }> {
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

    await client.query(
      `insert into legal_consents (
        id, tenant_id, company_id, user_id, email, policy_version, privacy_accepted, terms_accepted,
        cookie_acknowledged, marketing_opt_in, ip_address, user_agent
      ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        createId("consent"),
        tenantId,
        companyId,
        userId,
        input.owner.email.toLowerCase(),
        input.consent.policyVersion,
        input.consent.privacyAccepted,
        input.consent.termsAccepted,
        input.consent.cookieAcknowledged,
        input.consent.marketingOptIn,
        consentMeta.ipAddress,
        consentMeta.userAgent,
      ],
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

export async function createDataSubjectRequest(scope: TenantScope, input: DataSubjectRequestInput, meta: {
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
  userId?: string | undefined;
}) {
  const result = await pool.query(
    `insert into data_subject_requests (
      id, tenant_id, company_id, user_id, email, request_type, message, ip_address, user_agent
    ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    returning id, email, request_type, status, message, created_at`,
    [
      createId("dsr"),
      scope.tenantId,
      scope.companyId,
      meta.userId,
      input.email,
      input.requestType,
      input.message,
      meta.ipAddress,
      meta.userAgent,
    ],
  );
  const row = result.rows[0];
  return {
    id: String(row.id),
    email: String(row.email),
    requestType: String(row.request_type),
    status: String(row.status),
    message: row.message ? String(row.message) : undefined,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  };
}

export async function listLegalConsents(scope: TenantScope) {
  const result = await pool.query(
    `select id, email, policy_version, privacy_accepted, terms_accepted, cookie_acknowledged, marketing_opt_in, created_at
     from legal_consents
     where tenant_id = $1 and company_id = $2
     order by created_at desc`,
    [scope.tenantId, scope.companyId],
  );
  return result.rows.map((row) => ({
    id: String(row.id),
    cookieAcknowledged: Boolean(row.cookie_acknowledged),
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    email: String(row.email),
    marketingOptIn: Boolean(row.marketing_opt_in),
    policyVersion: String(row.policy_version),
    privacyAccepted: Boolean(row.privacy_accepted),
    termsAccepted: Boolean(row.terms_accepted),
  }));
}

export async function listDataSubjectRequests(scope: TenantScope) {
  const result = await pool.query(
    `select id, email, request_type, status, message, created_at, updated_at
     from data_subject_requests
     where tenant_id = $1 and company_id = $2
     order by created_at desc`,
    [scope.tenantId, scope.companyId],
  );
  return result.rows.map((row) => ({
    id: String(row.id),
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    email: String(row.email),
    message: row.message ? String(row.message) : undefined,
    requestType: String(row.request_type),
    status: String(row.status),
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
  }));
}

function mapSubscription(row: Record<string, unknown>): Subscription {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    companyId: String(row.company_id),
    provider: String(row.provider) as Subscription["provider"],
    plan: String(row.plan) as Subscription["plan"],
    status: String(row.status) as Subscription["status"],
    ...(row.external_customer_id ? { externalCustomerId: String(row.external_customer_id) } : {}),
    ...(row.external_subscription_id ? { externalSubscriptionId: String(row.external_subscription_id) } : {}),
    ...(row.current_period_start ? { currentPeriodStart: row.current_period_start instanceof Date ? row.current_period_start.toISOString() : String(row.current_period_start) } : {}),
    ...(row.current_period_end ? { currentPeriodEnd: row.current_period_end instanceof Date ? row.current_period_end.toISOString() : String(row.current_period_end) } : {}),
    ...(row.cancel_at ? { cancelAt: row.cancel_at instanceof Date ? row.cancel_at.toISOString() : String(row.cancel_at) } : {}),
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
  };
}

function mapDeliveryMessage(row: Record<string, unknown>): DeliveryMessage {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    companyId: String(row.company_id),
    channel: String(row.channel) as DeliveryMessage["channel"],
    recipient: String(row.recipient),
    ...(row.subject ? { subject: String(row.subject) } : {}),
    entityType: String(row.entity_type) as DeliveryMessage["entityType"],
    ...(row.entity_id ? { entityId: String(row.entity_id) } : {}),
    status: String(row.status) as DeliveryMessage["status"],
    ...(row.error ? { error: String(row.error) } : {}),
    ...(row.sent_at ? { sentAt: row.sent_at instanceof Date ? row.sent_at.toISOString() : String(row.sent_at) } : {}),
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
  };
}

export async function getSubscription(scope: TenantScope): Promise<Subscription> {
  const existing = await pool.query(
    "select * from subscriptions where tenant_id = $1 and company_id = $2 limit 1",
    [scope.tenantId, scope.companyId],
  );
  if (existing.rows[0]) return mapSubscription(existing.rows[0]);

  const company = await getCompany(scope, scope.companyId);
  const result = await pool.query(
    `insert into subscriptions (id, tenant_id, company_id, provider, plan, status, current_period_start, current_period_end)
     values ($1, $2, $3, 'manual', $4, 'trialing', now(), now() + interval '14 days')
     on conflict (tenant_id, company_id) do update set updated_at = now()
     returning *`,
    [createId("sub"), scope.tenantId, scope.companyId, company?.plan ?? "starter"],
  );
  return mapSubscription(result.rows[0]);
}

export async function createBillingCheckoutSession(scope: TenantScope, input: SubscriptionCheckoutInput): Promise<BillingCheckoutSession> {
  const subscription = await getSubscription(scope);
  const stripePriceId = process.env[`STRIPE_PRICE_${input.plan.toUpperCase()}`];
  const appUrl = process.env.WEB_ORIGIN ?? "https://fleetcore-web.onrender.com";
  const idempotencyKey = input.idempotencyKey ?? createId("stripe_idem");

  if (!process.env.STRIPE_SECRET_KEY || !stripePriceId) {
    return {
      idempotencyKey,
      mode: "manual",
      message: "Stripe is not configured yet. Add STRIPE_SECRET_KEY and STRIPE_PRICE_* to enable paid checkout.",
      subscription,
    };
  }

  const existingSession = await pool.query(
    `select * from stripe_checkout_sessions
     where tenant_id = $1 and company_id = $2 and idempotency_key = $3
     limit 1`,
    [scope.tenantId, scope.companyId, idempotencyKey],
  );
  if (existingSession.rows[0]?.checkout_url) {
    return {
      checkoutUrl: String(existingSession.rows[0].checkout_url),
      idempotencyKey,
      mode: "stripe",
      message: "Stripe checkout session reused from idempotency key.",
      subscription,
      ...(existingSession.rows[0].stripe_session_id ? { checkoutSessionId: String(existingSession.rows[0].stripe_session_id) } : {}),
    };
  }

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    body: new URLSearchParams({
      "line_items[0][price]": stripePriceId,
      "line_items[0][quantity]": "1",
      mode: "subscription",
      success_url: `${appUrl}?billing=success`,
      cancel_url: `${appUrl}?billing=cancelled`,
      client_reference_id: scope.companyId,
      "metadata[tenant_id]": scope.tenantId,
      "metadata[company_id]": scope.companyId,
      "metadata[plan]": input.plan,
      "metadata[subscription_id]": subscription.id,
      "subscription_data[metadata][tenant_id]": scope.tenantId,
      "subscription_data[metadata][company_id]": scope.companyId,
      "subscription_data[metadata][plan]": input.plan,
      "subscription_data[metadata][subscription_id]": subscription.id,
    }),
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Idempotency-Key": idempotencyKey,
    },
    method: "POST",
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Stripe checkout failed: ${errorBody}`);
  }

  const session = await response.json() as { id?: string; url?: string };
  await pool.query(
    `insert into stripe_checkout_sessions (
      id, tenant_id, company_id, subscription_id, plan, stripe_session_id, idempotency_key, status, checkout_url
    ) values ($1, $2, $3, $4, $5, $6, $7, 'created', $8)
    on conflict (idempotency_key) do update set
      stripe_session_id = coalesce(excluded.stripe_session_id, stripe_checkout_sessions.stripe_session_id),
      checkout_url = coalesce(excluded.checkout_url, stripe_checkout_sessions.checkout_url),
      updated_at = now()
    returning *`,
    [createId("stripe_checkout"), scope.tenantId, scope.companyId, subscription.id, input.plan, session.id ?? null, idempotencyKey, session.url ?? null],
  );
  return {
    ...(session.id ? { checkoutSessionId: session.id } : {}),
    ...(session.url ? { checkoutUrl: session.url } : {}),
    idempotencyKey,
    mode: "stripe",
    message: "Stripe checkout session created.",
    subscription,
  };
}

export async function syncSubscription(scope: TenantScope, input: SubscriptionSyncInput): Promise<Subscription> {
  const current = await getSubscription(scope);
  const result = await pool.query(
    `insert into subscriptions (
      id, tenant_id, company_id, provider, plan, status, external_customer_id, external_subscription_id,
      current_period_start, current_period_end, cancel_at
    ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    on conflict (tenant_id, company_id)
    do update set
      provider = excluded.provider,
      plan = excluded.plan,
      status = excluded.status,
      external_customer_id = coalesce(excluded.external_customer_id, subscriptions.external_customer_id),
      external_subscription_id = coalesce(excluded.external_subscription_id, subscriptions.external_subscription_id),
      current_period_start = excluded.current_period_start,
      current_period_end = excluded.current_period_end,
      cancel_at = excluded.cancel_at,
      updated_at = now()
    returning *`,
    [
      current.id,
      scope.tenantId,
      scope.companyId,
      input.provider,
      input.plan ?? current.plan,
      input.status,
      input.externalCustomerId ?? null,
      input.externalSubscriptionId ?? null,
      input.currentPeriodStart ?? null,
      input.currentPeriodEnd ?? null,
      input.cancelAt ?? null,
    ],
  );
  return mapSubscription(result.rows[0]);
}

type StripeWebhookEvent = {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
};

export type StripeWebhookProcessResult = {
  companyId?: string;
  duplicate: boolean;
  plan?: Subscription["plan"];
  processed: boolean;
  status: "processed" | "ignored" | "failed";
  subscriptionStatus?: Subscription["status"];
  tenantId?: string;
  type: string;
};

type StripeWebhookOutcome = {
  companyId?: string;
  plan?: Subscription["plan"];
  status: StripeWebhookProcessResult["status"];
  subscriptionStatus?: Subscription["status"];
  tenantId?: string;
};

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function metadataValue(object: Record<string, unknown>, key: string) {
  const metadata = object.metadata;
  if (!metadata || typeof metadata !== "object") return undefined;
  return stringValue((metadata as Record<string, unknown>)[key]);
}

function epochSecondsToIso(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? new Date(value * 1000).toISOString() : null;
}

function stripeStatus(value: unknown): Subscription["status"] {
  if (value === "trialing" || value === "active" || value === "past_due" || value === "canceled" || value === "incomplete") {
    return value;
  }
  if (value === "unpaid" || value === "incomplete_expired") return "past_due";
  return "incomplete";
}

async function findScopeForStripeObject(object: Record<string, unknown>): Promise<TenantScope | undefined> {
  const metadataScope = {
    companyId: metadataValue(object, "company_id") ?? stringValue(object.client_reference_id),
    tenantId: metadataValue(object, "tenant_id"),
  };
  if (metadataScope.tenantId && metadataScope.companyId) return metadataScope as TenantScope;

  const subscriptionId = stringValue(object.subscription) ?? stringValue(object.id);
  if (!subscriptionId) return undefined;

  const result = await pool.query(
    `select tenant_id, company_id from subscriptions
     where provider = 'stripe' and external_subscription_id = $1
     limit 1`,
    [subscriptionId],
  );
  return result.rows[0] ? { companyId: String(result.rows[0].company_id), tenantId: String(result.rows[0].tenant_id) } : undefined;
}

async function updateCompanyPlanAfterConfirmedStripePayment(scope: TenantScope, plan: Subscription["plan"]) {
  await pool.query(
    "update companies set plan = $3, updated_at = now() where tenant_id = $1 and id = $2",
    [scope.tenantId, scope.companyId, plan],
  );
}

async function syncStripeSubscriptionFromWebhook(scope: TenantScope, input: SubscriptionSyncInput, grantAccess: boolean) {
  const subscription = await syncSubscription(scope, input);
  if (grantAccess && (subscription.status === "active" || subscription.status === "trialing")) {
    await updateCompanyPlanAfterConfirmedStripePayment(scope, subscription.plan);
  }
  return subscription;
}

async function markStripeWebhookEvent(id: string, status: StripeWebhookProcessResult["status"], error?: string) {
  await pool.query(
    `update stripe_webhook_events
     set status = $2, error = $3, processed_at = now()
     where id = $1`,
    [id, status, error ?? null],
  );
}

async function handleCheckoutSessionCompleted(object: Record<string, unknown>): Promise<StripeWebhookOutcome> {
  const scope = await findScopeForStripeObject(object);
  if (!scope) return { status: "ignored" as const };

  const paymentStatus = stringValue(object.payment_status);
  const plan = metadataValue(object, "plan") as Subscription["plan"] | undefined;
  const grantAccess = paymentStatus === "paid" || paymentStatus === "no_payment_required";
  await pool.query(
    `update stripe_checkout_sessions
     set status = $4, stripe_session_id = coalesce(stripe_session_id, $3), updated_at = now()
     where tenant_id = $1 and company_id = $2 and stripe_session_id = $3`,
    [scope.tenantId, scope.companyId, stringValue(object.id) ?? null, grantAccess ? "completed" : "failed"],
  );

  await syncStripeSubscriptionFromWebhook(scope, {
    externalCustomerId: stringValue(object.customer),
    externalSubscriptionId: stringValue(object.subscription),
    plan,
    provider: "stripe",
    status: grantAccess ? "active" : "incomplete",
  }, grantAccess);
  return {
    ...scope,
    status: "processed" as const,
    subscriptionStatus: grantAccess ? "active" as const : "incomplete" as const,
    ...(plan ? { plan } : {}),
  };
}

async function handleStripeSubscriptionObject(object: Record<string, unknown>): Promise<StripeWebhookOutcome> {
  const scope = await findScopeForStripeObject(object);
  if (!scope) return { status: "ignored" as const };
  const status = stripeStatus(object.status);
  const plan = metadataValue(object, "plan") as Subscription["plan"] | undefined;
  await syncStripeSubscriptionFromWebhook(scope, {
    cancelAt: epochSecondsToIso(object.cancel_at),
    currentPeriodEnd: epochSecondsToIso(object.current_period_end),
    currentPeriodStart: epochSecondsToIso(object.current_period_start),
    externalCustomerId: stringValue(object.customer),
    externalSubscriptionId: stringValue(object.id),
    plan,
    provider: "stripe",
    status,
  }, status === "active" || status === "trialing");
  return {
    ...scope,
    status: "processed" as const,
    subscriptionStatus: status,
    ...(plan ? { plan } : {}),
  };
}

async function handleStripeInvoice(object: Record<string, unknown>, status: Subscription["status"], grantAccess: boolean): Promise<StripeWebhookOutcome> {
  const scope = await findScopeForStripeObject(object);
  if (!scope) return { status: "ignored" as const };
  await syncStripeSubscriptionFromWebhook(scope, {
    externalCustomerId: stringValue(object.customer),
    externalSubscriptionId: stringValue(object.subscription),
    provider: "stripe",
    status,
  }, grantAccess);
  return { ...scope, status: "processed" as const, subscriptionStatus: status };
}

export async function processStripeWebhookEvent(event: StripeWebhookEvent): Promise<StripeWebhookProcessResult> {
  const inserted = await pool.query(
    `insert into stripe_webhook_events (id, type, status, payload)
     values ($1, $2, 'processing', $3::jsonb)
     on conflict (id) do nothing`,
    [event.id, event.type, JSON.stringify(event)],
  );
  if (!inserted.rowCount) {
    return { duplicate: true, processed: false, status: "ignored", type: event.type };
  }

  try {
    const object = event.data.object;
    const outcome = event.type === "checkout.session.completed"
      ? await handleCheckoutSessionCompleted(object)
      : event.type === "checkout.session.expired"
        ? await (async (): Promise<StripeWebhookOutcome> => {
          await pool.query(
            "update stripe_checkout_sessions set status = 'expired', updated_at = now() where stripe_session_id = $1",
            [stringValue(object.id) ?? null],
          );
          return { status: "processed" };
        })()
        : event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted"
          ? await handleStripeSubscriptionObject(object)
          : event.type === "invoice.payment_failed"
            ? await handleStripeInvoice(object, "past_due", false)
            : event.type === "invoice.payment_succeeded"
              ? await handleStripeInvoice(object, "active", true)
              : { status: "ignored" as const };

    await markStripeWebhookEvent(event.id, outcome.status);
    return {
      duplicate: false,
      processed: outcome.status === "processed",
      status: outcome.status,
      type: event.type,
      ...(outcome.companyId ? { companyId: outcome.companyId } : {}),
      ...(outcome.plan ? { plan: outcome.plan } : {}),
      ...(outcome.subscriptionStatus ? { subscriptionStatus: outcome.subscriptionStatus } : {}),
      ...(outcome.tenantId ? { tenantId: outcome.tenantId } : {}),
    };
  } catch (error) {
    await markStripeWebhookEvent(event.id, "failed", error instanceof Error ? error.message : "Unknown Stripe webhook processing error");
    throw error;
  }
}

export async function createDeliveryMessage(scope: TenantScope, input: DeliveryMessageInput, userId?: string): Promise<DeliveryMessage> {
  const result = await pool.query(
    `insert into delivery_messages (
      id, tenant_id, company_id, user_id, channel, recipient, subject, body, entity_type, entity_id, status, sent_at
    ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'queued', null)
    returning *`,
    [
      createId("msg"),
      scope.tenantId,
      scope.companyId,
      userId ?? null,
      input.channel,
      input.recipient,
      input.subject ?? null,
      input.body,
      input.entityType,
      input.entityId ?? null,
    ],
  );
  return mapDeliveryMessage(result.rows[0]);
}

export async function updateDeliveryMessageStatus(scope: TenantScope, messageId: string, input: {
  error?: string;
  providerMessageId?: string;
  status: DeliveryMessage["status"];
}): Promise<DeliveryMessage | undefined> {
  const result = await pool.query(
    `update delivery_messages
     set status = $4,
         provider_message_id = $5,
         error = $6,
         sent_at = case when $4 = 'sent' then now() else sent_at end,
         updated_at = now()
     where tenant_id = $1 and company_id = $2 and id = $3
     returning *`,
    [scope.tenantId, scope.companyId, messageId, input.status, input.providerMessageId ?? null, input.error ?? null],
  );
  return result.rows[0] ? mapDeliveryMessage(result.rows[0]) : undefined;
}

export async function listDeliveryMessages(scope: TenantScope, entityId?: string): Promise<DeliveryMessage[]> {
  const result = await pool.query(
    `select *
     from delivery_messages
     where tenant_id = $1 and company_id = $2 and ($3::text is null or entity_id = $3)
     order by created_at desc
     limit 200`,
    [scope.tenantId, scope.companyId, entityId ?? null],
  );
  return result.rows.map(mapDeliveryMessage);
}

type FileObjectStorageInput = {
  data?: Buffer | null;
  fileId?: string;
  sha256: string;
  sizeBytes: number;
  storageKey: string;
  storageProvider: "database" | "s3";
};

export async function createFileObject(
  scope: TenantScope,
  input: FileUploadInput,
  publicUrlForId: (id: string, originalName: string) => string,
  uploadedByUserId?: string,
  storage?: FileObjectStorageInput,
): Promise<FileObject> {
  const fileId = storage?.fileId ?? createId("file");
  const data = storage ? storage.data ?? null : Buffer.from(input.base64, "base64");
  const sha256 = storage?.sha256 ?? createHash("sha256").update(data ?? Buffer.alloc(0)).digest("hex");
  const sizeBytes = storage?.sizeBytes ?? data?.byteLength ?? 0;
  const result = await pool.query(
    `insert into file_objects (
      id, tenant_id, company_id, original_name, mime_type, size_bytes, data,
      storage_provider, storage_key, sha256, uploaded_by_user_id
    ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    returning id, tenant_id, company_id, original_name, mime_type, size_bytes, storage_provider, storage_key, sha256, created_at, updated_at`,
    [
      fileId,
      scope.tenantId,
      scope.companyId,
      input.originalName,
      input.mimeType,
      sizeBytes,
      data,
      storage?.storageProvider ?? "database",
      storage?.storageKey ?? fileId,
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

export async function getFileObject(scope: TenantScope, fileId: string): Promise<{
  companyId: string;
  data?: Buffer;
  mimeType: string;
  originalName: string;
  sha256?: string;
  storageKey?: string;
  storageProvider: "database" | "s3";
  tenantId: string;
} | undefined> {
  const result = await pool.query(
    "select tenant_id, company_id, original_name, mime_type, data, storage_provider, storage_key, sha256 from file_objects where tenant_id = $1 and company_id = $2 and id = $3",
    [scope.tenantId, scope.companyId, fileId],
  );
  if (!result.rows[0]) return undefined;
  return {
    tenantId: String(result.rows[0].tenant_id),
    companyId: String(result.rows[0].company_id),
    ...(result.rows[0].data ? { data: result.rows[0].data as Buffer } : {}),
    mimeType: String(result.rows[0].mime_type),
    originalName: String(result.rows[0].original_name),
    storageProvider: (result.rows[0].storage_provider ? String(result.rows[0].storage_provider) : "database") as "database" | "s3",
    ...(result.rows[0].storage_key ? { storageKey: String(result.rows[0].storage_key) } : {}),
    ...(result.rows[0].sha256 ? { sha256: String(result.rows[0].sha256) } : {}),
  };
}

export async function deleteFileObject(scope: TenantScope, fileId: string): Promise<{
  companyId: string;
  storageKey?: string;
  storageProvider: "database" | "s3";
  tenantId: string;
} | undefined> {
  const result = await pool.query(
    `delete from file_objects
     where tenant_id = $1 and company_id = $2 and id = $3
     returning tenant_id, company_id, storage_provider, storage_key`,
    [scope.tenantId, scope.companyId, fileId],
  );
  if (!result.rows[0]) return undefined;
  return {
    tenantId: String(result.rows[0].tenant_id),
    companyId: String(result.rows[0].company_id),
    storageProvider: (result.rows[0].storage_provider ? String(result.rows[0].storage_provider) : "database") as "database" | "s3",
    ...(result.rows[0].storage_key ? { storageKey: String(result.rows[0].storage_key) } : {}),
  };
}

type DashboardFolderRow = {
  company_id: string;
  created_at: Date | string;
  id: string;
  name: string;
  tenant_id: string;
  updated_at: Date | string;
};

function mapDashboardFolder(
  row: DashboardFolderRow,
  files: DashboardFolderFile[],
  notes: DashboardFolderNote[],
): DashboardFolder {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    companyId: String(row.company_id),
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
    files,
    name: String(row.name),
    notes,
  };
}

async function hydrateDashboardFolders(scope: TenantScope, rows: DashboardFolderRow[], publicUrlForId: (id: string, originalName: string) => string): Promise<DashboardFolder[]> {
  if (!rows.length) return [];

  const folderIds = rows.map((row) => row.id);
  const [filesResult, notesResult] = await Promise.all([
    pool.query(
      `select dashboard_folder_files.id as folder_file_id,
              dashboard_folder_files.folder_id,
              dashboard_folder_files.created_at as added_at,
              file_objects.id,
              file_objects.tenant_id,
              file_objects.company_id,
              file_objects.original_name,
              file_objects.mime_type,
              file_objects.size_bytes,
              file_objects.storage_provider,
              file_objects.storage_key,
              file_objects.sha256,
              file_objects.created_at,
              file_objects.updated_at
       from dashboard_folder_files
       join file_objects on file_objects.id = dashboard_folder_files.file_id
       where dashboard_folder_files.tenant_id = $1
         and dashboard_folder_files.company_id = $2
         and dashboard_folder_files.folder_id = any($3::text[])
       order by dashboard_folder_files.created_at desc`,
      [scope.tenantId, scope.companyId, folderIds],
    ),
    pool.query(
      `select id, folder_id, text, created_at, updated_at
       from dashboard_folder_notes
       where tenant_id = $1 and company_id = $2 and folder_id = any($3::text[])
       order by created_at desc`,
      [scope.tenantId, scope.companyId, folderIds],
    ),
  ]);

  const filesByFolder = new Map<string, DashboardFolderFile[]>();
  for (const row of filesResult.rows) {
    const folderId = String(row.folder_id);
    const list = filesByFolder.get(folderId) ?? [];
    list.push({
      addedAt: row.added_at instanceof Date ? row.added_at.toISOString() : String(row.added_at),
      file: mapFileObject(row, publicUrlForId(String(row.id), String(row.original_name))),
      id: String(row.folder_file_id),
    });
    filesByFolder.set(folderId, list);
  }

  const notesByFolder = new Map<string, DashboardFolderNote[]>();
  for (const row of notesResult.rows) {
    const folderId = String(row.folder_id);
    const list = notesByFolder.get(folderId) ?? [];
    list.push({
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
      id: String(row.id),
      text: String(row.text),
      updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
    });
    notesByFolder.set(folderId, list);
  }

  return rows.map((row) => mapDashboardFolder(row, filesByFolder.get(row.id) ?? [], notesByFolder.get(row.id) ?? []));
}

export async function listDashboardFolders(scope: TenantScope, publicUrlForId: (id: string, originalName: string) => string): Promise<DashboardFolder[]> {
  const result = await pool.query(
    `select id, tenant_id, company_id, name, created_at, updated_at
     from dashboard_folders
     where tenant_id = $1 and company_id = $2
     order by updated_at desc, created_at desc`,
    [scope.tenantId, scope.companyId],
  );
  return hydrateDashboardFolders(scope, result.rows, publicUrlForId);
}

export async function createDashboardFolder(scope: TenantScope, input: DashboardFolderInput, userId?: string): Promise<DashboardFolder> {
  const id = createId("folder");
  const result = await pool.query(
    `insert into dashboard_folders (id, tenant_id, company_id, name, created_by)
     values ($1, $2, $3, $4, $5)
     returning id, tenant_id, company_id, name, created_at, updated_at`,
    [id, scope.tenantId, scope.companyId, input.name, userId ?? null],
  );
  return mapDashboardFolder(result.rows[0], [], []);
}

export async function updateDashboardFolder(scope: TenantScope, folderId: string, input: DashboardFolderPatchInput): Promise<DashboardFolder | undefined> {
  const result = await pool.query(
    `update dashboard_folders
     set name = coalesce($3, name), updated_at = now()
     where tenant_id = $1 and company_id = $2 and id = $4
     returning id, tenant_id, company_id, name, created_at, updated_at`,
    [scope.tenantId, scope.companyId, input.name ?? null, folderId],
  );
  if (!result.rows[0]) return undefined;
  return mapDashboardFolder(result.rows[0], [], []);
}

export async function deleteDashboardFolder(scope: TenantScope, folderId: string): Promise<boolean> {
  const result = await pool.query(
    "delete from dashboard_folders where tenant_id = $1 and company_id = $2 and id = $3",
    [scope.tenantId, scope.companyId, folderId],
  );
  return Boolean(result.rowCount);
}

export async function addDashboardFolderFile(scope: TenantScope, folderId: string, input: DashboardFolderFileInput, userId?: string): Promise<boolean> {
  const id = createId("folder_file");
  const result = await pool.query(
    `insert into dashboard_folder_files (id, tenant_id, company_id, folder_id, file_id, created_by)
     select $1, $2, $3, dashboard_folders.id, file_objects.id, $6
     from dashboard_folders
     join file_objects on file_objects.id = $5
      and file_objects.tenant_id = dashboard_folders.tenant_id
      and file_objects.company_id = dashboard_folders.company_id
     where dashboard_folders.tenant_id = $2
       and dashboard_folders.company_id = $3
       and dashboard_folders.id = $4
     on conflict (tenant_id, company_id, folder_id, file_id) do nothing`,
    [id, scope.tenantId, scope.companyId, folderId, input.fileId, userId ?? null],
  );
  if (result.rowCount) {
    await pool.query("update dashboard_folders set updated_at = now() where tenant_id = $1 and company_id = $2 and id = $3", [scope.tenantId, scope.companyId, folderId]);
  }
  return Boolean(result.rowCount);
}

export async function removeDashboardFolderFile(scope: TenantScope, folderId: string, folderFileId: string): Promise<boolean> {
  const result = await pool.query(
    "delete from dashboard_folder_files where tenant_id = $1 and company_id = $2 and folder_id = $3 and id = $4",
    [scope.tenantId, scope.companyId, folderId, folderFileId],
  );
  if (result.rowCount) {
    await pool.query("update dashboard_folders set updated_at = now() where tenant_id = $1 and company_id = $2 and id = $3", [scope.tenantId, scope.companyId, folderId]);
  }
  return Boolean(result.rowCount);
}

export async function addDashboardFolderNote(scope: TenantScope, folderId: string, input: DashboardFolderNoteInput, userId?: string): Promise<DashboardFolderNote | undefined> {
  const id = createId("folder_note");
  const result = await pool.query(
    `insert into dashboard_folder_notes (id, tenant_id, company_id, folder_id, text, created_by)
     select $1, $2, $3, id, $5, $6
     from dashboard_folders
     where tenant_id = $2 and company_id = $3 and id = $4
     returning id, text, created_at, updated_at`,
    [id, scope.tenantId, scope.companyId, folderId, input.text, userId ?? null],
  );
  if (!result.rows[0]) return undefined;
  await pool.query("update dashboard_folders set updated_at = now() where tenant_id = $1 and company_id = $2 and id = $3", [scope.tenantId, scope.companyId, folderId]);
  return {
    createdAt: result.rows[0].created_at instanceof Date ? result.rows[0].created_at.toISOString() : String(result.rows[0].created_at),
    id: String(result.rows[0].id),
    text: String(result.rows[0].text),
    updatedAt: result.rows[0].updated_at instanceof Date ? result.rows[0].updated_at.toISOString() : String(result.rows[0].updated_at),
  };
}

export async function removeDashboardFolderNote(scope: TenantScope, folderId: string, noteId: string): Promise<boolean> {
  const result = await pool.query(
    "delete from dashboard_folder_notes where tenant_id = $1 and company_id = $2 and folder_id = $3 and id = $4",
    [scope.tenantId, scope.companyId, folderId, noteId],
  );
  if (result.rowCount) {
    await pool.query("update dashboard_folders set updated_at = now() where tenant_id = $1 and company_id = $2 and id = $3", [scope.tenantId, scope.companyId, folderId]);
  }
  return Boolean(result.rowCount);
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

export async function updateCompanyBranding(scope: TenantScope, companyId: string, input: CompanyBrandingInput) {
  const patch = patchSet(
    {
      tradingName: input.tradingName,
      legalName: input.legalName,
      logoUrl: input.logoUrl,
      brandColor: input.brandColor,
      billingEmail: input.billingEmail,
      taxId: input.taxId,
      iban: input.iban,
      businessAddress: input.businessAddress,
      contractFooter: input.contractFooter,
    },
    {
      tradingName: "trading_name",
      legalName: "legal_name",
      logoUrl: "logo_url",
      brandColor: "brand_color",
      billingEmail: "billing_email",
      taxId: "tax_id",
      iban: "iban",
      businessAddress: "business_address",
      contractFooter: "contract_footer",
    },
    4,
  );
  if (!patch.sql) return getCompany(scope, companyId);

  const result = await pool.query(
    `update companies set ${patch.sql}, updated_at = now() where tenant_id = $1 and id = $2 and id = $3 returning *`,
    [scope.tenantId, scope.companyId, companyId, ...patch.values],
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

export async function updateUserProfile(userId: string, input: ProfileUpdateInput): Promise<User | undefined> {
  const patch = patchSet(
    {
      fullName: input.fullName,
      photoUrl: input.photoUrl,
    },
    {
      fullName: "full_name",
      photoUrl: "photo_url",
    },
    2,
  );
  if (!patch.sql) {
    const result = await pool.query("select * from users where id = $1", [userId]);
    return result.rows[0] ? mapUser(result.rows[0]) : undefined;
  }

  const result = await pool.query(
    `update users set ${patch.sql}, updated_at = now() where id = $1 returning *`,
    [userId, ...patch.values],
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
      status, location, odometer_km, daily_rate, photo_url
    ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
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
      input.photoUrl ?? null,
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
      photoUrl: input.photoUrl,
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
      photoUrl: "photo_url",
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

export async function findCustomerByEmail(scope: TenantScope, email: string) {
  const result = await pool.query(
    "select * from customers where tenant_id = $1 and company_id = $2 and lower(email) = lower($3) limit 1",
    [scope.tenantId, scope.companyId, email],
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

export async function hasOverlappingRentalBooking(
  scope: TenantScope,
  input: { excludeRentalId?: string; pickupAt: string; returnAt: string; vehicleId: string },
) {
  const result = await pool.query(
    `select 1
     from rentals
     where tenant_id = $1
       and company_id = $2
       and vehicle_id = $3
       and status <> 'closed'
       and id <> coalesce($6::text, '')
       and pickup_at < $5::timestamptz
       and return_at > $4::timestamptz
     limit 1`,
    [scope.tenantId, scope.companyId, input.vehicleId, input.pickupAt, input.returnAt, input.excludeRentalId ?? null],
  );
  return Boolean(result.rowCount);
}

export async function hasRentalChecklistPhase(scope: TenantScope, rentalId: string, phase: RentalChecklistInput["phase"]) {
  const result = await pool.query(
    `select 1
     from rental_checklists
     where tenant_id = $1
       and company_id = $2
       and rental_id = $3
       and phase = $4
     limit 1`,
    [scope.tenantId, scope.companyId, rentalId, phase],
  );
  return Boolean(result.rowCount);
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

export async function listRentalChecklists(scope: TenantScope, rentalId?: string): Promise<RentalChecklist[]> {
  const result = await pool.query(
    `select *
     from rental_checklists
     where tenant_id = $1
       and company_id = $2
       and ($3::text is null or rental_id = $3)
     order by created_at desc`,
    [scope.tenantId, scope.companyId, rentalId ?? null],
  );
  return result.rows.map(mapRentalChecklist);
}

export async function upsertRentalChecklist(scope: TenantScope, input: RentalChecklistInput): Promise<RentalChecklist | undefined> {
  const rental = await getRental(scope, input.rentalId);
  if (!rental) return undefined;

  const result = await pool.query(
    `insert into rental_checklists (
      id, tenant_id, company_id, rental_id, vehicle_id, customer_id, phase,
      odometer_km, fuel_level, exterior_ok, interior_ok, documents_ok, deposit_confirmed, notes, photo_urls
    ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb)
    on conflict (tenant_id, company_id, rental_id, phase)
    do update set
      odometer_km = excluded.odometer_km,
      fuel_level = excluded.fuel_level,
      exterior_ok = excluded.exterior_ok,
      interior_ok = excluded.interior_ok,
      documents_ok = excluded.documents_ok,
      deposit_confirmed = excluded.deposit_confirmed,
      notes = excluded.notes,
      photo_urls = excluded.photo_urls,
      updated_at = now()
    returning *`,
    [
      createId("chk"),
      scope.tenantId,
      scope.companyId,
      rental.id,
      rental.vehicleId,
      rental.customerId,
      input.phase,
      input.odometerKm,
      input.fuelLevel,
      input.exteriorOk,
      input.interiorOk,
      input.documentsOk,
      input.depositConfirmed,
      input.notes,
      JSON.stringify(input.photoUrls),
    ],
  );
  return mapRentalChecklist(result.rows[0]);
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

function flowStep(key: RentalFlowStep["key"], label: string, status: RentalFlowStep["status"], detail: string, actionLabel?: string): RentalFlowStep {
  return { key, label, status, detail, ...(actionLabel ? { actionLabel } : {}) };
}

export async function getRentalFlow(scope: TenantScope, rentalId: string): Promise<RentalFlow | undefined> {
  const rental = await getRental(scope, rentalId);
  if (!rental) return undefined;

  const [customer, vehicle, invoices, payments, contracts, checklists] = await Promise.all([
    getCustomer(scope, rental.customerId),
    getVehicle(scope, rental.vehicleId),
    listInvoices(scope),
    listPayments(scope),
    listRentalContracts(scope),
    listRentalChecklists(scope, rental.id),
  ]);
  if (!customer || !vehicle) return undefined;

  const invoice = invoices.find((item) => item.rentalId === rental.id);
  const contract = contracts.find((item) => item.rentalId === rental.id);
  const paidAmount = invoice
    ? payments.filter((item) => item.invoiceId === invoice.id).reduce((sum, payment) => sum + payment.amount, 0)
    : 0;
  const isPaid = invoice ? paidAmount >= invoice.total || invoice.status === "paid" : false;
  const pickupDone = checklists.some((item) => item.phase === "pickup");
  const returnDone = checklists.some((item) => item.phase === "return");
  const contractDone = contract?.status === "signed";
  const closed = rental.status === "closed";
  const active = rental.status === "active" || rental.status === "return_due" || closed;

  const steps: RentalFlowStep[] = [
    flowStep("booking", "Booking", "done", `${customer.displayName} · ${vehicle.plateNumber}`),
    flowStep(
      "contract",
      "Contract",
      contractDone ? "done" : "current",
      contract ? `Status: ${contract.status}` : "Generate and send rental agreement",
      contractDone ? undefined : "Create contract",
    ),
    flowStep(
      "payment",
      "Payment",
      isPaid ? "done" : contractDone ? "current" : "blocked",
      invoice ? `${paidAmount}/${invoice.total} ${invoice.currency}` : "Create invoice and payment",
      isPaid ? undefined : "Take payment",
    ),
    flowStep(
      "pickup",
      "Pickup checklist",
      pickupDone ? "done" : isPaid ? "current" : "blocked",
      pickupDone ? "Vehicle handover confirmed" : "Inspect vehicle and confirm deposit",
      pickupDone ? undefined : "Complete pickup",
    ),
    flowStep(
      "activeRental",
      "Active rental",
      active ? "done" : pickupDone ? "current" : "pending",
      active ? `Status: ${rental.status}` : "Start rental after pickup",
      active ? undefined : "Start rental",
    ),
    flowStep(
      "return",
      "Return checklist",
      returnDone || closed ? "done" : active ? "current" : "pending",
      returnDone || closed ? "Return inspection saved" : "Inspect vehicle at return",
      returnDone || closed ? undefined : "Complete return",
    ),
    flowStep(
      "deposit",
      "Deposit return",
      closed ? "done" : returnDone ? "current" : "pending",
      closed ? "Deposit flow closed" : "Refund or charge deposit difference",
      closed ? undefined : "Process deposit",
    ),
    flowStep(
      "closed",
      "Closed",
      closed ? "done" : "pending",
      closed ? "Rental completed" : "Close rental after return and deposit",
    ),
  ];

  const nextAction = steps.find((item) => item.status === "current" || item.status === "blocked");

  return {
    rental,
    customer,
    vehicle,
    ...(contract ? { contract } : {}),
    ...(invoice ? { invoice } : {}),
    paidAmount,
    checklists,
    contractPdfUrl: `/rentals/${rental.id}/contract.pdf`,
    ...(nextAction ? { nextAction } : {}),
    steps,
  };
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
    const paidResult = await client.query(
      "select coalesce(sum(amount), 0)::float as paid from payments where tenant_id = $1 and company_id = $2 and invoice_id = $3",
      [scope.tenantId, scope.companyId, invoiceId],
    );
    const paidAmount = Number(paidResult.rows[0]?.paid ?? 0);
    const remainingAmount = Number(invoice.total) - paidAmount;
    if (remainingAmount <= 0) {
      throw new PaymentValidationError("Invoice is already paid");
    }
    if (input.amount > remainingAmount + 0.01) {
      throw new PaymentValidationError(`Payment amount exceeds remaining invoice balance (${remainingAmount.toFixed(2)} ${invoice.currency})`);
    }

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
  const document = mapVehicleDocument(result.rows[0]);
  await upsertCanonicalDocument({
    category: input.type === "rental_contract" ? "rental_contract" : input.type === "other" ? "other" : "vehicle_compliance",
    companyId: scope.companyId,
    expiresAt: input.expiresAt,
    id: `doc_vehicle_${document.id}`,
    links: [{ entityId: input.vehicleId, entityType: "vehicle", relationType: "attached" }],
    metadata: { fileUrl: input.fileUrl, legacyId: document.id, legacyTable: "vehicle_documents" },
    source: "upload",
    status: input.expiresAt && new Date(input.expiresAt) < new Date() ? "expired" : "valid",
    tenantId: scope.tenantId,
    title: input.title,
    type: input.type,
  });
  return document;
}

async function upsertCanonicalDocument(input: {
  category: FleetDocument["category"];
  companyId: string;
  expiresAt?: string | undefined;
  id: string;
  links: Array<{ entityId: string; entityType: FleetDocument["links"][number]["entityType"]; relationType: string }>;
  metadata: Record<string, unknown>;
  source: FleetDocument["source"];
  status: FleetDocument["status"];
  tenantId: string;
  title: string;
  type: string;
  verifiedAt?: string | undefined;
}) {
  await pool.query(
    `insert into documents (
      id, tenant_id, company_id, title, category, type, status, source, expires_at, verified_at, search_text, metadata
    ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb)
    on conflict (id) do update set
      title = excluded.title,
      category = excluded.category,
      type = excluded.type,
      status = excluded.status,
      source = excluded.source,
      expires_at = excluded.expires_at,
      verified_at = excluded.verified_at,
      search_text = excluded.search_text,
      metadata = excluded.metadata,
      updated_at = now()`,
    [
      input.id,
      input.tenantId,
      input.companyId,
      input.title,
      input.category,
      input.type,
      input.status,
      input.source,
      input.expiresAt ?? null,
      input.verifiedAt ?? null,
      `${input.title} ${input.type} ${Object.values(input.metadata).join(" ")}`.trim(),
      JSON.stringify(input.metadata),
    ],
  );

  for (const link of input.links) {
    await pool.query(
      `insert into document_links (
        id, tenant_id, company_id, document_id, entity_type, entity_id, relation_type
      ) values ($1, $2, $3, $4, $5, $6, $7)
      on conflict do nothing`,
      [
        `link_${input.id}_${link.entityType}_${link.entityId}_${link.relationType}`.replace(/[^a-zA-Z0-9_]/g, "_"),
        input.tenantId,
        input.companyId,
        input.id,
        link.entityType,
        link.entityId,
        link.relationType,
      ],
    );
  }
}

export async function listFleetDocuments(
  scope: TenantScope,
  filters: {
    category?: string | undefined;
    entityId?: string | undefined;
    entityType?: string | undefined;
    query?: string | undefined;
    status?: string | undefined;
  } = {},
): Promise<FleetDocument[]> {
  const values: unknown[] = [scope.tenantId, scope.companyId];
  const where = ["documents.tenant_id = $1", "documents.company_id = $2", "documents.archived_at is null"];

  if (filters.category) {
    values.push(filters.category);
    where.push(`documents.category = $${values.length}`);
  }

  if (filters.status) {
    values.push(filters.status);
    where.push(`documents.status = $${values.length}`);
  }

  if (filters.query) {
    values.push(`%${filters.query.toLowerCase()}%`);
    where.push(`lower(documents.search_text) like $${values.length}`);
  }

  if (filters.entityType || filters.entityId) {
    if (filters.entityType) {
      values.push(filters.entityType);
      where.push(`exists (
        select 1 from document_links entity_filter
        where entity_filter.tenant_id = documents.tenant_id
          and entity_filter.company_id = documents.company_id
          and entity_filter.document_id = documents.id
          and entity_filter.entity_type = $${values.length}
      )`);
    }

    if (filters.entityId) {
      values.push(filters.entityId);
      where.push(`exists (
        select 1 from document_links entity_filter
        where entity_filter.tenant_id = documents.tenant_id
          and entity_filter.company_id = documents.company_id
          and entity_filter.document_id = documents.id
          and entity_filter.entity_id = $${values.length}
      )`);
    }
  }

  const result = await pool.query(
    `select
       documents.*,
       coalesce(
         json_agg(distinct jsonb_build_object(
           'entityId', document_links.entity_id,
           'entityType', document_links.entity_type,
           'relationType', document_links.relation_type
         )) filter (where document_links.id is not null),
         '[]'::json
       ) as links,
       coalesce(
         json_agg(distinct document_tags.tag) filter (where document_tags.id is not null),
         '[]'::json
       ) as tags
     from documents
     left join document_links
       on document_links.tenant_id = documents.tenant_id
      and document_links.company_id = documents.company_id
      and document_links.document_id = documents.id
     left join document_tags
       on document_tags.tenant_id = documents.tenant_id
      and document_tags.company_id = documents.company_id
      and document_tags.document_id = documents.id
     where ${where.join(" and ")}
     group by documents.id
     order by documents.created_at desc
     limit 100`,
    values,
  );
  return result.rows.map(mapFleetDocument);
}

export async function buildComplianceExport(
  scope: TenantScope,
  publicUrlForId: (id: string, originalName: string) => string,
): Promise<ComplianceExport | undefined> {
  const company = await getCompany(scope, scope.companyId);
  if (!company) return undefined;

  const [
    auditLogs,
    customers,
    dashboardFolders,
    dataSubjectRequests,
    documents,
    files,
    invoices,
    legalConsents,
    payments,
    rentals,
    serviceRecords,
    teamUsers,
    vehicles,
  ] = await Promise.all([
    listAuditLogs(scope, 500),
    listCustomers(scope),
    listDashboardFolders(scope, publicUrlForId),
    listDataSubjectRequests(scope),
    listFleetDocuments(scope),
    listFileObjects(scope, publicUrlForId),
    listInvoices(scope),
    listLegalConsents(scope),
    listPayments(scope),
    listRentals(scope),
    listServiceRecords(scope),
    listTeamUsers(scope),
    listVehicles(scope),
  ]);

  return {
    auditLogs,
    company,
    customers,
    dashboardFolders,
    dataSubjectRequests,
    documents,
    files,
    generatedAt: new Date().toISOString(),
    invoices,
    legalConsents,
    payments,
    rentals,
    serviceRecords,
    teamUsers,
    vehicles,
  };
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
  const document = mapCustomerDocument(result.rows[0]);
  await upsertCanonicalDocument({
    category: "customer_identity",
    companyId: scope.companyId,
    id: `doc_customer_${document.id}`,
    links: [{ entityId: input.customerId, entityType: "customer", relationType: "identity" }],
    metadata: { fileUrl: input.fileUrl, legacyId: document.id, legacyTable: "customer_documents", verified: input.verified },
    source: "upload",
    status: input.verified ? "valid" : "pending_review",
    tenantId: scope.tenantId,
    title: input.title,
    type: input.type,
    verifiedAt: input.verified ? new Date().toISOString() : undefined,
  });
  return document;
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
      status = case
        when rental_contracts.status = 'signed' then 'signed'
        else excluded.status
      end,
      document_url = excluded.document_url,
      sent_via = excluded.sent_via,
      sent_at = coalesce(excluded.sent_at, rental_contracts.sent_at),
      viewed_at = coalesce(excluded.viewed_at, rental_contracts.viewed_at),
      signed_at = coalesce(rental_contracts.signed_at, excluded.signed_at),
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
  await upsertCanonicalDocument({
    category: "rental_contract",
    companyId: scope.companyId,
    id: `doc_contract_${contract.id}`,
    links: [
      { entityId: contract.id, entityType: "contract", relationType: "canonical" },
      { entityId: contract.rentalId, entityType: "rental", relationType: "contract" },
      { entityId: contract.customerId, entityType: "customer", relationType: "contract" },
      { entityId: rental.vehicleId, entityType: "vehicle", relationType: "contract" },
    ],
    metadata: { fileUrl: contract.documentUrl, legacyId: contract.id, legacyTable: "rental_contracts", sentVia: contract.sentVia },
    source: "contract_flow",
    status: contract.status === "signed" ? "valid" : contract.status === "draft" ? "draft" : "pending_review",
    tenantId: scope.tenantId,
    title: `Rental contract ${contract.id}`,
    type: "rental_agreement",
    verifiedAt: contract.signedAt,
  });
  if (publicToken && publicTokenHash) {
    await pool.query(
      `insert into rental_contract_links (
        id, tenant_id, company_id, contract_id, rental_id, customer_id, channel, public_token_hash
      ) values ($1, $2, $3, $4, $5, $6, $7, $8)
      on conflict (public_token_hash) do nothing`,
      [
        createId("clink"),
        scope.tenantId,
        scope.companyId,
        contract.id,
        contract.rentalId,
        contract.customerId,
        input.sentVia,
        publicTokenHash,
      ],
    );
  }
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
     where id = $1
       and status in ('sent', 'viewed', 'signed')
       and (
         public_token_hash = $2
         or exists (
           select 1 from rental_contract_links
           where rental_contract_links.contract_id = rental_contracts.id
             and rental_contract_links.public_token_hash = $2
         )
       )
     returning *, $3 || '/operations/rental-contracts/public/' || id as public_url`,
    [contractId, tokenHash, publicOrigin],
  );
  if (result.rows[0]) {
    await pool.query("update rental_contract_links set last_used_at = now() where contract_id = $1 and public_token_hash = $2", [contractId, tokenHash]);
  }
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
     where id = $1
       and status in ('sent', 'viewed')
       and (
         public_token_hash = $2
         or exists (
           select 1 from rental_contract_links
           where rental_contract_links.contract_id = rental_contracts.id
             and rental_contract_links.public_token_hash = $2
         )
       )
     returning *, $3 || '/operations/rental-contracts/public/' || id as public_url`,
    [contractId, tokenHash, publicOrigin],
  );
  if (!result.rows[0]) return undefined;
  await pool.query("update rental_contract_links set last_used_at = now() where contract_id = $1 and public_token_hash = $2", [contractId, tokenHash]);
  const contract = mapRentalContract(result.rows[0]);
  return {
    contract: { ...contract, publicUrl: `${publicOrigin}/operations/rental-contracts/public/${contract.id}?token=${publicToken}` },
    signerName,
  };
}
