import type { FastifyPluginAsync } from "fastify";
import { calculateDashboardMetrics } from "../db/repositories.js";
import { getTenantScope } from "../lib/access-control.js";
import { envelope } from "../lib/http.js";

export const dashboardRoutes: FastifyPluginAsync = async (app) => {
  app.get("/dashboard", async (request) => envelope(await calculateDashboardMetrics(getTenantScope(request))));
};
