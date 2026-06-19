import type { FastifyPluginAsync } from "fastify";
import { createVehicleDocument, listVehicleDocuments, writeAuditLog } from "../db/repositories.js";
import { getRequestUser, getTenantScope, requireRoles } from "../lib/access-control.js";
import { envelope } from "../lib/http.js";
import { vehicleDocumentInput } from "../schemas.js";

export const documentRoutes: FastifyPluginAsync = async (app) => {
  app.get("/documents/vehicles", async (request) => {
    const { vehicleId } = request.query as { vehicleId?: string };
    return envelope(await listVehicleDocuments(getTenantScope(request), vehicleId));
  });

  app.post("/documents/vehicles", async (request, reply) => {
    if (!requireRoles(request, reply, ["owner", "admin", "fleet_manager", "support"])) return;

    const parsed = vehicleDocumentInput.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid document payload", issues: parsed.error.flatten() });
    }

    const scope = getTenantScope(request);
    const document = await createVehicleDocument(scope, parsed.data);
    if (!document) {
      return reply.code(422).send({ error: "Vehicle does not exist" });
    }

    const user = getRequestUser(request);
    await writeAuditLog({
      action: "document.vehicle.created",
      actorEmail: user?.email,
      companyId: scope.companyId,
      entityId: document.id,
      entityType: "vehicle_document",
      metadata: { title: document.title, type: document.type, vehicleId: document.vehicleId },
      tenantId: scope.tenantId,
      userId: user?.id,
    });
    return reply.code(201).send(envelope(document));
  });
};
