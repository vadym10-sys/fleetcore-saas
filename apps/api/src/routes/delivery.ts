import type { FastifyPluginAsync } from "fastify";
import { createDeliveryMessage, listDeliveryMessages, updateDeliveryMessageStatus, writeAuditLog } from "../db/repositories.js";
import { getRequestUser, getTenantScope, requireRoles } from "../lib/access-control.js";
import { envelope } from "../lib/http.js";
import { sendNotification } from "../lib/notifications.js";
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
    let message = await createDeliveryMessage(scope, parsed.data, user?.id);
    try {
      const result = await sendNotification({
        body: parsed.data.body,
        channel: parsed.data.channel,
        recipient: parsed.data.recipient,
        ...(parsed.data.subject ? { subject: parsed.data.subject } : {}),
      });
      message = await updateDeliveryMessageStatus(scope, message.id, {
        status: result.sent ? "sent" : "queued",
        ...(result.providerMessageId ? { providerMessageId: result.providerMessageId } : {}),
      }) ?? message;
    } catch (error) {
      request.log.error({ error, messageId: message.id }, "Notification delivery failed");
      message = await updateDeliveryMessageStatus(scope, message.id, {
        error: error instanceof Error ? error.message : "Unknown notification delivery error",
        status: "failed",
      }) ?? message;
    }
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
