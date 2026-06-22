import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { randomUUID } from "node:crypto";
import { createStorageKey, createSignedDownloadUrl, deleteObject, putObject } from "../lib/object-storage.js";
import { createFileObject, deleteFileObject, getFileObject, getFileObjectMetadata, listFileObjects, writeAuditLog } from "../db/repositories.js";
import { getRequestUser, getTenantScope, requireRoles } from "../lib/access-control.js";
import { envelope } from "../lib/http.js";
import { fileUploadInput } from "../schemas.js";

const maxUploadBytes = Number(process.env.MAX_UPLOAD_BYTES ?? 8 * 1024 * 1024);

function publicBaseUrl(request: FastifyRequest) {
  if (process.env.API_PUBLIC_URL) return process.env.API_PUBLIC_URL;

  const forwardedProto = request.headers["x-forwarded-proto"];
  const protocol = Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto;
  return `${protocol ?? request.protocol}://${request.headers.host}`;
}

function publicFileUrl(request: FastifyRequest, fileId: string, originalName: string) {
  return `${publicBaseUrl(request)}/uploads/${fileId}/${encodeURIComponent(originalName)}`;
}

export const uploadRoutes: FastifyPluginAsync = async (app) => {
  app.get("/uploads", async (request) => {
    return envelope(await listFileObjects(getTenantScope(request), (fileId, originalName) => publicFileUrl(request, fileId, originalName)));
  });

  app.post("/uploads", async (request, reply) => {
    if (!requireRoles(request, reply, ["owner", "manager"])) return;

    const parsed = fileUploadInput.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid upload payload", issues: parsed.error.flatten() });
    }

    const data = Buffer.from(parsed.data.base64, "base64");
    if (!data.byteLength || data.byteLength > maxUploadBytes) {
      return reply.code(413).send({ error: `File must be between 1 byte and ${maxUploadBytes} bytes` });
    }

    const user = getRequestUser(request);
    const scope = getTenantScope(request);
    const fileId = `file_${randomUUID().replace(/-/gu, "").slice(0, 8)}`;
    const storageKey = createStorageKey({
      companyId: scope.companyId,
      fileId,
      originalName: parsed.data.originalName,
      tenantId: scope.tenantId,
    });
    const stored = await putObject({
      body: data,
      contentType: parsed.data.mimeType,
      key: storageKey,
    });
    const file = await createFileObject(scope, parsed.data, (storedFileId, originalName) => publicFileUrl(request, storedFileId, originalName), user?.id, {
      data: stored.provider === "database" ? data : null,
      fileId,
      sha256: stored.sha256,
      sizeBytes: data.byteLength,
      storageKey: stored.storageKey,
      storageProvider: stored.provider,
    });
    await writeAuditLog({
      action: "file.uploaded",
      actorEmail: user?.email,
      companyId: scope.companyId,
      entityId: file.id,
      entityType: "file_object",
      ipAddress: request.ip,
      metadata: { mimeType: file.mimeType, originalName: file.originalName, sha256: file.sha256, sizeBytes: file.sizeBytes },
      tenantId: scope.tenantId,
      userAgent: request.headers["user-agent"]?.toString(),
      userId: user?.id,
    });
    return reply.code(201).send(envelope(file));
  });

  app.get("/uploads/:fileId", async (request, reply) => {
    const { fileId } = request.params as { fileId: string };
    const file = await getFileObjectMetadata(getTenantScope(request), fileId, (id, originalName) => publicFileUrl(request, id, originalName));
    if (!file) {
      return reply.code(404).send({ error: "File not found" });
    }
    return envelope(file);
  });

  app.get("/uploads/:fileId/signed-url", async (request, reply) => {
    const { fileId } = request.params as { fileId: string };
    const file = await getFileObject(getTenantScope(request), fileId);
    if (!file) return reply.code(404).send({ error: "File not found" });

    if (file.storageProvider === "s3" && file.storageKey) {
      const signed = createSignedDownloadUrl({ storageKey: file.storageKey });
      if (!signed) return reply.code(503).send({ error: "Object storage is not configured" });
      return envelope(signed);
    }

    return envelope({
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      url: publicFileUrl(request, fileId, file.originalName),
    });
  });

  app.get("/uploads/:fileId/:filename", async (request, reply) => {
    const { fileId } = request.params as { fileId: string; filename: string };
    const file = await getFileObject(getTenantScope(request), fileId);
    if (!file) {
      return reply.code(404).send({ error: "File not found" });
    }

    await writeAuditLog({
      action: "file.previewed",
      companyId: file.companyId,
      entityId: fileId,
      entityType: "file_object",
      ipAddress: request.ip,
      metadata: { mimeType: file.mimeType, originalName: file.originalName, sha256: file.sha256 },
      tenantId: file.tenantId,
      userAgent: request.headers["user-agent"]?.toString(),
    });

    if (file.storageProvider === "s3" && file.storageKey) {
      const signed = createSignedDownloadUrl({ storageKey: file.storageKey });
      if (!signed) return reply.code(503).send({ error: "Object storage is not configured" });
      return reply.redirect(signed.url);
    }

    if (!file.data) {
      return reply.code(404).send({ error: "File content not found" });
    }

    reply.header("content-type", file.mimeType);
    reply.header("content-length", String(file.data.byteLength));
    if (file.sha256) reply.header("etag", `"${file.sha256}"`);
    reply.header("content-disposition", `inline; filename="${encodeURIComponent(file.originalName)}"`);
    return reply.send(file.data);
  });

  app.delete("/uploads/:fileId", async (request, reply) => {
    if (!requireRoles(request, reply, ["owner", "manager"])) return;

    const { fileId } = request.params as { fileId: string };
    const scope = getTenantScope(request);
    const file = await getFileObject(scope, fileId);
    if (!file) return reply.code(404).send({ error: "File not found" });

    await deleteObject({
      storageKey: file.storageKey ?? fileId,
      storageProvider: file.storageProvider,
    });
    await deleteFileObject(scope, fileId);

    const user = getRequestUser(request);
    await writeAuditLog({
      action: "file.deleted",
      actorEmail: user?.email,
      companyId: scope.companyId,
      entityId: fileId,
      entityType: "file_object",
      ipAddress: request.ip,
      metadata: { originalName: file.originalName, storageProvider: file.storageProvider },
      tenantId: scope.tenantId,
      userAgent: request.headers["user-agent"]?.toString(),
      userId: user?.id,
    });

    return envelope({ deleted: true, id: fileId });
  });
};
