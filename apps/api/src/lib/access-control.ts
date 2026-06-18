import type { FastifyReply, FastifyRequest } from "fastify";
import type { UserRole } from "@fleetcore/shared";

export interface RequestUser {
  companyId: string;
  email: string;
  id: string;
  role: UserRole;
  tenantId: string;
}

export function setRequestUser(request: FastifyRequest, user: RequestUser) {
  (request as FastifyRequest & { user: RequestUser }).user = user;
}

export function getRequestUser(request: FastifyRequest) {
  return (request as FastifyRequest & { user?: RequestUser }).user;
}

export function requireRoles(request: FastifyRequest, reply: FastifyReply, allowedRoles: UserRole[]) {
  const user = getRequestUser(request);
  if (!user) {
    reply.code(401).send({ error: "Authentication required" });
    return false;
  }

  if (!allowedRoles.includes(user.role)) {
    reply.code(403).send({ error: "Insufficient permissions" });
    return false;
  }

  return true;
}
