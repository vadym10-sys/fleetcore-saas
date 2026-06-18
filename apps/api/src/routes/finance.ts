import type { FastifyPluginAsync } from "fastify";
import { createInvoice, createInvoicePayment, customerExists, getInvoice, listInvoices, listPayments, updateInvoice } from "../db/repositories.js";
import { requireRoles } from "../lib/access-control.js";
import { envelope } from "../lib/http.js";
import { invoiceInput, invoicePatchInput, paymentInput } from "../schemas.js";

export const financeRoutes: FastifyPluginAsync = async (app) => {
  app.get("/finance/invoices", async () => envelope(await listInvoices()));
  app.get("/finance/payments", async () => envelope(await listPayments()));

  app.get("/finance/invoices/:invoiceId", async (request, reply) => {
    const { invoiceId } = request.params as { invoiceId: string };
    const invoice = await getInvoice(invoiceId);
    if (!invoice) {
      return reply.code(404).send({ error: "Invoice not found" });
    }

    return envelope(invoice);
  });

  app.post("/finance/invoices", async (request, reply) => {
    if (!requireRoles(request, reply, ["owner", "admin", "finance_manager"])) return;

    const parsed = invoiceInput.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid invoice payload", issues: parsed.error.flatten() });
    }

    if (!(await customerExists(parsed.data.customerId))) {
      return reply.code(422).send({ error: "Customer does not exist" });
    }

    const invoice = await createInvoice(parsed.data);

    return reply.code(201).send(envelope(invoice));
  });

  app.patch("/finance/invoices/:invoiceId", async (request, reply) => {
    if (!requireRoles(request, reply, ["owner", "admin", "finance_manager"])) return;

    const { invoiceId } = request.params as { invoiceId: string };
    const parsed = invoicePatchInput.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid invoice payload", issues: parsed.error.flatten() });
    }

    if (parsed.data.customerId && !(await customerExists(parsed.data.customerId))) {
      return reply.code(422).send({ error: "Customer does not exist" });
    }

    const invoice = await updateInvoice(invoiceId, parsed.data);
    if (!invoice) {
      return reply.code(404).send({ error: "Invoice not found" });
    }

    return envelope(invoice);
  });

  app.post("/finance/invoices/:invoiceId/payments", async (request, reply) => {
    if (!requireRoles(request, reply, ["owner", "admin", "finance_manager"])) return;

    const { invoiceId } = request.params as { invoiceId: string };
    const parsed = paymentInput.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid payment payload", issues: parsed.error.flatten() });
    }

    const payment = await createInvoicePayment(invoiceId, parsed.data);
    if (!payment) {
      return reply.code(404).send({ error: "Invoice not found" });
    }

    return reply.code(201).send(envelope(payment));
  });
};
