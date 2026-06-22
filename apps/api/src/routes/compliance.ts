import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { buildComplianceExport, createDataSubjectRequest, writeAuditLog } from "../db/repositories.js";
import { getRequestUser, getTenantScope, requireRoles } from "../lib/access-control.js";
import { envelope } from "../lib/http.js";
import { dataSubjectRequestInput } from "../schemas.js";

function publicBaseUrl(request: FastifyRequest) {
  if (process.env.API_PUBLIC_URL) return process.env.API_PUBLIC_URL;

  const forwardedProto = request.headers["x-forwarded-proto"];
  const protocol = Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto;
  return `${protocol ?? request.protocol}://${request.headers.host}`;
}

function publicFileUrl(request: FastifyRequest, fileId: string, originalName: string) {
  return `${publicBaseUrl(request)}/uploads/${fileId}/${encodeURIComponent(originalName)}`;
}

export const complianceRoutes: FastifyPluginAsync = async (app) => {
  app.get("/compliance/export", async (request, reply) => {
    if (!requireRoles(request, reply, ["owner"])) return;

    const scope = getTenantScope(request);
    const user = getRequestUser(request);
    const exportData = await buildComplianceExport(scope, (fileId, originalName) => publicFileUrl(request, fileId, originalName));
    if (!exportData) return reply.code(404).send({ error: "Company not found" });

    await writeAuditLog({
      action: "compliance.export.created",
      actorEmail: user?.email,
      companyId: scope.companyId,
      entityId: scope.companyId,
      entityType: "company",
      tenantId: scope.tenantId,
      userId: user?.id,
    });

    return envelope(exportData);
  });

  app.post("/compliance/data-subject-requests", async (request, reply) => {
    if (!requireRoles(request, reply, ["owner"])) return;

    const parsed = dataSubjectRequestInput.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid data subject request payload", issues: parsed.error.flatten() });
    }

    const scope = getTenantScope(request);
    const user = getRequestUser(request);
    const created = await createDataSubjectRequest(scope, parsed.data, {
      ipAddress: request.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() ?? request.ip,
      userAgent: typeof request.headers["user-agent"] === "string" ? request.headers["user-agent"] : undefined,
      userId: user?.id,
    });

    await writeAuditLog({
      action: `compliance.${parsed.data.requestType}_request.created`,
      actorEmail: user?.email,
      companyId: scope.companyId,
      entityId: created.id,
      entityType: "data_subject_request",
      metadata: { email: parsed.data.email, requestType: parsed.data.requestType },
      tenantId: scope.tenantId,
      userId: user?.id,
    });

    return reply.code(201).send(envelope(created));
  });
};
