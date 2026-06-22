import type { FastifyPluginAsync } from "fastify";
import { createInvoice, createInvoicePayment, customerExists, getInvoice, listInvoices, listPayments, PaymentValidationError, updateInvoice } from "../db/repositories.js";
import { getTenantScope, requireRoles } from "../lib/access-control.js";
import { envelope } from "../lib/http.js";
import { invoiceInput, invoicePatchInput, paymentInput } from "../schemas.js";

export const financeRoutes: FastifyPluginAsync = async (app) => {
  app.get("/finance/invoices", async (request) => envelope(await listInvoices(getTenantScope(request))));
  app.get("/finance/payments", async (request) => envelope(await listPayments(getTenantScope(request))));

  app.get("/finance/invoices/:invoiceId", async (request, reply) => {
    const { invoiceId } = request.params as { invoiceId: string };
    const invoice = await getInvoice(getTenantScope(request), invoiceId);
    if (!invoice) {
      return reply.code(404).send({ error: "Invoice not found" });
    }

    return envelope(invoice);
  });

  app.post("/finance/invoices", async (request, reply) => {
    if (!requireRoles(request, reply, ["owner", "manager"])) return;

    const parsed = invoiceInput.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid invoice payload", issues: parsed.error.flatten() });
    }

    const scope = getTenantScope(request);
    if (!(await customerExists(scope, parsed.data.customerId))) {
      return reply.code(422).send({ error: "Customer does not exist" });
    }

    const invoice = await createInvoice(scope, parsed.data);

    return reply.code(201).send(envelope(invoice));
  });

  app.patch("/finance/invoices/:invoiceId", async (request, reply) => {
    if (!requireRoles(request, reply, ["owner", "manager"])) return;

    const { invoiceId } = request.params as { invoiceId: string };
    const parsed = invoicePatchInput.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid invoice payload", issues: parsed.error.flatten() });
    }

    const scope = getTenantScope(request);
    if (parsed.data.customerId && !(await customerExists(scope, parsed.data.customerId))) {
      return reply.code(422).send({ error: "Customer does not exist" });
    }

    const invoice = await updateInvoice(scope, invoiceId, parsed.data);
    if (!invoice) {
      return reply.code(404).send({ error: "Invoice not found" });
    }

    return envelope(invoice);
  });

  app.post("/finance/invoices/:invoiceId/payments", async (request, reply) => {
    if (!requireRoles(request, reply, ["owner", "manager"])) return;

    const { invoiceId } = request.params as { invoiceId: string };
    const parsed = paymentInput.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid payment payload", issues: parsed.error.flatten() });
    }

    let payment;
    try {
      payment = await createInvoicePayment(getTenantScope(request), invoiceId, parsed.data);
    } catch (error) {
      if (error instanceof PaymentValidationError) {
        return reply.code(422).send({ error: error.message });
      }
      throw error;
    }
    if (!payment) {
      return reply.code(404).send({ error: "Invoice not found" });
    }

    return reply.code(201).send(envelope(payment));
  });
};
