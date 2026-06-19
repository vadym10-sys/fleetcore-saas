import type { FastifyPluginAsync } from "fastify";
import { createVehicle, deleteVehicle, getVehicle, listVehicles, updateVehicle } from "../db/repositories.js";
import { getTenantScope, requireRoles } from "../lib/access-control.js";
import { envelope } from "../lib/http.js";
import { vehicleInput, vehiclePatchInput } from "../schemas.js";

export const fleetRoutes: FastifyPluginAsync = async (app) => {
  app.get("/fleet/vehicles", async (request) => envelope(await listVehicles(getTenantScope(request))));

  app.get("/fleet/vehicles/:vehicleId", async (request, reply) => {
    const { vehicleId } = request.params as { vehicleId: string };
    const vehicle = await getVehicle(getTenantScope(request), vehicleId);
    if (!vehicle) {
      return reply.code(404).send({ error: "Vehicle not found" });
    }

    return envelope(vehicle);
  });

  app.post("/fleet/vehicles", async (request, reply) => {
    if (!requireRoles(request, reply, ["owner", "admin", "fleet_manager"])) return;

    const parsed = vehicleInput.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid vehicle payload", issues: parsed.error.flatten() });
    }

    const vehicle = await createVehicle(getTenantScope(request), parsed.data);

    return reply.code(201).send(envelope(vehicle));
  });

  app.patch("/fleet/vehicles/:vehicleId", async (request, reply) => {
    if (!requireRoles(request, reply, ["owner", "admin", "fleet_manager"])) return;

    const { vehicleId } = request.params as { vehicleId: string };
    const parsed = vehiclePatchInput.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid vehicle payload", issues: parsed.error.flatten() });
    }

    const vehicle = await updateVehicle(getTenantScope(request), vehicleId, parsed.data);
    if (!vehicle) {
      return reply.code(404).send({ error: "Vehicle not found" });
    }

    return envelope(vehicle);
  });

  app.delete("/fleet/vehicles/:vehicleId", async (request, reply) => {
    if (!requireRoles(request, reply, ["owner", "admin", "fleet_manager"])) return;

    const { vehicleId } = request.params as { vehicleId: string };
    let result: Awaited<ReturnType<typeof deleteVehicle>>;
    try {
      result = await deleteVehicle(getTenantScope(request), vehicleId);
    } catch (error) {
      if ((error as { code?: string }).code === "23503") {
        return reply.code(409).send({ error: "Vehicle has rental history and cannot be deleted" });
      }
      throw error;
    }
    if (result.reason === "vehicle_has_rentals") {
      return reply.code(409).send({ error: "Vehicle has rental history and cannot be deleted" });
    }
    if (!result.deleted) {
      return reply.code(404).send({ error: "Vehicle not found" });
    }

    return envelope({ id: vehicleId, deleted: true });
  });
};
