import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const source = await readFile(new URL("./dashboard-client.tsx", import.meta.url), "utf8");

test("dashboard client keeps production account and document flows wired", () => {
  for (const marker of [
    "/auth/refresh",
    "/auth/logout",
    "/auth/demo",
    "/auth/request-password-reset",
    "/auth/request-email-verification",
    "Document center",
    "FileObjectRow",
    "FilePreviewLink",
    "requestContractUpload",
    "requestSignatureUpload",
    "requestVehicleFolderUpload",
    "requestCustomerFolderUpload",
    "/operations/rental-contract-events",
    "contractEventLabel",
    "contract-timeline",
    "FleetCore Command",
    "command-actions",
    "OwnerProfileDialog",
    "fleetcore-profile-open",
    "/auth/team",
    "/auth/me",
    "saveProfilePhoto",
    "owner-photo-hint",
    "VehicleVisual",
    "vehicleVisualVariant",
    "saveVehiclePhoto",
    "removeVehiclePhoto",
    "photoUrl",
    "saveCompanyBranding",
    "saveCompanyLogo",
    "BookingCalendar",
    "Company branding",
    "/operations/rental-checklists",
    "createRentalChecklist",
    "checklist-cell",
    "/flow",
    "contractPdfUrl",
    "RentalFlowPanel",
    "rental-flow-panel",
    "processFlowAction",
    "openRentalContractPdf",
    "auth-choice-grid",
    "initialMode",
    "MobileDrawer",
    "mobile-drawer",
    "mobile-menu-button",
    "openVehicleCreate",
    "openCustomerCreate",
    "assignVehicleToNewCustomer",
    "customer-assign-vehicle",
    "openRentalContractPdfForRental",
    "OnboardingWizard",
    "fleetcore-onboarding-open",
    "DocumentVault",
    "document-vault",
    "openExternalMap",
    "mobile-fab",
    "shareRentalContract",
    "openTelegram",
    "openEmail",
    "sidebar-signout-button",
    "mobile-drawer-signout",
  ]) {
    assert.match(source, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("dashboard client does not ship inert buttons", () => {
  const buttonTags = source.match(/<button\b[\s\S]*?>/g) ?? [];

  assert.ok(buttonTags.length > 20, "expected dashboard buttons to be present");

  for (const tag of buttonTags) {
    const hasAction = /onClick=/.test(tag) || /type="submit"/.test(tag);
    assert.ok(hasAction, `button without click handler or submit type: ${tag}`);
  }

  assert.doesNotMatch(source, /MobileAppNav|mobile-app-nav|mobile-account-strip/);
});
