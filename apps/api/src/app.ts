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

type IntegrationState = "connected" | "missing" | "test_mode";

function configuredState(value: string | undefined, testPatterns: string[] = []): IntegrationState {
  if (!value) return "missing";
  const normalized = value.toLowerCase();
  return testPatterns.some((pattern) => normalized.includes(pattern)) ? "test_mode" : "connected";
}

function productionIntegrations() {
  const stripeState = configuredState(process.env.STRIPE_SECRET_KEY, ["sk_test", "test"]);
  const emailState = configuredState(process.env.RESEND_API_KEY ?? process.env.SMTP_URL, ["test", "sandbox", "localhost"]);
  const whatsappState = process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID
    ? configuredState(process.env.WHATSAPP_ACCESS_TOKEN, ["test", "sandbox"])
    : "missing";
  const telegramState = configuredState(process.env.TELEGRAM_BOT_TOKEN, ["test", "sandbox"]);
  const objectStorageState = configuredState(process.env.S3_BUCKET, ["test", "dev", "local"]);
  const monitoringState = configuredState(process.env.SENTRY_DSN ?? process.env.MONITORING_DSN ?? process.env.UPTIME_MONITOR_URL, ["test", "localhost"]);
  const legalState = process.env.GDPR_DOCS_URL || process.env.PRIVACY_POLICY_URL || process.env.TERMS_URL
    ? configuredState(process.env.GDPR_DOCS_URL ?? process.env.PRIVACY_POLICY_URL ?? process.env.TERMS_URL, ["draft", "test", "localhost"])
    : "missing";

  return {
    email: {
      description: emailState === "missing" ? "Email provider is not configured yet." : "Email provider credentials are present.",
      label: "Email provider",
      requiredForCommercialLaunch: true,
      state: emailState,
    },
    gdprLegalDocs: {
      description: legalState === "missing" ? "Privacy, terms or GDPR/DPA links are not configured." : "Legal documentation link is configured.",
      label: "GDPR / legal docs",
      requiredForCommercialLaunch: true,
      state: legalState,
    },
    monitoring: {
      description: monitoringState === "missing" ? "Production error monitoring or uptime URL is not configured." : "Monitoring configuration is present.",
      label: "Monitoring",
      requiredForCommercialLaunch: true,
      state: monitoringState,
    },
    objectStorage: {
      description: objectStorageState === "missing" ? "Using database/local fallback for uploaded files." : "S3-compatible object storage bucket is configured.",
      label: "S3 / object storage",
      requiredForCommercialLaunch: true,
      state: objectStorageState,
    },
    stripe: {
      description: stripeState === "missing" ? "Stripe secret key and price IDs are not configured." : "Stripe key is configured.",
      label: "Stripe",
      requiredForCommercialLaunch: true,
      state: stripeState,
    },
    telegram: {
      description: telegramState === "missing" ? "Telegram bot token is not configured." : "Telegram bot token is configured.",
      label: "Telegram bot",
      requiredForCommercialLaunch: false,
      state: telegramState,
    },
    whatsapp: {
      description: whatsappState === "missing" ? "WhatsApp Business token or phone number ID is not configured." : "WhatsApp Business API credentials are configured.",
      label: "WhatsApp Business API",
      requiredForCommercialLaunch: true,
      state: whatsappState,
    },
  } satisfies Record<string, { description: string; label: string; requiredForCommercialLaunch: boolean; state: IntegrationState }>;
}

function commercialReadiness() {
  const integrations = productionIntegrations();
  return {
    billingConfigured: integrations.stripe.state !== "missing",
    emailConfigured: integrations.email.state !== "missing",
    objectStorageConfigured: integrations.objectStorage.state !== "missing",
    telegramConfigured: integrations.telegram.state !== "missing",
    whatsappConfigured: integrations.whatsapp.state !== "missing",
  };
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
    const integrations = productionIntegrations();
    const readiness = commercialReadiness();
    try {
      await pool.query("select 1");
      return envelope({
        checks: {
          database: "ok",
          migrations: "ok",
          storage: process.env.S3_BUCKET ? "s3" : "database",
        },
        commercialReadiness: readiness,
        integrations,
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
          commercialReadiness: readiness,
          integrations,
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
