import { LegalPage } from "../legal-content";

export default function PrivacyPage() {
  return (
    <LegalPage eyebrow="GDPR basics" title="Privacy Policy">
      <h2>What FleetCore collects</h2>
      <p>FleetCore processes account details, company details, fleet records, rental records, customer records, uploaded documents, operational logs and support communications needed to run a B2B fleet rental workspace.</p>
      <h2>Why data is processed</h2>
      <p>Data is used to authenticate users, isolate company workspaces, operate rentals, store documents, send transactional notifications, keep audit logs and meet legal obligations.</p>
      <h2>Retention</h2>
      <p>Business records are retained for the period required by contract, accounting, tax, insurance and fraud-prevention obligations. Workspace owners can request export or deletion review from the Data Requests page.</p>
      <h2>Contact</h2>
      <p>For privacy questions, contact the FleetCore workspace owner or the FleetCore support address configured for your account.</p>
    </LegalPage>
  );
}
