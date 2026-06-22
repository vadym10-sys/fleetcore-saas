import type { AuthSession } from "@fleetcore/shared";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { createAuthToken, createCompanyAccount, createDeliveryMessage, createTeamUser, getActiveAuthToken, getUserByEmail, getUserCredentialsByEmail, listAuditLogs, listTeamUsers, markAuthTokenUsed, markUserEmailVerified, revokeAuthToken, revokeUserRefreshTokens, touchUserLogin, updateDeliveryMessageStatus, updateUserPassword, updateUserProfile, writeAuditLog } from "../db/repositories.js";
import { getRequestUser, getTenantScope, requireRoles } from "../lib/access-control.js";
import { accessTokenExpiresAt, createOpaqueToken, hashOpaqueToken, hashPassword, refreshTokenExpiresAt, signAccessToken, verifyPassword } from "../lib/auth.js";
import { buildActionLink, sendTransactionalEmail, type TransactionalEmailInput } from "../lib/email.js";
import { envelope } from "../lib/http.js";
import { emailVerificationInput, emailVerificationRequestInput, loginInput, logoutInput, passwordResetInput, passwordResetRequestInput, profileUpdateInput, refreshTokenInput, registerCompanyInput, teamMemberInput } from "../schemas.js";

const authAttempts = new Map<string, { count: number; resetAt: number }>();

function requestIp(request: FastifyRequest) {
  const forwarded = request.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded) return forwarded.split(",")[0]?.trim();
  return request.ip;
}

function userAgent(request: FastifyRequest) {
  const header = request.headers["user-agent"];
  return typeof header === "string" ? header : undefined;
}

function authRateLimit(key: string, maxAttempts = 12, windowMs = 60_000) {
  const now = Date.now();
  const current = authAttempts.get(key);
  if (!current || current.resetAt < now) {
    authAttempts.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  current.count += 1;
  return current.count <= maxAttempts;
}

async function createSession(user: AuthSession["user"], request: FastifyRequest): Promise<AuthSession> {
  const accessExpiresAt = accessTokenExpiresAt();
  const refreshToken = createOpaqueToken();
  const refreshExpiresAt = refreshTokenExpiresAt();
  await createAuthToken({
    companyId: user.companyId,
    expiresAt: refreshExpiresAt,
    ipAddress: requestIp(request),
    tenantId: user.tenantId,
    tokenHash: hashOpaqueToken(refreshToken),
    type: "refresh",
    userAgent: userAgent(request),
    userId: user.id,
  });

  return {
    accessToken: signAccessToken(user, accessExpiresAt),
    accessTokenExpiresAt: accessExpiresAt.toISOString(),
    tenantId: user.tenantId,
    companyId: user.companyId,
    refreshToken,
    refreshTokenExpiresAt: refreshExpiresAt.toISOString(),
    user,
  };
}

function shouldExposeDevToken() {
  return process.env.NODE_ENV !== "production" || process.env.AUTH_TOKEN_PREVIEW === "true";
}

async function sendAuthEmail(app: Parameters<FastifyPluginAsync>[0], input: TransactionalEmailInput & {
  companyId: string;
  tenantId: string;
  userId?: string;
}) {
  const scope = { companyId: input.companyId, tenantId: input.tenantId };
  const renderedBody = input.data?.link ? `Open secure FleetCore link: ${input.data.link}` : `FleetCore ${input.kind}`;
  let message = await createDeliveryMessage(scope, {
    body: renderedBody,
    channel: "email",
    entityType: "system",
    recipient: input.to,
    subject: input.subject ?? input.kind.replace(/_/gu, " "),
  }, input.userId);
  try {
    const result = await sendTransactionalEmail(input);
    message = await updateDeliveryMessageStatus(scope, message.id, {
      status: result.sent ? "sent" : "queued",
      ...(result.messageId ? { providerMessageId: result.messageId } : {}),
    }) ?? message;
  } catch (error) {
    app.log.error({ error, messageId: message.id }, "Auth transactional email failed");
    await updateDeliveryMessageStatus(scope, message.id, {
      error: error instanceof Error ? error.message : "Unknown email delivery error",
      status: "failed",
    });
  }
}

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post("/auth/demo", async (request, reply): Promise<{ data: AuthSession } | void> => {
    const limitKey = `demo:${requestIp(request) ?? "unknown"}`;
    if (!authRateLimit(limitKey, 24, 60_000)) {
      return reply.code(429).send({ error: "Too many demo login attempts. Try again soon." });
    }

    const user = await getUserByEmail("founder@atlas.example");
    if (!user) {
      return reply.code(503).send({ error: "Demo account is not ready yet. Try again in a few seconds." });
    }

    await touchUserLogin(user.id);
    await writeAuditLog({
      action: "auth.demo_login",
      actorEmail: user.email,
      companyId: user.companyId,
      ipAddress: requestIp(request),
      tenantId: user.tenantId,
      userAgent: userAgent(request),
      userId: user.id,
    });

    return envelope(await createSession(user, request));
  });

  app.post("/auth/login", async (request, reply): Promise<{ data: AuthSession } | void> => {
    const parsed = loginInput.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid login payload", issues: parsed.error.flatten() });
    }

    const limitKey = `login:${requestIp(request) ?? "unknown"}:${parsed.data.email}`;
    if (!authRateLimit(limitKey)) {
      return reply.code(429).send({ error: "Too many login attempts. Try again soon." });
    }

    const credentials = await getUserCredentialsByEmail(parsed.data.email);
    if (!credentials || !verifyPassword(parsed.data.password, credentials.passwordHash)) {
      return reply.code(401).send({ error: "Invalid credentials" });
    }

    await touchUserLogin(credentials.user.id);
    await writeAuditLog({
      action: "auth.login",
      actorEmail: credentials.user.email,
      companyId: credentials.user.companyId,
      ipAddress: requestIp(request),
      tenantId: credentials.user.tenantId,
      userAgent: userAgent(request),
      userId: credentials.user.id,
    });
    return envelope(await createSession(credentials.user, request));
  });

  app.post("/auth/register-company", async (request, reply): Promise<{ data: AuthSession } | void> => {
    const parsed = registerCompanyInput.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid registration payload", issues: parsed.error.flatten() });
    }

    try {
      const account = await createCompanyAccount(parsed.data, hashPassword(parsed.data.owner.password));
      await writeAuditLog({
        action: "auth.register_company",
        actorEmail: account.user.email,
        companyId: account.user.companyId,
        ipAddress: requestIp(request),
        metadata: { plan: account.company.plan },
        tenantId: account.user.tenantId,
        userAgent: userAgent(request),
        userId: account.user.id,
      });
      await sendAuthEmail(app, {
        companyId: account.user.companyId,
        data: { company: account.company.tradingName, name: account.user.fullName },
        kind: "welcome",
        tenantId: account.user.tenantId,
        to: account.user.email,
        userId: account.user.id,
      });

      return reply.code(201).send(envelope(await createSession(account.user, request)));
    } catch (error) {
      if (error instanceof Error && error.message === "EMAIL_ALREADY_REGISTERED") {
        return reply.code(409).send({ error: "Email already registered" });
      }

      throw error;
    }
  });

  app.post("/auth/refresh", async (request, reply): Promise<{ data: AuthSession } | void> => {
    const parsed = refreshTokenInput.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid refresh payload", issues: parsed.error.flatten() });
    }

    const tokenHash = hashOpaqueToken(parsed.data.refreshToken);
    const token = await getActiveAuthToken(tokenHash, "refresh");
    if (!token) {
      return reply.code(401).send({ error: "Invalid refresh token" });
    }

    await markAuthTokenUsed(token.id);
    await writeAuditLog({
      action: "auth.refresh",
      actorEmail: token.user.email,
      companyId: token.user.companyId,
      ipAddress: requestIp(request),
      tenantId: token.user.tenantId,
      userAgent: userAgent(request),
      userId: token.user.id,
    });
    return envelope(await createSession(token.user, request));
  });

  app.post("/auth/logout", async (request) => {
    const parsed = logoutInput.safeParse(request.body ?? {});
    if (parsed.success && parsed.data.refreshToken) {
      await revokeAuthToken(hashOpaqueToken(parsed.data.refreshToken), "refresh");
    }

    const user = getRequestUser(request);
    if (user) {
      await writeAuditLog({
        action: "auth.logout",
        actorEmail: user.email,
        companyId: user.companyId,
        ipAddress: requestIp(request),
        tenantId: user.tenantId,
        userAgent: userAgent(request),
        userId: user.id,
      });
    }

    return envelope({ ok: true });
  });

  app.post("/auth/request-password-reset", async (request, reply) => {
    const parsed = passwordResetRequestInput.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid password reset payload", issues: parsed.error.flatten() });
    }

    const limitKey = `password-reset:${requestIp(request) ?? "unknown"}:${parsed.data.email}`;
    if (!authRateLimit(limitKey, 5, 15 * 60_000)) {
      return reply.code(429).send({ error: "Too many password reset requests. Try again later." });
    }

    const user = await getUserByEmail(parsed.data.email);
    const response: { delivery: "email" | "development"; resetToken?: string } = { delivery: shouldExposeDevToken() ? "development" : "email" };
    if (user) {
      const resetToken = createOpaqueToken();
      await createAuthToken({
        companyId: user.companyId,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60),
        ipAddress: requestIp(request),
        tenantId: user.tenantId,
        tokenHash: hashOpaqueToken(resetToken),
        type: "password_reset",
        userAgent: userAgent(request),
        userId: user.id,
      });
      await writeAuditLog({
        action: "auth.password_reset_requested",
        actorEmail: user.email,
        companyId: user.companyId,
        ipAddress: requestIp(request),
        tenantId: user.tenantId,
        userAgent: userAgent(request),
        userId: user.id,
      });
      await sendAuthEmail(app, {
        companyId: user.companyId,
        data: { link: buildActionLink("/reset-password", resetToken), name: user.fullName },
        kind: "password_reset",
        tenantId: user.tenantId,
        to: user.email,
        userId: user.id,
      });
      if (shouldExposeDevToken()) response.resetToken = resetToken;
    }

    return envelope(response);
  });

  app.post("/auth/reset-password", async (request, reply) => {
    const parsed = passwordResetInput.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid password reset payload", issues: parsed.error.flatten() });
    }

    const token = await getActiveAuthToken(hashOpaqueToken(parsed.data.token), "password_reset");
    if (!token) {
      return reply.code(401).send({ error: "Invalid or expired password reset token" });
    }

    await updateUserPassword(token.user.id, hashPassword(parsed.data.password));
    await markAuthTokenUsed(token.id);
    await revokeUserRefreshTokens(token.user.id);
    await writeAuditLog({
      action: "auth.password_reset_completed",
      actorEmail: token.user.email,
      companyId: token.user.companyId,
      ipAddress: requestIp(request),
      tenantId: token.user.tenantId,
      userAgent: userAgent(request),
      userId: token.user.id,
    });

    return envelope({ ok: true });
  });

  app.post("/auth/request-email-verification", async (request, reply) => {
    const parsed = emailVerificationRequestInput.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid email verification payload", issues: parsed.error.flatten() });
    }

    const currentUser = getRequestUser(request);
    const targetEmail = parsed.data.email ?? currentUser?.email;
    if (!targetEmail) {
      return reply.code(401).send({ error: "Authentication required" });
    }

    const user = await getUserByEmail(targetEmail);
    if (!user) {
      return reply.code(404).send({ error: "User not found" });
    }

    if (currentUser && currentUser.id !== user.id && !["owner"].includes(currentUser.role)) {
      return reply.code(403).send({ error: "Insufficient permissions" });
    }

    const verificationToken = createOpaqueToken();
    await createAuthToken({
      companyId: user.companyId,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
      ipAddress: requestIp(request),
      tenantId: user.tenantId,
      tokenHash: hashOpaqueToken(verificationToken),
      type: "email_verification",
      userAgent: userAgent(request),
      userId: user.id,
    });
    await writeAuditLog({
      action: "auth.email_verification_requested",
      actorEmail: user.email,
      companyId: user.companyId,
      ipAddress: requestIp(request),
      tenantId: user.tenantId,
      userAgent: userAgent(request),
      userId: user.id,
    });
    await sendAuthEmail(app, {
      companyId: user.companyId,
      data: { link: buildActionLink("/verify-email", verificationToken), name: user.fullName },
      kind: "magic_link",
      tenantId: user.tenantId,
      to: user.email,
      userId: user.id,
    });

    return envelope({
      delivery: shouldExposeDevToken() ? "development" : "email",
      ...(shouldExposeDevToken() ? { verificationToken } : {}),
    });
  });

  app.post("/auth/verify-email", async (request, reply) => {
    const parsed = emailVerificationInput.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid email verification payload", issues: parsed.error.flatten() });
    }

    const token = await getActiveAuthToken(hashOpaqueToken(parsed.data.token), "email_verification");
    if (!token) {
      return reply.code(401).send({ error: "Invalid or expired email verification token" });
    }

    await markUserEmailVerified(token.user.id);
    await markAuthTokenUsed(token.id);
    await writeAuditLog({
      action: "auth.email_verified",
      actorEmail: token.user.email,
      companyId: token.user.companyId,
      ipAddress: requestIp(request),
      tenantId: token.user.tenantId,
      userAgent: userAgent(request),
      userId: token.user.id,
    });

    return envelope({ ok: true });
  });

  app.get("/auth/audit-log", async (request, reply) => {
    if (!requireRoles(request, reply, ["owner"])) return;
    const scope = getTenantScope(request);
    return envelope(await listAuditLogs(scope, 100));
  });

  app.patch("/auth/me", async (request, reply) => {
    const user = getRequestUser(request);
    if (!user) return reply.code(401).send({ error: "Authentication required" });

    const parsed = profileUpdateInput.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid profile payload", issues: parsed.error.flatten() });
    }

    const updated = await updateUserProfile(user.id, parsed.data);
    if (!updated) return reply.code(404).send({ error: "User not found" });

    await writeAuditLog({
      action: "auth.profile.updated",
      actorEmail: updated.email,
      companyId: updated.companyId,
      ipAddress: requestIp(request),
      metadata: { fullName: updated.fullName, photoUrl: updated.photoUrl ?? null },
      tenantId: updated.tenantId,
      userAgent: userAgent(request),
      userId: updated.id,
    });

    return envelope(updated);
  });

  app.get("/auth/team", async (request, reply) => {
    if (!requireRoles(request, reply, ["owner"])) return;
    return envelope(await listTeamUsers(getTenantScope(request)));
  });

  app.post("/auth/team", async (request, reply) => {
    if (!requireRoles(request, reply, ["owner"])) return;

    const parsed = teamMemberInput.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid team member payload", issues: parsed.error.flatten() });
    }

    const scope = getTenantScope(request);
    const actor = getRequestUser(request);
    try {
      const user = await createTeamUser(scope, parsed.data, hashPassword(parsed.data.password));
      await writeAuditLog({
        action: "auth.team_user.created",
        actorEmail: actor?.email,
        companyId: scope.companyId,
        entityId: user.id,
        entityType: "user",
        ipAddress: requestIp(request),
        metadata: { email: user.email, role: user.role },
        tenantId: scope.tenantId,
        userAgent: userAgent(request),
        userId: actor?.id,
      });
      return reply.code(201).send(envelope(user));
    } catch (error) {
      if (error instanceof Error && error.message === "EMAIL_ALREADY_REGISTERED") {
        return reply.code(409).send({ error: "Email already registered" });
      }

      throw error;
    }
  });
};
