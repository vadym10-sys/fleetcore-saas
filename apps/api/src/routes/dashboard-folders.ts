import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import {
  addDashboardFolderFile,
  addDashboardFolderNote,
  createDashboardFolder,
  deleteDashboardFolder,
  listDashboardFolders,
  removeDashboardFolderFile,
  removeDashboardFolderNote,
  updateDashboardFolder,
  writeAuditLog,
} from "../db/repositories.js";
import { getRequestUser, getTenantScope, requireRoles } from "../lib/access-control.js";
import { envelope } from "../lib/http.js";
import { dashboardFolderFileInput, dashboardFolderInput, dashboardFolderNoteInput, dashboardFolderPatchInput } from "../schemas.js";

function publicBaseUrl(request: FastifyRequest) {
  if (process.env.API_PUBLIC_URL) return process.env.API_PUBLIC_URL;

  const forwardedProto = request.headers["x-forwarded-proto"];
  const protocol = Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto;
  return `${protocol ?? request.protocol}://${request.headers.host}`;
}

function publicFileUrl(request: FastifyRequest, fileId: string, originalName: string) {
  return `${publicBaseUrl(request)}/uploads/${fileId}/${encodeURIComponent(originalName)}`;
}

export const dashboardFolderRoutes: FastifyPluginAsync = async (app) => {
  app.get("/dashboard/folders", async (request) => {
    return envelope(await listDashboardFolders(getTenantScope(request), (fileId, originalName) => publicFileUrl(request, fileId, originalName)));
  });

  app.post("/dashboard/folders", async (request, reply) => {
    if (!requireRoles(request, reply, ["owner", "manager"])) return;

    const parsed = dashboardFolderInput.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid folder payload", issues: parsed.error.flatten() });
    }

    const scope = getTenantScope(request);
    const user = getRequestUser(request);
    const folder = await createDashboardFolder(scope, parsed.data, user?.id);
    await writeAuditLog({
      action: "dashboard.folder.created",
      actorEmail: user?.email,
      companyId: scope.companyId,
      entityId: folder.id,
      entityType: "dashboard_folder",
      metadata: { name: folder.name },
      tenantId: scope.tenantId,
      userId: user?.id,
    });
    return reply.code(201).send(envelope(folder));
  });

  app.patch("/dashboard/folders/:folderId", async (request, reply) => {
    if (!requireRoles(request, reply, ["owner", "manager"])) return;

    const parsed = dashboardFolderPatchInput.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid folder payload", issues: parsed.error.flatten() });
    }

    const { folderId } = request.params as { folderId: string };
    const scope = getTenantScope(request);
    const folder = await updateDashboardFolder(scope, folderId, parsed.data);
    if (!folder) return reply.code(404).send({ error: "Folder not found" });

    const user = getRequestUser(request);
    await writeAuditLog({
      action: "dashboard.folder.updated",
      actorEmail: user?.email,
      companyId: scope.companyId,
      entityId: folder.id,
      entityType: "dashboard_folder",
      metadata: { name: folder.name },
      tenantId: scope.tenantId,
      userId: user?.id,
    });
    return envelope(folder);
  });

  app.delete("/dashboard/folders/:folderId", async (request, reply) => {
    if (!requireRoles(request, reply, ["owner", "manager"])) return;

    const { folderId } = request.params as { folderId: string };
    const scope = getTenantScope(request);
    const deleted = await deleteDashboardFolder(scope, folderId);
    if (!deleted) return reply.code(404).send({ error: "Folder not found" });

    const user = getRequestUser(request);
    await writeAuditLog({
      action: "dashboard.folder.deleted",
      actorEmail: user?.email,
      companyId: scope.companyId,
      entityId: folderId,
      entityType: "dashboard_folder",
      tenantId: scope.tenantId,
      userId: user?.id,
    });
    return envelope({ deleted: true });
  });

  app.post("/dashboard/folders/:folderId/files", async (request, reply) => {
    if (!requireRoles(request, reply, ["owner", "manager"])) return;

    const parsed = dashboardFolderFileInput.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid folder file payload", issues: parsed.error.flatten() });
    }

    const { folderId } = request.params as { folderId: string };
    const scope = getTenantScope(request);
    const user = getRequestUser(request);
    const added = await addDashboardFolderFile(scope, folderId, parsed.data, user?.id);
    if (!added) return reply.code(404).send({ error: "Folder or file not found" });

    await writeAuditLog({
      action: "dashboard.folder.file_added",
      actorEmail: user?.email,
      companyId: scope.companyId,
      entityId: folderId,
      entityType: "dashboard_folder",
      metadata: { fileId: parsed.data.fileId },
      tenantId: scope.tenantId,
      userId: user?.id,
    });
    return envelope(await listDashboardFolders(scope, (fileId, originalName) => publicFileUrl(request, fileId, originalName)));
  });

  app.delete("/dashboard/folders/:folderId/files/:folderFileId", async (request, reply) => {
    if (!requireRoles(request, reply, ["owner", "manager"])) return;

    const { folderFileId, folderId } = request.params as { folderFileId: string; folderId: string };
    const scope = getTenantScope(request);
    const deleted = await removeDashboardFolderFile(scope, folderId, folderFileId);
    if (!deleted) return reply.code(404).send({ error: "Folder file not found" });

    const user = getRequestUser(request);
    await writeAuditLog({
      action: "dashboard.folder.file_removed",
      actorEmail: user?.email,
      companyId: scope.companyId,
      entityId: folderId,
      entityType: "dashboard_folder",
      metadata: { folderFileId },
      tenantId: scope.tenantId,
      userId: user?.id,
    });
    return envelope({ deleted: true });
  });

  app.post("/dashboard/folders/:folderId/notes", async (request, reply) => {
    if (!requireRoles(request, reply, ["owner", "manager"])) return;

    const parsed = dashboardFolderNoteInput.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid folder note payload", issues: parsed.error.flatten() });
    }

    const { folderId } = request.params as { folderId: string };
    const scope = getTenantScope(request);
    const user = getRequestUser(request);
    const note = await addDashboardFolderNote(scope, folderId, parsed.data, user?.id);
    if (!note) return reply.code(404).send({ error: "Folder not found" });

    await writeAuditLog({
      action: "dashboard.folder.note_added",
      actorEmail: user?.email,
      companyId: scope.companyId,
      entityId: folderId,
      entityType: "dashboard_folder",
      metadata: { noteId: note.id },
      tenantId: scope.tenantId,
      userId: user?.id,
    });
    return reply.code(201).send(envelope(note));
  });

  app.delete("/dashboard/folders/:folderId/notes/:noteId", async (request, reply) => {
    if (!requireRoles(request, reply, ["owner", "manager"])) return;

    const { folderId, noteId } = request.params as { folderId: string; noteId: string };
    const scope = getTenantScope(request);
    const deleted = await removeDashboardFolderNote(scope, folderId, noteId);
    if (!deleted) return reply.code(404).send({ error: "Folder note not found" });

    const user = getRequestUser(request);
    await writeAuditLog({
      action: "dashboard.folder.note_removed",
      actorEmail: user?.email,
      companyId: scope.companyId,
      entityId: folderId,
      entityType: "dashboard_folder",
      metadata: { noteId },
      tenantId: scope.tenantId,
      userId: user?.id,
    });
    return envelope({ deleted: true });
  });
};
