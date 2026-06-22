import type { FastifyPluginAsync } from "fastify";
import { createBillingCheckoutSession, createDeliveryMessage, getCompany, getSubscription, listTeamUsers, processStripeWebhookEvent, syncSubscription, updateDeliveryMessageStatus, writeAuditLog, type StripeWebhookProcessResult } from "../db/repositories.js";
import { getRequestUser, getTenantScope, requireRoles } from "../lib/access-control.js";
import { sendTransactionalEmail, type TransactionalEmailKind } from "../lib/email.js";
import { envelope } from "../lib/http.js";
import { parseStripeWebhookEvent, StripeSignatureError } from "../lib/stripe.js";
import { subscriptionCheckoutInput, subscriptionSyncInput } from "../schemas.js";

function moneyFromStripeObject(object: Record<string, unknown>) {
  const amount = typeof object.amount_paid === "number" ? object.amount_paid : typeof object.amount_due === "number" ? object.amount_due : undefined;
  const currency = typeof object.currency === "string" ? object.currency.toUpperCase() : "";
  return amount === undefined ? undefined : `${(amount / 100).toFixed(2)} ${currency}`.trim();
}

async function billingEmailRecipients(scope: { companyId: string; tenantId: string }) {
  const [company, team] = await Promise.all([getCompany(scope, scope.companyId), listTeamUsers(scope)]);
  const recipients = new Set<string>();
  if (company?.billingEmail) recipients.add(company.billingEmail);
  for (const user of team) {
    if (user.role === "owner") recipients.add(user.email);
  }
  return { company, recipients: [...recipients] };
}

async function sendBillingEmail(app: Parameters<FastifyPluginAsync>[0], result: StripeWebhookProcessResult, kind: TransactionalEmailKind, data: Record<string, string | undefined>) {
  if (!result.tenantId || !result.companyId) return;
  const scope = { companyId: result.companyId, tenantId: result.tenantId };
  const { company, recipients } = await billingEmailRecipients(scope);
  for (const recipient of recipients) {
    let message = await createDeliveryMessage(scope, {
      body: data.message ?? `${kind} for ${company?.tradingName ?? "FleetCore"}`,
      channel: "email",
      entityType: "system",
      recipient,
      subject: kind === "payment_failed" ? "FleetCore payment failed" : "FleetCore payment confirmed",
    });
    try {
      const email = await sendTransactionalEmail({
        data: {
          amount: data.amount,
          company: company?.tradingName ?? "FleetCore",
          message: data.message,
          plan: result.plan,
          reason: data.reason,
        },
        kind,
        to: recipient,
      });
      message = await updateDeliveryMessageStatus(scope, message.id, {
        status: email.sent ? "sent" : "queued",
        ...(email.messageId ? { providerMessageId: email.messageId } : {}),
      }) ?? message;
    } catch (error) {
      app.log.error({ error, messageId: message.id }, "Billing transactional email failed");
      await updateDeliveryMessageStatus(scope, message.id, {
        error: error instanceof Error ? error.message : "Unknown email delivery error",
        status: "failed",
      });
    }
  }
}

export const billingRoutes: FastifyPluginAsync = async (app) => {
  app.post("/billing/stripe/webhook", async (request, reply) => {
    const rawBody = request.rawBody;
    if (!rawBody) {
      return reply.code(400).send({ error: "Stripe webhook raw body is missing" });
    }

    try {
      const signatureHeader = request.headers["stripe-signature"];
      const event = parseStripeWebhookEvent(rawBody, Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader, process.env.STRIPE_WEBHOOK_SECRET);
      const result = await processStripeWebhookEvent(event);
      if (result.processed && !result.duplicate && (event.type === "checkout.session.completed" || event.type === "invoice.payment_succeeded")) {
        await sendBillingEmail(app, result, "payment_success", { amount: moneyFromStripeObject(event.data.object) });
      }
      if (result.processed && !result.duplicate && event.type === "invoice.payment_failed") {
        await sendBillingEmail(app, result, "payment_failed", {
          amount: moneyFromStripeObject(event.data.object),
          reason: "Stripe reported invoice.payment_failed.",
        });
      }
      return envelope(result);
    } catch (error) {
      if (error instanceof StripeSignatureError || error instanceof SyntaxError) {
        return reply.code(400).send({ error: error.message });
      }
      request.log.error(error);
      return reply.code(500).send({ error: "Stripe webhook processing failed" });
    }
  });

  app.get("/billing/subscription", async (request, reply) => {
    if (!requireRoles(request, reply, ["owner", "manager"])) return;
    return envelope(await getSubscription(getTenantScope(request)));
  });

  app.post("/billing/checkout", async (request, reply) => {
    if (!requireRoles(request, reply, ["owner"])) return;

    const parsed = subscriptionCheckoutInput.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid billing checkout payload", issues: parsed.error.flatten() });
    }

    const scope = getTenantScope(request);
    const user = getRequestUser(request);
    const session = await createBillingCheckoutSession(scope, parsed.data);
    await writeAuditLog({
      action: "billing.checkout.created",
      actorEmail: user?.email,
      companyId: scope.companyId,
      entityId: session.subscription.id,
      entityType: "subscription",
      metadata: { mode: session.mode, plan: parsed.data.plan },
      tenantId: scope.tenantId,
      userId: user?.id,
    });
    return envelope(session);
  });

  app.post("/billing/subscription/sync", async (request, reply) => {
    if (!requireRoles(request, reply, ["owner"])) return;

    const parsed = subscriptionSyncInput.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid subscription sync payload", issues: parsed.error.flatten() });
    }

    const scope = getTenantScope(request);
    const user = getRequestUser(request);
    const subscription = await syncSubscription(scope, parsed.data);
    await writeAuditLog({
      action: "billing.subscription.synced",
      actorEmail: user?.email,
      companyId: scope.companyId,
      entityId: subscription.id,
      entityType: "subscription",
      metadata: { provider: subscription.provider, status: subscription.status, plan: subscription.plan },
      tenantId: scope.tenantId,
      userId: user?.id,
    });
    return envelope(subscription);
  });
};
