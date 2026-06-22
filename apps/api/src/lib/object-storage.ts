import { createHmac, createHash } from "node:crypto";

export type StorageProvider = "database" | "s3";

export type StoredObject = {
  provider: StorageProvider;
  sha256: string;
  storageKey: string;
};

type S3Config = {
  accessKeyId: string;
  bucket: string;
  endpoint: string;
  forcePathStyle: boolean;
  region: string;
  secretAccessKey: string;
};

function getS3Config(env: NodeJS.ProcessEnv = process.env): S3Config | undefined {
  if (!env.S3_BUCKET || !env.S3_REGION || !env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY) return undefined;
  const endpoint = env.S3_ENDPOINT?.replace(/\/+$/u, "") ?? `https://s3.${env.S3_REGION}.amazonaws.com`;
  return {
    accessKeyId: env.S3_ACCESS_KEY_ID,
    bucket: env.S3_BUCKET,
    endpoint,
    forcePathStyle: env.S3_FORCE_PATH_STYLE === "true" || Boolean(env.S3_ENDPOINT),
    region: env.S3_REGION,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
  };
}

export function objectStorageProvider(env: NodeJS.ProcessEnv = process.env): StorageProvider {
  return getS3Config(env) ? "s3" : "database";
}

function sanitizeFileName(name: string) {
  return name.replace(/[^\w.\-]+/gu, "_").replace(/^_+|_+$/gu, "") || "file";
}

export function createStorageKey(input: { companyId: string; fileId: string; originalName: string; tenantId: string }) {
  return `${input.tenantId}/${input.companyId}/${input.fileId}/${sanitizeFileName(input.originalName)}`;
}

function hmac(key: Buffer | string, value: string) {
  return createHmac("sha256", key).update(value).digest();
}

function hmacHex(key: Buffer | string, value: string) {
  return createHmac("sha256", key).update(value).digest("hex");
}

function sha256Hex(value: Buffer | string) {
  return createHash("sha256").update(value).digest("hex");
}

function amzDate(date = new Date()) {
  const iso = date.toISOString().replace(/[:-]|\.\d{3}/gu, "");
  return {
    date: iso.slice(0, 8),
    timestamp: iso,
  };
}

function encodePathPart(part: string) {
  return encodeURIComponent(part).replace(/[!'()*]/gu, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

function encodeKey(key: string) {
  return key.split("/").map(encodePathPart).join("/");
}

function s3ObjectUrl(config: S3Config, key: string) {
  const endpoint = new URL(config.endpoint);
  const encodedKey = encodeKey(key);
  if (config.forcePathStyle) {
    return new URL(`/${encodePathPart(config.bucket)}/${encodedKey}`, endpoint);
  }
  return new URL(`${endpoint.protocol}//${config.bucket}.${endpoint.host}/${encodedKey}`);
}

function signingKey(config: S3Config, date: string) {
  const kDate = hmac(`AWS4${config.secretAccessKey}`, date);
  const kRegion = hmac(kDate, config.region);
  const kService = hmac(kRegion, "s3");
  return hmac(kService, "aws4_request");
}

function canonicalQuery(params: URLSearchParams) {
  return Array.from(params.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${encodePathPart(key)}=${encodePathPart(value)}`)
    .join("&");
}

function signS3Request(input: {
  bodyHash: string;
  config: S3Config;
  date?: Date;
  headers?: Record<string, string>;
  key: string;
  method: "DELETE" | "GET" | "PUT";
  query?: URLSearchParams;
}) {
  const target = s3ObjectUrl(input.config, input.key);
  const { date, timestamp } = amzDate(input.date);
  const credentialScope = `${date}/${input.config.region}/s3/aws4_request`;
  const headers = {
    host: target.host,
    "x-amz-content-sha256": input.bodyHash,
    "x-amz-date": timestamp,
    ...(input.headers ?? {}),
  };
  const signedHeaderNames = Object.keys(headers).map((name) => name.toLowerCase()).sort();
  const canonicalHeaders = signedHeaderNames.map((name) => `${name}:${headers[name as keyof typeof headers]}\n`).join("");
  const canonicalRequest = [
    input.method,
    target.pathname,
    input.query ? canonicalQuery(input.query) : "",
    canonicalHeaders,
    signedHeaderNames.join(";"),
    input.bodyHash,
  ].join("\n");
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    timestamp,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");
  const signature = hmacHex(signingKey(input.config, date), stringToSign);
  return {
    authorization: `AWS4-HMAC-SHA256 Credential=${input.config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaderNames.join(";")}, Signature=${signature}`,
    headers,
    signature,
    target,
    timestamp,
  };
}

async function assertS3Response(response: Response, action: string) {
  if (!response.ok) {
    throw new Error(`${action} failed: ${response.status} ${await response.text()}`);
  }
}

export async function putObject(input: {
  body: Buffer;
  contentType: string;
  env?: NodeJS.ProcessEnv;
  key: string;
}): Promise<StoredObject> {
  const config = getS3Config(input.env);
  const sha256 = sha256Hex(input.body);
  if (!config) return { provider: "database", sha256, storageKey: input.key };

  const signed = signS3Request({
    bodyHash: sha256,
    config,
    headers: { "content-type": input.contentType },
    key: input.key,
    method: "PUT",
  });
  const response = await fetch(signed.target, {
    body: input.body as unknown as BodyInit,
    headers: {
      Authorization: signed.authorization,
      "Content-Type": input.contentType,
      "x-amz-content-sha256": sha256,
      "x-amz-date": signed.timestamp,
    },
    method: "PUT",
  });
  await assertS3Response(response, "S3 upload");
  return { provider: "s3", sha256, storageKey: input.key };
}

export async function deleteObject(input: { env?: NodeJS.ProcessEnv; storageKey: string; storageProvider: StorageProvider }) {
  const config = getS3Config(input.env);
  if (input.storageProvider !== "s3" || !config) return { deleted: true, provider: input.storageProvider };

  const emptyHash = sha256Hex("");
  const signed = signS3Request({
    bodyHash: emptyHash,
    config,
    key: input.storageKey,
    method: "DELETE",
  });
  const response = await fetch(signed.target, {
    headers: {
      Authorization: signed.authorization,
      "x-amz-content-sha256": emptyHash,
      "x-amz-date": signed.timestamp,
    },
    method: "DELETE",
  });
  await assertS3Response(response, "S3 delete");
  return { deleted: true, provider: input.storageProvider };
}

export function createSignedDownloadUrl(input: { env?: NodeJS.ProcessEnv; expiresInSeconds?: number; storageKey: string }) {
  const config = getS3Config(input.env);
  if (!config) return undefined;

  const expires = Math.max(60, Math.min(3600, input.expiresInSeconds ?? 300));
  const target = s3ObjectUrl(config, input.storageKey);
  const { date, timestamp } = amzDate();
  const credentialScope = `${date}/${config.region}/s3/aws4_request`;
  const params = new URLSearchParams({
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${config.accessKeyId}/${credentialScope}`,
    "X-Amz-Date": timestamp,
    "X-Amz-Expires": String(expires),
    "X-Amz-SignedHeaders": "host",
  });
  const canonicalRequest = [
    "GET",
    target.pathname,
    canonicalQuery(params),
    `host:${target.host}\n`,
    "host",
    "UNSIGNED-PAYLOAD",
  ].join("\n");
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    timestamp,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");
  params.set("X-Amz-Signature", hmacHex(signingKey(config, date), stringToSign));
  target.search = params.toString();
  return {
    expiresAt: new Date(Date.now() + expires * 1000).toISOString(),
    url: target.toString(),
  };
}
