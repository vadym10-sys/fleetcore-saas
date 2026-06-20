import type { FastifyPluginAsync } from "fastify";
import { getCompany, listCompanies, updateCompanyBranding } from "../db/repositories.js";
import { getTenantScope, requireRoles } from "../lib/access-control.js";
import { envelope } from "../lib/http.js";
import { companyBrandingInput } from "../schemas.js";

export const companyRoutes: FastifyPluginAsync = async (app) => {
  app.get("/companies", async (request) => envelope(await listCompanies(getTenantScope(request))));

  app.get("/companies/:companyId", async (request, reply) => {
    const { companyId } = request.params as { companyId: string };
    const company = await getCompany(getTenantScope(request), companyId);
    if (!company) {
      return reply.code(404).send({ error: "Company not found" });
    }

    return envelope(company);
  });

  app.patch("/companies/:companyId", async (request, reply) => {
    if (!requireRoles(request, reply, ["owner", "admin"])) return;

    const { companyId } = request.params as { companyId: string };
    const parsed = companyBrandingInput.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid company branding payload", issues: parsed.error.flatten() });
    }

    const company = await updateCompanyBranding(getTenantScope(request), companyId, parsed.data);
    if (!company) {
      return reply.code(404).send({ error: "Company not found" });
    }

    return envelope(company);
  });
};
