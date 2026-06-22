import type { FastifyPluginAsync } from "fastify";
import { createDeliveryMessage, listDeliveryMessages, writeAuditLog } from "../db/repositories.js";
import { getRequestUser, getTenantScope, requireRoles } from "../lib/access-control.js";
import { envelope } from "../lib/http.js";
import { deliveryMessageInput } from "../schemas.js";

export const deliveryRoutes: FastifyPluginAsync = async (app) => {
  app.get("/delivery/messages", async (request, reply) => {
    if (!requireRoles(request, reply, ["owner", "manager"])) return;

    const { entityId } = request.query as { entityId?: string };
    return envelope(await listDeliveryMessages(getTenantScope(request), entityId));
  });

  app.post("/delivery/messages", async (request, reply) => {
    if (!requireRoles(request, reply, ["owner", "manager"])) return;

    const parsed = deliveryMessageInput.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid delivery payload", issues: parsed.error.flatten() });
    }

    const scope = getTenantScope(request);
    const user = getRequestUser(request);
    const message = await createDeliveryMessage(scope, parsed.data, user?.id);
    await writeAuditLog({
      action: "delivery.message.created",
      actorEmail: user?.email,
      companyId: scope.companyId,
      entityId: message.entityId ?? message.id,
      entityType: message.entityType,
      metadata: { channel: message.channel, recipient: message.recipient, status: message.status },
      tenantId: scope.tenantId,
      userId: user?.id,
    });
    return reply.code(201).send(envelope(message));
  });
};
