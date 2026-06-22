import Fastify from "fastify";
import { platformModules } from "@fleetcore/shared";
import { installTenantContext } from "./plugins/tenant-context.js";
import { aiRoutes } from "./routes/ai.js";
import { authRoutes } from "./routes/auth.js";
import { billingRoutes } from "./routes/billing.js";
import { companyRoutes } from "./routes/companies.js";
import { complianceRoutes } from "./routes/compliance.js";
import { dashboardFolderRoutes } from "./routes/dashboard-folders.js";
import { customerRoutes } from "./routes/customers.js";
import { dashboardRoutes } from "./routes/dashboard.js";
import { deliveryRoutes } from "./routes/delivery.js";
import { documentRoutes } from "./routes/documents.js";
import { financeRoutes } from "./routes/finance.js";
import { fleetRoutes } from "./routes/fleet.js";
import { gpsRoutes } from "./routes/gps.js";
import { operationRoutes } from "./routes/operations.js";
import { rentalRoutes } from "./routes/rentals.js";
import { uploadRoutes } from "./routes/uploads.js";
import { envelope } from "./lib/http.js";
import { runMigrations } from "./db/migrate.js";
import { pool } from "./db/client.js";
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
  const app = Fastify({ bodyLimit: Number(process.env.MAX_UPLOAD_BODY_BYTES ?? 12 * 1024 * 1024), logger: true });

  app.addContentTypeParser("application/x-www-form-urlencoded", { parseAs: "string" }, (_request, body, done) => {
    done(null, body);
  });

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
  app.get("/version", async () => envelope({
    app: "fleetcore-api",
    commit: process.env.RENDER_GIT_COMMIT ?? process.env.GIT_COMMIT ?? process.env.COMMIT_SHA ?? "unknown",
    environment: process.env.NODE_ENV ?? "development",
    version: process.env.npm_package_version ?? "0.1.0",
  }));
  app.get("/readiness", async (_request, reply) => {
    try {
      await pool.query("select 1");
      return envelope({
        checks: {
          database: "ok",
          migrations: "ok",
          storage: process.env.S3_BUCKET ? "s3" : "database",
        },
        ok: true,
      });
    } catch (error) {
      app.log.error(error);
      return reply.code(503).send({
        data: {
          checks: {
            database: "error",
            migrations: "unknown",
            storage: process.env.S3_BUCKET ? "s3" : "database",
          },
          ok: false,
        },
      });
    }
  });
  app.get("/status", async (_request, reply) => {
    try {
      await pool.query("select 1");
      return envelope({
        checks: {
          database: "ok",
          migrations: "ok",
          storage: process.env.S3_BUCKET ? "s3" : "database",
        },
        commercialReadiness: {
          billingConfigured: Boolean(process.env.STRIPE_SECRET_KEY),
          emailConfigured: Boolean(process.env.RESEND_API_KEY || process.env.SMTP_URL),
          objectStorageConfigured: Boolean(process.env.S3_BUCKET),
          telegramConfigured: Boolean(process.env.TELEGRAM_BOT_TOKEN),
          whatsappConfigured: Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID),
        },
        ok: true,
      });
    } catch (error) {
      app.log.error(error);
      return reply.code(503).send({
        data: {
          checks: {
            database: "error",
            migrations: "unknown",
            storage: process.env.S3_BUCKET ? "s3" : "database",
          },
          commercialReadiness: {
            billingConfigured: Boolean(process.env.STRIPE_SECRET_KEY),
            emailConfigured: Boolean(process.env.RESEND_API_KEY || process.env.SMTP_URL),
            objectStorageConfigured: Boolean(process.env.S3_BUCKET),
            telegramConfigured: Boolean(process.env.TELEGRAM_BOT_TOKEN),
            whatsappConfigured: Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID),
          },
          ok: false,
        },
      });
    }
  });

  await runMigrations();
  await seedDatabase();
  installTenantContext(app);
  await app.register(aiRoutes);
  await app.register(authRoutes);
  await app.register(billingRoutes);
  await app.register(dashboardRoutes);
  await app.register(dashboardFolderRoutes);
  await app.register(complianceRoutes);
  await app.register(companyRoutes);
  await app.register(deliveryRoutes);
  await app.register(fleetRoutes);
  await app.register(customerRoutes);
  await app.register(rentalRoutes);
  await app.register(financeRoutes);
  await app.register(gpsRoutes);
  await app.register(uploadRoutes);
  await app.register(documentRoutes);
  await app.register(operationRoutes);

  return app;
}
