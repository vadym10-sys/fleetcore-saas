import type { FastifyPluginAsync } from "fastify";
import { createRental, getRental, hasRentalReferences, listRentals, returnRental, updateRental } from "../db/repositories.js";
import { getTenantScope, requireRoles } from "../lib/access-control.js";
import { envelope } from "../lib/http.js";
import { rentalInput, rentalPatchInput, rentalReturnInput } from "../schemas.js";

export const rentalRoutes: FastifyPluginAsync = async (app) => {
  app.get("/rentals", async (request) => envelope(await listRentals(getTenantScope(request))));

  app.get("/rentals/:rentalId", async (request, reply) => {
    const { rentalId } = request.params as { rentalId: string };
    const rental = await getRental(getTenantScope(request), rentalId);
    if (!rental) {
      return reply.code(404).send({ error: "Rental not found" });
    }

    return envelope(rental);
  });

  app.post("/rentals", async (request, reply) => {
    if (!requireRoles(request, reply, ["owner", "admin", "fleet_manager"])) return;

    const parsed = rentalInput.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid rental payload", issues: parsed.error.flatten() });
    }

    const scope = getTenantScope(request);
    if (!(await hasRentalReferences(scope, parsed.data.customerId, parsed.data.vehicleId))) {
      return reply.code(422).send({ error: "Customer or vehicle does not exist" });
    }

    const rental = await createRental(scope, parsed.data);

    return reply.code(201).send(envelope(rental));
  });

  app.patch("/rentals/:rentalId", async (request, reply) => {
    if (!requireRoles(request, reply, ["owner", "admin", "fleet_manager"])) return;

    const { rentalId } = request.params as { rentalId: string };
    const parsed = rentalPatchInput.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid rental payload", issues: parsed.error.flatten() });
    }

    const scope = getTenantScope(request);
    if (!(await hasRentalReferences(scope, parsed.data.customerId, parsed.data.vehicleId))) {
      return reply.code(422).send({ error: "Customer or vehicle does not exist" });
    }

    const rental = await updateRental(scope, rentalId, parsed.data);
    if (!rental) {
      return reply.code(404).send({ error: "Rental not found" });
    }

    return envelope(rental);
  });

  app.post("/rentals/:rentalId/return", async (request, reply) => {
    if (!requireRoles(request, reply, ["owner", "admin", "fleet_manager"])) return;

    const { rentalId } = request.params as { rentalId: string };
    const parsed = rentalReturnInput.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid return payload", issues: parsed.error.flatten() });
    }

    const rental = await returnRental(getTenantScope(request), rentalId, parsed.data);
    if (!rental) {
      return reply.code(404).send({ error: "Rental not found or cannot be returned" });
    }

    return envelope(rental);
  });
};
