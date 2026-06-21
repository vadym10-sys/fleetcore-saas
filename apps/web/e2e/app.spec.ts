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
  await createSheet.locator(".create-action-panel").getByRole("button", { name: "Закрыть" }).click();

  const commandMenu = page.locator(".command-action-menu").first();
  await commandMenu.getByText("Другие действия").click();
  await expect(commandMenu).toHaveAttribute("open", "");
  await expect(commandMenu.getByRole("button", { name: "Мастер аренды" })).toBeVisible();
  await expect(commandMenu.getByRole("button", { name: "Новая аренда" })).toBeVisible();
  await expect(commandMenu.getByRole("button", { name: "Автомобиль" })).toBeVisible();

  const firstMenuButtonColor = await commandMenu.getByRole("button", { name: "Мастер аренды" }).evaluate((node) => getComputedStyle(node).color);
  expect(firstMenuButtonColor).not.toBe("rgb(255, 255, 255)");
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

test("desktop user can manage professional list controls", async ({ page, isMobile }) => {
  test.skip(isMobile, "list controls are covered in desktop workflow first");

  await page.goto("/");
  await page.getByRole("button", demoButton).click();
  await expect(page.getByRole("heading", { level: 1, name: "Главная" })).toBeVisible();

  const sidebarNav = page.getByRole("navigation").first();
  await sidebarNav.getByRole("button", { name: /Авто/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Авто" })).toBeVisible();

  const fleetControls = page.locator(".list-control-bar").filter({ hasText: "Fleet list" }).first();
  await expect(fleetControls).toBeVisible();
  await fleetControls.getByRole("combobox").selectOption("roi");
  await fleetControls.getByRole("button", { name: "Выбрать видимые" }).click();
  await expect(fleetControls).toContainText("выбрано");

  const fleetDownload = page.waitForEvent("download");
  await fleetControls.getByRole("button", { name: "Экспорт выбранных" }).click();
  await fleetDownload;
  await expect(page.getByRole("status").getByText(/автомобилей экспортировано в CSV/)).toBeVisible();

  await sidebarNav.getByRole("button", { name: /Клиенты/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Клиенты" })).toBeVisible();

  const crmControls = page.locator(".list-control-bar").filter({ hasText: "CRM list" }).first();
  await expect(crmControls).toBeVisible();
  await crmControls.getByRole("combobox").selectOption("rentals");
  await crmControls.getByRole("button", { name: "Выбрать видимые" }).click();
  await expect(crmControls).toContainText("выбрано");

  const crmDownload = page.waitForEvent("download");
  await crmControls.getByRole("button", { name: "Экспорт выбранных" }).click();
  await crmDownload;
  await expect(page.getByRole("status").getByText(/клиентов экспортировано в CSV/)).toBeVisible();
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
