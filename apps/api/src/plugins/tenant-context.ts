import type { FastifyInstance } from "fastify";
import { defaultCompanyId, defaultTenantId } from "../db/constants.js";
import { setRequestUser } from "../lib/access-control.js";
import { verifyAccessToken } from "../lib/auth.js";

const publicRoutes = new Set([
  "/health",
  "/readiness",
  "/status",
  "/version",
  "/auth/demo",
  "/auth/login",
  "/auth/logout",
  "/auth/refresh",
  "/auth/register-company",
  "/auth/request-email-verification",
  "/auth/request-password-reset",
  "/auth/reset-password",
  "/auth/verify-email",
  "/billing/stripe/webhook",
]);
function isPublicUploadPreview(url: string) {
  return /^\/uploads\/[^/]+\/.+/.test(url);
}

function isPublicContractRoute(url: string) {
  return /^\/operations\/rental-contracts\/public\/[^/]+/.test(url);
}

function isPublicClientIntakeRoute(url: string) {
  return /^\/operations\/client-intake\/public/.test(url);
}

function allowsLocalTenantHeader() {
  return process.env.ALLOW_DEV_TENANT_HEADER === "true" || process.env.NODE_ENV !== "production";
}

export function installTenantContext(app: FastifyInstance) {
  app.addHook("preHandler", async (request, reply) => {
    if (request.method === "OPTIONS") {
      return;
    }

    if (publicRoutes.has(request.url) || isPublicUploadPreview(request.url) || isPublicContractRoute(request.url) || isPublicClientIntakeRoute(request.url)) {
      return;
    }

    const authorization = request.headers.authorization;
    const token = authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : undefined;
    const claims = token ? verifyAccessToken(token) : undefined;
    if (claims?.tenantId && claims.companyId) {
      setRequestUser(request, {
        companyId: claims.companyId,
        email: claims.email,
        id: claims.sub,
        role: claims.role,
        tenantId: claims.tenantId,
      });
      return;
    }

    const requestedTenant = request.headers["x-tenant-id"];
    if (!allowsLocalTenantHeader() || requestedTenant !== defaultTenantId) {
      return reply.code(401).send({ error: "Invalid or missing tenant context" });
    }

    setRequestUser(request, {
      companyId: defaultCompanyId,
      email: "local-dev@fleetcore.example",
      id: "local_dev",
      role: "owner",
      tenantId: defaultTenantId,
    });
  });
}
