import { randomUUID } from "node:crypto";

export type MonitoringSeverity = "critical" | "error" | "info" | "warning";

export type MonitoringEventInput = {
  context?: Record<string, unknown>;
  error?: unknown;
  message: string;
  severity?: MonitoringSeverity;
  source: "api" | "background_job" | "delivery" | "startup" | "webhook";
};

export type MonitoringEventResult = {
  delivered: boolean;
  provider: "mock" | "none" | "sentry" | "webhook";
  skipped?: boolean;
};

function isSuppressed(env: NodeJS.ProcessEnv) {
  const testMode = env.NODE_ENV === "test" || env.MONITORING_TEST_MODE === "true";
  return testMode && env.MONITORING_SEND_IN_TEST !== "true";
}

function errorDetails(error: unknown) {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
      stack: error.stack,
    };
  }
  return { message: String(error) };
}

function eventPayload(input: MonitoringEventInput, env: NodeJS.ProcessEnv) {
  return {
    context: input.context ?? {},
    environment: env.NODE_ENV ?? "development",
    error: input.error === undefined ? undefined : errorDetails(input.error),
    message: input.message,
    service: "fleetcore-api",
    severity: input.severity ?? "error",
    source: input.source,
    timestamp: new Date().toISOString(),
    version: env.RENDER_GIT_COMMIT ?? env.GIT_COMMIT ?? env.COMMIT_SHA ?? "unknown",
  };
}

function sentryTarget(dsn: string) {
  try {
    const parsed = new URL(dsn);
    const projectId = parsed.pathname.split("/").filter(Boolean).at(-1);
    if (!projectId) return undefined;
    const publicKey = parsed.username;
    const endpoint = `${parsed.protocol}//${parsed.host}/api/${projectId}/store/`;
    return {
      auth: `Sentry sentry_version=7, sentry_key=${publicKey}, sentry_client=fleetcore-api/0.1.0`,
      endpoint,
    };
  } catch {
    return undefined;
  }
}

async function postJson(url: string, payload: Record<string, unknown>, headers: Record<string, string> = {}) {
  const response = await fetch(url, {
    body: JSON.stringify(payload),
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    method: "POST",
  });
  if (!response.ok) {
    throw new Error(`Monitoring delivery failed: ${response.status} ${await response.text()}`);
  }
}

export function monitoringProvider(env: NodeJS.ProcessEnv = process.env): MonitoringEventResult["provider"] {
  if (env.MONITORING_DSN) return "webhook";
  if (env.SENTRY_DSN) return "sentry";
  return "none";
}

export async function reportMonitoringEvent(input: MonitoringEventInput, env: NodeJS.ProcessEnv = process.env): Promise<MonitoringEventResult> {
  const provider = monitoringProvider(env);
  if (provider === "none") {
    return { delivered: false, provider: "none", skipped: true };
  }
  if (env.MONITORING_MODE === "mock" || isSuppressed(env)) {
    return { delivered: false, provider: "mock", skipped: true };
  }

  const payload = eventPayload(input, env);
  if (provider === "webhook" && env.MONITORING_DSN) {
    await postJson(env.MONITORING_DSN, payload, env.MONITORING_TOKEN ? { Authorization: `Bearer ${env.MONITORING_TOKEN}` } : {});
    return { delivered: true, provider };
  }

  if (provider === "sentry" && env.SENTRY_DSN) {
    const target = sentryTarget(env.SENTRY_DSN);
    if (!target) return { delivered: false, provider: "sentry", skipped: true };
    await postJson(target.endpoint, {
      culprit: input.source,
      environment: payload.environment,
      event_id: randomUUID().replace(/-/gu, ""),
      extra: payload.context,
      level: payload.severity,
      logger: "fleetcore-api",
      message: payload.message,
      platform: "node",
      release: payload.version,
      timestamp: payload.timestamp,
      ...(payload.error ? { exception: { values: [{ type: payload.error.name ?? "Error", value: payload.error.message, stacktrace: payload.error.stack }] } } : {}),
    }, { "X-Sentry-Auth": target.auth });
    return { delivered: true, provider };
  }

  return { delivered: false, provider, skipped: true };
}

export async function alertWebhookFailure(input: Omit<MonitoringEventInput, "source">, env: NodeJS.ProcessEnv = process.env) {
  return reportMonitoringEvent({ ...input, severity: input.severity ?? "critical", source: "webhook" }, env);
}

export async function alertBackgroundJobFailure(input: Omit<MonitoringEventInput, "source">, env: NodeJS.ProcessEnv = process.env) {
  return reportMonitoringEvent({ ...input, severity: input.severity ?? "critical", source: "background_job" }, env);
}

export async function alertDeliveryFailure(input: Omit<MonitoringEventInput, "source">, env: NodeJS.ProcessEnv = process.env) {
  return reportMonitoringEvent({ ...input, severity: input.severity ?? "error", source: "delivery" }, env);
}

export async function runMonitoredJob<T>(name: string, job: () => Promise<T>, env: NodeJS.ProcessEnv = process.env): Promise<T> {
  try {
    return await job();
  } catch (error) {
    await alertBackgroundJobFailure({
      context: { job: name },
      error,
      message: `Background job failed: ${name}`,
    }, env);
    throw error;
  }
}
