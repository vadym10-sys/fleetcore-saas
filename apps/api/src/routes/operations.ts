import type { FastifyPluginAsync } from "fastify";
import {
  createCustomerDocument,
  createExpense,
  createRentalContract,
  createServiceRecord,
  listCustomerDocuments,
  listExpenses,
  listRentalContracts,
  listServiceRecords,
} from "../db/repositories.js";
import { getTenantScope, requireRoles } from "../lib/access-control.js";
import { envelope } from "../lib/http.js";
import { customerDocumentInput, expenseInput, rentalContractInput, serviceRecordInput } from "../schemas.js";

export const operationRoutes: FastifyPluginAsync = async (app) => {
  app.get("/operations/expenses", async (request) => envelope(await listExpenses(getTenantScope(request))));

  app.post("/operations/expenses", async (request, reply) => {
    if (!requireRoles(request, reply, ["owner", "admin", "finance_manager", "fleet_manager"])) return;

    const parsed = expenseInput.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid expense payload", issues: parsed.error.flatten() });
    }

    const expense = await createExpense(getTenantScope(request), parsed.data);
    if (!expense) {
      return reply.code(422).send({ error: "Vehicle does not exist" });
    }

    return reply.code(201).send(envelope(expense));
  });

  app.get("/operations/service-records", async (request) => {
    const { vehicleId } = request.query as { vehicleId?: string };
    return envelope(await listServiceRecords(getTenantScope(request), vehicleId));
  });

  app.post("/operations/service-records", async (request, reply) => {
    if (!requireRoles(request, reply, ["owner", "admin", "fleet_manager"])) return;

    const parsed = serviceRecordInput.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid service payload", issues: parsed.error.flatten() });
    }

    const record = await createServiceRecord(getTenantScope(request), parsed.data);
    if (!record) {
      return reply.code(422).send({ error: "Vehicle does not exist" });
    }

    return reply.code(201).send(envelope(record));
  });

  app.get("/operations/customer-documents", async (request) => {
    const { customerId } = request.query as { customerId?: string };
    return envelope(await listCustomerDocuments(getTenantScope(request), customerId));
  });

  app.post("/operations/customer-documents", async (request, reply) => {
    if (!requireRoles(request, reply, ["owner", "admin", "support", "fleet_manager"])) return;

    const parsed = customerDocumentInput.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid customer document payload", issues: parsed.error.flatten() });
    }

    const document = await createCustomerDocument(getTenantScope(request), parsed.data);
    if (!document) {
      return reply.code(422).send({ error: "Customer does not exist" });
    }

    return reply.code(201).send(envelope(document));
  });

  app.get("/operations/rental-contracts", async (request) => envelope(await listRentalContracts(getTenantScope(request))));

  app.post("/operations/rental-contracts", async (request, reply) => {
    if (!requireRoles(request, reply, ["owner", "admin", "fleet_manager", "support"])) return;

    const parsed = rentalContractInput.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid rental contract payload", issues: parsed.error.flatten() });
    }

    const contract = await createRentalContract(getTenantScope(request), parsed.data);
    if (!contract) {
      return reply.code(422).send({ error: "Rental does not exist" });
    }

    return reply.code(201).send(envelope(contract));
  });
};

