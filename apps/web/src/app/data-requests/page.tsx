import DataRequestForm from "./request-form";
import { LegalPage } from "../legal-content";

export default function DataRequestsPage() {
  return (
    <LegalPage eyebrow="GDPR requests" title="Delete account / export data request">
      <p>Workspace owners can request a data export or deletion review. FleetCore records the request, keeps an audit trail and lets the company review legal retention duties before data is deleted.</p>
      <DataRequestForm />
    </LegalPage>
  );
}
