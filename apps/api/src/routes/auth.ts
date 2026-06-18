import type { AuthSession } from "@fleetcore/shared";
import type { FastifyPluginAsync } from "fastify";
import { defaultCompanyId, defaultTenantId } from "../db/constants.js";
import { getUserCredentialsByEmail } from "../db/repositories.js";
import { signAccessToken, verifyPassword } from "../lib/auth.js";
import { envelope } from "../lib/http.js";
import { loginInput } from "../schemas.js";

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
      tenantId: defaultTenantId,
      companyId: defaultCompanyId,
      user: credentials.user,
    });
  });
};
