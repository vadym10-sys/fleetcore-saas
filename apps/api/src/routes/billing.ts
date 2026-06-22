import type { FastifyPluginAsync } from "fastify";
import { createBillingCheckoutSession, getSubscription, syncSubscription, writeAuditLog } from "../db/repositories.js";
import { getRequestUser, getTenantScope, requireRoles } from "../lib/access-control.js";
import { envelope } from "../lib/http.js";
import { subscriptionCheckoutInput, subscriptionSyncInput } from "../schemas.js";

export const billingRoutes: FastifyPluginAsync = async (app) => {
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
