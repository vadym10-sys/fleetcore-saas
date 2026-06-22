import { LegalPage } from "../legal-content";

export default function CookiesPage() {
  return (
    <LegalPage eyebrow="Browser storage" title="Cookie Policy">
      <h2>Essential storage</h2>
      <p>FleetCore uses essential browser storage for login sessions, language preference, onboarding state and operational UI state. These are needed for the SaaS to work.</p>
      <h2>Analytics and marketing</h2>
      <p>Analytics or marketing cookies should only be enabled after the workspace has the correct production provider and consent controls configured.</p>
      <h2>Managing cookies</h2>
      <p>Users can clear browser storage from their browser settings. Doing so may log the user out or reset local UI preferences.</p>
    </LegalPage>
  );
}
