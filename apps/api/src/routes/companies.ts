import type { FastifyPluginAsync } from "fastify";
import { getCompany, listCompanies } from "../db/repositories.js";
import { envelope } from "../lib/http.js";

export const companyRoutes: FastifyPluginAsync = async (app) => {
  app.get("/companies", async () => envelope(await listCompanies()));

  app.get("/companies/:companyId", async (request, reply) => {
    const { companyId } = request.params as { companyId: string };
    const company = await getCompany(companyId);
    if (!company) {
      return reply.code(404).send({ error: "Company not found" });
    }

    return envelope(company);
  });
};
