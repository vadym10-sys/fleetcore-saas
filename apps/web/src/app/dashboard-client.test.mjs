import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const source = await readFile(new URL("./dashboard-client.tsx", import.meta.url), "utf8");
const css = await readFile(new URL("./globals.css", import.meta.url), "utf8");
const rentalWorkbench = await readFile(new URL("../features/rentals/rental-workbench.tsx", import.meta.url), "utf8");

test("dashboard client keeps production account and document flows wired", () => {
  for (const marker of [
    "/auth/refresh",
    "/auth/logout",
    "/auth/demo",
    "/auth/request-password-reset",
    "/auth/request-email-verification",
    "Document center",
    "Document Inbox",
    "document-inbox",
    "FileObjectRow",
    "FilePreviewLink",
    "requestContractUpload",
    "requestSignatureUpload",
    "requestVehicleFolderUpload",
    "requestCustomerFolderUpload",
    "/operations/rental-contract-events",
    "contractEventLabel",
    "RentalWorkbench",
    "rental-workbench",
    "FleetCore Command",
    "GlobalSearchResult",
    "globalSearchResults",
    "global-search-results",
    "search-result-row",
    "openSearchResult",
    "/ai/search",
    "AiSearchResponse",
    "runAiSearch",
    "startVoiceSearch",
    "search-ai-button",
    "search-voice-button",
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
    "openProfileDialog",
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
    "Calendly резервации",
    "calendlyReservationUrl",
    "primary-calendly-panel",
    "Company branding",
    "/operations/rental-checklists",
    "createRentalChecklist",
    "/flow",
    "contractPdfUrl",
    "RentalDetailPanel",
    "VehicleHero",
    "VehicleGridCard",
    "OperationDialog",
    "VehicleForm",
    "Финальный расчёт",
    "finalizeRentalFlow",
    "processFlowAction",
    "openRentalContractPdf",
    "auth-toolbar",
    "auth-demo-link",
    "auth-secondary-actions",
    "auth-preview-shell",
    "initialMode",
    "MobileDrawer",
    "mobile-drawer",
    "mobile-menu-button",
    "openVehicleCreate",
    "openCustomerCreate",
    "assignVehicleToNewCustomer",
    "customer-assign-vehicle",
    "ClientProfilePanel",
    "client-profile-panel",
    "Client CRM",
    "Добавить авто клиенту",
    "openRentalContractPdfForRental",
    "OnboardingWizard",
    "fleetcore-onboarding-open",
    "DocumentVault",
    "document-vault",
    "document-center-tabs",
    "document-status-board",
    "rental-folder-card",
    "Папки аренды",
    "TodayOperationsDashboard",
    "DashboardLoadingState",
    "dashboard-loading-state",
    "dashboard-map-overview",
    "Карта автопарка",
    "DashboardFolders",
    "dashboard-folder-board",
    "fleetcore-dashboard-folders",
    "Добавить папку",
    "today-operations-board",
    "SimplifiedCommandCenter",
    "Другие действия",
    "Рабочий центр автопарка",
    "RentalDetailPanel",
    "rental-detail-panel",
    "rental-step-master",
    "rental-side-focus",
    "RentalWorkbench",
    "rental-detail-timeline",
    "rental-health-strip",
    "Следующее лучшее действие",
    "client-priority-card",
    "rental-flow-plus",
    "rental-secondary-details",
    "Финальный расчёт",
    "document-workbench-grid",
    "calendar-collapse",
    "mapProvider",
    "apple-map-panel",
    "apple-map-canvas",
    "mobile-fab",
    "operation-auto-context",
    "Создать автомобиль автоматически",
    "Создать инвойс автоматически",
    "RentalScenarioWizard",
    "rental-scenario-wizard",
    "Новая аренда с нуля",
    "One-click rental assembly",
    "Собрать аренду",
    "saveAndPrepareSend",
    "Сохранить и подготовить отправку",
    "runRentalWizardStep",
    "ClientIntakeScreen",
    "client-intake-form",
    "client-intake-success",
    "Заявка на аренду автомобиля",
    "Паспорт или ID",
    "Мы восстановили черновик заявки",
    "ClientIntakeShareDialog",
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
    "isDemoNoiseVehicle",
    "visibleVehicles",
    "closeTransientSurfaces",
    "ensureBookableVehicle",
    "createNewRental",
  ]) {
    assert.match(source, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("rental workbench keeps rental operations extracted and actionable", () => {
  for (const marker of [
    "export function RentalWorkbench",
    "rental-workbench",
    "onCreatePickup",
    "onCreateReturn",
    "onOpenPdf",
    "onShare",
    "rental-workbench-checks",
    "WhatsApp",
    "Telegram",
  ]) {
    assert.match(rentalWorkbench, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
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

test("dashboard client keeps forms, uploads and mobile shell actionable", () => {
  const formTags = source.match(/<form\b[\s\S]*?>/g) ?? [];
  assert.ok(formTags.length >= 5, "expected auth, intake, operation, vehicle and customer forms");
  for (const tag of formTags) {
    assert.match(tag, /onSubmit=/, `form without submit handler: ${tag}`);
  }

  const fileInputMatches = [...source.matchAll(/type="file"/g)];
  assert.ok(fileInputMatches.length >= 10, "expected document/profile/vehicle upload inputs");
  for (const match of fileInputMatches) {
    const start = Math.max(0, match.index - 360);
    const end = Math.min(source.length, match.index + 180);
    const context = source.slice(start, end);
    assert.match(context, /onChange=/, `file input without nearby change handler: ${context}`);
  }

  for (const marker of [
    ".mobile-drawer-shell",
    ".mobile-drawer-shell.open",
    ".mobile-drawer-backdrop",
    ".mobile-drawer",
    ".mobile-drawer-nav button",
    ".mobile-fab",
    "@media (max-width: 760px)",
    "env(safe-area-inset-bottom)",
  ]) {
    assert.match(css, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  assert.match(source, /function ClientIntakeScreen/);
  assert.match(source, /data-testid="client-intake-form"/);
  assert.match(source, /fetch\(`\$\{API_URL\}\/operations\/client-intake\/public`/);
  assert.match(source, /window\.location\.search/);
  assert.match(source, /companyId && tenantId/);
});

test("command dropdown has visible compact actions", () => {
  for (const marker of [
    ".command-action-menu > div",
    "max-height: min(420px, calc(100vh - 220px))",
    ".command-action-menu > div .ghost-button",
    "color: var(--ink)",
    "text-align: left",
  ]) {
    assert.match(css, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});
