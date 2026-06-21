import { expect, test } from "@playwright/test";

const demoButton = { exact: true, name: "Демо" };
const desktopSections = ["Главная", "GPS", "Авто", "Календарь", "Аренды", "Финансы", "Документы", "Настройки"];

function actionName(label: RegExp | string) {
  if (label instanceof RegExp) return label;
  return new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:\\s|$)`);
}

test("desktop user can enter demo SaaS and use the command surface", async ({ page, isMobile }) => {
  test.skip(isMobile, "desktop command surface is covered by desktop project");

  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Вход в аккаунт компании" })).toBeVisible();
  await page.getByRole("button", demoButton).click();

  await expect(page.getByRole("heading", { name: "Главная" })).toBeVisible();
  const globalSearch = page.getByRole("textbox", { name: "Номер, VIN, клиент, телефон" });
  await expect(globalSearch).toBeVisible();
  await expect(page.getByRole("button", { exact: true, name: "+ Создать" })).toBeVisible();
  await expect(page.locator(".today-operations-board")).toBeVisible();
  await expect(page.locator("[data-testid='dashboard-map-overview']")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Карта автопарка" })).toBeVisible();
  await expect(page.locator("[data-testid='dashboard-folder-board']")).toBeVisible();
  await expect(page.getByText("Папка 1")).toBeVisible();
  page.once("dialog", async (dialog) => {
    await dialog.accept("Папка QA");
  });
  await page.locator(".dashboard-folder-add").click();
  await expect(page.getByText("Папка QA")).toBeVisible();

  await globalSearch.fill("BMW");
  await expect(page.locator(".global-search-results")).toBeVisible();
  await page.getByRole("button", { name: "AI поиск" }).click();
  await expect(page.locator(".global-search-results")).toContainText(/AI поиск|Результаты поиска/);
  await page.getByRole("button", { exact: true, name: "+ Создать" }).click();
  const createSheet = page.locator(".create-action-sheet");
  await expect(createSheet).toBeVisible();
  await expect(createSheet.getByRole("button", { name: /Создать аренду/ })).toBeVisible();
  await createSheet.locator(".create-action-panel").getByRole("button", { name: "Закрыть" }).click();

  const commandMenu = page.locator(".command-action-menu").first();
  await commandMenu.getByText("Другие действия").click();
  await expect(commandMenu).toHaveAttribute("open", "");
  await expect(commandMenu.getByRole("button", { name: "Создать аренду" })).toBeVisible();
  await expect(commandMenu.getByRole("button", { name: "Автомобиль" })).toBeVisible();

  const firstMenuButtonColor = await commandMenu.getByRole("button", { name: "Создать аренду" }).evaluate((node) => getComputedStyle(node).color);
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

  await sidebarNav.getByRole("button", { name: /Календарь/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Календарь" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Календарь резерваций" })).toBeVisible();
  await expect(page.locator(".calendly-panel")).toBeVisible();
});

test("desktop primary buttons open real workflows without blank surfaces", async ({ page, isMobile }) => {
  test.skip(isMobile, "desktop action coverage is handled in desktop project");

  await page.goto("/");
  await page.getByRole("button", demoButton).click();
  await expect(page.getByRole("heading", { level: 1, name: "Главная" })).toBeVisible();

  async function closeModalIfOpen() {
    const closeButtons = page.locator(".modal-backdrop").getByRole("button", { name: /×|Закрыть/ });
    if (await closeButtons.count()) {
      await closeButtons.first().click();
      await expect(page.locator(".modal-backdrop")).toHaveCount(0);
    }
  }

  async function openCreateAction(label: RegExp | string) {
    await page.getByRole("button", { exact: true, name: "+ Создать" }).click();
    const sheet = page.locator(".create-action-sheet");
    await expect(sheet).toBeVisible();
    await sheet.getByRole("button", { name: actionName(label) }).click();
  }

  await openCreateAction("Создать аренду");
  const workflow = page.locator(".rental-workflow");
  await expect(workflow).toBeVisible();
  await expect(workflow.locator(".rental-workflow-progress")).toContainText("Создать аренду");
  await expect(workflow.locator(".rental-workflow-progress")).toContainText("Закрыть аренду");
  await expect(workflow).toContainText("Детали карточки аренды");
  await workflow.getByRole("button", { exact: true, name: "Закрыть" }).click();

  await openCreateAction("Заявка клиента");
  await expect(page.locator(".share-modal")).toBeVisible();
  await expect(page.locator(".client-intake-link-box")).toContainText("/?clientIntake=1");
  await closeModalIfOpen();

  await openCreateAction("Автомобиль");
  await expect(page.locator(".live-form").filter({ hasText: "Добавить автомобиль" })).toBeVisible();

  await openCreateAction("Клиент");
  await expect(page.locator(".live-form").filter({ hasText: "Добавить клиента" })).toBeVisible();

  for (const action of [
    { button: "Документ", title: "Документ автомобиля" },
    { button: "Расход", title: "Добавить расход" },
    { button: "ТО", title: "Создать техобслуживание" },
  ]) {
    await openCreateAction(action.button);
    await expect(page.locator(".operation-modal")).toContainText(action.title);
    await closeModalIfOpen();
  }

  await openCreateAction("WhatsApp / Telegram");
  await expect(page.locator(".share-modal")).toContainText("Отправить договор клиенту");
  await closeModalIfOpen();

  const sidebarNav = page.getByRole("navigation").first();
  await sidebarNav.getByRole("button", { name: /GPS/ }).click();
  await page.getByRole("button", { name: "Подключить GPS к авто" }).click();
  await expect(page.locator(".operation-modal")).toContainText("Подключить GPS");
  await closeModalIfOpen();

  await sidebarNav.getByRole("button", { name: /Настройки/ }).click();
  await page.getByRole("button", { name: "Открыть мастер настройки" }).click();
  const onboarding = page.locator(".onboarding-modal");
  await expect(onboarding).toBeVisible();
  await onboarding.getByRole("button", { name: "×" }).click();
});

test("desktop rental workflow creates rental, enables sending and closes return", async ({ page, isMobile, request }) => {
  test.skip(isMobile, "full rental workflow is covered by desktop project");

  const apiBaseUrl = "http://127.0.0.1:4000";
  const demoSession = await request.post(`${apiBaseUrl}/auth/demo`);
  expect(demoSession.ok()).toBeTruthy();
  const { data: session } = await demoSession.json();
  const uniqueId = Date.now();
  const vehicleResponse = await request.post(`${apiBaseUrl}/fleet/vehicles`, {
    data: {
      dailyRate: 118,
      location: "QA Garage",
      make: "Audi",
      model: "Q8",
      odometerKm: 145,
      plateNumber: `QA-${String(uniqueId).slice(-6)}`,
      status: "available",
      vin: `QA${uniqueId}`,
      year: 2026,
    },
    headers: { authorization: `Bearer ${session.accessToken}` },
  });
  expect(vehicleResponse.ok()).toBeTruthy();

  await page.goto("/");
  await page.getByRole("button", demoButton).click();
  await expect(page.getByRole("heading", { level: 1, name: "Главная" })).toBeVisible();

  await page.getByRole("button", { exact: true, name: "+ Создать" }).click();
  await page.locator(".create-action-sheet").getByRole("button", { name: "Создать аренду" }).click();
  const workflow = page.locator(".rental-workflow");
  await expect(workflow).toBeVisible();

  await workflow.getByLabel("Выбрать из CRM").selectOption({ index: 0 });
  await workflow.getByLabel("Имя").fill(`QA Rental ${uniqueId}`);
  await workflow.getByLabel("Телефон").fill("+48 600 777 888");
  await workflow.getByLabel("Email").fill(`qa-rental-${uniqueId}@example.com`);
  await workflow.getByLabel("WhatsApp").fill("+48 600 777 888");

  const vehicleSelect = workflow.getByLabel("Автомобиль");
  await expect.poll(async () => vehicleSelect.evaluate((node) => {
    const select = node as HTMLSelectElement;
    return Array.from(select.options).some((option) => option.value && !option.disabled);
  })).toBe(true);
  const vehicleValue = await vehicleSelect.evaluate((node) => {
    const select = node as HTMLSelectElement;
    return Array.from(select.options).find((option) => option.value && !option.disabled)?.value ?? "";
  });
  expect(vehicleValue).not.toBe("");
  await vehicleSelect.selectOption(vehicleValue);

  await workflow.getByLabel("Статус оплаты").selectOption("paid");
  await workflow.getByLabel("Способ оплаты").selectOption("card");
  await workflow.getByRole("button", { name: "Сохранить аренду" }).click();
  await expect(page.getByRole("status").getByText(/Аренда сохранена/)).toBeVisible({ timeout: 15_000 });
  await expect(workflow.getByText("Карточка аренды создана и доступна в поиске")).toBeVisible();
  await expect(workflow.getByRole("button", { name: "WhatsApp" })).toBeEnabled();
  await workflow.getByLabel("Состояние автомобиля").selectOption("ok");
  await workflow.getByRole("button", { exact: true, name: "Закрыть аренду" }).click();
  await expect(page.getByRole("status").getByText(/Возврат оформлен|уже закрыта/)).toBeVisible({ timeout: 15_000 });
  await workflow.getByRole("button", { exact: true, name: "Закрыть" }).click();
  await page.getByRole("textbox", { name: "Номер, VIN, клиент, телефон" }).fill(`QA Rental ${uniqueId}`);
  await expect(page.locator(".global-search-results")).toBeVisible();
  await expect(page.locator(".global-search-results").getByText("Бронь")).toBeVisible();
});

test("mobile user can enter demo SaaS and navigate through drawer", async ({ page, isMobile }) => {
  test.skip(!isMobile, "mobile drawer flow is only meaningful on mobile project");

  await page.goto("/");
  await page.getByRole("button", demoButton).click();

  await expect(page.getByRole("heading", { name: "Главная" })).toBeVisible();
  await expect(page.locator(".mobile-menu-button")).toBeVisible();
  await expect(page.getByRole("button", { exact: true, name: "+ Создать" })).toBeVisible();

  await page.locator(".mobile-menu-button").click();
  await expect(page.locator(".mobile-drawer-shell.open")).toBeVisible();
  await expect(page.locator(".mobile-drawer-profile")).toBeVisible();
  await expect(page.locator(".mobile-drawer-signout")).toBeVisible();

  await page.locator(".mobile-drawer-more summary").click();
  await page.locator(".mobile-drawer-nav").getByRole("button", { name: /GPS/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "GPS" })).toBeVisible();
});
