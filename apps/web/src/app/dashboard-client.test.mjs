import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const source = await readFile(new URL("./dashboard-client.tsx", import.meta.url), "utf8");

test("dashboard client keeps production account and document flows wired", () => {
  for (const marker of [
    "/auth/refresh",
    "/auth/logout",
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
    "/auth/team",
    "/auth/me",
    "VehicleVisual",
    "vehicleVisualVariant",
    "saveVehiclePhoto",
    "removeVehiclePhoto",
    "photoUrl",
    "saveCompanyBranding",
    "saveCompanyLogo",
    "BookingCalendar",
    "Company branding",
  ]) {
    assert.match(source, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});
