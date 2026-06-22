import type { ProductionIntegrationState, ProductionIntegrationStatus, SystemStatus } from "@fleetcore/shared";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ReadinessRow = {
  key: keyof SystemStatus["integrations"];
  value: ProductionIntegrationStatus;
};

const stateLabel: Record<ProductionIntegrationState, string> = {
  connected: "Connected",
  missing: "Missing",
  test_mode: "Test mode",
};

async function getStatus() {
  try {
    const response = await fetch(`${API_URL}/status`, { cache: "no-store" });
    if (!response.ok) {
      return { error: `API status returned ${response.status}` };
    }
    return { status: (await response.json()).data as SystemStatus };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Status API unavailable" };
  }
}

function stateClass(state: ProductionIntegrationState) {
  if (state === "connected") return "status-pill connected";
  if (state === "test_mode") return "status-pill test";
  return "status-pill missing";
}

function readinessSummary(rows: ReadinessRow[]) {
  const commercialRows = rows.filter((row) => row.value.requiredForCommercialLaunch);
  const connected = commercialRows.filter((row) => row.value.state === "connected").length;
  const testMode = commercialRows.filter((row) => row.value.state === "test_mode").length;
  const missing = commercialRows.filter((row) => row.value.state === "missing").length;
  return { connected, missing, testMode, total: commercialRows.length };
}

export default async function ProductionStatusPage() {
  const result = await getStatus();

  if (result.error || !result.status) {
    return (
      <main className="status-page">
        <section className="status-hero">
          <span>FleetCore Production Readiness</span>
          <h1>Status unavailable</h1>
          <p>{result.error ?? "FleetCore could not load the production readiness status."}</p>
          <a className="status-link" href="/">Back to pilot app</a>
        </section>
      </main>
    );
  }

  const status = result.status;
  const rows = Object.entries(status.integrations).map(([key, value]) => ({
    key: key as keyof SystemStatus["integrations"],
    value,
  }));
  const summary = readinessSummary(rows);
  const launchReady = summary.missing === 0 && summary.testMode === 0 && status.ok;

  return (
    <main className="status-page">
      <section className="status-hero">
        <span>FleetCore Production Readiness</span>
        <h1>{launchReady ? "Commercial launch ready" : "Pilot mode active"}</h1>
        <p>
          FleetCore pilot mode stays available. This page only shows which production integrations are connected,
          missing or running in test mode.
        </p>
        <div className="status-actions">
          <a className="status-link primary" href="/">Open SaaS</a>
          <a className="status-link" href={`${API_URL}/status`}>Raw API status</a>
        </div>
      </section>

      <section className="status-summary-grid">
        <article>
          <span>Commercial integrations</span>
          <strong>{summary.connected}/{summary.total}</strong>
          <small>connected for launch</small>
        </article>
        <article>
          <span>Missing</span>
          <strong>{summary.missing}</strong>
          <small>must be configured</small>
        </article>
        <article>
          <span>Test mode</span>
          <strong>{summary.testMode}</strong>
          <small>not live credentials</small>
        </article>
        <article>
          <span>Database</span>
          <strong>{status.checks.database}</strong>
          <small>migrations: {status.checks.migrations}</small>
        </article>
      </section>

      <section className="status-table-panel">
        <div className="status-table-title">
          <div>
            <span>Production checklist</span>
            <h2>Integrations</h2>
          </div>
          <p>Required integrations must be connected before selling FleetCore as a fully automated SaaS.</p>
        </div>

        <div className="status-table">
          {rows.map((row) => (
            <article className="status-row" key={row.key}>
              <div>
                <strong>{row.value.label}</strong>
                <span>{row.value.description}</span>
              </div>
              <span className={stateClass(row.value.state)}>{stateLabel[row.value.state]}</span>
              <small>{row.value.requiredForCommercialLaunch ? "Required" : "Optional"}</small>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
