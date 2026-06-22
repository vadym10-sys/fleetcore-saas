import nodemailer from "nodemailer";

export type EmailProvider = "log" | "resend" | "smtp";

export type TransactionalEmailKind =
  | "admin_notification"
  | "magic_link"
  | "password_reset"
  | "payment_failed"
  | "payment_success"
  | "welcome";

export type TransactionalEmailInput = {
  kind: TransactionalEmailKind;
  to: string;
  subject?: string;
  data?: Record<string, string | number | boolean | null | undefined>;
};

export type TransactionalEmailResult = {
  messageId?: string;
  provider: EmailProvider;
  sent: boolean;
  skipped?: boolean;
};

function selectedEmailProvider(env: NodeJS.ProcessEnv = process.env): EmailProvider {
  const configured = env.EMAIL_PROVIDER?.toLowerCase();
  if (configured === "resend" || configured === "smtp" || configured === "log") return configured;
  if (env.RESEND_API_KEY) return "resend";
  if (env.SMTP_URL) return "smtp";
  return "log";
}

function shouldSuppressExternalEmail(env: NodeJS.ProcessEnv = process.env) {
  const testMode = env.NODE_ENV === "test" || env.EMAIL_TEST_MODE === "true";
  return testMode && env.EMAIL_SEND_IN_TEST !== "true";
}

function fromAddress(env: NodeJS.ProcessEnv = process.env) {
  return env.EMAIL_FROM || "FleetCore <no-reply@fleetcore.app>";
}

function publicWebUrl(env: NodeJS.ProcessEnv = process.env) {
  return env.WEB_ORIGIN ?? "https://fleetcore-web.onrender.com";
}

function stringData(data: TransactionalEmailInput["data"], key: string, fallback = "") {
  const value = data?.[key];
  return value === undefined || value === null ? fallback : String(value);
}

function template(input: TransactionalEmailInput) {
  const webUrl = publicWebUrl();
  const company = stringData(input.data, "company", "FleetCore");
  const name = stringData(input.data, "name", "there");
  const link = stringData(input.data, "link", webUrl);
  const plan = stringData(input.data, "plan", "current plan");
  const amount = stringData(input.data, "amount", "");
  const reason = stringData(input.data, "reason", "Payment could not be completed.");

  if (input.kind === "welcome") {
    return {
      subject: input.subject ?? `Welcome to ${company}`,
      text: `Hi ${name},\n\nWelcome to ${company}. Your FleetCore workspace is ready.\n\nOpen FleetCore: ${webUrl}\n\nFleetCore`,
    };
  }

  if (input.kind === "password_reset") {
    return {
      subject: input.subject ?? "Reset your FleetCore password",
      text: `Hi ${name},\n\nUse this secure link to reset your FleetCore password:\n${link}\n\nIf you did not request this, ignore this email.\n\nFleetCore`,
    };
  }

  if (input.kind === "magic_link") {
    return {
      subject: input.subject ?? "Your FleetCore verification link",
      text: `Hi ${name},\n\nUse this secure FleetCore link:\n${link}\n\nFleetCore`,
    };
  }

  if (input.kind === "payment_success") {
    return {
      subject: input.subject ?? "FleetCore payment confirmed",
      text: `Payment confirmed for ${company}.\n\nPlan: ${plan}${amount ? `\nAmount: ${amount}` : ""}\n\nYour subscription is active.\n\nFleetCore`,
    };
  }

  if (input.kind === "payment_failed") {
    return {
      subject: input.subject ?? "FleetCore payment failed",
      text: `Payment failed for ${company}.\n\nPlan: ${plan}${amount ? `\nAmount: ${amount}` : ""}\nReason: ${reason}\n\nPlease update billing to keep access active.\n\nFleetCore`,
    };
  }

  return {
    subject: input.subject ?? "FleetCore admin notification",
    text: `FleetCore admin notification\n\n${stringData(input.data, "message", "A FleetCore event requires attention.")}\n\nCompany: ${company}\n\nFleetCore`,
  };
}

async function sendViaResend(input: TransactionalEmailInput, rendered: { subject: string; text: string }, env: NodeJS.ProcessEnv) {
  const response = await fetch("https://api.resend.com/emails", {
    body: JSON.stringify({
      from: fromAddress(env),
      to: [input.to],
      subject: rendered.subject,
      text: rendered.text,
    }),
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`Resend email failed: ${response.status} ${await response.text()}`);
  }
  const body = await response.json() as { id?: string };
  return body.id;
}

async function sendViaSmtp(input: TransactionalEmailInput, rendered: { subject: string; text: string }, env: NodeJS.ProcessEnv) {
  if (!env.SMTP_URL) throw new Error("SMTP_URL is not configured.");
  const transport = nodemailer.createTransport(env.SMTP_URL);
  const info = await transport.sendMail({
    from: fromAddress(env),
    subject: rendered.subject,
    text: rendered.text,
    to: input.to,
  });
  return info.messageId;
}

export async function sendTransactionalEmail(input: TransactionalEmailInput, env: NodeJS.ProcessEnv = process.env): Promise<TransactionalEmailResult> {
  const provider = selectedEmailProvider(env);
  const rendered = template(input);

  if (provider === "log" || shouldSuppressExternalEmail(env)) {
    return { provider, sent: false, skipped: true };
  }

  const messageId = provider === "resend"
    ? await sendViaResend(input, rendered, env)
    : await sendViaSmtp(input, rendered, env);

  return {
    provider,
    sent: true,
    ...(messageId ? { messageId } : {}),
  };
}

export function buildActionLink(path: string, token: string) {
  const base = publicWebUrl().replace(/\/$/u, "");
  return `${base}${path}?token=${encodeURIComponent(token)}`;
}
