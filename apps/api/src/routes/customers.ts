import type { FastifyPluginAsync } from "fastify";
import { createCustomer, getCustomer, listCustomers, updateCustomer } from "../db/repositories.js";
import { getTenantScope, requireRoles } from "../lib/access-control.js";
import { envelope } from "../lib/http.js";
import { customerInput, customerPatchInput } from "../schemas.js";

export const customerRoutes: FastifyPluginAsync = async (app) => {
  app.get("/customers", async (request) => envelope(await listCustomers(getTenantScope(request))));

  app.get("/customers/:customerId", async (request, reply) => {
    const { customerId } = request.params as { customerId: string };
    const customer = await getCustomer(getTenantScope(request), customerId);
    if (!customer) {
      return reply.code(404).send({ error: "Customer not found" });
    }

    return envelope(customer);
  });

  app.post("/customers", async (request, reply) => {
    if (!requireRoles(request, reply, ["owner", "manager"])) return;

    const parsed = customerInput.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid customer payload", issues: parsed.error.flatten() });
    }

    const customer = await createCustomer(getTenantScope(request), parsed.data);

    return reply.code(201).send(envelope(customer));
  });

  app.patch("/customers/:customerId", async (request, reply) => {
    if (!requireRoles(request, reply, ["owner", "manager"])) return;

    const { customerId } = request.params as { customerId: string };
    const parsed = customerPatchInput.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid customer payload", issues: parsed.error.flatten() });
    }

    const customer = await updateCustomer(getTenantScope(request), customerId, parsed.data);
    if (!customer) {
      return reply.code(404).send({ error: "Customer not found" });
    }

    return envelope(customer);
  });
};
