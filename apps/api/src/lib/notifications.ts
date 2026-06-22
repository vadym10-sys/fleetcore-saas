import { sendTransactionalEmail } from "./email.js";

export type NotificationChannel = "email" | "telegram" | "whatsapp";
export type NotificationProvider = "email" | "mock" | "telegram" | "whatsapp";

export type NotificationInput = {
  body: string;
  channel: NotificationChannel;
  recipient: string;
  subject?: string;
};

export type NotificationResult = {
  attempts: number;
  provider: NotificationProvider;
  providerMessageId?: string;
  sent: boolean;
  skipped?: boolean;
};

function isMockMode(env: NodeJS.ProcessEnv = process.env) {
  return env.NOTIFICATION_MODE === "mock" || env.DELIVERY_MOCK_MODE === "true";
}

function suppressExternalNotifications(env: NodeJS.ProcessEnv = process.env) {
  const testMode = env.NODE_ENV === "test" || env.NOTIFICATION_TEST_MODE === "true";
  return testMode && env.NOTIFICATION_SEND_IN_TEST !== "true" && env.EMAIL_SEND_IN_TEST !== "true";
}

function retryAttempts(env: NodeJS.ProcessEnv = process.env) {
  const configured = Number(env.NOTIFICATION_RETRY_ATTEMPTS ?? 2);
  return Number.isFinite(configured) ? Math.max(1, Math.min(5, configured)) : 2;
}

async function withRetry<T>(operation: () => Promise<T>, attempts: number) {
  let lastError: unknown;
  for (let index = 0; index < attempts; index += 1) {
    try {
      return { attempts: index + 1, result: await operation() };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Notification delivery failed");
}

async function sendWhatsApp(input: NotificationInput, env: NodeJS.ProcessEnv) {
  if (!env.WHATSAPP_ACCESS_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID) {
    return { provider: "mock" as const, sent: false, skipped: true };
  }

  const response = await fetch(`https://graph.facebook.com/v20.0/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      text: { body: input.body, preview_url: true },
      to: input.recipient.replace(/[^\d+]/gu, ""),
      type: "text",
    }),
    headers: {
      Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`WhatsApp delivery failed: ${response.status} ${await response.text()}`);
  }

  const body = await response.json() as { messages?: Array<{ id?: string }> };
  return {
    provider: "whatsapp" as const,
    providerMessageId: body.messages?.[0]?.id,
    sent: true,
  };
}

async function sendTelegram(input: NotificationInput, env: NodeJS.ProcessEnv) {
  if (!env.TELEGRAM_BOT_TOKEN) {
    return { provider: "mock" as const, sent: false, skipped: true };
  }

  const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    body: JSON.stringify({
      chat_id: input.recipient,
      disable_web_page_preview: false,
      text: input.body,
    }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`Telegram delivery failed: ${response.status} ${await response.text()}`);
  }

  const body = await response.json() as { result?: { message_id?: number } };
  return {
    provider: "telegram" as const,
    providerMessageId: body.result?.message_id === undefined ? undefined : String(body.result.message_id),
    sent: true,
  };
}

async function sendEmailNotification(input: NotificationInput, env: NodeJS.ProcessEnv) {
  const result = await sendTransactionalEmail({
    data: { message: input.body },
    kind: "admin_notification",
    to: input.recipient,
    ...(input.subject ? { subject: input.subject } : {}),
  }, env);
  return {
    provider: "email" as const,
    providerMessageId: result.messageId,
    sent: result.sent,
    skipped: result.skipped,
  };
}

export async function sendNotification(input: NotificationInput, env: NodeJS.ProcessEnv = process.env): Promise<NotificationResult> {
  if (isMockMode(env) || suppressExternalNotifications(env)) {
    return {
      attempts: 0,
      provider: "mock",
      sent: false,
      skipped: true,
    };
  }

  const attempts = retryAttempts(env);
  const delivery = await withRetry(async () => {
    if (input.channel === "email") return sendEmailNotification(input, env);
    if (input.channel === "telegram") return sendTelegram(input, env);
    return sendWhatsApp(input, env);
  }, attempts);

  return {
    attempts: delivery.attempts,
    provider: delivery.result.provider,
    sent: delivery.result.sent,
    ...(delivery.result.providerMessageId ? { providerMessageId: delivery.result.providerMessageId } : {}),
    ...(delivery.result.skipped ? { skipped: delivery.result.skipped } : {}),
  };
}
