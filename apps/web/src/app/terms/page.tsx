import { LegalPage } from "../legal-content";

export default function TermsPage() {
  return (
    <LegalPage eyebrow="Commercial terms" title="Terms of Service">
      <h2>Service scope</h2>
      <p>FleetCore is a B2B SaaS workspace for fleet operations, rentals, CRM, documents, payments, GPS records and operational reporting.</p>
      <h2>Customer responsibilities</h2>
      <p>Workspace owners are responsible for user access, uploaded content, customer notices, rental legality, document accuracy and compliance with local transport, tax and privacy requirements.</p>
      <h2>Availability</h2>
      <p>The pilot version may use mock or test integrations until production credentials are connected. Production readiness is visible from the FleetCore status page.</p>
      <h2>Suspension</h2>
      <p>FleetCore may restrict access for abuse, unpaid subscription, security risk or unlawful use.</p>
    </LegalPage>
  );
}
