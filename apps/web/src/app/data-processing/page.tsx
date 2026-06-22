import { LegalPage } from "../legal-content";

export default function DataProcessingPage() {
  return (
    <LegalPage eyebrow="Processor notice" title="Data Processing Notice">
      <h2>Roles</h2>
      <p>For company workspace data, the fleet company is usually the controller and FleetCore acts as a processor for hosting, storage, notification delivery and operational processing.</p>
      <h2>Subprocessors</h2>
      <p>Production deployments may use infrastructure, email, payment, monitoring, object storage, WhatsApp and Telegram providers. Their status is visible in FleetCore production readiness.</p>
      <h2>Security basics</h2>
      <p>FleetCore applies tenant isolation, role-based access, audit logs, private file storage controls and environment validation for production credentials.</p>
      <h2>International use</h2>
      <p>Workspace owners must verify local legal requirements for each country where vehicles, employees or customers operate.</p>
    </LegalPage>
  );
}
