import { expect, test } from "@playwright/test";

const demoButton = { exact: true, name: "Демо" };
const desktopSections = ["Главная", "GPS", "Авто", "Клиенты", "Аренды", "Финансы", "Документы", "Настройки"];

test("desktop user can enter demo SaaS and use the command surface", async ({ page, isMobile }) => {
  test.skip(isMobile, "desktop command surface is covered by desktop project");

  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Вход в аккаунт компании" })).toBeVisible();
  await page.getByRole("button", demoButton).click();

  await expect(page.getByRole("heading", { name: "Главная" })).toBeVisible();
  const globalSearch = page.getByRole("textbox", { name: "Номер, VIN, клиент, телефон" });
  await expect(globalSearch).toBeVisible();
  await expect(page.getByRole("button", { name: /Создать/ })).toBeVisible();
  await expect(page.locator(".today-operations-board")).toBeVisible();

  await globalSearch.fill("BMW");
  await expect(page.locator(".global-search-results")).toBeVisible();
  await page.getByRole("button", { name: /Создать/ }).click();
  const createSheet = page.locator(".create-action-sheet");
  await expect(createSheet).toBeVisible();
  await expect(createSheet.getByRole("button", { name: /Новая аренда/ })).toBeVisible();
});

test("desktop user can open every main SaaS section", async ({ page, isMobile }) => {
  test.skip(isMobile, "desktop section navigation is covered by desktop project");

  await page.goto("/");
  await page.getByRole("button", demoButton).click();
  await expect(page.getByRole("heading", { level: 1, name: "Главная" })).toBeVisible();

  const sidebarNav = page.getByRole("navigation").first();
  for (const section of desktopSections) {
    await sidebarNav.getByRole("button", { name: new RegExp(section) }).click();
    await expect(page.getByRole("heading", { level: 1, name: section })).toBeVisible();
    await expect(page.locator(".modal-backdrop")).toHaveCount(0);
  }
});

test("mobile user can enter demo SaaS and navigate through drawer", async ({ page, isMobile }) => {
  test.skip(!isMobile, "mobile drawer flow is only meaningful on mobile project");

  await page.goto("/");
  await page.getByRole("button", demoButton).click();

  await expect(page.getByRole("heading", { name: "Главная" })).toBeVisible();
  await expect(page.locator(".mobile-menu-button")).toBeVisible();
  await expect(page.getByRole("button", { name: /Создать/ })).toBeVisible();

  await page.locator(".mobile-menu-button").click();
  await expect(page.locator(".mobile-drawer-shell.open")).toBeVisible();
  await expect(page.locator(".mobile-drawer-profile")).toBeVisible();
  await expect(page.locator(".mobile-drawer-signout")).toBeVisible();

  await page.locator(".mobile-drawer-more summary").click();
  await page.locator(".mobile-drawer-nav").getByRole("button", { name: /GPS/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "GPS" })).toBeVisible();
});
