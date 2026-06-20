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
    "fleet-command-actions",
    "command-create-booking",
    "command-create-vehicle",
    "command-create-customer",
    "command-upload-document",
    "command-create-expense",
    "command-create-service",
    "command-share-contract",
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
    "flow-progress-row",
    "flow-control-grid",
    "flow-playbook",
    "Депозит и финальный расчёт",
    "finalizeRentalFlow",
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
    "mapProvider",
    "apple-map-panel",
    "apple-map-canvas",
    "mobile-fab",
    "shareRentalContract",
    "ShareContractDialog",
    "DocumentPreviewDialog",
    "document-preview-modal",
    "share-channel-grid",
    "openTelegram",
    "openEmail",
    "sidebar-signout-button",
    "mobile-drawer-signout",
    "Файл не выбран",
    "Фото профиля не выбрано",
    "Нет активного Rental Flow",
    "Rental Flow уже завершен",
    "Сессия не найдена",
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
  assert.doesNotMatch(source, /openExternalMap|maps\.apple\.com|google\.com\/maps\/search/);
});
