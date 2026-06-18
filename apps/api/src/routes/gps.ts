import type { FastifyPluginAsync } from "fastify";
import { listGpsDevices, upsertGpsDevice } from "../db/repositories.js";
import { requireRoles } from "../lib/access-control.js";
import { envelope } from "../lib/http.js";
import { gpsDeviceInput } from "../schemas.js";

export const gpsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/gps/devices", async () => envelope(await listGpsDevices()));

  app.post("/gps/devices", async (request, reply) => {
    if (!requireRoles(request, reply, ["owner", "admin", "fleet_manager"])) return;

    const parsed = gpsDeviceInput.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid GPS payload", issues: parsed.error.flatten() });
    }

    const device = await upsertGpsDevice(parsed.data);
    if (!device) {
      return reply.code(422).send({ error: "Vehicle does not exist" });
    }

    return reply.code(201).send(envelope(device));
  });
};
