import { buildServer } from "./app.js";
import { alertBackgroundJobFailure, reportMonitoringEvent } from "./lib/monitoring.js";

const port = Number(process.env.API_PORT ?? 4000);
const host = process.env.API_HOST ?? "0.0.0.0";

process.on("unhandledRejection", (reason) => {
  void alertBackgroundJobFailure({
    context: { processEvent: "unhandledRejection" },
    error: reason,
    message: "Unhandled promise rejection",
  }).finally(() => {
    console.error(reason);
    process.exit(1);
  });
});

process.on("uncaughtException", (error) => {
  void alertBackgroundJobFailure({
    context: { processEvent: "uncaughtException" },
    error,
    message: "Uncaught exception",
  }).finally(() => {
    console.error(error);
    process.exit(1);
  });
});

buildServer()
  .then((app) => app.listen({ port, host }))
  .catch((error) => {
    void reportMonitoringEvent({
      context: { host, port },
      error,
      message: "FleetCore API startup failed",
      severity: "critical",
      source: "startup",
    }).finally(() => {
      console.error(error);
      process.exit(1);
    });
  });
