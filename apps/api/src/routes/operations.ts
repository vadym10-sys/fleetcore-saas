import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import {
  createCustomer,
  createCustomerDocument,
  createExpense,
  createFileObject,
  createRentalContract,
  createRentalContractEvent,
  createServiceRecord,
  findCustomerByEmail,
  getPublicRentalContract,
  listCustomerDocuments,
  listExpenses,
  listRentalChecklists,
  listRentalContractEvents,
  listRentalContracts,
  listServiceRecords,
  signPublicRentalContract,
  updateCustomer,
  upsertRentalChecklist,
  writeAuditLog,
} from "../db/repositories.js";
import { getRequestUser, getTenantScope, requireRoles } from "../lib/access-control.js";
import { envelope } from "../lib/http.js";
import { customerDocumentInput, expenseInput, publicClientIntakeInput, publicContractSignatureInput, rentalChecklistInput, rentalContractInput, serviceRecordInput } from "../schemas.js";

const maxPublicIntakeFileBytes = Number(process.env.MAX_UPLOAD_BYTES ?? 8 * 1024 * 1024);

function htmlEscape(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#039;");
}

function publicBaseUrl(request: FastifyRequest) {
  if (process.env.API_PUBLIC_URL) return process.env.API_PUBLIC_URL;

  const forwardedProto = request.headers["x-forwarded-proto"];
  const protocol = Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto;
  return `${protocol ?? request.protocol}://${request.headers.host}`;
}

function publicFileUrl(request: FastifyRequest, fileId: string, originalName: string) {
  return `${publicBaseUrl(request)}/uploads/${fileId}/${encodeURIComponent(originalName)}`;
}

function contractHtml(contract: { documentUrl: string; id: string; rentalId: string; signedAt?: string; status: string }, token: string) {
  const signed = contract.status === "signed";
  return `<!doctype html>
<html lang="en">
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>FleetCore rental contract</title>
<body style="margin:0;background:#f3f5f8;color:#111827;font-family:Inter,Arial,sans-serif">
  <main style="max-width:760px;margin:0 auto;padding:24px">
    <section style="background:#111827;color:white;border-radius:12px;padding:24px;margin-bottom:16px">
      <div style="font-weight:900;font-size:14px;color:#f2c879">FleetCore rental contract</div>
      <h1 style="margin:10px 0 6px;font-size:30px">Contract ${htmlEscape(contract.id)}</h1>
      <p style="margin:0;color:#cbd5e1">Rental ${htmlEscape(contract.rentalId)} · status ${htmlEscape(contract.status)}</p>
    </section>
    <section style="background:white;border:1px solid #dde3ec;border-radius:12px;padding:20px;margin-bottom:16px">
      <p style="margin-top:0">Open the rental document, review the terms, then sign below.</p>
      <a href="${htmlEscape(contract.documentUrl)}" target="_blank" rel="noreferrer" style="display:inline-block;background:#2346d8;color:white;text-decoration:none;font-weight:800;border-radius:8px;padding:12px 16px">Open contract document</a>
    </section>
    <section style="background:white;border:1px solid #dde3ec;border-radius:12px;padding:20px">
      ${signed ? `<h2 style="margin-top:0;color:#0f9f6e">Signed</h2><p>Signed at ${htmlEscape(contract.signedAt ?? "")}</p>` : `
      <h2 style="margin-top:0">Electronic signature</h2>
      <form method="post" action="/operations/rental-contracts/public/${encodeURIComponent(contract.id)}/sign?token=${encodeURIComponent(token)}">
        <label style="display:block;font-weight:800;margin-bottom:8px">Full name</label>
        <input name="signerName" required minlength="2" style="box-sizing:border-box;width:100%;height:46px;border:1px solid #dde3ec;border-radius:8px;padding:0 12px;font:inherit;margin-bottom:14px" />
        <button style="height:46px;border:0;border-radius:8px;background:#0f9f6e;color:white;font-weight:900;padding:0 18px" type="submit">Sign contract</button>
      </form>`}
    </section>
  </main>
</body>
</html>`;
}

export const operationRoutes: FastifyPluginAsync = async (app) => {
  app.get("/operations/expenses", async (request) => envelope(await listExpenses(getTenantScope(request))));

  app.post("/operations/expenses", async (request, reply) => {
    if (!requireRoles(request, reply, ["owner", "manager"])) return;

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
    if (!requireRoles(request, reply, ["owner", "manager"])) return;

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
    if (!requireRoles(request, reply, ["owner", "manager"])) return;

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

  app.get("/operations/rental-contract-events", async (request) => {
    const { contractId } = request.query as { contractId?: string };
    return envelope(await listRentalContractEvents(getTenantScope(request), contractId));
  });

  app.get("/operations/rental-checklists", async (request) => {
    const { rentalId } = request.query as { rentalId?: string };
    return envelope(await listRentalChecklists(getTenantScope(request), rentalId));
  });

  app.post("/operations/rental-checklists", async (request, reply) => {
    if (!requireRoles(request, reply, ["owner", "manager"])) return;

    const parsed = rentalChecklistInput.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid rental checklist payload", issues: parsed.error.flatten() });
    }

    const scope = getTenantScope(request);
    const checklist = await upsertRentalChecklist(scope, parsed.data);
    if (!checklist) {
      return reply.code(422).send({ error: "Rental does not exist" });
    }

    const user = getRequestUser(request);
    await writeAuditLog({
      action: "rental.checklist.upserted",
      actorEmail: user?.email,
      companyId: scope.companyId,
      entityId: checklist.id,
      entityType: "rental_checklist",
      metadata: { phase: checklist.phase, rentalId: checklist.rentalId, vehicleId: checklist.vehicleId },
      tenantId: scope.tenantId,
      userId: user?.id,
    });
    return reply.code(201).send(envelope(checklist));
  });

  app.get("/operations/rental-contracts/public/:contractId", async (request, reply) => {
    const { contractId } = request.params as { contractId: string };
    const { token } = request.query as { token?: string };
    if (!token) return reply.code(401).send({ error: "Missing contract token" });

    const contract = await getPublicRentalContract(contractId, token);
    if (!contract) return reply.code(404).send({ error: "Contract not found" });

    await writeAuditLog({
      action: "rental.contract.viewed",
      companyId: contract.companyId,
      entityId: contract.id,
      entityType: "rental_contract",
      metadata: { rentalId: contract.rentalId, status: contract.status },
      tenantId: contract.tenantId,
    });
    await createRentalContractEvent({
      actorLabel: "Customer",
      channel: "public_link",
      companyId: contract.companyId,
      contractId: contract.id,
      customerId: contract.customerId,
      eventType: "viewed",
      metadata: { status: contract.status },
      rentalId: contract.rentalId,
      tenantId: contract.tenantId,
    });
    reply.header("content-type", "text/html; charset=utf-8");
    return reply.send(contractHtml(contract, token));
  });

  app.post("/operations/rental-contracts/public/:contractId/sign", async (request, reply) => {
    const { contractId } = request.params as { contractId: string };
    const { token } = request.query as { token?: string };
    if (!token) return reply.code(401).send({ error: "Missing contract token" });

    const body = typeof request.body === "string"
      ? Object.fromEntries(new URLSearchParams(request.body))
      : request.body;
    const parsed = publicContractSignatureInput.safeParse(body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid signature payload", issues: parsed.error.flatten() });
    }

    const signed = await signPublicRentalContract(contractId, token, parsed.data.signerName);
    if (!signed) return reply.code(404).send({ error: "Contract not found or already signed" });

    await writeAuditLog({
      action: "rental.contract.signed",
      companyId: signed.contract.companyId,
      entityId: signed.contract.id,
      entityType: "rental_contract",
      metadata: { rentalId: signed.contract.rentalId, signerName: signed.signerName },
      tenantId: signed.contract.tenantId,
    });
    await createRentalContractEvent({
      actorLabel: signed.signerName,
      channel: "public_link",
      companyId: signed.contract.companyId,
      contractId: signed.contract.id,
      customerId: signed.contract.customerId,
      eventType: "signed",
      metadata: { signerName: signed.signerName },
      rentalId: signed.contract.rentalId,
      tenantId: signed.contract.tenantId,
    });
    reply.header("content-type", "text/html; charset=utf-8");
    return reply.send(contractHtml(signed.contract, token));
  });

  app.post("/operations/client-intake/public", async (request, reply) => {
    const parsed = publicClientIntakeInput.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid client intake payload", issues: parsed.error.flatten() });
    }

    const scope = { companyId: parsed.data.companyId, tenantId: parsed.data.tenantId };
    const existingCustomer = await findCustomerByEmail(scope, parsed.data.customer.email);
    const customer = existingCustomer
      ? await updateCustomer(scope, existingCustomer.id, {
        displayName: parsed.data.customer.displayName,
        phone: parsed.data.customer.phone,
        riskLevel: existingCustomer.riskLevel,
        type: parsed.data.customer.type,
      }) ?? existingCustomer
      : await createCustomer(scope, {
        displayName: parsed.data.customer.displayName,
        email: parsed.data.customer.email,
        phone: parsed.data.customer.phone,
        riskLevel: "low",
        type: parsed.data.customer.type,
      });
    const documents = [];

    for (const intakeFile of parsed.data.files) {
      const data = Buffer.from(intakeFile.base64, "base64");
      if (!data.byteLength || data.byteLength > maxPublicIntakeFileBytes) {
        return reply.code(413).send({ error: `File must be between 1 byte and ${maxPublicIntakeFileBytes} bytes` });
      }

      const file = await createFileObject(scope, {
        base64: intakeFile.base64,
        mimeType: intakeFile.mimeType,
        originalName: intakeFile.originalName,
      }, (fileId, originalName) => publicFileUrl(request, fileId, originalName));
      const document = await createCustomerDocument(scope, {
        customerId: customer.id,
        fileUrl: file.publicUrl,
        title: intakeFile.title,
        type: intakeFile.documentType,
        verified: false,
      });
      if (document) documents.push(document);
    }

    await writeAuditLog({
      action: "client.intake.submitted",
      actorEmail: customer.email,
      companyId: scope.companyId,
      entityId: customer.id,
      entityType: "customer",
      ipAddress: request.ip,
      metadata: { documents: documents.length, note: parsed.data.note, rentalId: parsed.data.rentalId },
      tenantId: scope.tenantId,
      userAgent: request.headers["user-agent"]?.toString(),
    });

    return reply.code(201).send(envelope({ customer, documents }));
  });

  app.post("/operations/rental-contracts", async (request, reply) => {
    if (!requireRoles(request, reply, ["owner", "manager"])) return;

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
    await createRentalContractEvent({
      actorLabel: user?.email,
      channel: contract.sentVia,
      companyId: scope.companyId,
      contractId: contract.id,
      customerId: contract.customerId,
      eventType: contract.status === "draft" ? "created" : contract.status,
      metadata: { documentUrl: contract.documentUrl, rentalId: contract.rentalId, status: contract.status },
      rentalId: contract.rentalId,
      tenantId: scope.tenantId,
    });
    return reply.code(201).send(envelope(contract));
  });
};
