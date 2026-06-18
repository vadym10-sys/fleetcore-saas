import { createHmac, timingSafeEqual } from "node:crypto";
import type { User, UserRole } from "@fleetcore/shared";

export interface AuthClaims {
  companyId: string;
  email: string;
  role: UserRole;
  sub: string;
  tenantId: string;
}

function secret() {
  return process.env.JWT_SECRET ?? "fleetcore-local-development-secret";
}

function encode(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function signPayload(data: string) {
  return createHmac("sha256", secret()).update(data).digest("base64url");
}

export function signAccessToken(user: User) {
  const header = encode({ alg: "HS256", typ: "JWT" });
  const payload = encode({
    companyId: user.companyId,
    email: user.email,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 12,
    role: user.role,
    sub: user.id,
    tenantId: user.tenantId,
  });
  const unsigned = `${header}.${payload}`;

  return `${unsigned}.${signPayload(unsigned)}`;
}

export function verifyAccessToken(token: string): AuthClaims | undefined {
  const [header, payload, signature] = token.split(".");
  if (!header || !payload || !signature) return undefined;

  const expected = signPayload(`${header}.${payload}`);
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== actualBuffer.length || !timingSafeEqual(expectedBuffer, actualBuffer)) {
    return undefined;
  }

  const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as AuthClaims & { exp?: number };
  if (claims.exp && claims.exp < Math.floor(Date.now() / 1000)) {
    return undefined;
  }

  return claims;
}

export function verifyPassword(password: string, storedHash: string) {
  const expected = Buffer.from(storedHash);
  const actual = Buffer.from(password);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
