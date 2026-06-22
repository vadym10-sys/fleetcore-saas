import { z } from "zod";
import type { ProductionIntegrationState } from "@fleetcore/shared";

const productionEnvSchema = z.object({
  API_PUBLIC_URL: z.string().url(),
  DATABASE_URL: z.string().url(),
  GDPR_DOCS_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  PRIVACY_POLICY_URL: z.string().url(),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  S3_ENDPOINT: z.string().url().optional(),
  S3_FORCE_PATH_STYLE: z.string().optional(),
  S3_REGION: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  STRIPE_PRICE_ENTERPRISE: z.string().min(1),
  STRIPE_PRICE_GROWTH: z.string().min(1),
  STRIPE_PRICE_STARTER: z.string().min(1),
  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  TERMS_URL: z.string().url(),
  WEB_ORIGIN: z.string().url(),
  WHATSAPP_ACCESS_TOKEN: z.string().min(1),
  WHATSAPP_PHONE_NUMBER_ID: z.string().min(1),
  MONITORING_DSN: z.string().min(1).optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  SENTRY_DSN: z.string().url().optional(),
  SMTP_URL: z.string().min(1).optional(),
  UPTIME_MONITOR_URL: z.string().url().optional(),
}).passthrough().superRefine((env, ctx) => {
  if (!env.RESEND_API_KEY && !env.SMTP_URL) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Either RESEND_API_KEY or SMTP_URL is required for production email delivery.",
      path: ["RESEND_API_KEY"],
    });
  }

  if (!env.SENTRY_DSN && !env.MONITORING_DSN && !env.UPTIME_MONITOR_URL) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "At least one monitoring variable is required: SENTRY_DSN, MONITORING_DSN or UPTIME_MONITOR_URL.",
      path: ["SENTRY_DSN"],
    });
  }
});

export type ProductionEnv = z.infer<typeof productionEnvSchema>;

export function isStrictProduction(env: NodeJS.ProcessEnv = process.env) {
  return env.PRODUCTION === "true";
}

function configuredState(value: string | undefined, testPatterns: string[] = []): ProductionIntegrationState {
  if (!value) return "missing";
  const normalized = value.toLowerCase();
  return testPatterns.some((pattern) => normalized.includes(pattern)) ? "test_mode" : "connected";
}

export function productionIntegrations(env: NodeJS.ProcessEnv = process.env) {
  const stripeState = env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET
    ? configuredState(env.STRIPE_SECRET_KEY, ["sk_test", "test"])
    : "missing";
  const emailState = configuredState(env.RESEND_API_KEY ?? env.SMTP_URL, ["test", "sandbox", "localhost"]);
  const whatsappState = env.WHATSAPP_ACCESS_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID
    ? configuredState(env.WHATSAPP_ACCESS_TOKEN, ["test", "sandbox"])
    : "missing";
  const telegramState = configuredState(env.TELEGRAM_BOT_TOKEN, ["test", "sandbox"]);
  const objectStorageState = env.S3_BUCKET && env.S3_REGION && env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY
    ? configuredState(env.S3_BUCKET, ["test", "dev", "local"])
    : "missing";
  const monitoringState = configuredState(env.SENTRY_DSN ?? env.MONITORING_DSN ?? env.UPTIME_MONITOR_URL, ["test", "localhost"]);
  const legalState = env.GDPR_DOCS_URL || env.PRIVACY_POLICY_URL || env.TERMS_URL
    ? configuredState(env.GDPR_DOCS_URL ?? env.PRIVACY_POLICY_URL ?? env.TERMS_URL, ["draft", "test", "localhost"])
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
  };
}

export function commercialReadiness(env: NodeJS.ProcessEnv = process.env) {
  const integrations = productionIntegrations(env);
  return {
    billingConfigured: integrations.stripe.state !== "missing",
    emailConfigured: integrations.email.state !== "missing",
    objectStorageConfigured: integrations.objectStorage.state !== "missing",
    telegramConfigured: integrations.telegram.state !== "missing",
    whatsappConfigured: integrations.whatsapp.state !== "missing",
  };
}

export function validateProductionEnv(env: NodeJS.ProcessEnv = process.env) {
  if (!isStrictProduction(env)) {
    return { mode: "pilot" as const, ok: true };
  }

  const parsed = productionEnvSchema.safeParse(env);
  if (parsed.success) {
    return { env: parsed.data, mode: "production" as const, ok: true };
  }

  const missing = parsed.error.issues
    .map((issue) => issue.path.join(".") || issue.message)
    .filter((value, index, values) => values.indexOf(value) === index)
    .sort();
  throw new Error(`FleetCore production env validation failed. Missing or invalid variables: ${missing.join(", ")}`);
}
