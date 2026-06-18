import Fastify from "fastify";
import { platformModules } from "@fleetcore/shared";
import { installTenantContext } from "./plugins/tenant-context.js";
import { authRoutes } from "./routes/auth.js";
import { companyRoutes } from "./routes/companies.js";
import { customerRoutes } from "./routes/customers.js";
import { dashboardRoutes } from "./routes/dashboard.js";
import { documentRoutes } from "./routes/documents.js";
import { financeRoutes } from "./routes/finance.js";
import { fleetRoutes } from "./routes/fleet.js";
import { gpsRoutes } from "./routes/gps.js";
import { operationRoutes } from "./routes/operations.js";
import { rentalRoutes } from "./routes/rentals.js";
import { envelope } from "./lib/http.js";
import { runMigrations } from "./db/migrate.js";
import { seedDatabase } from "./db/seed.js";

function resolveCorsOrigin(origin: string | undefined) {
  const configuredOrigin = process.env.WEB_ORIGIN ?? "http://localhost:3000";
  if (!origin) return configuredOrigin;
  if (origin === configuredOrigin) return origin;

  const isLocalDevOrigin = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);
  if (process.env.NODE_ENV !== "production" && isLocalDevOrigin) {
    return origin;
  }

  return configuredOrigin;
}

export async function buildServer() {
  const app = Fastify({ logger: true });

  app.addHook("onRequest", async (request, reply) => {
    reply.header("access-control-allow-origin", resolveCorsOrigin(request.headers.origin));
    reply.header("access-control-allow-methods", "GET,POST,PATCH,DELETE,OPTIONS");
    reply.header("access-control-allow-headers", "content-type,authorization,x-tenant-id");
  });

  app.options("/*", async (_request, reply) => reply.code(204).send());

  app.setErrorHandler((error, request, reply) => {
    request.log.error(error);
    return reply.code(500).send({ error: "Internal server error" });
  });

  app.setNotFoundHandler((_request, reply) => reply.code(404).send({ error: "Route not found" }));

  app.get("/health", async () => envelope({ ok: true, modules: platformModules }));

  await runMigrations();
  await seedDatabase();
  installTenantContext(app);
  await app.register(authRoutes);
  await app.register(dashboardRoutes);
  await app.register(companyRoutes);
  await app.register(fleetRoutes);
  await app.register(customerRoutes);
  await app.register(rentalRoutes);
  await app.register(financeRoutes);
  await app.register(gpsRoutes);
  await app.register(documentRoutes);
  await app.register(operationRoutes);

  return app;
}
