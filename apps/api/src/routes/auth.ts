import type { AuthSession } from "@fleetcore/shared";
import type { FastifyPluginAsync } from "fastify";
import { createCompanyAccount, getUserCredentialsByEmail } from "../db/repositories.js";
import { hashPassword, signAccessToken, verifyPassword } from "../lib/auth.js";
import { envelope } from "../lib/http.js";
import { loginInput, registerCompanyInput } from "../schemas.js";

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post("/auth/login", async (request, reply): Promise<{ data: AuthSession } | void> => {
    const parsed = loginInput.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid login payload", issues: parsed.error.flatten() });
    }

    const credentials = await getUserCredentialsByEmail(parsed.data.email);
    if (!credentials || !verifyPassword(parsed.data.password, credentials.passwordHash)) {
      return reply.code(401).send({ error: "Invalid credentials" });
    }

    return envelope({
      accessToken: signAccessToken(credentials.user),
      tenantId: credentials.user.tenantId,
      companyId: credentials.user.companyId,
      user: credentials.user,
    });
  });

  app.post("/auth/register-company", async (request, reply): Promise<{ data: AuthSession } | void> => {
    const parsed = registerCompanyInput.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid registration payload", issues: parsed.error.flatten() });
    }

    try {
      const account = await createCompanyAccount(parsed.data, hashPassword(parsed.data.owner.password));

      return reply.code(201).send(envelope({
        accessToken: signAccessToken(account.user),
        tenantId: account.user.tenantId,
        companyId: account.user.companyId,
        user: account.user,
      }));
    } catch (error) {
      if (error instanceof Error && error.message === "EMAIL_ALREADY_REGISTERED") {
        return reply.code(409).send({ error: "Email already registered" });
      }

      throw error;
    }
  });
};
