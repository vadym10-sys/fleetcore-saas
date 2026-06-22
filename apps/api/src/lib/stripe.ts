import { createHmac, timingSafeEqual } from "node:crypto";

export class StripeSignatureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StripeSignatureError";
  }
}

function parseSignatureHeader(header: string) {
  return header.split(",").reduce<{ timestamp?: string; signatures: string[] }>((parsed, part) => {
    const [key, value] = part.split("=");
    if (key === "t" && value) parsed.timestamp = value;
    if (key === "v1" && value) parsed.signatures.push(value);
    return parsed;
  }, { signatures: [] });
}

function safeCompareHex(left: string, right: string) {
  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function verifyStripeSignature(rawBody: string, signatureHeader: string | undefined, secret: string | undefined, toleranceSeconds = 300) {
  if (!secret) {
    throw new StripeSignatureError("Stripe webhook secret is not configured.");
  }
  if (!signatureHeader) {
    throw new StripeSignatureError("Stripe-Signature header is missing.");
  }

  const parsed = parseSignatureHeader(signatureHeader);
  const timestamp = Number(parsed.timestamp);
  if (!Number.isFinite(timestamp) || parsed.signatures.length === 0) {
    throw new StripeSignatureError("Stripe-Signature header is invalid.");
  }

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > toleranceSeconds) {
    throw new StripeSignatureError("Stripe webhook timestamp is outside tolerance.");
  }

  const expectedSignature = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`, "utf8")
    .digest("hex");

  if (!parsed.signatures.some((signature) => safeCompareHex(signature, expectedSignature))) {
    throw new StripeSignatureError("Stripe webhook signature verification failed.");
  }
}

export function parseStripeWebhookEvent(rawBody: string, signatureHeader: string | undefined, secret: string | undefined): { id: string; type: string; data: { object: Record<string, unknown> } } {
  verifyStripeSignature(rawBody, signatureHeader, secret);
  const parsed = JSON.parse(rawBody) as { id?: string; type?: string; data?: { object?: Record<string, unknown> } };
  if (!parsed.id || !parsed.type || !parsed.data?.object) {
    throw new StripeSignatureError("Stripe webhook payload is missing required event fields.");
  }
  return { data: { object: parsed.data.object }, id: parsed.id, type: parsed.type };
}
