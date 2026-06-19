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
  writeAuditLog,
} from "../db/repositories.js";
import { getRequestUser, getTenantScope, requireRoles } from "../lib/access-control.js";
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

    const scope = getTenantScope(request);
    const expense = await createExpense(scope, parsed.data);
    if (!expense) {
      return reply.code(422).send({ error: "Vehicle does not exist" });
    }

    const user = getRequestUser(request);
    await writeAuditLog({
      action: "finance.expense.created",
      actorEmail: user?.email,
      companyId: scope.companyId,
      entityId: expense.id,
      entityType: "expense",
      metadata: { amount: expense.amount, category: expense.category, vehicleId: expense.vehicleId },
      tenantId: scope.tenantId,
      userId: user?.id,
    });
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

    const scope = getTenantScope(request);
    const record = await createServiceRecord(scope, parsed.data);
    if (!record) {
      return reply.code(422).send({ error: "Vehicle does not exist" });
    }

    const user = getRequestUser(request);
    await writeAuditLog({
      action: "service.record.created",
      actorEmail: user?.email,
      companyId: scope.companyId,
      entityId: record.id,
      entityType: "service_record",
      metadata: { cost: record.cost, status: record.status, type: record.type, vehicleId: record.vehicleId },
      tenantId: scope.tenantId,
      userId: user?.id,
    });
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

    const scope = getTenantScope(request);
    const document = await createCustomerDocument(scope, parsed.data);
    if (!document) {
      return reply.code(422).send({ error: "Customer does not exist" });
    }

    const user = getRequestUser(request);
    await writeAuditLog({
      action: "document.customer.created",
      actorEmail: user?.email,
      companyId: scope.companyId,
      entityId: document.id,
      entityType: "customer_document",
      metadata: { customerId: document.customerId, title: document.title, type: document.type, verified: document.verified },
      tenantId: scope.tenantId,
      userId: user?.id,
    });
    return reply.code(201).send(envelope(document));
  });

  app.get("/operations/rental-contracts", async (request) => envelope(await listRentalContracts(getTenantScope(request))));

  app.post("/operations/rental-contracts", async (request, reply) => {
    if (!requireRoles(request, reply, ["owner", "admin", "fleet_manager", "support"])) return;

    const parsed = rentalContractInput.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid rental contract payload", issues: parsed.error.flatten() });
    }

    const scope = getTenantScope(request);
    const contract = await createRentalContract(scope, parsed.data);
    if (!contract) {
      return reply.code(422).send({ error: "Rental does not exist" });
    }

    const user = getRequestUser(request);
    await writeAuditLog({
      action: "rental.contract.upserted",
      actorEmail: user?.email,
      companyId: scope.companyId,
      entityId: contract.id,
      entityType: "rental_contract",
      metadata: { rentalId: contract.rentalId, sentVia: contract.sentVia, status: contract.status },
      tenantId: scope.tenantId,
      userId: user?.id,
    });
    return reply.code(201).send(envelope(contract));
  });
};
