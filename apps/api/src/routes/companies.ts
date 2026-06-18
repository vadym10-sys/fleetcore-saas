import type { FastifyPluginAsync } from "fastify";
import { getCompany, listCompanies } from "../db/repositories.js";
import { getTenantScope } from "../lib/access-control.js";
import { envelope } from "../lib/http.js";

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
};
