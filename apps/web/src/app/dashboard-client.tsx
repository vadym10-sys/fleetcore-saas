"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent, type RefObject } from "react";
import type { AuthSession, Company, Customer, CustomerDocument, DashboardMetrics, Expense, FileObject, GpsDevice, Invoice, Payment, Rental, RentalChecklist, RentalContract, RentalContractEvent, RentalFlow, ServiceRecord, User, UserRole, Vehicle, VehicleDocument } from "@fleetcore/shared";
import { EmptyWorkspaceState, ListControlBar, type SavedView } from "../features/common/list-control-bar";
import { RentalWorkbench } from "../features/rentals/rental-workbench";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
const CALENDLY_URL = process.env.NEXT_PUBLIC_CALENDLY_URL ?? "https://calendly.com/fleetcore-saas/rental-reservation";
const TENANT_ID = "tenant_atlas";

type GoogleLatLngLiteral = { lat: number; lng: number };
type GoogleMapInstance = {
  setCenter: (position: GoogleLatLngLiteral) => void;
  setZoom: (zoom: number) => void;
};
type GoogleMarkerInstance = {
  setMap: (map: GoogleMapInstance | null) => void;
};

type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  onresult: ((event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null;
  start: () => void;
  stop: () => void;
};

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;
type GoogleMapsNamespace = {
  Map: new (element: HTMLElement, options: { center: GoogleLatLngLiteral; mapTypeControl?: boolean; streetViewControl?: boolean; styles?: Array<Record<string, unknown>>; zoom: number }) => GoogleMapInstance;
  Marker: new (options: { label?: string; map: GoogleMapInstance; position: GoogleLatLngLiteral; title?: string }) => GoogleMarkerInstance;
};

declare global {
  interface Window {
    google?: { maps?: GoogleMapsNamespace };
    fleetcoreGoogleMapsReady?: () => void;
  }
}

type ApiEnvelope<T> = { data: T };
type Section = "Dashboard" | "GPS" | "Vehicles" | "Calendar" | "Drivers/Clients" | "Bookings" | "Finance" | "Service" | "Settings";
type Locale = "en" | "ru" | "es" | "fr" | "de";
type MapProvider = "apple" | "google";
type SmartAction = { disabled?: boolean; label: string; onClick: () => void };
type SectionFocus = {
  meta: string;
  primary: SmartAction;
  secondary: SmartAction[];
  title: string;
};
type RentalWizardStep = "vehicle" | "customer" | "booking" | "contract" | "send" | "payment" | "return";
type VehicleSortKey = "status" | "plate" | "return" | "roi";
type CustomerSortKey = "name" | "risk" | "debt" | "rentals";
type OperationKind =
  | "booking"
  | "contract"
  | "customerDocument"
  | "depositDocument"
  | "depositReturn"
  | "expense"
  | "gps"
  | "payment"
  | "signature"
  | "service"
  | "vehicleDocument";

type AppData = {
  company: Company | undefined;
  customers: Customer[];
  documents: VehicleDocument[];
  files: FileObject[];
  gpsDevices: GpsDevice[];
  invoices: Invoice[];
  metrics: DashboardMetrics;
  payments: Payment[];
  rentals: Rental[];
  customerDocuments: CustomerDocument[];
  expenses: Expense[];
  rentalChecklists: RentalChecklist[];
  rentalContracts: RentalContract[];
  rentalContractEvents: RentalContractEvent[];
  rentalFlows: RentalFlow[];
  serviceRecords: ServiceRecord[];
  teamUsers: User[];
  vehicles: Vehicle[];
};

type UiNotification = {
  id: string;
  tone: "green" | "blue" | "orange" | "red" | "black";
  title: string;
  meta: string;
  time: string;
};

type DocumentPreview = {
  fileUrl: string;
  meta?: string;
  title: string;
};

type RentalDocumentFolder = {
  checklists: RentalChecklist[];
  contract: RentalContract | undefined;
  customer: Customer | undefined;
  invoice: Invoice | undefined;
  paymentTotal: number;
  rental: Rental;
  vehicle: Vehicle | undefined;
};

type RentalDetailContext = RentalDocumentFolder & {
  contractEvents: RentalContractEvent[];
  flow: RentalFlow | undefined;
  paidAmount: number;
  remainingAmount: number;
};

type RentalWorkflowDraft = {
  clientEmail: string;
  clientName: string;
  clientNote: string;
  clientPassportId: string;
  clientPhone: string;
  clientTelegram: string;
  clientWhatsApp: string;
  depositAmount: string;
  depositRefund: string;
  paymentAmount: string;
  paymentMethod: "bank_transfer" | "card" | "cash";
  paymentStatus: "paid" | "partial" | "unpaid";
  pickupAt: string;
  rentalAmount: string;
  returnAt: string;
  returnCondition: string;
  returnDamages: string;
  returnDate: string;
  selectedCustomerId: string;
  selectedRentalId: string;
  selectedVehicleId: string;
};

type DocumentCenterTab = "attention" | "vehicles" | "customers" | "rentals" | "files";

type OperationsIssue = {
  action: () => void;
  label: string;
  meta: string;
  tone: "red" | "orange" | "blue" | "green" | "black";
};

type GlobalSearchResult = {
  id: string;
  kind: "vehicle" | "customer" | "rental" | "document" | "finance" | "gps";
  label: string;
  meta: string;
  section: Section;
  vehicleId?: string;
  customerId?: string;
  rentalId?: string;
  preview?: DocumentPreview;
};

type DashboardFolder = {
  createdAt: string;
  files?: DashboardFolderFile[];
  id: string;
  name: string;
  notes?: DashboardFolderNote[];
};

type DashboardFolderFile = {
  addedAt: string;
  fileUrl: string;
  id: string;
  mimeType: string;
  name: string;
  sizeBytes: number;
};

type DashboardFolderNote = {
  createdAt: string;
  id: string;
  text: string;
};

type AiSearchResponse = {
  intent: string;
  mode: "local" | "openai";
  query: string;
  results: GlobalSearchResult[];
  summary: string;
  terms: string[];
};

const sections: Section[] = ["Dashboard", "GPS", "Vehicles", "Calendar", "Bookings", "Finance", "Service", "Settings"];
const locales: Array<{ code: Locale; label: string }> = [
  { code: "en", label: "EN" },
  { code: "ru", label: "RU" },
  { code: "es", label: "ES" },
  { code: "fr", label: "FR" },
  { code: "de", label: "DE" },
];
const gpsProviderOptions = [
  { label: "Traccar", value: "traccar" },
  { label: "Wialon", value: "wialon" },
  { label: "Navixy", value: "navixy" },
  { label: "GPSWOX", value: "gpswox" },
  { label: "Samsara", value: "samsara" },
  { label: "Geotab", value: "geotab" },
  { label: "Teltonika", value: "teltonika" },
  { label: "Ruptela", value: "ruptela" },
  { label: "Queclink", value: "queclink" },
  { label: "Concox", value: "concox" },
  { label: "Motive", value: "motive" },
  { label: "Fleet Complete", value: "fleet_complete" },
  { label: "Webfleet", value: "webfleet" },
  { label: "Verizon Connect", value: "verizon_connect" },
  { label: "API / Webhook", value: "api_webhook" },
  { label: "Manual", value: "manual" },
];

const uiCopy = {
  en: {
    "auth.demo": "Enter demo account",
    "auth.email": "Company email",
    "auth.login": "Sign in",
    "auth.loginTitle": "Sign in to company account",
    "auth.message": "Sign in with your company email or create a new B2B account.",
    "auth.newCompany": "New company",
    "auth.ownerEmail": "Owner email",
    "auth.ownerName": "Owner name",
    "auth.password": "Password",
    "auth.passwordConfirm": "Repeat password",
    "auth.resetPassword": "Reset password",
    "auth.register": "Create account",
    "auth.registerTitle": "Register B2B company",
    "auth.choiceLoginTitle": "Sign in",
    "auth.choiceLoginText": "For owner or manager",
    "auth.choiceRegisterTitle": "Create company",
    "auth.choiceRegisterText": "New B2B account",
    "auth.choiceDemoTitle": "Demo",
    "auth.choiceDemoText": "Explore SaaS without registration",
    "auth.previewTitle": "B2B data isolation",
    "auth.previewText": "Each company gets its own tenant, owner account, fleet, customers, rentals and finances.",
    "drawer.planSubtitle": "FleetCore premium workspace",
    "drawer.profileTeam": "Profile and team",
    "drawer.switchAccount": "Sign in with another account",
    "auth.businessName": "Business name",
    "auth.legalName": "Legal name",
    "auth.country": "Country",
    "auth.currency": "Currency",
    "auth.fleetLimit": "Fleet limit",
    "common.loading": "Loading...",
    "common.refresh": "Refresh data",
    "common.search": "Plate, VIN, client, phone",
    "common.signOut": "Sign out",
    "common.cancel": "Cancel",
    "common.save": "Save",
    "common.noClient": "No client",
    "common.noReturn": "No return",
    "section.subtitle.Dashboard": "Executive view of fleet, revenue, returns and operational alerts.",
    "section.subtitle.GPS": "Connect trackers, platforms and live vehicle positions in one control room.",
    "section.subtitle.Vehicles": "Manage fleet records, documents, service and profitability per vehicle.",
    "section.subtitle.Calendar": "Calendly booking slots and FleetCore reservations in one scheduling view.",
    "section.subtitle.Drivers/Clients": "Customer CRM, documents, rental history and verification files.",
    "section.subtitle.Bookings": "Create bookings, contracts, signatures and WhatsApp customer links.",
    "section.subtitle.Finance": "Payments, expenses, deposits, refunds and ROI by vehicle.",
    "section.subtitle.Service": "Vehicle, client and rental documents, expiry dates and service files.",
    "section.subtitle.Settings": "Company account, subscription, integrations and business data.",
    "dashboard.activeRentals": "In rental",
    "dashboard.available": "Available now",
    "dashboard.monthlyRevenue": "Monthly revenue",
    "dashboard.overdue": "On service",
    "dashboard.todayRevenue": "Today revenue",
    "dashboard.totalVehicles": "Total vehicles",
    "gps.connect": "Connect GPS",
    "gps.connectVehicle": "Connect GPS to vehicle",
    "gps.deviceId": "Tracker ID",
    "gps.devices": "GPS devices",
    "gps.empty": "Connect the first GPS tracker.",
    "gps.fastConnect": "Quick-connect selected vehicle",
    "gps.notConnected": "GPS not connected",
    "gps.platform": "Platform",
    "gps.speed": "Speed, km/h",
    "gps.supported": "Manual GPS connection",
    "gps.supportedHint": "Add a device manually with coordinates, speed and last signal. Provider history can be expanded later.",
    "finance.expenses": "Expenses",
    "finance.income": "Income",
    "finance.net": "Net profit",
    "panel.latestRequests": "Latest requests",
    "panel.notifications": "Notifications",
    "panel.returns": "Upcoming returns",
    "panel.vehicleCard": "Vehicle card",
    "status.active": "Active",
    "status.available": "Available",
    "status.maintenance": "In repair",
    "status.offline": "Offline",
    "status.overdue": "Overdue",
    "status.rented": "In rental",
    "status.reserved": "Reserved",
    "status.returnDue": "Return soon",
    "status.noCritical": "No critical events",
    "status.system": "System",
    "time.now": "now",
    "vehicle.add": "Add vehicle",
    "vehicle.client": "Client",
    "vehicle.delete": "Remove vehicle",
    "vehicle.deleteBlocked": "Vehicle has rental history. Close or archive rentals before removing it.",
    "vehicle.deleted": "Vehicle removed",
    "vehicle.deleting": "Removing vehicle...",
    "vehicle.documents": "PDF documents",
    "vehicle.expense": "Add expense",
    "vehicle.mileage": "Mileage",
    "vehicle.return": "Return",
    "vehicle.save": "Save vehicle",
    "vehicle.service": "Service",
    "vehicle.serviceCreate": "Create service",
    "vehicle.uploadDocument": "Upload document",
    "vehicle.photoAdd": "Add vehicle photo",
    "vehicle.photoReplace": "Replace photo",
    "vehicle.photoRemove": "Remove photo",
    "command.kicker": "FleetCore Command",
    "command.title": "Fleet operations center",
    "command.subtitle": "Run the most frequent actions in one click without moving between sections.",
    "command.returns": "Returns",
    "command.overdue": "Overdue",
    "command.documents": "Documents",
    "command.contracts": "Contracts",
    "command.newBooking": "New booking",
    "command.vehicle": "Vehicle",
    "command.customer": "Customer",
    "command.document": "Document",
    "command.expense": "Expense",
    "command.service": "Service",
    "customer.add": "Add customer",
    "customer.assignVehicle": "Attach vehicle to this customer",
    "customer.noAvailableVehicle": "No available vehicle is ready for this customer.",
    "customer.createVehicleFirst": "Add vehicle first",
    "customer.vehicle": "Customer vehicle",
    "customer.vehiclePlaceholder": "Choose an available vehicle",
    "customer.saved": "Customer saved",
    "customer.creating": "Creating customer...",
    "customer.assigning": "Attaching vehicle to customer...",
    "customer.noVehicleForAssign": "No available vehicle to attach. Add a vehicle first.",
    "customer.assigned": "Customer attached to vehicle",
    "form.displayName": "Full name",
    "form.email": "Email",
    "form.phone": "Phone",
    "form.make": "Make",
    "form.model": "Model",
    "form.year": "Year",
    "form.plateNumber": "Plate number",
    "form.vin": "VIN",
    "form.location": "Location",
    "form.odometerKm": "Mileage, km",
    "form.dailyRate": "Daily rate",
    "nav.Bookings": "Rentals",
    "nav.Calendar": "Calendar",
    "nav.Dashboard": "Dashboard",
    "nav.Drivers/Clients": "Clients",
    "nav.Finance": "Finance",
    "nav.GPS": "GPS",
    "nav.Service": "Documents",
    "nav.Settings": "Settings",
    "nav.Vehicles": "Vehicles",
    "settings.account": "Company account",
    "settings.companyId": "Company ID",
    "settings.data": "SaaS data",
    "settings.documents": "Documents",
    "settings.contracts": "Contracts",
    "settings.integrations": "Integrations",
    "settings.maps": "Google Maps",
    "settings.mapsActive": "live map connected",
    "settings.mapsPreview": "preview mode active",
    "settings.platform": "FleetCore Cloud: online",
    "settings.role": "Role",
    "settings.update": "Refresh data",
    "settings.vehicles": "Vehicles",
    "settings.customers": "Clients",
    "tariff.manage": "Manage subscription",
    "tariff.month": "month",
    "tariff.name": "Business plan",
  },
  ru: {
    "auth.demo": "Войти в демо-аккаунт",
    "auth.email": "Email компании",
    "auth.login": "Войти",
    "auth.loginTitle": "Вход в аккаунт компании",
    "auth.message": "Войдите через email компании или создайте новый B2B-аккаунт.",
    "auth.newCompany": "Новая компания",
    "auth.ownerEmail": "Email владельца",
    "auth.ownerName": "Имя владельца",
    "auth.password": "Пароль",
    "auth.passwordConfirm": "Повторите пароль",
    "auth.resetPassword": "Восстановить пароль",
    "auth.register": "Создать аккаунт",
    "auth.registerTitle": "Регистрация B2B-компании",
    "auth.choiceLoginTitle": "Войти",
    "auth.choiceLoginText": "Для владельца или менеджера",
    "auth.choiceRegisterTitle": "Создать компанию",
    "auth.choiceRegisterText": "Новый B2B аккаунт",
    "auth.choiceDemoTitle": "Демо",
    "auth.choiceDemoText": "Посмотреть SaaS без регистрации",
    "auth.previewTitle": "B2B изоляция данных",
    "auth.previewText": "Каждая компания получает свой tenant, owner-аккаунт, автопарк, клиентов, аренды и финансы.",
    "drawer.planSubtitle": "Премиальное рабочее пространство FleetCore",
    "drawer.profileTeam": "Профиль и команда",
    "drawer.switchAccount": "Войти другим аккаунтом",
    "auth.businessName": "Название бизнеса",
    "auth.legalName": "Юридическое имя",
    "auth.country": "Страна",
    "auth.currency": "Валюта",
    "auth.fleetLimit": "Лимит автопарка",
    "common.loading": "Загрузка...",
    "common.refresh": "Обновить данные",
    "common.search": "Номер, VIN, клиент, телефон",
    "common.signOut": "Выйти из аккаунта",
    "common.cancel": "Отмена",
    "common.save": "Сохранить",
    "common.noClient": "Без клиента",
    "common.noReturn": "Нет возврата",
    "section.subtitle.Dashboard": "Главный обзор автопарка, доходов, возвратов и операционных событий.",
    "section.subtitle.GPS": "Подключайте трекеры, платформы и живые позиции автомобилей в одном центре.",
    "section.subtitle.Vehicles": "Управляйте авто, документами, сервисом и прибыльностью каждой машины.",
    "section.subtitle.Calendar": "Calendly-слоты и резервации FleetCore в одном календаре.",
    "section.subtitle.Drivers/Clients": "CRM клиентов, документы, история аренд и проверочные файлы.",
    "section.subtitle.Bookings": "Брони, договоры, подписи и WhatsApp-ссылки для клиентов.",
    "section.subtitle.Finance": "Оплаты, расходы, депозиты, возвраты и ROI по автомобилям.",
    "section.subtitle.Service": "Документы авто, клиентов, аренд, сроки действия и сервисные файлы.",
    "section.subtitle.Settings": "Аккаунт компании, подписка, интеграции и бизнес-данные.",
    "dashboard.activeRentals": "В аренде",
    "dashboard.available": "Свободно сейчас",
    "dashboard.monthlyRevenue": "Доход за месяц",
    "dashboard.overdue": "На сервисе",
    "dashboard.todayRevenue": "Доход сегодня",
    "dashboard.totalVehicles": "Всего автомобилей",
    "gps.connect": "Подключить GPS",
    "gps.connectVehicle": "Подключить GPS к авто",
    "gps.deviceId": "ID трекера",
    "gps.devices": "GPS устройства",
    "gps.empty": "Подключите первый GPS-трекер.",
    "gps.fastConnect": "Быстро подключить выбранное авто",
    "gps.notConnected": "GPS не подключен",
    "gps.platform": "Платформа",
    "gps.speed": "Скорость, км/ч",
    "gps.supported": "Ручное подключение GPS",
    "gps.supportedHint": "Добавьте устройство вручную: координаты, скорость и последний сигнал. Историю провайдеров можно расширить позже.",
    "finance.expenses": "Расходы",
    "finance.income": "Доход",
    "finance.net": "Чистая прибыль",
    "panel.latestRequests": "Последние заявки",
    "panel.notifications": "Уведомления",
    "panel.returns": "Ближайшие возвраты",
    "panel.vehicleCard": "Карточка автомобиля",
    "status.active": "Активен",
    "status.available": "Свободен",
    "status.maintenance": "На ремонте",
    "status.offline": "Оффлайн",
    "status.overdue": "Просрочен",
    "status.rented": "В аренде",
    "status.reserved": "Забронирован",
    "status.returnDue": "Скоро возврат",
    "status.noCritical": "Критических событий нет",
    "status.system": "Система",
    "time.now": "сейчас",
    "vehicle.add": "Добавить автомобиль",
    "vehicle.client": "Клиент",
    "vehicle.delete": "Убрать автомобиль",
    "vehicle.deleteBlocked": "У автомобиля есть история аренды. Сначала закройте или архивируйте аренды.",
    "vehicle.deleted": "Автомобиль удален",
    "vehicle.deleting": "Удаляем автомобиль...",
    "vehicle.documents": "Документы PDF",
    "vehicle.expense": "Добавить расход",
    "vehicle.mileage": "Пробег",
    "vehicle.return": "Возврат",
    "vehicle.save": "Сохранить авто",
    "vehicle.service": "Сервис",
    "vehicle.serviceCreate": "Создать ТО",
    "vehicle.uploadDocument": "Загрузить документ",
    "vehicle.photoAdd": "Добавить фото авто",
    "vehicle.photoReplace": "Заменить фото",
    "vehicle.photoRemove": "Убрать фото",
    "command.kicker": "FleetCore Command",
    "command.title": "Рабочий центр автопарка",
    "command.subtitle": "Самые частые действия доступны в один клик без перехода по разделам.",
    "command.returns": "Возвраты",
    "command.overdue": "Просрочки",
    "command.documents": "Документы",
    "command.contracts": "Договоры",
    "command.newBooking": "Новая бронь",
    "command.vehicle": "Автомобиль",
    "command.customer": "Клиент",
    "command.document": "Документ",
    "command.expense": "Расход",
    "command.service": "ТО",
    "customer.add": "Добавить клиента",
    "customer.assignVehicle": "Добавить к этому клиенту автомобиль",
    "customer.noAvailableVehicle": "Нет свободного автомобиля для этого клиента.",
    "customer.createVehicleFirst": "Сначала добавить автомобиль",
    "customer.vehicle": "Автомобиль клиента",
    "customer.vehiclePlaceholder": "Выберите свободный автомобиль",
    "customer.saved": "Клиент сохранен",
    "customer.creating": "Создаем клиента...",
    "customer.assigning": "Закрепляем автомобиль за клиентом...",
    "customer.noVehicleForAssign": "Нет свободного автомобиля для закрепления. Сначала добавьте автомобиль.",
    "customer.assigned": "Клиент закреплен за автомобилем",
    "form.displayName": "Имя и фамилия",
    "form.email": "Email",
    "form.phone": "Телефон",
    "form.make": "Марка",
    "form.model": "Модель",
    "form.year": "Год",
    "form.plateNumber": "Госномер",
    "form.vin": "VIN",
    "form.location": "Локация",
    "form.odometerKm": "Пробег, км",
    "form.dailyRate": "Цена в день",
    "nav.Bookings": "Аренды",
    "nav.Calendar": "Календарь",
    "nav.Dashboard": "Главная",
    "nav.Drivers/Clients": "Клиенты",
    "nav.Finance": "Финансы",
    "nav.GPS": "GPS",
    "nav.Service": "Документы",
    "nav.Settings": "Настройки",
    "nav.Vehicles": "Авто",
    "settings.account": "Аккаунт компании",
    "settings.companyId": "Company ID",
    "settings.data": "Данные SaaS",
    "settings.documents": "Документы",
    "settings.contracts": "Договоры",
    "settings.integrations": "Интеграции",
    "settings.maps": "Google Maps",
    "settings.mapsActive": "живая карта подключена",
    "settings.mapsPreview": "активен preview-режим",
    "settings.platform": "FleetCore Cloud: онлайн",
    "settings.role": "Роль",
    "settings.update": "Обновить данные",
    "settings.vehicles": "Авто",
    "settings.customers": "Клиенты",
    "tariff.manage": "Управление подпиской",
    "tariff.month": "месяц",
    "tariff.name": "Тариф Business",
  },
  es: {
    "auth.demo": "Entrar en demo",
    "auth.email": "Email de empresa",
    "auth.login": "Entrar",
    "auth.loginTitle": "Acceso a la cuenta de empresa",
    "auth.message": "Accede con el email de tu empresa o crea una cuenta B2B.",
    "auth.newCompany": "Nueva empresa",
    "auth.ownerEmail": "Email del propietario",
    "auth.ownerName": "Nombre del propietario",
    "auth.password": "Contraseña",
    "auth.passwordConfirm": "Repetir contraseña",
    "auth.resetPassword": "Restablecer contraseña",
    "auth.register": "Crear cuenta",
    "auth.registerTitle": "Registrar empresa B2B",
    "auth.choiceLoginTitle": "Entrar",
    "auth.choiceLoginText": "Para propietario o gestor",
    "auth.choiceRegisterTitle": "Crear empresa",
    "auth.choiceRegisterText": "Nueva cuenta B2B",
    "auth.choiceDemoTitle": "Demo",
    "auth.choiceDemoText": "Ver el SaaS sin registro",
    "auth.previewTitle": "Aislamiento de datos B2B",
    "auth.previewText": "Cada empresa obtiene su propio tenant, cuenta de propietario, flota, clientes, alquileres y finanzas.",
    "drawer.planSubtitle": "Espacio premium de FleetCore",
    "drawer.profileTeam": "Perfil y equipo",
    "drawer.switchAccount": "Entrar con otra cuenta",
    "auth.businessName": "Nombre comercial",
    "auth.legalName": "Razón social",
    "auth.country": "País",
    "auth.currency": "Moneda",
    "auth.fleetLimit": "Límite de flota",
    "common.loading": "Cargando...",
    "common.refresh": "Actualizar datos",
    "common.search": "Matrícula, VIN, cliente, teléfono",
    "common.signOut": "Cerrar sesión",
    "common.cancel": "Cancelar",
    "common.save": "Guardar",
    "common.noClient": "Sin cliente",
    "common.noReturn": "Sin devolución",
    "section.subtitle.Dashboard": "Vista ejecutiva de flota, ingresos, devoluciones y alertas operativas.",
    "section.subtitle.GPS": "Conecta rastreadores, plataformas y posiciones en vivo en un solo centro.",
    "section.subtitle.Vehicles": "Gestiona flota, documentos, servicio y rentabilidad por vehículo.",
    "section.subtitle.Calendar": "Reservas de FleetCore y slots de Calendly en un calendario.",
    "section.subtitle.Drivers/Clients": "CRM de clientes, documentos, historial de alquileres y verificación.",
    "section.subtitle.Bookings": "Reservas, contratos, firmas y enlaces WhatsApp para clientes.",
    "section.subtitle.Finance": "Pagos, gastos, depósitos, reembolsos y ROI por vehículo.",
    "section.subtitle.Service": "Documentos de autos, clientes, alquileres, vencimientos y servicio.",
    "section.subtitle.Settings": "Cuenta, suscripción, integraciones y datos de negocio.",
    "dashboard.activeRentals": "En alquiler",
    "dashboard.available": "Disponible ahora",
    "dashboard.monthlyRevenue": "Ingresos mensuales",
    "dashboard.overdue": "En servicio",
    "dashboard.todayRevenue": "Ingresos hoy",
    "dashboard.totalVehicles": "Vehículos totales",
    "gps.connect": "Conectar GPS",
    "gps.connectVehicle": "Conectar GPS al vehículo",
    "gps.deviceId": "ID del rastreador",
    "gps.devices": "Dispositivos GPS",
    "gps.empty": "Conecta el primer rastreador GPS.",
    "gps.fastConnect": "Conectar vehículo seleccionado",
    "gps.notConnected": "GPS no conectado",
    "gps.platform": "Plataforma",
    "gps.speed": "Velocidad, km/h",
    "gps.supported": "Conexión GPS manual",
    "gps.supportedHint": "Añade el dispositivo manualmente con coordenadas, velocidad y última señal.",
    "finance.expenses": "Gastos",
    "finance.income": "Ingresos",
    "finance.net": "Beneficio neto",
    "panel.latestRequests": "Últimas solicitudes",
    "panel.notifications": "Notificaciones",
    "panel.returns": "Próximas devoluciones",
    "panel.vehicleCard": "Ficha del vehículo",
    "status.active": "Activo",
    "status.available": "Disponible",
    "status.maintenance": "En reparación",
    "status.offline": "Sin conexión",
    "status.overdue": "Vencido",
    "status.rented": "En alquiler",
    "status.reserved": "Reservado",
    "status.returnDue": "Devuelve pronto",
    "status.noCritical": "Sin eventos críticos",
    "status.system": "Sistema",
    "time.now": "ahora",
    "vehicle.add": "Añadir vehículo",
    "vehicle.client": "Cliente",
    "vehicle.delete": "Eliminar vehículo",
    "vehicle.deleteBlocked": "El vehículo tiene historial de alquiler. Cierra o archiva los alquileres antes de eliminarlo.",
    "vehicle.deleted": "Vehículo eliminado",
    "vehicle.deleting": "Eliminando vehículo...",
    "vehicle.documents": "Documentos PDF",
    "vehicle.expense": "Añadir gasto",
    "vehicle.mileage": "Kilometraje",
    "vehicle.return": "Devolución",
    "vehicle.save": "Guardar vehículo",
    "vehicle.service": "Servicio",
    "vehicle.serviceCreate": "Crear servicio",
    "vehicle.uploadDocument": "Subir documento",
    "vehicle.photoAdd": "Añadir foto del vehículo",
    "vehicle.photoReplace": "Cambiar foto",
    "vehicle.photoRemove": "Quitar foto",
    "command.kicker": "FleetCore Command",
    "command.title": "Centro operativo de flota",
    "command.subtitle": "Ejecuta las acciones más frecuentes con un clic sin cambiar de sección.",
    "command.returns": "Devoluciones",
    "command.overdue": "Vencidos",
    "command.documents": "Documentos",
    "command.contracts": "Contratos",
    "command.newBooking": "Nueva reserva",
    "command.vehicle": "Vehículo",
    "command.customer": "Cliente",
    "command.document": "Documento",
    "command.expense": "Gasto",
    "command.service": "Servicio",
    "customer.add": "Añadir cliente",
    "customer.assignVehicle": "Asignar vehículo a este cliente",
    "customer.noAvailableVehicle": "No hay vehículo disponible para este cliente.",
    "customer.createVehicleFirst": "Añadir vehículo primero",
    "customer.vehicle": "Vehículo del cliente",
    "customer.vehiclePlaceholder": "Elige un vehículo disponible",
    "customer.saved": "Cliente guardado",
    "customer.creating": "Creando cliente...",
    "customer.assigning": "Asignando vehículo al cliente...",
    "customer.noVehicleForAssign": "No hay vehículo disponible para asignar. Añade un vehículo primero.",
    "customer.assigned": "Cliente asignado al vehículo",
    "form.displayName": "Nombre completo",
    "form.email": "Email",
    "form.phone": "Teléfono",
    "form.make": "Marca",
    "form.model": "Modelo",
    "form.year": "Año",
    "form.plateNumber": "Matrícula",
    "form.vin": "VIN",
    "form.location": "Ubicación",
    "form.odometerKm": "Kilometraje, km",
    "form.dailyRate": "Tarifa diaria",
    "nav.Bookings": "Alquileres",
    "nav.Calendar": "Calendario",
    "nav.Dashboard": "Panel",
    "nav.Drivers/Clients": "Clientes",
    "nav.Finance": "Finanzas",
    "nav.GPS": "GPS",
    "nav.Service": "Documentos",
    "nav.Settings": "Ajustes",
    "nav.Vehicles": "Vehículos",
    "settings.account": "Cuenta de empresa",
    "settings.companyId": "ID de empresa",
    "settings.data": "Datos SaaS",
    "settings.documents": "Documentos",
    "settings.contracts": "Contratos",
    "settings.integrations": "Integraciones",
    "settings.maps": "Google Maps",
    "settings.mapsActive": "mapa en vivo conectado",
    "settings.mapsPreview": "modo preview activo",
    "settings.platform": "FleetCore Cloud: online",
    "settings.role": "Rol",
    "settings.update": "Actualizar datos",
    "settings.vehicles": "Vehículos",
    "settings.customers": "Clientes",
    "tariff.manage": "Gestionar suscripción",
    "tariff.month": "mes",
    "tariff.name": "Plan Business",
  },
  fr: {
    "auth.demo": "Entrer en démo",
    "auth.email": "Email entreprise",
    "auth.login": "Connexion",
    "auth.loginTitle": "Connexion au compte entreprise",
    "auth.message": "Connectez-vous avec l'email de votre entreprise ou créez un compte B2B.",
    "auth.newCompany": "Nouvelle société",
    "auth.ownerEmail": "Email du propriétaire",
    "auth.ownerName": "Nom du propriétaire",
    "auth.password": "Mot de passe",
    "auth.passwordConfirm": "Répéter le mot de passe",
    "auth.resetPassword": "Réinitialiser le mot de passe",
    "auth.register": "Créer un compte",
    "auth.registerTitle": "Inscription société B2B",
    "auth.choiceLoginTitle": "Connexion",
    "auth.choiceLoginText": "Pour propriétaire ou manager",
    "auth.choiceRegisterTitle": "Créer société",
    "auth.choiceRegisterText": "Nouveau compte B2B",
    "auth.choiceDemoTitle": "Démo",
    "auth.choiceDemoText": "Voir le SaaS sans inscription",
    "auth.previewTitle": "Isolation des données B2B",
    "auth.previewText": "Chaque société obtient son propre tenant, compte propriétaire, flotte, clients, locations et finances.",
    "drawer.planSubtitle": "Espace premium FleetCore",
    "drawer.profileTeam": "Profil et équipe",
    "drawer.switchAccount": "Se connecter avec un autre compte",
    "auth.businessName": "Nom commercial",
    "auth.legalName": "Raison sociale",
    "auth.country": "Pays",
    "auth.currency": "Devise",
    "auth.fleetLimit": "Limite de flotte",
    "common.loading": "Chargement...",
    "common.refresh": "Actualiser",
    "common.search": "Plaque, VIN, client, téléphone",
    "common.signOut": "Se déconnecter",
    "common.cancel": "Annuler",
    "common.save": "Enregistrer",
    "common.noClient": "Sans client",
    "common.noReturn": "Sans retour",
    "section.subtitle.Dashboard": "Vue dirigeant de la flotte, des revenus, des retours et des alertes.",
    "section.subtitle.GPS": "Connectez traceurs, plateformes et positions en direct dans un centre unique.",
    "section.subtitle.Vehicles": "Gérez flotte, documents, service et rentabilité par véhicule.",
    "section.subtitle.Calendar": "Réservations FleetCore et créneaux Calendly dans un seul calendrier.",
    "section.subtitle.Drivers/Clients": "CRM clients, documents, historique de location et vérification.",
    "section.subtitle.Bookings": "Réservations, contrats, signatures et liens WhatsApp clients.",
    "section.subtitle.Finance": "Paiements, dépenses, dépôts, remboursements et ROI par véhicule.",
    "section.subtitle.Service": "Documents véhicules, clients, locations, échéances et service.",
    "section.subtitle.Settings": "Compte, abonnement, intégrations et données business.",
    "dashboard.activeRentals": "En location",
    "dashboard.available": "Disponible",
    "dashboard.monthlyRevenue": "Revenu mensuel",
    "dashboard.overdue": "En service",
    "dashboard.todayRevenue": "Revenu du jour",
    "dashboard.totalVehicles": "Véhicules",
    "gps.connect": "Connecter GPS",
    "gps.connectVehicle": "Connecter le GPS au véhicule",
    "gps.deviceId": "ID du traceur",
    "gps.devices": "Appareils GPS",
    "gps.empty": "Connectez le premier traceur GPS.",
    "gps.fastConnect": "Connexion rapide du véhicule",
    "gps.notConnected": "GPS non connecté",
    "gps.platform": "Plateforme",
    "gps.speed": "Vitesse, km/h",
    "gps.supported": "Connexion GPS manuelle",
    "gps.supportedHint": "Ajoutez un appareil manuellement avec coordonnées, vitesse et dernier signal.",
    "finance.expenses": "Dépenses",
    "finance.income": "Revenus",
    "finance.net": "Profit net",
    "panel.latestRequests": "Dernières demandes",
    "panel.notifications": "Notifications",
    "panel.returns": "Retours à venir",
    "panel.vehicleCard": "Fiche véhicule",
    "status.active": "Actif",
    "status.available": "Disponible",
    "status.maintenance": "En réparation",
    "status.offline": "Hors ligne",
    "status.overdue": "En retard",
    "status.rented": "En location",
    "status.reserved": "Réservé",
    "status.returnDue": "Retour bientôt",
    "status.noCritical": "Aucun événement critique",
    "status.system": "Système",
    "time.now": "maintenant",
    "vehicle.add": "Ajouter un véhicule",
    "vehicle.client": "Client",
    "vehicle.delete": "Supprimer le véhicule",
    "vehicle.deleteBlocked": "Ce véhicule a un historique de location. Fermez ou archivez les locations avant suppression.",
    "vehicle.deleted": "Véhicule supprimé",
    "vehicle.deleting": "Suppression du véhicule...",
    "vehicle.documents": "Documents PDF",
    "vehicle.expense": "Ajouter une dépense",
    "vehicle.mileage": "Kilométrage",
    "vehicle.return": "Retour",
    "vehicle.save": "Enregistrer le véhicule",
    "vehicle.service": "Service",
    "vehicle.serviceCreate": "Créer maintenance",
    "vehicle.uploadDocument": "Téléverser document",
    "vehicle.photoAdd": "Ajouter photo véhicule",
    "vehicle.photoReplace": "Remplacer la photo",
    "vehicle.photoRemove": "Retirer la photo",
    "command.kicker": "FleetCore Command",
    "command.title": "Centre opérations flotte",
    "command.subtitle": "Lancez les actions fréquentes en un clic sans changer de section.",
    "command.returns": "Retours",
    "command.overdue": "Retards",
    "command.documents": "Documents",
    "command.contracts": "Contrats",
    "command.newBooking": "Nouvelle réservation",
    "command.vehicle": "Véhicule",
    "command.customer": "Client",
    "command.document": "Document",
    "command.expense": "Dépense",
    "command.service": "Service",
    "customer.add": "Ajouter un client",
    "customer.assignVehicle": "Associer un véhicule à ce client",
    "customer.noAvailableVehicle": "Aucun véhicule disponible pour ce client.",
    "customer.createVehicleFirst": "Ajouter un véhicule d'abord",
    "customer.vehicle": "Véhicule du client",
    "customer.vehiclePlaceholder": "Choisir un véhicule disponible",
    "customer.saved": "Client enregistré",
    "customer.creating": "Création du client...",
    "customer.assigning": "Association du véhicule au client...",
    "customer.noVehicleForAssign": "Aucun véhicule disponible à associer. Ajoutez d'abord un véhicule.",
    "customer.assigned": "Client associé au véhicule",
    "form.displayName": "Nom complet",
    "form.email": "Email",
    "form.phone": "Téléphone",
    "form.make": "Marque",
    "form.model": "Modèle",
    "form.year": "Année",
    "form.plateNumber": "Immatriculation",
    "form.vin": "VIN",
    "form.location": "Emplacement",
    "form.odometerKm": "Kilométrage, km",
    "form.dailyRate": "Tarif jour",
    "nav.Bookings": "Locations",
    "nav.Calendar": "Calendrier",
    "nav.Dashboard": "Tableau",
    "nav.Drivers/Clients": "Clients",
    "nav.Finance": "Finance",
    "nav.GPS": "GPS",
    "nav.Service": "Documents",
    "nav.Settings": "Paramètres",
    "nav.Vehicles": "Véhicules",
    "settings.account": "Compte entreprise",
    "settings.companyId": "ID société",
    "settings.data": "Données SaaS",
    "settings.documents": "Documents",
    "settings.contracts": "Contrats",
    "settings.integrations": "Intégrations",
    "settings.maps": "Google Maps",
    "settings.mapsActive": "carte en direct connectée",
    "settings.mapsPreview": "mode aperçu actif",
    "settings.platform": "FleetCore Cloud: en ligne",
    "settings.role": "Rôle",
    "settings.update": "Actualiser",
    "settings.vehicles": "Véhicules",
    "settings.customers": "Clients",
    "tariff.manage": "Gérer l'abonnement",
    "tariff.month": "mois",
    "tariff.name": "Offre Business",
  },
  de: {
    "auth.demo": "Demo öffnen",
    "auth.email": "Firmen-E-Mail",
    "auth.login": "Anmelden",
    "auth.loginTitle": "Beim Firmenkonto anmelden",
    "auth.message": "Mit Firmen-E-Mail anmelden oder ein neues B2B-Konto erstellen.",
    "auth.newCompany": "Neue Firma",
    "auth.ownerEmail": "E-Mail des Inhabers",
    "auth.ownerName": "Name des Inhabers",
    "auth.password": "Passwort",
    "auth.passwordConfirm": "Passwort wiederholen",
    "auth.resetPassword": "Passwort zurücksetzen",
    "auth.register": "Konto erstellen",
    "auth.registerTitle": "B2B-Firma registrieren",
    "auth.choiceLoginTitle": "Anmelden",
    "auth.choiceLoginText": "Für Inhaber oder Manager",
    "auth.choiceRegisterTitle": "Firma erstellen",
    "auth.choiceRegisterText": "Neues B2B-Konto",
    "auth.choiceDemoTitle": "Demo",
    "auth.choiceDemoText": "SaaS ohne Registrierung ansehen",
    "auth.previewTitle": "B2B-Datenisolation",
    "auth.previewText": "Jede Firma erhält eigenen Tenant, Inhaber-Konto, Flotte, Kunden, Mieten und Finanzen.",
    "drawer.planSubtitle": "Premium-Arbeitsbereich von FleetCore",
    "drawer.profileTeam": "Profil und Team",
    "drawer.switchAccount": "Mit anderem Konto anmelden",
    "auth.businessName": "Firmenname",
    "auth.legalName": "Rechtsname",
    "auth.country": "Land",
    "auth.currency": "Währung",
    "auth.fleetLimit": "Flottenlimit",
    "common.loading": "Wird geladen...",
    "common.refresh": "Daten aktualisieren",
    "common.search": "Kennzeichen, VIN, Kunde, Telefon",
    "common.signOut": "Abmelden",
    "common.cancel": "Abbrechen",
    "common.save": "Speichern",
    "common.noClient": "Kein Kunde",
    "common.noReturn": "Keine Rückgabe",
    "section.subtitle.Dashboard": "Managementblick auf Flotte, Umsatz, Rückgaben und operative Alerts.",
    "section.subtitle.GPS": "Tracker, Plattformen und Live-Positionen in einer Leitstelle verbinden.",
    "section.subtitle.Vehicles": "Fahrzeuge, Dokumente, Service und Profitabilität je Fahrzeug verwalten.",
    "section.subtitle.Calendar": "FleetCore-Reservierungen und Calendly-Zeiten in einem Kalender.",
    "section.subtitle.Drivers/Clients": "Kunden-CRM, Dokumente, Mietverlauf und Verifizierungsdateien.",
    "section.subtitle.Bookings": "Buchungen, Verträge, Signaturen und WhatsApp-Kundenlinks.",
    "section.subtitle.Finance": "Zahlungen, Kosten, Kautionen, Rückgaben und ROI je Fahrzeug.",
    "section.subtitle.Service": "Fahrzeug-, Kunden- und Mietdokumente, Fristen und Serviceakten.",
    "section.subtitle.Settings": "Firmenkonto, Abo, Integrationen und Geschäftsdaten.",
    "dashboard.activeRentals": "Vermietet",
    "dashboard.available": "Jetzt verfügbar",
    "dashboard.monthlyRevenue": "Monatsumsatz",
    "dashboard.overdue": "Im Service",
    "dashboard.todayRevenue": "Umsatz heute",
    "dashboard.totalVehicles": "Fahrzeuge gesamt",
    "gps.connect": "GPS verbinden",
    "gps.connectVehicle": "GPS mit Fahrzeug verbinden",
    "gps.deviceId": "Tracker-ID",
    "gps.devices": "GPS-Geräte",
    "gps.empty": "Ersten GPS-Tracker verbinden.",
    "gps.fastConnect": "Ausgewähltes Fahrzeug verbinden",
    "gps.notConnected": "GPS nicht verbunden",
    "gps.platform": "Plattform",
    "gps.speed": "Geschwindigkeit, km/h",
    "gps.supported": "Manuelle GPS-Verbindung",
    "gps.supportedHint": "Gerät manuell mit Koordinaten, Geschwindigkeit und letztem Signal hinzufügen.",
    "finance.expenses": "Kosten",
    "finance.income": "Umsatz",
    "finance.net": "Nettogewinn",
    "panel.latestRequests": "Letzte Anfragen",
    "panel.notifications": "Benachrichtigungen",
    "panel.returns": "Nächste Rückgaben",
    "panel.vehicleCard": "Fahrzeugkarte",
    "status.active": "Aktiv",
    "status.available": "Verfügbar",
    "status.maintenance": "In Reparatur",
    "status.offline": "Offline",
    "status.overdue": "Überfällig",
    "status.rented": "Vermietet",
    "status.reserved": "Reserviert",
    "status.returnDue": "Rückgabe bald",
    "status.noCritical": "Keine kritischen Ereignisse",
    "status.system": "System",
    "time.now": "jetzt",
    "vehicle.add": "Fahrzeug hinzufügen",
    "vehicle.client": "Kunde",
    "vehicle.delete": "Fahrzeug entfernen",
    "vehicle.deleteBlocked": "Dieses Fahrzeug hat Mietverlauf. Schließen oder archivieren Sie die Mieten vor dem Entfernen.",
    "vehicle.deleted": "Fahrzeug entfernt",
    "vehicle.deleting": "Fahrzeug wird entfernt...",
    "vehicle.documents": "PDF-Dokumente",
    "vehicle.expense": "Kosten hinzufügen",
    "vehicle.mileage": "Kilometerstand",
    "vehicle.return": "Rückgabe",
    "vehicle.save": "Fahrzeug speichern",
    "vehicle.service": "Service",
    "vehicle.serviceCreate": "Service erstellen",
    "vehicle.uploadDocument": "Dokument hochladen",
    "vehicle.photoAdd": "Fahrzeugfoto hinzufügen",
    "vehicle.photoReplace": "Foto ersetzen",
    "vehicle.photoRemove": "Foto entfernen",
    "command.kicker": "FleetCore Command",
    "command.title": "Flotten-Leitstelle",
    "command.subtitle": "Häufige Aktionen mit einem Klick ausführen, ohne Bereiche zu wechseln.",
    "command.returns": "Rückgaben",
    "command.overdue": "Überfällig",
    "command.documents": "Dokumente",
    "command.contracts": "Verträge",
    "command.newBooking": "Neue Buchung",
    "command.vehicle": "Fahrzeug",
    "command.customer": "Kunde",
    "command.document": "Dokument",
    "command.expense": "Kosten",
    "command.service": "Service",
    "customer.add": "Kunde hinzufügen",
    "customer.assignVehicle": "Fahrzeug diesem Kunden zuordnen",
    "customer.noAvailableVehicle": "Kein verfügbares Fahrzeug für diesen Kunden.",
    "customer.createVehicleFirst": "Zuerst Fahrzeug hinzufügen",
    "customer.vehicle": "Kundenfahrzeug",
    "customer.vehiclePlaceholder": "Verfügbares Fahrzeug wählen",
    "customer.saved": "Kunde gespeichert",
    "customer.creating": "Kunde wird erstellt...",
    "customer.assigning": "Fahrzeug wird dem Kunden zugeordnet...",
    "customer.noVehicleForAssign": "Kein verfügbares Fahrzeug zum Zuordnen. Fügen Sie zuerst ein Fahrzeug hinzu.",
    "customer.assigned": "Kunde dem Fahrzeug zugeordnet",
    "form.displayName": "Vollständiger Name",
    "form.email": "E-Mail",
    "form.phone": "Telefon",
    "form.make": "Marke",
    "form.model": "Modell",
    "form.year": "Jahr",
    "form.plateNumber": "Kennzeichen",
    "form.vin": "VIN",
    "form.location": "Standort",
    "form.odometerKm": "Kilometerstand, km",
    "form.dailyRate": "Tagespreis",
    "nav.Bookings": "Mieten",
    "nav.Calendar": "Kalender",
    "nav.Dashboard": "Dashboard",
    "nav.Drivers/Clients": "Kunden",
    "nav.Finance": "Finanzen",
    "nav.GPS": "GPS",
    "nav.Service": "Dokumente",
    "nav.Settings": "Einstellungen",
    "nav.Vehicles": "Fahrzeuge",
    "settings.account": "Firmenkonto",
    "settings.companyId": "Firmen-ID",
    "settings.data": "SaaS-Daten",
    "settings.documents": "Dokumente",
    "settings.contracts": "Verträge",
    "settings.integrations": "Integrationen",
    "settings.maps": "Google Maps",
    "settings.mapsActive": "Live-Karte verbunden",
    "settings.mapsPreview": "Vorschaumodus aktiv",
    "settings.platform": "FleetCore Cloud: online",
    "settings.role": "Rolle",
    "settings.update": "Daten aktualisieren",
    "settings.vehicles": "Fahrzeuge",
    "settings.customers": "Kunden",
    "tariff.manage": "Abo verwalten",
    "tariff.month": "Monat",
    "tariff.name": "Business Tarif",
  },
} satisfies Record<Locale, Record<string, string>>;

function translate(locale: Locale, key: string) {
  const copy = uiCopy as Record<Locale, Record<string, string>>;
  return copy[locale][key] ?? copy.en[key] ?? key;
}

function sectionLabel(locale: Locale, section: Section) {
  return translate(locale, `nav.${section}`);
}

function sectionIcon(section: Section) {
  if (section === "Dashboard") return "⌂";
  if (section === "GPS") return "⌖";
  if (section === "Vehicles") return "▣";
  if (section === "Calendar") return "◴";
  if (section === "Finance") return "€";
  if (section === "Service") return "▤";
  if (section === "Settings") return "⚙";
  return "♙";
}

function sectionSubtitle(locale: Locale, section: Section) {
  return translate(locale, `section.subtitle.${section}`);
}

function moreLabel(locale: Locale) {
  if (locale === "ru") return "Ещё";
  if (locale === "es") return "Más";
  if (locale === "fr") return "Plus";
  if (locale === "de") return "Mehr";
  return "More";
}

function rentalStatusLabel(locale: Locale, status: Rental["status"]) {
  if (status === "quote") return locale === "ru" ? "Черновик" : "Quote";
  if (status === "reserved") return translate(locale, "status.reserved");
  if (status === "active") return translate(locale, "status.rented");
  if (status === "return_due") return translate(locale, "status.returnDue");
  if (status === "closed") return locale === "ru" ? "Закрыто" : "Closed";
  return status;
}

function contractStatusLabel(locale: Locale, status?: RentalContract["status"]) {
  if (!status) return locale === "ru" ? "Не создан" : "Not created";
  if (status === "draft") return locale === "ru" ? "Черновик" : "Draft";
  if (status === "sent") return locale === "ru" ? "Отправлен" : "Sent";
  if (status === "viewed") return locale === "ru" ? "Открыт" : "Viewed";
  if (status === "signed") return locale === "ru" ? "Подписан" : "Signed";
  return status;
}

function invoiceStatusLabel(locale: Locale, status?: Invoice["status"]) {
  if (!status) return locale === "ru" ? "Нет счёта" : "No invoice";
  if (status === "draft") return locale === "ru" ? "Черновик" : "Draft";
  if (status === "issued") return locale === "ru" ? "Выставлен" : "Issued";
  if (status === "paid") return locale === "ru" ? "Оплачен" : "Paid";
  if (status === "overdue") return locale === "ru" ? "Просрочен" : "Overdue";
  return status;
}

const emptyMetrics: DashboardMetrics = {
  activeRentals: 0,
  availableVehicles: 0,
  fleetUtilization: 0,
  monthlyRevenue: 0,
  overdueInvoices: 0,
};

const money = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const dateFmt = new Intl.DateTimeFormat("ru", { day: "2-digit", month: "short" });
const folderPickerProps = { directory: "", webkitdirectory: "" } as Record<string, string>;

function isDemoNoiseVehicle(vehicle: Vehicle) {
  const plate = vehicle.plateNumber.toUpperCase();
  const name = `${vehicle.make} ${vehicle.model}`.trim().toLowerCase();
  return /^(BUG|PHOTO|QA|VAL|WEB)-/.test(plate) || name === "test vehicle";
}

const defaultOperationForm = {
  amount: "100",
  category: "maintenance",
  cost: "120",
  customerId: "",
  depositAmount: "500",
  documentTitle: "",
  documentType: "other",
  externalDeviceId: "",
  finalAmount: "",
  invoiceId: "",
  latitude: "52.2297",
  longitude: "21.0122",
  method: "manual",
  note: "",
  odometerKm: "1000",
  provider: "traccar",
  reference: "",
  rentalId: "",
  returnAt: "",
  serviceAt: "",
  serviceType: "inspection",
  speedKph: "0",
  status: "planned",
  totalAmount: "180",
  vehicleId: "",
};

function readStoredSession() {
  if (typeof window === "undefined") return undefined;
  const stored = localStorage.getItem("fleetcore-session");
  if (!stored) return undefined;
  try {
    return JSON.parse(stored) as AuthSession;
  } catch {
    localStorage.removeItem("fleetcore-session");
    return undefined;
  }
}

function saveStoredSession(session: AuthSession) {
  if (typeof window !== "undefined") {
    localStorage.setItem("fleetcore-session", JSON.stringify(session));
  }
}

async function parseApiError(response: Response) {
  const body = await response.text();
  let message = body || `Request failed: ${response.status}`;
  try {
    const parsed = JSON.parse(body) as { error?: string };
    message = parsed.error ?? message;
  } catch {
    // Keep raw response text when the API did not return JSON.
  }
  return message;
}

async function refreshStoredSession() {
  const stored = readStoredSession();
  if (!stored?.refreshToken) return undefined;
  const response = await fetch(`${API_URL}/auth/refresh`, {
    body: JSON.stringify({ refreshToken: stored.refreshToken }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  if (!response.ok) return undefined;
  const refreshed = (await response.json()) as ApiEnvelope<AuthSession>;
  saveStoredSession(refreshed.data);
  return refreshed.data;
}

async function warmApi() {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 45000);
  try {
    const response = await fetch(`${API_URL}/health`, {
      cache: "no-store",
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timeout);
  }
}

async function api<T>(path: string, options: RequestInit = {}, token?: string, retry = true) {
  const hasBody = options.body !== undefined && options.body !== null;
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...(hasBody ? { "content-type": "application/json" } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : { "x-tenant-id": TENANT_ID }),
      ...options.headers,
    },
  });

  if (!response.ok) {
    if (response.status === 401 && retry && token && path !== "/auth/refresh") {
      const refreshed = await refreshStoredSession();
      if (refreshed?.accessToken) {
        return api<T>(path, options, refreshed.accessToken, false);
      }
    }
    const message = await parseApiError(response);
    throw new ApiRequestError(message, response.status);
  }

  return (await response.json()) as ApiEnvelope<T>;
}

class ApiRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "ApiRequestError";
  }
}

function Badge({ value }: { value: string }) {
  return <span className={`badge badge-${value.replaceAll(" ", "-").replaceAll("_", "-")}`}>{value.replaceAll("_", " ")}</span>;
}

function vehicleVisualVariant(vehicle?: Pick<Vehicle, "make" | "model">) {
  const name = `${vehicle?.make ?? ""} ${vehicle?.model ?? ""}`.toLowerCase();
  if (name.includes("tesla")) return "electric";
  if (name.includes("ford") || name.includes("transit")) return "van";
  if (name.includes("mercedes")) return "sedan";
  if (name.includes("rolls") || name.includes("royce")) return "luxury";
  if (name.includes("bmw") || name.includes("x5") || name.includes("x6")) return "suv";
  return "default";
}

function VehicleVisual({ tone = "light", vehicle }: { tone?: "light" | "dark"; vehicle?: Pick<Vehicle, "make" | "model"> }) {
  const variant = vehicleVisualVariant(vehicle);
  if ("photoUrl" in (vehicle ?? {}) && (vehicle as Vehicle).photoUrl) {
    return (
      <div className={`vehicle-photo-shell ${tone}`}>
        <img alt={`${(vehicle as Vehicle).make} ${(vehicle as Vehicle).model}`} src={(vehicle as Vehicle).photoUrl} />
      </div>
    );
  }

  return (
    <div className={`vehicle-art vehicle-visual ${tone} vehicle-${variant}`}>
      <span className="car-shadow" />
      <span className="car-roof" />
      <span className="car-window front" />
      <span className="car-window rear" />
      <span className="car-body" />
      <span className="car-grille" />
      <span className="car-light front" />
      <span className="car-light rear" />
      <span className="wheel left" />
      <span className="wheel right" />
    </div>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FilePreviewLink({ fileUrl, onPreview, title }: { fileUrl: string; onPreview?: ((document: DocumentPreview) => void) | undefined; title: string }) {
  if (onPreview) {
    return <button className="document-link" onClick={() => onPreview({ fileUrl, title })} type="button">{title}</button>;
  }

  return <a className="document-link" href={fileUrl} rel="noreferrer" target="_blank">{title}</a>;
}

function FileObjectRow({ file, onPreview }: { file: FileObject; onPreview?: ((document: DocumentPreview) => void) | undefined }) {
  return (
    <article className="file-object-row">
      <div>
        <strong>{file.originalName}</strong>
        <span>{file.mimeType} · {formatBytes(file.sizeBytes)} · {file.storageProvider}</span>
        {file.sha256 ? <small>SHA-256 {file.sha256.slice(0, 16)}...</small> : null}
      </div>
      <FilePreviewLink fileUrl={file.publicUrl} onPreview={onPreview} title="Preview" />
    </article>
  );
}

function vehicleStatusLabel(locale: Locale, vehicle: Vehicle, rental?: Rental) {
  if (vehicle.status === "maintenance") return translate(locale, "status.maintenance");
  if (rental?.status === "reserved") return translate(locale, "status.reserved");
  if (rental?.status === "return_due") return translate(locale, "status.returnDue");
  if (vehicle.status === "rented") return translate(locale, "status.rented");
  if (vehicle.status === "offline") return translate(locale, "status.offline");
  return translate(locale, "status.available");
}

function contractEventLabel(locale: Locale, event: RentalContractEvent) {
  const labels: Record<Locale, Record<RentalContractEvent["eventType"], string>> = {
    de: { created: "Erstellt", sent: "Gesendet", viewed: "Geöffnet", signed: "Signiert" },
    en: { created: "Created", sent: "Sent", viewed: "Viewed", signed: "Signed" },
    es: { created: "Creado", sent: "Enviado", viewed: "Visto", signed: "Firmado" },
    fr: { created: "Créé", sent: "Envoyé", viewed: "Vu", signed: "Signé" },
    ru: { created: "Создан", sent: "Отправлен", viewed: "Открыт", signed: "Подписан" },
  };
  return labels[locale][event.eventType];
}

function statusTone(vehicle: Vehicle, rental?: Rental): UiNotification["tone"] {
  if (vehicle.status === "maintenance") return "black";
  if (rental?.status === "reserved") return "blue";
  if (rental?.status === "return_due") return "orange";
  if (vehicle.status === "rented") return "blue";
  if (vehicle.status === "offline") return "red";
  return "green";
}

function documentTypeFromName(name: string): "insurance" | "registration" | "inspection" | "rental_contract" | "other" {
  const normalized = name.toLowerCase();
  if (normalized.includes("insurance") || normalized.includes("страх")) return "insurance";
  if (normalized.includes("registration") || normalized.includes("регистр")) return "registration";
  if (normalized.includes("inspection") || normalized.includes("то") || normalized.includes("tech")) return "inspection";
  if (normalized.includes("contract") || normalized.includes("договор")) return "rental_contract";
  return "other";
}

function customerDocumentTypeFromName(name: string): CustomerDocument["type"] {
  const normalized = name.toLowerCase();
  if (normalized.includes("passport") || normalized.includes("паспорт")) return "passport";
  if (normalized.includes("id") || normalized.includes("карта") || normalized.includes("dowod")) return "id_card";
  if (normalized.includes("license") || normalized.includes("driver") || normalized.includes("вод")) return "driver_license";
  return "other";
}

function normalizePhoneForWhatsApp(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return digits.length ? digits : "48600111222";
}

function openWhatsApp(phone: string, text: string) {
  const url = `https://wa.me/${normalizePhoneForWhatsApp(phone)}?text=${encodeURIComponent(text)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

function openTelegram(text: string, url: string) {
  window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
}

function openEmail(email: string, subject: string, body: string) {
  window.open(`mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, "_blank", "noopener,noreferrer");
}

function downloadCsv(filename: string, rows: string[][]) {
  if (typeof window === "undefined") return;
  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, "\"\"")}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function buildClientIntakeUrl(session: AuthSession, rental?: Rental) {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const params = new URLSearchParams({
    clientIntake: "1",
    companyId: session.companyId,
    tenantId: session.tenantId,
  });
  if (rental) params.set("rentalId", rental.id);
  return `${origin}/?${params.toString()}`;
}

let googleMapsPromise: Promise<GoogleMapsNamespace | undefined> | undefined;

function loadGoogleMaps(apiKey: string) {
  if (!apiKey || typeof window === "undefined") return Promise.resolve(undefined);
  if (window.google?.maps) return Promise.resolve(window.google.maps);
  if (googleMapsPromise) return googleMapsPromise;

  googleMapsPromise = new Promise((resolve, reject) => {
    window.fleetcoreGoogleMapsReady = () => resolve(window.google?.maps);
    const script = document.createElement("script");
    script.async = true;
    script.defer = true;
    script.onerror = () => reject(new Error("Google Maps API не загрузился"));
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&callback=fleetcoreGoogleMapsReady`;
    document.head.appendChild(script);
  });

  return googleMapsPromise;
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Не удалось прочитать файл ${file.name}`));
    reader.onload = () => {
      const result = String(reader.result ?? "");
      resolve(result.includes(",") ? result.split(",")[1] ?? "" : result);
    };
    reader.readAsDataURL(file);
  });
}

function LanguageSelect({ locale, onChange }: { locale: Locale; onChange: (locale: Locale) => void }) {
  return (
    <label className="language-select">
      <span>Language</span>
      <select aria-label="Language" value={locale} onChange={(event) => onChange(event.target.value as Locale)}>
        {locales.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}
      </select>
    </label>
  );
}

function ClientIntakeScreen({ params }: { params: { companyId: string; rentalId?: string; tenantId: string } }) {
  const draftKey = `fleetcore-client-intake:${params.tenantId}:${params.companyId}:${params.rentalId ?? "general"}`;
  const [form, setForm] = useState({
    address: "",
    birthDate: "",
    displayName: "",
    driverLicenseNumber: "",
    email: "",
    note: "",
    phone: "",
    pickupLocation: "",
    type: "individual" as Customer["type"],
  });
  const [files, setFiles] = useState<{ file: File; title: string; type: CustomerDocument["type"] }[]>([]);
  const [message, setMessage] = useState("Заполните данные и загрузите документы для аренды.");
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(draftKey);
    if (!saved) return;
    try {
      setForm((current) => ({ ...current, ...JSON.parse(saved) }));
      setMessage("Мы восстановили черновик заявки на этом телефоне.");
    } catch {
      localStorage.removeItem(draftKey);
    }
  }, [draftKey]);

  useEffect(() => {
    localStorage.setItem(draftKey, JSON.stringify(form));
  }, [draftKey, form]);

  const requiredDocuments = [
    { done: files.some((item) => item.title === "Фото клиента"), label: "Фото клиента" },
    { done: files.some((item) => item.type === "passport" || item.type === "id_card"), label: "Паспорт или ID" },
    { done: files.some((item) => item.type === "driver_license"), label: "Водительские права" },
  ];
  const completedFields = [
    form.displayName.trim(),
    form.phone.trim(),
    form.email.trim(),
    form.birthDate.trim(),
    form.driverLicenseNumber.trim(),
  ].filter(Boolean).length;
  const progress = Math.round(((completedFields + requiredDocuments.filter((item) => item.done).length) / 8) * 100);

  function intakeNote() {
    return [
      form.note ? `Комментарий: ${form.note}` : undefined,
      form.birthDate ? `Дата рождения: ${form.birthDate}` : undefined,
      form.address ? `Адрес проживания: ${form.address}` : undefined,
      form.driverLicenseNumber ? `Номер водительских прав: ${form.driverLicenseNumber}` : undefined,
      form.pickupLocation ? `Место выдачи/получения авто: ${form.pickupLocation}` : undefined,
    ].filter(Boolean).join("\n");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!requiredDocuments.every((item) => item.done)) {
      setMessage("Добавьте обязательные документы: фото клиента, паспорт/ID и водительские права.");
      return;
    }
    setSaving(true);
    setMessage("Отправляем заявку...");
    try {
      const payloadFiles = await Promise.all(files.map(async (item) => ({
        base64: await fileToBase64(item.file),
        documentType: item.type,
        mimeType: item.file.type || "application/octet-stream",
        originalName: item.file.name,
        title: item.title || item.file.name,
      })));
      const response = await fetch(`${API_URL}/operations/client-intake/public`, {
        body: JSON.stringify({
          companyId: params.companyId,
          customer: {
            displayName: form.displayName,
            email: form.email,
            phone: form.phone,
            type: form.type,
          },
          files: payloadFiles,
          note: intakeNote(),
          rentalId: params.rentalId,
          tenantId: params.tenantId,
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      if (!response.ok) throw new Error(await response.text());
      setMessage("Заявка отправлена. Компания получила ваши данные и документы.");
      setFiles([]);
      localStorage.removeItem(draftKey);
      setSubmitted(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось отправить заявку");
    } finally {
      setSaving(false);
    }
  }

  function addFiles(list: FileList | null, type: CustomerDocument["type"], title: string) {
    if (!list?.length) return;
    setFiles((current) => [
      ...current,
      ...Array.from(list).map((file) => ({ file, title, type })),
    ]);
  }

  function removeFile(indexToRemove: number) {
    setFiles((current) => current.filter((_, index) => index !== indexToRemove));
  }

  if (submitted) {
    return (
      <main className="client-intake-page">
        <section className="client-intake-card client-intake-success" data-testid="client-intake-success">
          <div className="client-intake-success-mark">✓</div>
          <span className="eyebrow">FleetCore</span>
          <h1>Заявка отправлена</h1>
          <p>Компания получила ваши данные и документы. Менеджер проверит заявку и свяжется с вами по телефону или email.</p>
          <button className="secondary-button full" type="button" onClick={() => window.close()}>Закрыть страницу</button>
        </section>
      </main>
    );
  }

  return (
    <main className="client-intake-page">
      <section className="client-intake-card" data-testid="client-intake-form">
        <div className="client-intake-hero">
          <span className="eyebrow">FleetCore</span>
          <h1>Заявка на аренду автомобиля</h1>
          <p>Заполните данные со своего телефона и загрузите документы. Компания получит заявку в своей системе.</p>
          <div className="client-intake-progress">
            <span style={{ width: `${progress}%` }} />
          </div>
          <strong>{progress}% готово</strong>
        </div>
        <div className="client-intake-steps" aria-label="Client intake checklist">
          <span className="done">1. Контакты</span>
          <span className={completedFields >= 5 ? "done" : ""}>2. Личные данные</span>
          <span className={requiredDocuments.every((item) => item.done) ? "done" : ""}>3. Документы</span>
        </div>
        <form onSubmit={submit}>
          <div className="form-grid">
            <label>Имя и фамилия<input required value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} /></label>
            <label>Телефон<input required value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label>
            <label>Email<input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
            <label>Дата рождения<input required type="date" value={form.birthDate} onChange={(event) => setForm({ ...form, birthDate: event.target.value })} /></label>
            <label>Номер водительских прав<input required value={form.driverLicenseNumber} onChange={(event) => setForm({ ...form, driverLicenseNumber: event.target.value })} /></label>
            <label>Место выдачи авто<input value={form.pickupLocation} onChange={(event) => setForm({ ...form, pickupLocation: event.target.value })} placeholder="Аэропорт, офис, адрес" /></label>
            <label>Тип клиента
              <select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as Customer["type"] })}>
                <option value="individual">Физическое лицо</option>
                <option value="business">Компания</option>
              </select>
            </label>
            <label>Адрес проживания<input value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} /></label>
            <label className="wide-field">Комментарий<textarea value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder="Дата аренды, место выдачи, пожелания" /></label>
          </div>

          <div className="client-intake-requirements">
            {requiredDocuments.map((item) => (
              <span key={item.label} className={item.done ? "done" : ""}>{item.done ? "✓" : "•"} {item.label}</span>
            ))}
          </div>

          <div className="client-intake-upload-grid">
            <label>Фото клиента<span>Селфи или фото лица</span><input accept="image/*" type="file" onChange={(event) => addFiles(event.currentTarget.files, "other", "Фото клиента")} /></label>
            <label>Паспорт<span>Фото или PDF основной страницы</span><input accept=".pdf,image/*" type="file" onChange={(event) => addFiles(event.currentTarget.files, "passport", "Паспорт")} /></label>
            <label>ID карта<span>Если паспорт не используется</span><input accept=".pdf,image/*" type="file" onChange={(event) => addFiles(event.currentTarget.files, "id_card", "ID карта")} /></label>
            <label>Водительские права<span>Лицевая/обратная сторона</span><input accept=".pdf,image/*" multiple type="file" onChange={(event) => addFiles(event.currentTarget.files, "driver_license", "Водительские права")} /></label>
          </div>

          <div className="client-intake-files">
            {files.map((item, index) => (
              <span key={`${item.file.name}-${index}`}>
                {item.title}: {item.file.name}
                <button aria-label={`Удалить ${item.file.name}`} type="button" onClick={() => removeFile(index)}>×</button>
              </span>
            ))}
            {!files.length ? <span>Файлы ещё не выбраны. Загрузите фото, паспорт/ID и водительские права.</span> : null}
          </div>

          <p className="client-intake-message">{message}</p>
          <button className="primary-button full" disabled={saving} type="submit">{saving ? "Отправляем..." : "Отправить заявку"}</button>
        </form>
      </section>
    </main>
  );
}

function AuthScreen({ initialMode = "login", locale, onLocaleChange, onSession }: { initialMode?: "login" | "register"; locale: Locale; onLocaleChange: (locale: Locale) => void; onSession: (session: AuthSession) => void }) {
  const t = (key: string) => translate(locale, key);
  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [apiReady, setApiReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(t("auth.message"));
  const [login, setLogin] = useState({ email: "", password: "" });
  const [register, setRegister] = useState({
    country: "PL",
    currency: "EUR",
    email: "",
    fleetSizeLimit: "25",
    fullName: "",
    legalName: "",
    password: "",
    passwordConfirm: "",
    plan: "starter",
    tradingName: "",
  });

  useEffect(() => {
    setMessage(t("auth.message"));
  }, [locale]);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    let active = true;
    setMessage("Подключаем FleetCore API...");
    warmApi().then((ready) => {
      if (!active) return;
      setApiReady(ready);
      setMessage(ready
        ? translate(locale, "auth.message")
        : "Сервер просыпается дольше обычного. Нажмите вход еще раз через несколько секунд.");
    });
    return () => {
      active = false;
    };
  }, [locale]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(apiReady ? (mode === "login" ? "Проверяем доступ..." : "Создаем компанию...") : "Будим сервер и проверяем доступ...");
    try {
      if (!apiReady) {
        setApiReady(await warmApi());
      }
      if (mode === "register" && register.password !== register.passwordConfirm) {
        throw new Error("Пароли не совпадают");
      }

      const response = mode === "login"
        ? await api<AuthSession>("/auth/login", {
            body: JSON.stringify({
              email: login.email.trim().toLowerCase(),
              password: login.password,
            }),
            method: "POST",
          })
        : await api<AuthSession>("/auth/register-company", {
            body: JSON.stringify({
              company: {
                country: register.country.trim().toUpperCase(),
                currency: register.currency.trim().toUpperCase(),
                fleetSizeLimit: Number(register.fleetSizeLimit),
                legalName: register.legalName.trim(),
                plan: register.plan,
                tradingName: register.tradingName.trim(),
              },
              owner: {
                email: register.email.trim().toLowerCase(),
                fullName: register.fullName.trim(),
                password: register.password,
              },
            }),
            method: "POST",
          });
      saveStoredSession(response.data);
      if (mode === "register") {
        localStorage.setItem(`fleetcore-onboarding-open:${response.data.companyId}`, "1");
      }
      setLoading(false);
      onSession(response.data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось войти");
      setLoading(false);
    }
  }

  async function loginDemo() {
    setLoading(true);
    setMessage(apiReady ? "Открываем демо-аккаунт..." : "Будим сервер и открываем демо-аккаунт...");
    try {
      if (!apiReady) {
        setApiReady(await warmApi());
      }
      const response = await api<AuthSession>("/auth/demo", {
        body: JSON.stringify({}),
        method: "POST",
      });
      saveStoredSession(response.data);
      setLoading(false);
      onSession(response.data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось открыть демо");
      setLoading(false);
    }
  }

  async function requestPasswordReset() {
    const email = login.email.trim().toLowerCase();
    if (!email) {
      setMessage(t("auth.email"));
      return;
    }
    setLoading(true);
    try {
      const response = await api<{ delivery: "development" | "email"; resetToken?: string }>("/auth/request-password-reset", {
        body: JSON.stringify({ email }),
        method: "POST",
      });
      setMessage(response.data.resetToken
        ? `Reset token: ${response.data.resetToken}`
        : "Password reset instructions were sent if the account exists.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Password reset failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div className="auth-header">
          <span className="auth-kicker">FleetCore SaaS</span>
          <h1>{mode === "login" ? t("auth.loginTitle") : t("auth.registerTitle")}</h1>
          <p>{message}</p>
          <div className={`api-ready-status ${apiReady ? "ready" : "warming"}`}>
            <span />
            {apiReady ? "API online" : "Connecting API"}
          </div>
        </div>
        <div className="auth-toolbar">
          <LanguageSelect locale={locale} onChange={onLocaleChange} />
          <button className="auth-demo-link" disabled={loading} onClick={() => void loginDemo()} type="button">{t("auth.choiceDemoTitle")}</button>
        </div>
        <div className="auth-tabs">
          <button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")} type="button">{t("auth.login")}</button>
          <button className={mode === "register" ? "active" : ""} onClick={() => setMode("register")} type="button">{t("auth.newCompany")}</button>
        </div>
        <form className="auth-form" onSubmit={(event) => void submit(event)}>
          {mode === "login" ? (
            <>
              <label>{t("auth.email")}<input autoComplete="email" inputMode="email" required type="email" value={login.email} onChange={(event) => setLogin({ ...login, email: event.target.value })} /></label>
              <label>{t("auth.password")}<input autoComplete="current-password" required type="password" value={login.password} onChange={(event) => setLogin({ ...login, password: event.target.value })} /></label>
            </>
          ) : (
            <>
              <label>{t("auth.businessName")}<input autoComplete="organization" required value={register.tradingName} onChange={(event) => setRegister({ ...register, tradingName: event.target.value })} /></label>
              <label>{t("auth.legalName")}<input autoComplete="organization" required value={register.legalName} onChange={(event) => setRegister({ ...register, legalName: event.target.value })} /></label>
              <div className="auth-two">
                <label>{t("auth.country")}<input maxLength={2} required value={register.country} onChange={(event) => setRegister({ ...register, country: event.target.value.toUpperCase().slice(0, 2) })} /></label>
                <label>{t("auth.currency")}<input maxLength={3} required value={register.currency} onChange={(event) => setRegister({ ...register, currency: event.target.value.toUpperCase().slice(0, 3) })} /></label>
              </div>
              <label>{t("auth.fleetLimit")}<input min="1" required type="number" value={register.fleetSizeLimit} onChange={(event) => setRegister({ ...register, fleetSizeLimit: event.target.value })} /></label>
              <label>{t("auth.ownerName")}<input autoComplete="name" required value={register.fullName} onChange={(event) => setRegister({ ...register, fullName: event.target.value })} /></label>
              <label>{t("auth.ownerEmail")}<input autoComplete="email" inputMode="email" required type="email" value={register.email} onChange={(event) => setRegister({ ...register, email: event.target.value })} /></label>
              <label>{t("auth.password")}<input autoComplete="new-password" minLength={8} required type="password" value={register.password} onChange={(event) => setRegister({ ...register, password: event.target.value })} /></label>
              <label>{t("auth.passwordConfirm")}<input autoComplete="new-password" minLength={8} required type="password" value={register.passwordConfirm} onChange={(event) => setRegister({ ...register, passwordConfirm: event.target.value })} /></label>
            </>
          )}
          <button className="primary-button full" disabled={loading} type="submit">{loading ? t("common.loading") : mode === "login" ? t("auth.login") : t("auth.register")}</button>
          {mode === "login" ? (
            <div className="auth-secondary-actions">
              <button className="ghost-button full-button" disabled={loading} onClick={() => void loginDemo()} type="button">{t("auth.demo")}</button>
              <button className="text-button" disabled={loading} onClick={() => void requestPasswordReset()} type="button">{t("auth.resetPassword")}</button>
            </div>
          ) : null}
        </form>
      </section>
      <section className="auth-preview">
        <div className="auth-preview-shell">
          <div className="auth-preview-topline">
            <span>FleetCore Business</span>
            <strong>€499 / month</strong>
          </div>
          <div className="auth-preview-hero">
            <span>Premium fleet operations</span>
            <h2>Один рабочий центр для аренды, документов, GPS и финансов.</h2>
            <p>{t("auth.previewText")}</p>
          </div>
          <div className="auth-preview-metrics">
            <article><span>Fleet</span><strong>36</strong><small>vehicles</small></article>
            <article><span>Revenue</span><strong>€42k</strong><small>month</small></article>
            <article><span>Returns</span><strong>8</strong><small>today</small></article>
          </div>
          <div className="auth-preview-flow">
            <article className="done"><span>1</span><div><strong>Booking</strong><small>BMW X5 reserved</small></div></article>
            <article className="done"><span>2</span><div><strong>Contract</strong><small>PDF sent to client</small></div></article>
            <article><span>3</span><div><strong>Deposit</strong><small>€500 held</small></div></article>
            <article><span>4</span><div><strong>Return</strong><small>final settlement</small></div></article>
          </div>
        </div>
      </section>
    </main>
  );
}

export default function DashboardClient() {
  const [locale, setLocale] = useState<Locale>("ru");
  const [clientIntakeParams, setClientIntakeParams] = useState<{ companyId: string; rentalId?: string; tenantId: string } | undefined>();
  const [session, setSession] = useState<AuthSession | undefined>();
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [activeSection, setActiveSection] = useState<Section>("Dashboard");
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [aiSearch, setAiSearch] = useState<AiSearchResponse | undefined>();
  const [aiSearchLoading, setAiSearchLoading] = useState(false);
  const [aiSearchError, setAiSearchError] = useState("");
  const [voiceListening, setVoiceListening] = useState(false);
  const speechRecognitionRef = useRef<BrowserSpeechRecognition | undefined>(undefined);
  const [mapFilter, setMapFilter] = useState<"all" | "available" | "rented" | "maintenance" | "offline">("all");
  const [vehicleSort, setVehicleSort] = useState<VehicleSortKey>("status");
  const [customerSort, setCustomerSort] = useState<CustomerSortKey>("name");
  const [selectedFleetIds, setSelectedFleetIds] = useState<string[]>([]);
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | undefined>();
  const [selectedRentalId, setSelectedRentalId] = useState<string | undefined>();
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [busyAction, setBusyAction] = useState<string | undefined>();
  const [operation, setOperation] = useState<OperationKind | undefined>();
  const [documentPreview, setDocumentPreview] = useState<DocumentPreview | undefined>();
  const [profileOpen, setProfileOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [clientIntakeDialogOpen, setClientIntakeDialogOpen] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [createSheetOpen, setCreateSheetOpen] = useState(false);
  const [rentalWizardOpen, setRentalWizardOpen] = useState(false);
  const [rentalWorkflowOpen, setRentalWorkflowOpen] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState("");
  const [profileName, setProfileName] = useState("");
  const [teamForm, setTeamForm] = useState({
    email: `manager-${Date.now().toString().slice(-5)}@example.com`,
    fullName: "Fleet Manager",
    password: "manager-pass-123",
    role: "manager" as Exclude<UserRole, "owner">,
  });
  const [operationForm, setOperationForm] = useState(defaultOperationForm);
  const [operationFiles, setOperationFiles] = useState<FileList | null>(null);
  const vehicleDocumentInputRef = useRef<HTMLInputElement>(null);
  const vehicleFolderInputRef = useRef<HTMLInputElement>(null);
  const vehiclePhotoInputRef = useRef<HTMLInputElement>(null);
  const companyLogoInputRef = useRef<HTMLInputElement>(null);
  const customerDocumentInputRef = useRef<HTMLInputElement>(null);
  const customerFolderInputRef = useRef<HTMLInputElement>(null);
  const contractInputRef = useRef<HTMLInputElement>(null);
  const depositInputRef = useRef<HTMLInputElement>(null);
  const signatureInputRef = useRef<HTMLInputElement>(null);
  const vehicleCreateRef = useRef<HTMLFormElement>(null);
  const customerCreateRef = useRef<HTMLFormElement>(null);
  const [data, setData] = useState<AppData>({
    company: undefined,
    customers: [],
    documents: [],
    files: [],
    gpsDevices: [],
    invoices: [],
    metrics: emptyMetrics,
    payments: [],
    rentals: [],
    customerDocuments: [],
    expenses: [],
    rentalChecklists: [],
    rentalContracts: [],
    rentalContractEvents: [],
    rentalFlows: [],
    serviceRecords: [],
    teamUsers: [],
    vehicles: [],
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("clientIntake") !== "1") return;
    const companyId = params.get("companyId");
    const tenantId = params.get("tenantId");
    if (companyId && tenantId) {
      const rentalId = params.get("rentalId");
      setClientIntakeParams({ companyId, tenantId, ...(rentalId ? { rentalId } : {}) });
    }
  }, []);
  const [vehicleForm, setVehicleForm] = useState({
    dailyRate: "90",
    location: "Warsaw",
    make: "BMW",
    model: "X5",
    odometerKm: "1000",
    plateNumber: `WA-${Date.now().toString().slice(-5)}`,
    vin: `VIN${Date.now().toString().slice(-10)}`,
    year: "2024",
  });
  const [customerForm, setCustomerForm] = useState({
    displayName: "Новый клиент",
    email: `client-${Date.now().toString().slice(-5)}@example.com`,
    phone: "+48 600 111 222",
    vehicleId: "",
  });
  const [companyForm, setCompanyForm] = useState({
    billingEmail: "",
    brandColor: "#2346d8",
    businessAddress: "",
    contractFooter: "",
    iban: "",
    legalName: "",
    logoUrl: "",
    taxId: "",
    tradingName: "",
  });

  const token = session?.accessToken;
  const t = (key: string) => translate(locale, key);

  function closeTransientSurfaces() {
    setCreateSheetOpen(false);
    setMobileDrawerOpen(false);
    setSearchOpen(false);
    setShareDialogOpen(false);
    setClientIntakeDialogOpen(false);
    setRentalWorkflowOpen(false);
  }

  function selectSection(section: Section) {
    closeTransientSurfaces();
    setActiveSection(section);
  }

  function openCreateSheet() {
    setMobileDrawerOpen(false);
    setProfileOpen(false);
    setCreateSheetOpen(true);
  }

  function openRentalWorkflow() {
    closeTransientSurfaces();
    setProfileOpen(false);
    setOperation(undefined);
    setRentalWizardOpen(false);
    setRentalWorkflowOpen(true);
  }

  function openProfileDialog() {
    setCreateSheetOpen(false);
    setMobileDrawerOpen(false);
    setShareDialogOpen(false);
    setClientIntakeDialogOpen(false);
    setRentalWorkflowOpen(false);
    setProfileOpen(true);
  }

  useEffect(() => {
    const stored = localStorage.getItem("fleetcore-session");
    if (stored) {
      try {
        setSession(JSON.parse(stored) as AuthSession);
      } catch {
        localStorage.removeItem("fleetcore-session");
      }
    }
    const storedLocale = localStorage.getItem("fleetcore-locale");
    if (storedLocale && locales.some((item) => item.code === storedLocale)) {
      setLocale(storedLocale as Locale);
    }
    const storedVehicleSort = localStorage.getItem("fleetcore-vehicle-sort") as VehicleSortKey | null;
    if (storedVehicleSort && ["status", "plate", "return", "roi"].includes(storedVehicleSort)) {
      setVehicleSort(storedVehicleSort);
    }
    const storedCustomerSort = localStorage.getItem("fleetcore-customer-sort") as CustomerSortKey | null;
    if (storedCustomerSort && ["name", "risk", "debt", "rentals"].includes(storedCustomerSort)) {
      setCustomerSort(storedCustomerSort);
    }
  }, []);

  useEffect(() => {
    if (!session?.user.id) return;
    setProfileName(session.user.fullName);
    setProfilePhoto(session.user.photoUrl ?? localStorage.getItem(`fleetcore-profile-photo:${session.user.id}`) ?? "");
  }, [session?.user.fullName, session?.user.id, session?.user.photoUrl]);

  function changeLocale(nextLocale: Locale) {
    setLocale(nextLocale);
    localStorage.setItem("fleetcore-locale", nextLocale);
  }

  function changeVehicleSort(nextSort: VehicleSortKey) {
    setVehicleSort(nextSort);
    localStorage.setItem("fleetcore-vehicle-sort", nextSort);
  }

  function changeCustomerSort(nextSort: CustomerSortKey) {
    setCustomerSort(nextSort);
    localStorage.setItem("fleetcore-customer-sort", nextSort);
  }

  async function loadData(currentToken = token) {
    setLoading(true);
    try {
      const canManageTeam = session?.user.role === "owner";
      const [company, metrics, vehicles, customers, rentals, invoices, payments, gpsDevices, documents, files, expenses, serviceRecords, customerDocuments, rentalContracts, rentalContractEvents, rentalChecklists, teamUsers] = await Promise.all([
        api<Company>(`/companies/${session?.companyId ?? ""}`, {}, currentToken),
        api<DashboardMetrics>("/dashboard", {}, currentToken),
        api<Vehicle[]>("/fleet/vehicles", {}, currentToken),
        api<Customer[]>("/customers", {}, currentToken),
        api<Rental[]>("/rentals", {}, currentToken),
        api<Invoice[]>("/finance/invoices", {}, currentToken),
        api<Payment[]>("/finance/payments", {}, currentToken),
        api<GpsDevice[]>("/gps/devices", {}, currentToken),
        api<VehicleDocument[]>("/documents/vehicles", {}, currentToken),
        api<FileObject[]>("/uploads", {}, currentToken),
        api<Expense[]>("/operations/expenses", {}, currentToken),
        api<ServiceRecord[]>("/operations/service-records", {}, currentToken),
        api<CustomerDocument[]>("/operations/customer-documents", {}, currentToken),
        api<RentalContract[]>("/operations/rental-contracts", {}, currentToken),
        api<RentalContractEvent[]>("/operations/rental-contract-events", {}, currentToken),
        api<RentalChecklist[]>("/operations/rental-checklists", {}, currentToken),
        canManageTeam ? api<User[]>("/auth/team", {}, currentToken) : Promise.resolve({ data: session?.user ? [session.user] : [] }),
      ]);

      const rentalFlows = await Promise.all(rentals.data.map((rental) => api<RentalFlow>(`/rentals/${rental.id}/flow`, {}, currentToken)));

      setData({
        company: company.data,
        customers: customers.data,
        documents: documents.data,
        files: files.data,
        gpsDevices: gpsDevices.data,
        invoices: invoices.data,
        metrics: metrics.data,
        payments: payments.data,
        rentals: rentals.data,
        customerDocuments: customerDocuments.data,
        expenses: expenses.data,
        rentalChecklists: rentalChecklists.data,
        rentalContracts: rentalContracts.data,
        rentalContractEvents: rentalContractEvents.data,
        rentalFlows: rentalFlows.map((flow) => flow.data),
        serviceRecords: serviceRecords.data,
        teamUsers: teamUsers.data,
        vehicles: vehicles.data,
      });
      setCompanyForm({
        billingEmail: company.data.billingEmail ?? "",
        brandColor: company.data.brandColor ?? "#2346d8",
        businessAddress: company.data.businessAddress ?? "",
        contractFooter: company.data.contractFooter ?? "",
        iban: company.data.iban ?? "",
        legalName: company.data.legalName,
        logoUrl: company.data.logoUrl ?? "",
        taxId: company.data.taxId ?? "",
        tradingName: company.data.tradingName,
      });
      if (session && localStorage.getItem(`fleetcore-onboarding-open:${session.companyId}`) === "1") {
        setOnboardingOpen(true);
      }
      setSelectedVehicleId((current) => current ?? vehicles.data[0]?.id);
      setMessage("");
    } catch (error) {
      if (error instanceof ApiRequestError && (error.status === 401 || error.status === 403)) {
        void logout();
        return;
      }
      setMessage(error instanceof Error ? error.message : "Не удалось загрузить данные");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!session?.accessToken) return;
    closeTransientSurfaces();
    setProfileOpen(false);
    setOperation(undefined);
    setDocumentPreview(undefined);
    setRentalWizardOpen(false);
    setRentalWorkflowOpen(false);
    loadData().catch((error: unknown) => {
      setLoading(false);
      setMessage(error instanceof Error ? error.message : "Не удалось загрузить данные");
    });
  }, [session?.accessToken]);

  useEffect(() => {
    setCreateSheetOpen(false);
    setMobileDrawerOpen(false);
    setSearchOpen(false);
  }, [activeSection]);

  const visibleVehicles = useMemo(() => {
    if (session?.companyId !== "company_atlas") return data.vehicles;
    return data.vehicles.filter((vehicle) => !isDemoNoiseVehicle(vehicle));
  }, [data.vehicles, session?.companyId]);
  const visibleVehicleIds = useMemo(() => new Set(visibleVehicles.map((vehicle) => vehicle.id)), [visibleVehicles]);
  const visibleRentals = useMemo(() => data.rentals.filter((rental) => visibleVehicleIds.has(rental.vehicleId)), [data.rentals, visibleVehicleIds]);

  const selectedVehicle = visibleVehicles.find((vehicle) => vehicle.id === selectedVehicleId) ?? visibleVehicles[0] ?? data.vehicles[0];
  const activeRental = visibleRentals.find((rental) => rental.vehicleId === selectedVehicle?.id && rental.status !== "closed");
  const selectedCustomer = data.customers.find((customer) => customer.id === selectedCustomerId)
    ?? data.customers.find((customer) => customer.id === activeRental?.customerId)
    ?? data.customers[0];
  const activeCustomer = selectedCustomer;
  const activeInvoice = data.invoices.find((invoice) => invoice.status !== "paid") ?? data.invoices[0];
  const activeRentalFlow = data.rentalFlows.find((flow) => flow.rental.id === activeRental?.id)
    ?? data.rentalFlows.find((flow) => visibleVehicleIds.has(flow.rental.vehicleId) && flow.rental.status !== "closed")
    ?? data.rentalFlows[0];

  const globalSearchResults = useMemo<GlobalSearchResult[]>(() => {
    const query = search.trim().toLowerCase();
    if (query.length < 2) return [];
    const compactQuery = query.replace(/\s+/g, "");
    const matches = (...values: Array<string | number | undefined>) => values
      .filter((value): value is string | number => value !== undefined && value !== null)
      .some((value) => {
        const normalized = String(value).toLowerCase();
        return normalized.includes(query) || normalized.replace(/\s+/g, "").includes(compactQuery);
      });

    const vehicleResults = visibleVehicles
      .filter((vehicle) => matches(vehicle.plateNumber, vehicle.vin, vehicle.make, vehicle.model, vehicle.location, vehicle.year))
      .slice(0, 5)
      .map<GlobalSearchResult>((vehicle) => ({
        id: `vehicle-${vehicle.id}`,
        kind: "vehicle",
        label: `${vehicle.make} ${vehicle.model}`,
        meta: `${vehicle.plateNumber} · VIN ${vehicle.vin} · ${vehicle.status}`,
        section: "Vehicles",
        vehicleId: vehicle.id,
      }));

    const customerResults = data.customers
      .filter((customer) => matches(customer.displayName, customer.phone, customer.email, customer.type, customer.riskLevel))
      .slice(0, 5)
      .map<GlobalSearchResult>((customer) => ({
        customerId: customer.id,
        id: `customer-${customer.id}`,
        kind: "customer",
        label: customer.displayName,
        meta: `${customer.phone} · ${customer.email}`,
        section: "Drivers/Clients",
      }));

    const rentalResults = visibleRentals
      .map((rental) => ({
        customer: data.customers.find((customer) => customer.id === rental.customerId),
        invoice: data.invoices.find((invoice) => invoice.rentalId === rental.id),
        rental,
        vehicle: visibleVehicles.find((vehicle) => vehicle.id === rental.vehicleId),
      }))
      .filter(({ customer, invoice, rental, vehicle }) => matches(
        rental.id,
        rental.status,
        rental.totalAmount,
        rental.depositAmount,
        rental.pickupAt,
        rental.returnAt,
        invoice?.status,
        invoice?.total,
        vehicle?.plateNumber,
        vehicle?.vin,
        vehicle?.make,
        vehicle?.model,
        customer?.displayName,
        customer?.phone,
        customer?.email,
      ))
      .slice(0, 6)
      .map<GlobalSearchResult>(({ customer, invoice, rental, vehicle }) => ({
        ...(customer?.id ? { customerId: customer.id } : {}),
        ...(vehicle?.id ? { vehicleId: vehicle.id } : {}),
        id: `rental-${rental.id}`,
        kind: "rental",
        label: `${customer?.displayName ?? "Клиент"} · ${vehicle?.plateNumber ?? "без номера"}`,
        meta: `${rental.id} · ${vehicle?.make ?? "Авто"} ${vehicle?.model ?? ""} · ${rental.status} · ${money.format(rental.totalAmount)} · депозит ${money.format(rental.depositAmount)} · ${invoice?.status ?? "invoice pending"} · возврат ${dateFmt.format(new Date(rental.returnAt))}`,
        rentalId: rental.id,
        section: "Bookings",
      }));

    const vehicleDocumentResults = data.documents
      .map((doc) => ({
        doc,
        vehicle: visibleVehicles.find((vehicle) => vehicle.id === doc.vehicleId),
      }))
      .filter(({ doc, vehicle }) => matches(doc.title, doc.type, vehicle?.plateNumber, vehicle?.vin, vehicle?.make, vehicle?.model))
      .slice(0, 4)
      .map<GlobalSearchResult>(({ doc, vehicle }) => ({
        ...(vehicle?.id ? { vehicleId: vehicle.id } : {}),
        id: `vehicle-document-${doc.id}`,
        kind: "document",
        label: doc.title,
        meta: `${vehicle?.plateNumber ?? "Авто"} · ${doc.type}${doc.expiresAt ? ` · до ${dateFmt.format(new Date(doc.expiresAt))}` : ""}`,
        preview: { fileUrl: doc.fileUrl, title: doc.title, meta: doc.type },
        section: "Service",
      }));

    const customerDocumentResults = data.customerDocuments
      .map((doc) => ({
        customer: data.customers.find((customer) => customer.id === doc.customerId),
        doc,
      }))
      .filter(({ customer, doc }) => matches(doc.title, doc.type, customer?.displayName, customer?.phone, customer?.email))
      .slice(0, 4)
      .map<GlobalSearchResult>(({ customer, doc }) => ({
        ...(customer?.id ? { customerId: customer.id } : {}),
        id: `customer-document-${doc.id}`,
        kind: "document",
        label: doc.title,
        meta: `${customer?.displayName ?? "Клиент"} · ${doc.type}`,
        preview: { fileUrl: doc.fileUrl, title: doc.title, meta: doc.type },
        section: "Service",
      }));

    return [...rentalResults, ...vehicleResults, ...customerResults, ...vehicleDocumentResults, ...customerDocumentResults].slice(0, 12);
  }, [data.customerDocuments, data.customers, data.documents, data.invoices, money, search, visibleRentals, visibleVehicles]);

  const searchResults = useMemo<GlobalSearchResult[]>(() => {
    const aiResults = aiSearch?.query === search.trim() ? aiSearch.results : [];
    const existingIds = new Set(aiResults.map((result) => result.id));
    return [...aiResults, ...globalSearchResults.filter((result) => !existingIds.has(result.id))].slice(0, 12);
  }, [aiSearch, globalSearchResults, search]);

  async function runAiSearch(query = search) {
    const normalizedQuery = query.trim();
    if (normalizedQuery.length < 2) {
      setAiSearchError("Введите минимум 2 символа для AI-поиска.");
      setSearchOpen(true);
      return;
    }
    setAiSearchLoading(true);
    setAiSearchError("");
    try {
      const response = await api<AiSearchResponse>(
        "/ai/search",
        {
          body: JSON.stringify({ query: normalizedQuery }),
          method: "POST",
        },
        session?.accessToken,
      );
      setAiSearch(response.data);
      setSearch(normalizedQuery);
      setSearchOpen(true);
    } catch (error) {
      setAiSearchError(error instanceof Error ? error.message : "AI-поиск временно недоступен.");
      setSearchOpen(true);
    } finally {
      setAiSearchLoading(false);
    }
  }

  function startVoiceSearch() {
    if (typeof window === "undefined") return;
    const SpeechRecognition = (
      (window as Window & { SpeechRecognition?: BrowserSpeechRecognitionConstructor; webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor }).SpeechRecognition
      ?? (window as Window & { SpeechRecognition?: BrowserSpeechRecognitionConstructor; webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor }).webkitSpeechRecognition
    );
    if (!SpeechRecognition) {
      setAiSearchError("Голосовой ввод не поддерживается этим браузером. Введите запрос текстом.");
      setSearchOpen(true);
      return;
    }

    speechRecognitionRef.current?.stop();
    const recognition = new SpeechRecognition();
    recognition.lang = locale === "ru" ? "ru-RU" : locale === "es" ? "es-ES" : locale === "fr" ? "fr-FR" : locale === "de" ? "de-DE" : "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim() ?? "";
      if (transcript) {
        setSearch(transcript);
        setSearchOpen(true);
        void runAiSearch(transcript);
      }
    };
    recognition.onerror = () => {
      setVoiceListening(false);
      setAiSearchError("Не удалось распознать голос. Попробуйте ещё раз или введите текст.");
      setSearchOpen(true);
    };
    recognition.onend = () => setVoiceListening(false);
    speechRecognitionRef.current = recognition;
    setVoiceListening(true);
    recognition.start();
  }

  function openSearchResult(result: GlobalSearchResult) {
    if (result.vehicleId) {
      setSelectedVehicleId(result.vehicleId);
    }
    if (result.rentalId) {
      setSelectedRentalId(result.rentalId);
    }
    if (result.customerId) {
      setSelectedCustomerId(result.customerId);
    }
    if (result.kind === "vehicle" && result.vehicleId) {
      const vehicle = data.vehicles.find((item) => item.id === result.vehicleId);
      setSearch(vehicle?.plateNumber ?? result.label);
    } else if (result.kind === "customer" && result.customerId) {
      const customer = data.customers.find((item) => item.id === result.customerId);
      setSearch(customer?.displayName ?? result.label);
    } else {
      setSearch(result.label);
    }
    selectSection(result.section);
    setSearchOpen(false);
    if (result.preview) {
      setDocumentPreview(result.preview);
    }
  }

  const filteredVehicles = useMemo(() => {
    const query = search.trim().toLowerCase();
    return visibleVehicles.filter((vehicle) => {
      const rental = visibleRentals.find((item) => item.vehicleId === vehicle.id && item.status !== "closed");
      const customer = data.customers.find((item) => item.id === rental?.customerId);
      const matchesFilter = mapFilter === "all" || vehicle.status === mapFilter;
      const matchesSearch = !query || [
        vehicle.plateNumber,
        vehicle.vin,
        vehicle.make,
        vehicle.model,
        customer?.displayName,
        customer?.phone,
      ].filter(Boolean).some((value) => value!.toLowerCase().includes(query));
      return matchesFilter && matchesSearch;
    });
  }, [data.customers, mapFilter, search, visibleRentals, visibleVehicles]);

  const incomeToday = useMemo(() => data.payments
    .filter((payment) => new Date(payment.paidAt).toDateString() === new Date().toDateString())
    .reduce((sum, payment) => sum + payment.amount, 0), [data.payments]);

  const finance = useMemo(() => {
    const incomeByVehicle = visibleVehicles.map((vehicle) => {
      const rentalIds = visibleRentals.filter((rental) => rental.vehicleId === vehicle.id).map((rental) => rental.id);
      const income = data.invoices.filter((invoice) => invoice.rentalId && rentalIds.includes(invoice.rentalId)).reduce((sum, invoice) => sum + invoice.total, 0);
      const expenses = data.expenses.filter((expense) => expense.vehicleId === vehicle.id).reduce((sum, expense) => sum + expense.amount, 0);
      return { expenses, income, roi: expenses ? Math.round(((income - expenses) / expenses) * 100) : 0, vehicle };
    });
    const totalIncome = incomeByVehicle.reduce((sum, item) => sum + item.income, 0);
    const expenses = incomeByVehicle.reduce((sum, item) => sum + item.expenses, 0);
    return { expenses, incomeByVehicle, netProfit: totalIncome - expenses, totalIncome };
  }, [data.expenses, data.invoices, visibleRentals, visibleVehicles]);
  const totalDeposits = visibleRentals.reduce((sum, rental) => sum + rental.depositAmount, 0);
  const overdueInvoices = data.invoices.filter((invoice) => invoice.status === "overdue");

  const sortedVehicles = useMemo(() => {
    const returnTime = (vehicle: Vehicle) => {
      const rental = visibleRentals.find((item) => item.vehicleId === vehicle.id && item.status !== "closed");
      return rental ? new Date(rental.returnAt).getTime() : Number.MAX_SAFE_INTEGER;
    };
    const roi = (vehicle: Vehicle) => finance.incomeByVehicle.find((item) => item.vehicle.id === vehicle.id)?.roi ?? 0;
    return [...filteredVehicles].sort((left, right) => {
      if (vehicleSort === "plate") return left.plateNumber.localeCompare(right.plateNumber);
      if (vehicleSort === "return") return returnTime(left) - returnTime(right);
      if (vehicleSort === "roi") return roi(right) - roi(left);
      return `${left.status}-${left.plateNumber}`.localeCompare(`${right.status}-${right.plateNumber}`);
    });
  }, [filteredVehicles, finance.incomeByVehicle, vehicleSort, visibleRentals]);

  const filteredCustomers = useMemo(() => {
    const query = search.trim().toLowerCase();
    const customerDebt = (customer: Customer) => {
      const rentalIds = visibleRentals.filter((rental) => rental.customerId === customer.id).map((rental) => rental.id);
      return data.invoices
        .filter((invoice) => invoice.customerId === customer.id || (invoice.rentalId ? rentalIds.includes(invoice.rentalId) : false))
        .filter((invoice) => invoice.status !== "paid")
        .reduce((sum, invoice) => sum + invoice.total, 0);
    };
    const rentalCount = (customer: Customer) => visibleRentals.filter((rental) => rental.customerId === customer.id).length;
    return data.customers
      .filter((customer) => !query || `${customer.displayName} ${customer.phone} ${customer.email}`.toLowerCase().includes(query))
      .sort((left, right) => {
        if (customerSort === "risk") return left.riskLevel.localeCompare(right.riskLevel) || left.displayName.localeCompare(right.displayName);
        if (customerSort === "debt") return customerDebt(right) - customerDebt(left);
        if (customerSort === "rentals") return rentalCount(right) - rentalCount(left);
        return left.displayName.localeCompare(right.displayName);
      });
  }, [customerSort, data.customers, data.invoices, search, visibleRentals]);

  const selectedVehiclesForBulk = sortedVehicles.filter((vehicle) => selectedFleetIds.includes(vehicle.id));
  const selectedCustomersForBulk = filteredCustomers.filter((customer) => selectedClientIds.includes(customer.id));

  const vehicleSortViews: Array<SavedView<VehicleSortKey>> = [
    { label: "Status", value: "status" },
    { label: "Plate", value: "plate" },
    { label: "Return date", value: "return" },
    { label: "ROI", value: "roi" },
  ];
  const customerSortViews: Array<SavedView<CustomerSortKey>> = [
    { label: "Name", value: "name" },
    { label: "Risk", value: "risk" },
    { label: "Debt", value: "debt" },
    { label: "Rentals", value: "rentals" },
  ];

  function exportVehiclesCsv(vehicles: Vehicle[]) {
    downloadCsv("fleetcore-vehicles.csv", [
      ["Make", "Model", "Plate", "VIN", "Status", "Odometer", "Location", "Daily rate", "ROI"],
      ...vehicles.map((vehicle) => {
        const roi = finance.incomeByVehicle.find((item) => item.vehicle.id === vehicle.id)?.roi ?? 0;
        return [vehicle.make, vehicle.model, vehicle.plateNumber, vehicle.vin, vehicle.status, String(vehicle.odometerKm), vehicle.location, String(vehicle.dailyRate), `${roi}%`];
      }),
    ]);
    setMessage(`${vehicles.length} автомобилей экспортировано в CSV`);
  }

  function exportCustomersCsv(customers: Customer[]) {
    downloadCsv("fleetcore-customers.csv", [
      ["Name", "Email", "Phone", "Type", "Risk", "Rentals"],
      ...customers.map((customer) => [
        customer.displayName,
        customer.email,
        customer.phone,
        customer.type,
        customer.riskLevel,
        String(visibleRentals.filter((rental) => rental.customerId === customer.id).length),
      ]),
    ]);
    setMessage(`${customers.length} клиентов экспортировано в CSV`);
  }

  const notifications = useMemo<UiNotification[]>(() => {
    const now = Date.now();
    const dueRentals = visibleRentals
      .filter((rental) => rental.status !== "closed" && new Date(rental.returnAt).getTime() < now)
      .map((rental) => {
        const vehicle = visibleVehicles.find((item) => item.id === rental.vehicleId);
        return { id: `rental-${rental.id}`, meta: vehicle?.plateNumber ?? sectionLabel(locale, "Vehicles"), time: t("time.now"), title: t("status.returnDue"), tone: "red" as const };
      });
    const paymentAlerts = data.invoices
      .filter((invoice) => invoice.status === "overdue")
      .map((invoice) => ({ id: `invoice-${invoice.id}`, meta: invoice.invoiceNumber, time: dateFmt.format(new Date(invoice.dueAt)), title: t("status.overdue"), tone: "red" as const }));
    const docAlerts = data.documents
      .filter((doc) => doc.expiresAt && new Date(doc.expiresAt).getTime() < now + 30 * 24 * 60 * 60 * 1000)
      .map((doc) => ({ id: `doc-${doc.id}`, meta: doc.title, time: doc.expiresAt ? dateFmt.format(new Date(doc.expiresAt)) : "-", title: t("settings.documents"), tone: "orange" as const }));
    const serviceAlerts = visibleVehicles
      .filter((vehicle) => vehicle.odometerKm > 40_000)
      .map((vehicle) => ({ id: `service-${vehicle.id}`, meta: vehicle.plateNumber, time: `${vehicle.odometerKm.toLocaleString()} км`, title: t("vehicle.serviceCreate"), tone: "blue" as const }));
    return [...dueRentals, ...paymentAlerts, ...docAlerts, ...serviceAlerts].slice(0, 8);
  }, [data.documents, data.invoices, locale, visibleRentals, visibleVehicles]);

  const dashboardCards = [
    [t("dashboard.totalVehicles"), visibleVehicles.length, "blue"],
    [t("dashboard.available"), visibleVehicles.filter((vehicle) => vehicle.status === "available").length, "green"],
    [t("dashboard.activeRentals"), visibleVehicles.filter((vehicle) => vehicle.status === "rented").length, "blue"],
    [t("dashboard.overdue"), visibleVehicles.filter((vehicle) => vehicle.status === "maintenance").length, "black"],
    [t("dashboard.monthlyRevenue"), money.format(data.metrics.monthlyRevenue), "green"],
    [t("dashboard.todayRevenue"), money.format(incomeToday), "green"],
  ] as const;
  const workflowStats = [
    { label: t("command.returns"), value: visibleRentals.filter((rental) => rental.status === "return_due").length, tone: "orange" },
    { label: t("command.overdue"), value: notifications.filter((item) => item.tone === "red").length, tone: "red" },
    { label: t("command.documents"), value: data.documents.length + data.customerDocuments.length, tone: "blue" },
    { label: t("command.contracts"), value: data.rentalContracts.length, tone: "green" },
  ];

  const operations = useMemo(() => {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const activeRentals = visibleRentals.filter((rental) => rental.status !== "closed");
    const dueToday = activeRentals.filter((rental) => Math.abs(new Date(rental.returnAt).getTime() - now) < dayMs);
    const overdueRentals = activeRentals.filter((rental) => new Date(rental.returnAt).getTime() < now);
    const unpaidInvoices = data.invoices.filter((invoice) => invoice.status === "issued" || invoice.status === "overdue");
    const expiringDocs = data.documents.filter((doc) => doc.expiresAt && new Date(doc.expiresAt).getTime() < now + 30 * dayMs);
    const offlineGps = data.gpsDevices.filter((device) => device.status === "offline" || now - new Date(device.lastSignalAt).getTime() > 2 * 60 * 60 * 1000);
    const missingVehicleDocs = visibleVehicles.filter((vehicle) => !data.documents.some((doc) => doc.vehicleId === vehicle.id));
    const serviceDue = visibleVehicles.filter((vehicle) => vehicle.odometerKm >= 40_000 || data.serviceRecords.some((record) => record.vehicleId === vehicle.id && record.status !== "completed"));
    const openContracts = data.rentalContracts.filter((contract) => contract.status !== "signed");
    const issues: OperationsIssue[] = [
      ...overdueRentals.slice(0, 3).map<OperationsIssue>((rental) => {
        const vehicle = visibleVehicles.find((item) => item.id === rental.vehicleId);
        const customer = data.customers.find((item) => item.id === rental.customerId);
        return {
          action: () => {
            setSelectedRentalId(rental.id);
            setSelectedVehicleId(rental.vehicleId);
            selectSection("Bookings");
          },
          label: "Просрочен возврат",
          meta: `${vehicle?.plateNumber ?? "Авто"} · ${customer?.displayName ?? "Клиент"} · ${dateFmt.format(new Date(rental.returnAt))}`,
          tone: "red",
        };
      }),
      ...unpaidInvoices.slice(0, 3).map<OperationsIssue>((invoice) => ({
        action: () => {
          selectSection("Finance");
          openOperation("payment");
        },
        label: invoice.status === "overdue" ? "Просрочен платеж" : "Ожидает оплаты",
        meta: `${invoice.invoiceNumber} · ${money.format(invoice.total)} · ${dateFmt.format(new Date(invoice.dueAt))}`,
        tone: invoice.status === "overdue" ? "red" : "orange",
      })),
      ...expiringDocs.slice(0, 2).map<OperationsIssue>((doc) => ({
        action: () => {
          setSelectedVehicleId(doc.vehicleId);
          selectSection("Service");
        },
        label: "Срок документа",
        meta: `${doc.title} · ${doc.expiresAt ? dateFmt.format(new Date(doc.expiresAt)) : "без срока"}`,
        tone: "orange",
      })),
      ...offlineGps.slice(0, 2).map<OperationsIssue>((device) => {
        const vehicle = visibleVehicles.find((item) => item.id === device.vehicleId);
        return {
          action: () => {
            setSelectedVehicleId(device.vehicleId);
            selectSection("GPS");
          },
          label: "GPS без сигнала",
          meta: `${vehicle?.plateNumber ?? "Авто"} · ${device.provider} · ${dateFmt.format(new Date(device.lastSignalAt))}`,
          tone: "black",
        };
      }),
    ].slice(0, 8);

    return {
      activeRentals,
      dueToday,
      expiringDocs,
      issues,
      missingVehicleDocs,
      offlineGps,
      openContracts,
      overdueRentals,
      serviceDue,
      unpaidInvoices,
    };
  }, [data.customers, data.documents, data.gpsDevices, data.invoices, data.rentalContracts, data.serviceRecords, visibleRentals, visibleVehicles]);

  const selectedRental = visibleRentals.find((rental) => rental.id === selectedRentalId)
    ?? visibleRentals.find((rental) => rental.id === activeRental?.id)
    ?? visibleRentals.find((rental) => rental.status !== "closed")
    ?? visibleRentals[0]
    ?? data.rentals[0];
  const selectedRentalDetail = useMemo<RentalDetailContext | undefined>(() => {
    if (!selectedRental) return undefined;
    const contract = data.rentalContracts.find((item) => item.rentalId === selectedRental.id);
    const invoice = data.invoices.find((item) => item.rentalId === selectedRental.id);
    const paidAmount = invoice ? data.payments.filter((payment) => payment.invoiceId === invoice.id).reduce((sum, payment) => sum + payment.amount, 0) : 0;
    return {
      checklists: data.rentalChecklists.filter((item) => item.rentalId === selectedRental.id),
      contract,
      contractEvents: contract ? data.rentalContractEvents.filter((event) => event.contractId === contract.id) : [],
      customer: data.customers.find((customer) => customer.id === selectedRental.customerId),
      flow: data.rentalFlows.find((flow) => flow.rental.id === selectedRental.id),
      invoice,
      paidAmount,
      paymentTotal: paidAmount,
      remainingAmount: Math.max(0, (invoice?.total ?? selectedRental.totalAmount) - paidAmount),
      rental: selectedRental,
      vehicle: data.vehicles.find((vehicle) => vehicle.id === selectedRental.vehicleId),
    };
  }, [data.customers, data.invoices, data.payments, data.rentalChecklists, data.rentalContractEvents, data.rentalContracts, data.rentalFlows, data.vehicles, selectedRental]);

  function openOperation(kind: OperationKind) {
    closeTransientSurfaces();
    const vehicle = selectedVehicle ?? data.vehicles[0];
    const customer = activeCustomer ?? data.customers[0];
    const rental = activeRental ?? data.rentals[0];
    const invoice = activeInvoice ?? data.invoices[0];
    const nextServiceDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const nextReturnDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16);

    setOperationForm({
      ...defaultOperationForm,
      amount: String(Math.max(50, Math.round(vehicle?.dailyRate ? vehicle.dailyRate * 1.4 : 100))),
      cost: String(Math.max(80, Math.round(vehicle?.dailyRate ? vehicle.dailyRate * 2 : 120))),
      customerId: customer?.id ?? "",
      depositAmount: String(rental?.depositAmount ?? 500),
      documentTitle: kind === "signature" ? "Подписанный договор" : kind === "depositDocument" ? "Депозит / возврат" : "",
      documentType: kind === "vehicleDocument" ? "other" : kind === "customerDocument" ? "passport" : "other",
      externalDeviceId: vehicle ? `device-${vehicle.id}` : "",
      finalAmount: String(rental?.totalAmount ?? vehicle?.dailyRate ?? 100),
      invoiceId: invoice?.id ?? "",
      note: vehicle ? `${vehicle.plateNumber}` : "",
      odometerKm: String(vehicle?.odometerKm ?? 1000),
      rentalId: rental?.id ?? "",
      returnAt: nextReturnDate,
      serviceAt: nextServiceDate,
      totalAmount: String(rental?.totalAmount ?? (vehicle?.dailyRate ? vehicle.dailyRate * 2 : 180)),
      vehicleId: vehicle?.id ?? "",
    });
    setOperationFiles(null);
    setOperation(kind);
  }

  function openShareDialog() {
    setCreateSheetOpen(false);
    setMobileDrawerOpen(false);
    setShareDialogOpen(true);
    setMessage("Выберите канал отправки договора клиенту.");
  }

  function closeShareDialog() {
    setShareDialogOpen(false);
    setMessage("");
  }

  function shareClientIntake(channel: "email" | "telegram" | "whatsapp") {
    if (!session) return;
    const rental = selectedRental ?? activeRental;
    const customer = activeCustomer ?? selectedCustomer ?? data.customers[0];
    const vehicle = selectedVehicle ?? data.vehicles.find((item) => item.id === rental?.vehicleId) ?? data.vehicles[0];
    const url = buildClientIntakeUrl(session, rental);
    const text = `Здравствуйте${customer ? `, ${customer.displayName}` : ""}. Заполните, пожалуйста, заявку на аренду FleetCore и загрузите фото/документы: ${url}`;
    if (channel === "whatsapp") {
      openWhatsApp(customer?.phone ?? "", text);
    } else if (channel === "telegram") {
      openTelegram(vehicle ? `Заявка на аренду ${vehicle.make} ${vehicle.model}` : "Заявка на аренду FleetCore", url);
    } else {
      openEmail(customer?.email ?? "", "FleetCore rental application", text);
    }
    setClientIntakeDialogOpen(false);
    setMessage(`Ссылка заявки клиента открыта для отправки: ${channel}`);
  }

  function focusCreateForm(section: Section, formRef: RefObject<HTMLFormElement | null>, label: string) {
    selectSection(section);
    setMessage(label);
    window.setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      formRef.current?.querySelector("input")?.focus();
    }, 80);
  }

  function openVehicleCreate() {
    focusCreateForm("Vehicles", vehicleCreateRef, "Форма добавления автомобиля открыта");
  }

  function openCustomerCreate() {
    focusCreateForm("Drivers/Clients", customerCreateRef, "Форма добавления клиента открыта");
  }

  function closeOnboarding() {
    if (session) {
      localStorage.setItem(`fleetcore-onboarding-open:${session.companyId}`, "0");
    }
    setOnboardingOpen(false);
  }

  function runOnboardingAction(action: "company" | "vehicle" | "customer" | "gps" | "contract" | "manager") {
    if (action === "company") {
      selectSection("Settings");
    } else if (action === "vehicle") {
      openVehicleCreate();
    } else if (action === "customer") {
      openCustomerCreate();
    } else if (action === "gps") {
      selectSection("GPS");
      openOperation("gps");
    } else if (action === "contract") {
      selectSection("Bookings");
      void createDraftContract();
    } else if (action === "manager") {
      openProfileDialog();
    }
    closeOnboarding();
  }

  async function runAction<T>(label: string, action: () => Promise<T>) {
    if (busyAction) {
      setMessage(`Дождитесь завершения операции: ${busyAction}`);
      return undefined;
    }
    setBusyAction(label);
    setMessage(label);
    try {
      return await action();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Операция не выполнена");
      return undefined;
    } finally {
      setBusyAction(undefined);
    }
  }

  async function createVehicleRecord(overrides: Partial<typeof vehicleForm> = {}) {
    const draft = { ...vehicleForm, ...overrides };
    const response = await api<Vehicle>("/fleet/vehicles", {
      body: JSON.stringify({
        dailyRate: Number(draft.dailyRate),
        location: draft.location,
        make: draft.make,
        model: draft.model,
        odometerKm: Number(draft.odometerKm),
        plateNumber: draft.plateNumber,
        status: "available",
        vin: draft.vin,
        year: Number(draft.year),
      }),
      method: "POST",
    }, token);
    return response.data;
  }

  async function createCustomerRecord(overrides: Partial<typeof customerForm> = {}) {
    const draft = { ...customerForm, ...overrides };
    const response = await api<Customer>("/customers", {
      body: JSON.stringify({
        displayName: draft.displayName,
        email: draft.email,
        phone: draft.phone,
        riskLevel: "low",
        type: "individual",
      }),
      method: "POST",
    }, token);
    return response.data;
  }

  async function ensureVehicle() {
    if (selectedVehicle) return selectedVehicle;
    if (data.vehicles[0]) return data.vehicles[0];
    const created = await createVehicleRecord({
      plateNumber: `AUTO-${Date.now().toString().slice(-5)}`,
      vin: `VIN${Date.now().toString().slice(-10)}`,
    });
    setSelectedVehicleId(created.id);
    setMessage(`Автомобиль создан автоматически: ${created.make} ${created.model}`);
    return created;
  }

  function findAvailableVehicle(preferredVehicleId?: string) {
    const unavailableVehicleIds = new Set(data.rentals.filter((rental) => rental.status !== "closed").map((rental) => rental.vehicleId));
    const preferred = [...visibleVehicles, ...data.vehicles].find((vehicle) => vehicle.id === preferredVehicleId && vehicle.status === "available" && !unavailableVehicleIds.has(vehicle.id));
    return preferred
      ?? visibleVehicles.find((vehicle) => vehicle.status === "available" && !unavailableVehicleIds.has(vehicle.id))
      ?? data.vehicles.find((vehicle) => vehicle.status === "available" && !unavailableVehicleIds.has(vehicle.id))
      ?? data.vehicles.find((vehicle) => !unavailableVehicleIds.has(vehicle.id));
  }

  async function ensureBookableVehicle() {
    const vehicle = findAvailableVehicle();
    if (vehicle) return vehicle;
    const created = await createVehicleRecord({
      make: "BMW",
      model: "X5",
      plateNumber: `NEW-${Date.now().toString().slice(-5)}`,
      vin: `BOOK${Date.now().toString().slice(-10)}`,
    });
    setSelectedVehicleId(created.id);
    setMessage(`Свободный автомобиль создан автоматически: ${created.make} ${created.model}`);
    return created;
  }

  async function ensureCustomer() {
    if (selectedCustomer) return selectedCustomer;
    if (activeCustomer) return activeCustomer;
    if (data.customers[0]) return data.customers[0];
    const created = await createCustomerRecord({
      displayName: "Новый клиент",
      email: `client-${Date.now().toString().slice(-5)}@example.com`,
      phone: "+48 600 111 222",
    });
    setSelectedCustomerId(created.id);
    setMessage(`Клиент создан автоматически: ${created.displayName}`);
    return created;
  }

  async function ensureRental() {
    if (activeRental) return activeRental;
    const vehicle = await ensureVehicle();
    const customer = await ensureCustomer();
    const pickupAt = new Date();
    const returnAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    const response = await api<Rental>("/rentals", {
      body: JSON.stringify({
        customerId: customer.id,
        depositAmount: 500,
        pickupAt: pickupAt.toISOString(),
        returnAt: returnAt.toISOString(),
        status: "reserved",
        totalAmount: vehicle.dailyRate * 2,
        vehicleId: vehicle.id,
      }),
      method: "POST",
    }, token);
    setSelectedRentalId(response.data.id);
    setSelectedVehicleId(response.data.vehicleId);
    setSelectedCustomerId(response.data.customerId);
    return response.data;
  }

  async function createNewRental() {
    const vehicle = await ensureBookableVehicle();
    const customer = await ensureCustomer();
    const pickupAt = new Date();
    const returnAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    const response = await api<Rental>("/rentals", {
      body: JSON.stringify({
        customerId: customer.id,
        depositAmount: 500,
        pickupAt: pickupAt.toISOString(),
        returnAt: returnAt.toISOString(),
        status: "reserved",
        totalAmount: vehicle.dailyRate * 2,
        vehicleId: vehicle.id,
      }),
      method: "POST",
    }, token);
    setSelectedRentalId(response.data.id);
    setSelectedVehicleId(response.data.vehicleId);
    setSelectedCustomerId(response.data.customerId);
    return response.data;
  }

  async function ensureInvoice() {
    if (activeInvoice && activeInvoice.status !== "paid") return activeInvoice;
    const rental = await ensureRental();
    const vehicle = data.vehicles.find((item) => item.id === rental.vehicleId) ?? selectedVehicle;
    const response = await api<Invoice>("/finance/invoices", {
      body: JSON.stringify({
        currency: "EUR",
        customerId: rental.customerId,
        dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        rentalId: rental.id,
        status: "issued",
        subtotal: rental.totalAmount || vehicle?.dailyRate || 100,
        tax: 0,
      }),
      method: "POST",
    }, token);
    setMessage(`Инвойс создан автоматически: ${response.data.invoiceNumber}`);
    return response.data;
  }

  async function submitVehicle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runAction(`${t("vehicle.add")}...`, async () => {
      const created = await createVehicleRecord();
      setVehicleForm((current) => ({ ...current, plateNumber: `WA-${Date.now().toString().slice(-5)}`, vin: `VIN${Date.now().toString().slice(-10)}` }));
      setSelectedVehicleId(created.id);
      await loadData();
      setMessage(t("vehicle.save"));
    });
  }

  async function removeVehicle(vehicle: Vehicle) {
    const hasRentalHistory = data.rentals.some((rental) => rental.vehicleId === vehicle.id);
    setSelectedVehicleId(vehicle.id);
    if (hasRentalHistory) {
      setMessage(t("vehicle.deleteBlocked"));
      return;
    }

    await runAction(t("vehicle.deleting"), async () => {
      await api<{ deleted: boolean; id: string }>(`/fleet/vehicles/${vehicle.id}`, { method: "DELETE" }, token);
      const nextVehicle = data.vehicles.find((item) => item.id !== vehicle.id);
      setSelectedVehicleId(nextVehicle?.id);
      await loadData();
      setMessage(t("vehicle.deleted"));
    });
  }

  async function submitCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runAction(t("customer.creating"), async () => {
      const customer = await createCustomerRecord();
      setSelectedCustomerId(customer.id);
      setCustomerForm((current) => ({ ...current, displayName: "Новый клиент", email: `client-${Date.now().toString().slice(-5)}@example.com`, vehicleId: "" }));
      await loadData();
      setMessage(t("customer.saved"));
    });
  }

  async function assignVehicleToNewCustomer() {
    await runAction(t("customer.assigning"), async () => {
      const unavailableVehicleIds = new Set(data.rentals.filter((rental) => rental.status !== "closed").map((rental) => rental.vehicleId));
      const vehicle = data.vehicles.find((item) => item.id === customerForm.vehicleId)
        ?? data.vehicles.find((item) => item.status === "available" && !unavailableVehicleIds.has(item.id))
        ?? data.vehicles.find((item) => !unavailableVehicleIds.has(item.id));

      if (!vehicle) {
        setMessage(t("customer.noVehicleForAssign"));
        return;
      }

      const customer = await createCustomerRecord();
      const pickupAt = new Date();
      const returnAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      await api<Rental>("/rentals", {
        body: JSON.stringify({
          customerId: customer.id,
          depositAmount: 500,
          pickupAt: pickupAt.toISOString(),
          returnAt: returnAt.toISOString(),
          status: "reserved",
          totalAmount: vehicle.dailyRate * 7,
          vehicleId: vehicle.id,
        }),
        method: "POST",
      }, token);
      await api<Vehicle>(`/fleet/vehicles/${vehicle.id}`, {
        body: JSON.stringify({ status: "rented" }),
        method: "PATCH",
      }, token);

      setCustomerForm((current) => ({ ...current, displayName: "Новый клиент", email: `client-${Date.now().toString().slice(-5)}@example.com`, vehicleId: "" }));
      setSelectedVehicleId(vehicle.id);
      setSelectedCustomerId(customer.id);
      await loadData();
      setMessage(`${customer.displayName}: ${t("customer.assigned")} ${vehicle.make} ${vehicle.model}`);
    });
  }

  async function connectGps() {
    await runAction("Подключаем GPS...", async () => {
      const vehicle = await ensureVehicle();
      await api<GpsDevice>("/gps/devices", {
        body: JSON.stringify({
          externalDeviceId: `device-${vehicle.id}`,
          latitude: 52.2297,
          longitude: 21.0122,
          provider: "traccar",
          speedKph: vehicle.status === "rented" ? 87 : 0,
          status: vehicle.status === "rented" ? "online" : "idle",
          vehicleId: vehicle.id,
        }),
        method: "POST",
      }, token);
      await loadData();
      setMessage("GPS подключен");
    });
  }

  async function saveVehicleFiles(files: FileList | null) {
    if (!files?.length) {
      setMessage("Файл не выбран. Нажмите кнопку еще раз и выберите PDF, фото или документ автомобиля.");
      return;
    }
    await runAction(`Загружаем документы авто: ${files.length}`, async () => {
      const vehicle = await ensureVehicle();
      await Promise.all(Array.from(files).map(async (file) => {
        const storedFile = await uploadFile(file);
        return api<VehicleDocument>("/documents/vehicles", {
          body: JSON.stringify({
            expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
            fileUrl: storedFile.publicUrl,
            title: file.name,
            type: documentTypeFromName(file.name),
            vehicleId: vehicle.id,
          }),
          method: "POST",
        }, token);
      }));
      await loadData();
      setMessage(`Загружено документов авто: ${files.length}`);
    });
  }

  async function saveVehiclePhoto(files: FileList | null) {
    const file = files?.[0];
    if (!file) {
      setMessage("Фото не выбрано. Нажмите кнопку еще раз и выберите фото автомобиля.");
      return;
    }
    await runAction("Обновляем фото автомобиля...", async () => {
      const vehicle = await ensureVehicle();
      const storedFile = await uploadFile(file);
      const response = await api<Vehicle>(`/fleet/vehicles/${vehicle.id}`, {
        body: JSON.stringify({ photoUrl: storedFile.publicUrl }),
        method: "PATCH",
      }, token);
      setSelectedVehicleId(response.data.id);
      await loadData();
      setMessage("Фото автомобиля сохранено");
    });
  }

  async function saveCompanyLogo(files: FileList | null) {
    const file = files?.[0];
    if (!file) {
      setMessage("Логотип не выбран. Нажмите кнопку еще раз и выберите файл логотипа.");
      return;
    }
    if (!session) {
      setMessage("Сессия не найдена. Войдите в аккаунт еще раз.");
      return;
    }
    await runAction("Загружаем логотип компании...", async () => {
      const storedFile = await uploadFile(file);
      const response = await api<Company>(`/companies/${session.companyId}`, {
        body: JSON.stringify({ logoUrl: storedFile.publicUrl }),
        method: "PATCH",
      }, token);
      setCompanyForm((current) => ({ ...current, logoUrl: response.data.logoUrl ?? "" }));
      await loadData();
      setMessage("Логотип компании сохранен");
    });
  }

  async function saveCompanyBranding() {
    if (!session) {
      setMessage("Сессия не найдена. Войдите в аккаунт еще раз.");
      return;
    }
    await runAction("Сохраняем бренд компании...", async () => {
      await api<Company>(`/companies/${session.companyId}`, {
        body: JSON.stringify({
          billingEmail: companyForm.billingEmail || null,
          brandColor: companyForm.brandColor || "#2346d8",
          businessAddress: companyForm.businessAddress || null,
          contractFooter: companyForm.contractFooter || null,
          iban: companyForm.iban || null,
          legalName: companyForm.legalName,
          taxId: companyForm.taxId || null,
          tradingName: companyForm.tradingName,
        }),
        method: "PATCH",
      }, token);
      await loadData();
      setMessage("Брендинг и реквизиты компании сохранены");
    });
  }

  async function removeCompanyLogo() {
    if (!session) {
      setMessage("Сессия не найдена. Войдите в аккаунт еще раз.");
      return;
    }
    await runAction("Убираем логотип компании...", async () => {
      await api<Company>(`/companies/${session.companyId}`, {
        body: JSON.stringify({ logoUrl: null }),
        method: "PATCH",
      }, token);
      await loadData();
      setMessage("Логотип компании убран");
    });
  }

  async function removeVehiclePhoto(vehicleOverride?: Vehicle) {
    await runAction("Убираем фото автомобиля...", async () => {
      const vehicle = vehicleOverride ?? await ensureVehicle();
      await api<Vehicle>(`/fleet/vehicles/${vehicle.id}`, {
        body: JSON.stringify({ photoUrl: null }),
        method: "PATCH",
      }, token);
      await loadData();
      setMessage("Фото убрано. Показываем встроенный визуал по марке.");
    });
  }

  async function saveCustomerFiles(files: FileList | null) {
    if (!files?.length) {
      setMessage("Файл клиента не выбран. Нажмите кнопку еще раз и выберите паспорт, ID или папку клиента.");
      return;
    }
    await runAction(`Загружаем документы клиента: ${files.length}`, async () => {
      const customer = await ensureCustomer();
      await Promise.all(Array.from(files).map(async (file) => {
        const storedFile = await uploadFile(file);
        return api<CustomerDocument>("/operations/customer-documents", {
          body: JSON.stringify({
            customerId: customer.id,
            fileUrl: storedFile.publicUrl,
            title: file.name,
            type: customerDocumentTypeFromName(file.name),
            verified: false,
          }),
          method: "POST",
        }, token);
      }));
      await loadData();
      setMessage(`Загружено документов клиента: ${files.length}`);
    });
  }

  async function saveDepositFiles(files: FileList | null) {
    if (!files?.length) {
      setMessage("Документ депозита не выбран. Нажмите кнопку еще раз и выберите файл депозита или возврата.");
      return;
    }
    await runAction(`Загружаем документы депозита: ${files.length}`, async () => {
      const rental = await ensureRental();
      const customer = data.customers.find((item) => item.id === rental.customerId) ?? await ensureCustomer();
      await Promise.all(Array.from(files).map(async (file) => {
        const storedFile = await uploadFile(file);
        return api<CustomerDocument>("/operations/customer-documents", {
          body: JSON.stringify({
            customerId: customer.id,
            fileUrl: storedFile.publicUrl,
            title: `Депозит / возврат: ${file.name}`,
            type: "other",
            verified: true,
          }),
          method: "POST",
        }, token);
      }));
      await loadData();
      setMessage(`Документы депозита сохранены: ${files.length}`);
    });
  }

  async function saveRentalContractFiles(files: FileList | null, status: RentalContract["status"]) {
    if (!files?.length) {
      setMessage("Договор не выбран. Выберите PDF/файл договора или создайте электронный договор.");
      return;
    }
    await runAction(`Загружаем договоры: ${files.length}`, async () => {
      const rental = await ensureRental();
      await Promise.all(Array.from(files).map(async (file) => {
        const storedFile = await uploadFile(file);
        return api<RentalContract>("/operations/rental-contracts", {
          body: JSON.stringify({
            documentUrl: storedFile.publicUrl,
            rentalId: rental.id,
            sentVia: "manual",
            signedAt: status === "signed" ? new Date().toISOString() : undefined,
            status,
          }),
          method: "POST",
        }, token);
      }));
      await loadData();
      setMessage(status === "signed" ? "Подписанный договор сохранен" : `Договоры сохранены: ${files.length}`);
    });
  }

  async function uploadFile(file: File) {
    const response = await api<FileObject>("/uploads", {
      body: JSON.stringify({
        base64: await fileToBase64(file),
        mimeType: file.type || "application/octet-stream",
        originalName: file.name,
      }),
      method: "POST",
    }, token);
    return response.data;
  }

  async function submitOperation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!operation) {
      setMessage("Операция не выбрана. Откройте действие еще раз.");
      return;
    }

    await runAction("Сохраняем операцию...", async () => {
      const vehicle = data.vehicles.find((item) => item.id === operationForm.vehicleId) ?? await ensureVehicle();
      const customer = data.customers.find((item) => item.id === operationForm.customerId) ?? await ensureCustomer();
      const rental = data.rentals.find((item) => item.id === operationForm.rentalId);
      const invoice = data.invoices.find((item) => item.id === operationForm.invoiceId) ?? activeInvoice;
      const files = Array.from(operationFiles ?? []);

      if (operation === "vehicleDocument") {
        if (!files.length) throw new Error("Выберите файл документа автомобиля");
        await Promise.all(files.map(async (file) => {
          const storedFile = await uploadFile(file);
          return api<VehicleDocument>("/documents/vehicles", {
            body: JSON.stringify({
              expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
              fileUrl: storedFile.publicUrl,
              title: operationForm.documentTitle || file.name,
              type: operationForm.documentType,
              vehicleId: vehicle.id,
            }),
            method: "POST",
          }, token);
        }));
        setMessage(`Документы авто сохранены: ${files.length}`);
      }

      if (operation === "customerDocument") {
        if (!files.length) throw new Error("Выберите паспорт, ID или водительские права клиента");
        await Promise.all(files.map(async (file) => {
          const storedFile = await uploadFile(file);
          return api<CustomerDocument>("/operations/customer-documents", {
            body: JSON.stringify({
              customerId: customer.id,
              fileUrl: storedFile.publicUrl,
              title: operationForm.documentTitle || file.name,
              type: operationForm.documentType,
              verified: false,
            }),
            method: "POST",
          }, token);
        }));
        setMessage(`Документы клиента сохранены: ${files.length}`);
      }

      if (operation === "expense") {
        await api<Expense>("/operations/expenses", {
          body: JSON.stringify({
            amount: Number(operationForm.amount),
            category: operationForm.category,
            currency: "EUR",
            note: operationForm.note || `Расход по ${vehicle.plateNumber}`,
            vehicleId: vehicle.id,
          }),
          method: "POST",
        }, token);
        await Promise.all(files.map(async (file) => {
          const storedFile = await uploadFile(file);
          return api<VehicleDocument>("/documents/vehicles", {
            body: JSON.stringify({
              fileUrl: storedFile.publicUrl,
              title: `Расход: ${file.name}`,
              type: "other",
              vehicleId: vehicle.id,
            }),
            method: "POST",
          }, token);
        }));
        setMessage("Расход сохранен");
      }

      if (operation === "service") {
        await api<ServiceRecord>("/operations/service-records", {
          body: JSON.stringify({
            cost: Number(operationForm.cost),
            note: operationForm.note || `ТО ${vehicle.plateNumber}`,
            odometerKm: Number(operationForm.odometerKm),
            serviceAt: new Date(operationForm.serviceAt || Date.now()).toISOString(),
            status: operationForm.status,
            type: operationForm.serviceType,
            vehicleId: vehicle.id,
          }),
          method: "POST",
        }, token);
        setMessage("Техобслуживание создано");
      }

      if (operation === "booking") {
        const bookingVehicle = findAvailableVehicle(operationForm.vehicleId) ?? await ensureBookableVehicle();
        await api<Rental>("/rentals", {
          body: JSON.stringify({
            customerId: customer.id,
            depositAmount: Number(operationForm.depositAmount),
            pickupAt: new Date().toISOString(),
            returnAt: new Date(operationForm.returnAt || Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
            status: "reserved",
            totalAmount: Number(operationForm.totalAmount),
            vehicleId: bookingVehicle.id,
          }),
          method: "POST",
        }, token);
        setMessage("Бронь создана");
      }

      if (operation === "payment") {
        const targetInvoice = invoice ?? await ensureInvoice();
        await api<Payment>(`/finance/invoices/${targetInvoice.id}/payments`, {
          body: JSON.stringify({
            amount: Number(operationForm.amount || targetInvoice.total),
            currency: targetInvoice.currency,
            method: operationForm.method,
            reference: operationForm.reference || `UI-${Date.now()}`,
          }),
          method: "POST",
        }, token);
        setMessage("Оплата проведена");
      }

      if (operation === "depositDocument") {
        const targetRental = rental ?? await ensureRental();
        const targetCustomer = data.customers.find((item) => item.id === targetRental.customerId) ?? customer;
        if (!files.length) throw new Error("Выберите чек или документ депозита");
        await Promise.all(files.map(async (file) => {
          const storedFile = await uploadFile(file);
          return api<CustomerDocument>("/operations/customer-documents", {
            body: JSON.stringify({
              customerId: targetCustomer.id,
              fileUrl: storedFile.publicUrl,
              title: operationForm.documentTitle || `Депозит / возврат: ${file.name}`,
              type: "other",
              verified: true,
            }),
            method: "POST",
          }, token);
        }));
        setMessage("Документы депозита сохранены");
      }

      if (operation === "depositReturn") {
        const targetRental = rental ?? await ensureRental();
        const targetVehicle = data.vehicles.find((item) => item.id === targetRental.vehicleId) ?? vehicle;
        await saveRentalChecklist("return", targetRental);
        await api<Rental>(`/rentals/${targetRental.id}/return`, {
          body: JSON.stringify({
            finalAmount: Number(operationForm.finalAmount || targetRental.totalAmount),
            odometerKm: Number(operationForm.odometerKm || targetVehicle.odometerKm),
          }),
          method: "POST",
        }, token);
        await api<Expense>("/operations/expenses", {
          body: JSON.stringify({
            amount: Number(operationForm.depositAmount || targetRental.depositAmount),
            category: "other",
            currency: "EUR",
            note: operationForm.note || `Возврат депозита по аренде ${targetRental.id}`,
            vehicleId: targetVehicle.id,
          }),
          method: "POST",
        }, token);
        setMessage("Возврат депозита оформлен");
      }

      if (operation === "gps") {
        await api<GpsDevice>("/gps/devices", {
          body: JSON.stringify({
            externalDeviceId: operationForm.externalDeviceId || `device-${vehicle.id}`,
            latitude: Number(operationForm.latitude),
            longitude: Number(operationForm.longitude),
            provider: operationForm.provider,
            speedKph: Number(operationForm.speedKph),
            status: Number(operationForm.speedKph) > 0 ? "online" : "idle",
            vehicleId: vehicle.id,
          }),
          method: "POST",
        }, token);
        setMessage("GPS подключен к автомобилю");
      }

      if (operation === "contract" || operation === "signature") {
        const targetRental = rental ?? await ensureRental();
        if (files.length) {
          await Promise.all(files.map(async (file) => {
            const storedFile = await uploadFile(file);
            return api<RentalContract>("/operations/rental-contracts", {
              body: JSON.stringify({
                documentUrl: storedFile.publicUrl,
                rentalId: targetRental.id,
                sentVia: "manual",
                signedAt: operation === "signature" ? new Date().toISOString() : undefined,
                status: operation === "signature" ? "signed" : "draft",
              }),
              method: "POST",
            }, token);
          }));
          setMessage(operation === "signature" ? "Подписанный договор сохранен" : "Договор аренды загружен");
        } else {
          const contract = await createContractRecord(operation === "signature" ? "signed" : "draft", "manual", targetRental);
          setMessage(`Электронный договор создан: ${contract.id}`);
        }
      }

      await loadData();
      setOperation(undefined);
      setOperationFiles(null);
    });
  }

  function requestVehicleDocumentUpload() {
    openOperation("vehicleDocument");
  }

  function requestVehicleFolderUpload() {
    vehicleFolderInputRef.current?.click();
  }

  function requestCustomerDocumentUpload() {
    openOperation("customerDocument");
  }

  function requestCustomerFolderUpload() {
    customerFolderInputRef.current?.click();
  }

  function requestContractUpload() {
    openOperation("contract");
  }

  function requestDepositUpload() {
    openOperation("depositDocument");
  }

  function requestSignatureUpload() {
    openOperation("signature");
  }

  async function payActiveInvoice() {
    await runAction("Проводим оплату...", async () => {
      const invoice = await ensureInvoice();
      await api<Payment>(`/finance/invoices/${invoice.id}/payments`, {
        body: JSON.stringify({ amount: invoice.total, currency: invoice.currency, method: "manual", reference: `UI-${Date.now()}` }),
        method: "POST",
      }, token);
      await loadData();
      setMessage("Платеж внесен");
    });
  }

  async function returnActiveRental() {
    await runAction("Закрываем возврат...", async () => {
      const rental = await ensureRental();
      const vehicle = data.vehicles.find((item) => item.id === rental.vehicleId) ?? await ensureVehicle();
      await saveRentalChecklist("return", rental);
      await api<Rental>(`/rentals/${rental.id}/return`, {
        body: JSON.stringify({ finalAmount: rental.totalAmount, odometerKm: vehicle.odometerKm + 25 }),
        method: "POST",
      }, token);
      await loadData();
      setMessage("Возврат автомобиля закрыт");
    });
  }

  async function createContractFile(rental: Rental) {
    const vehicle = data.vehicles.find((item) => item.id === rental.vehicleId) ?? await ensureVehicle();
    const customer = data.customers.find((item) => item.id === rental.customerId) ?? await ensureCustomer();
    const contractHtml = `<!doctype html>
<html lang="ru">
<meta charset="utf-8" />
<title>Договор аренды ${rental.id}</title>
<body style="font-family:Arial,sans-serif;line-height:1.5;color:#111827;padding:32px">
  <h1>Договор аренды автомобиля</h1>
  <p><strong>Договор:</strong> ${rental.id}</p>
  <p><strong>Клиент:</strong> ${customer.displayName} · ${customer.phone} · ${customer.email}</p>
  <p><strong>Автомобиль:</strong> ${vehicle.make} ${vehicle.model} · ${vehicle.plateNumber} · VIN ${vehicle.vin}</p>
  <p><strong>Период:</strong> ${new Date(rental.pickupAt).toLocaleString()} - ${new Date(rental.returnAt).toLocaleString()}</p>
  <p><strong>Сумма аренды:</strong> ${money.format(rental.totalAmount)}</p>
  <p><strong>Депозит:</strong> ${money.format(rental.depositAmount)}</p>
  <hr />
  <p>Клиент принимает автомобиль в исправном состоянии и обязуется вернуть его в согласованный срок.</p>
  <p>Подпись клиента: ____________________</p>
  <p>Подпись компании: ____________________</p>
</body>
</html>`;
    return new File([contractHtml], `rental-contract-${rental.id}.html`, { type: "text/html" });
  }

  async function createContractRecord(status: RentalContract["status"], sentVia: RentalContract["sentVia"], rentalOverride?: Rental) {
    const rental = rentalOverride ?? await ensureRental();
    const storedFile = await uploadFile(await createContractFile(rental));
    const response = await api<RentalContract>("/operations/rental-contracts", {
      body: JSON.stringify({
        documentUrl: storedFile.publicUrl,
        rentalId: rental.id,
        sentVia,
        signedAt: status === "signed" ? new Date().toISOString() : undefined,
        status,
      }),
      method: "POST",
    }, token);
    return response.data;
  }

  async function shareRentalContract(channel: "email" | "telegram" | "whatsapp", rentalOverride?: Rental) {
    await runAction(`Готовим ссылку договора: ${channel}`, async () => {
      const rental = rentalOverride ?? await ensureRental();
      const customer = data.customers.find((item) => item.id === rental.customerId) ?? await ensureCustomer();
      const vehicle = data.vehicles.find((item) => item.id === rental.vehicleId) ?? await ensureVehicle();
      const contract = await createContractRecord("sent", channel, rental);
      const contractUrl = contract.publicUrl ?? contract.documentUrl;
      const text = [
        `Здравствуйте, ${customer.displayName}.`,
        "Ваше подтверждение аренды FleetCore:",
        `Автомобиль: ${vehicle.make} ${vehicle.model} (${vehicle.plateNumber})`,
        `Период: ${new Date(rental.pickupAt).toLocaleString()} - ${new Date(rental.returnAt).toLocaleString()}`,
        `Сумма аренды: ${money.format(rental.totalAmount)}`,
        `Депозит: ${money.format(rental.depositAmount)}`,
        `Документ и подпись: ${contractUrl}`,
      ].join("\n");
      await loadData();
      if (channel === "whatsapp") {
        openWhatsApp(customer.phone, text);
      } else if (channel === "telegram") {
        openTelegram(text, contractUrl);
      } else {
        openEmail(customer.email, "FleetCore rental confirmation", text);
      }
      setMessage(`Ссылка договора открыта для отправки: ${channel}`);
    });
  }

  async function createDraftContract() {
    await runAction("Создаем электронный договор...", async () => {
      await createContractRecord("draft", "manual");
      await loadData();
      setMessage("Электронный договор создан");
    });
  }

  async function saveRentalChecklist(phase: RentalChecklist["phase"], rentalOverride?: Rental) {
    const rental = rentalOverride ?? await ensureRental();
    const vehicle = data.vehicles.find((item) => item.id === rental.vehicleId) ?? await ensureVehicle();
    await api<RentalChecklist>("/operations/rental-checklists", {
      body: JSON.stringify({
        depositConfirmed: true,
        documentsOk: true,
        exteriorOk: true,
        fuelLevel: 100,
        interiorOk: true,
        notes: phase === "pickup" ? `Выдача ${vehicle.plateNumber}` : `Возврат ${vehicle.plateNumber}`,
        odometerKm: vehicle.odometerKm,
        phase,
        photoUrls: vehicle.photoUrl ? [vehicle.photoUrl] : [],
        rentalId: rental.id,
      }),
      method: "POST",
    }, token);
  }

  async function saveRentalWorkflowReturnChecklist(rental: Rental, draft: RentalWorkflowDraft, files: FileList | null) {
    const vehicle = data.vehicles.find((item) => item.id === rental.vehicleId) ?? await ensureVehicle();
    const uploadedPhotos = await Promise.all(Array.from(files ?? []).map(async (file) => {
      const storedFile = await uploadFile(file);
      return storedFile.publicUrl;
    }));
    await api<RentalChecklist>("/operations/rental-checklists", {
      body: JSON.stringify({
        depositConfirmed: Number(draft.depositRefund || 0) >= 0,
        documentsOk: true,
        exteriorOk: draft.returnCondition !== "damaged",
        fuelLevel: 100,
        interiorOk: draft.returnCondition !== "dirty",
        notes: [
          `Возврат: ${draft.returnCondition || "ok"}`,
          draft.returnDamages ? `Повреждения: ${draft.returnDamages}` : "",
          draft.clientNote ? `Заметка: ${draft.clientNote}` : "",
        ].filter(Boolean).join(" · "),
        odometerKm: vehicle.odometerKm,
        phase: "return",
        photoUrls: uploadedPhotos.length ? uploadedPhotos : vehicle.photoUrl ? [vehicle.photoUrl] : [],
        rentalId: rental.id,
      }),
      method: "POST",
    }, token);
  }

  async function saveRentalWorkflow(draft: RentalWorkflowDraft, customerFiles: FileList | null) {
    return runAction("Сохраняем аренду...", async () => {
      const selectedExistingCustomer = data.customers.find((item) => item.id === draft.selectedCustomerId);
      const customer = selectedExistingCustomer ?? await createCustomerRecord({
        displayName: draft.clientName || "Новый клиент",
        email: draft.clientEmail || `client-${Date.now().toString().slice(-5)}@example.com`,
        phone: draft.clientPhone || draft.clientWhatsApp || "+48 600 111 222",
      });
      const pickupAt = new Date(draft.pickupAt || Date.now());
      const returnAt = new Date(draft.returnAt || Date.now() + 2 * 24 * 60 * 60 * 1000);
      const overlaps = (vehicle: Vehicle) => data.rentals.some((rental) => (
        rental.status !== "closed"
        && rental.id !== draft.selectedRentalId
        && rental.vehicleId === vehicle.id
        && new Date(rental.pickupAt).getTime() < returnAt.getTime()
        && new Date(rental.returnAt).getTime() > pickupAt.getTime()
      ));
      const requestedVehicle = data.vehicles.find((item) => item.id === draft.selectedVehicleId);
      const vehicle = requestedVehicle && requestedVehicle.status === "available" && !overlaps(requestedVehicle)
        ? requestedVehicle
        : data.vehicles.find((item) => item.status === "available" && !overlaps(item));
      if (!vehicle) throw new Error("Нет свободного автомобиля на выбранные даты");

      await Promise.all(Array.from(customerFiles ?? []).map(async (file) => {
        const storedFile = await uploadFile(file);
        return api<CustomerDocument>("/operations/customer-documents", {
          body: JSON.stringify({
            customerId: customer.id,
            fileUrl: storedFile.publicUrl,
            title: file.name,
            type: customerDocumentTypeFromName(file.name),
            verified: false,
          }),
          method: "POST",
        }, token);
      }));

      const existingRental = data.rentals.find((item) => item.id === draft.selectedRentalId && item.status !== "closed");
      const rentalPayload = {
        customerId: customer.id,
        depositAmount: Number(draft.depositAmount || vehicle.dailyRate || 0),
        pickupAt: pickupAt.toISOString(),
        returnAt: returnAt.toISOString(),
        status: "reserved" as const,
        totalAmount: Number(draft.rentalAmount || vehicle.dailyRate || 0),
        vehicleId: vehicle.id,
      };
      const rental = existingRental
        ? (await api<Rental>(`/rentals/${existingRental.id}`, { body: JSON.stringify(rentalPayload), method: "PATCH" }, token)).data
        : (await api<Rental>("/rentals", { body: JSON.stringify(rentalPayload), method: "POST" }, token)).data;

      const invoice = data.invoices.find((item) => item.rentalId === rental.id)
        ?? (await api<Invoice>("/finance/invoices", {
          body: JSON.stringify({
            currency: data.company?.currency ?? "EUR",
            customerId: customer.id,
            dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            rentalId: rental.id,
            status: "issued",
            subtotal: rental.totalAmount,
            tax: 0,
          }),
          method: "POST",
        }, token)).data;

      const existingPaid = data.payments.filter((payment) => payment.invoiceId === invoice.id).reduce((sum, payment) => sum + payment.amount, 0);
      const targetPaid = draft.paymentStatus === "paid"
        ? invoice.total
        : draft.paymentStatus === "partial"
          ? Math.max(1, Math.min(invoice.total - 1, Number(draft.paymentAmount || invoice.total / 2)))
          : 0;
      const amountToPay = Math.max(0, targetPaid - existingPaid);
      if (amountToPay > 0) {
        await api<Payment>(`/finance/invoices/${invoice.id}/payments`, {
          body: JSON.stringify({
            amount: amountToPay,
            currency: invoice.currency,
            method: draft.paymentMethod,
            reference: `RENTAL-WORKFLOW-${Date.now()}`,
          }),
          method: "POST",
        }, token);
      }

      setSelectedCustomerId(customer.id);
      setSelectedVehicleId(vehicle.id);
      setSelectedRentalId(rental.id);
      await loadData();
      setMessage(`Аренда сохранена: ${customer.displayName} · ${vehicle.plateNumber}`);
      return rental;
    });
  }

  async function sendRentalWorkflowConfirmation(channel: "email" | "telegram" | "whatsapp", draft: RentalWorkflowDraft) {
    return runAction(`Отправляем клиенту: ${channel}`, async () => {
      const rental = data.rentals.find((item) => item.id === draft.selectedRentalId) ?? await saveRentalWorkflow(draft, null);
      if (!rental) throw new Error("Сначала сохраните аренду");
      const customer = data.customers.find((item) => item.id === rental.customerId) ?? await ensureCustomer();
      const vehicle = data.vehicles.find((item) => item.id === rental.vehicleId) ?? await ensureVehicle();
      const contract = await createContractRecord("sent", channel, rental);
      const contractUrl = contract.publicUrl ?? contract.documentUrl;
      const text = [
        `Здравствуйте, ${customer.displayName}. Подтверждение аренды FleetCore:`,
        `Автомобиль: ${vehicle.make} ${vehicle.model} (${vehicle.plateNumber})`,
        `Даты: ${new Date(rental.pickupAt).toLocaleString()} - ${new Date(rental.returnAt).toLocaleString()}`,
        `Сумма: ${money.format(rental.totalAmount)}`,
        `Депозит: ${money.format(rental.depositAmount)}`,
        `Оплата: ${draft.paymentMethod}, статус ${draft.paymentStatus}`,
        `Документ: ${contractUrl}`,
      ].join("\n");
      await loadData();
      if (channel === "whatsapp") {
        openWhatsApp(draft.clientWhatsApp || customer.phone, text);
      } else if (channel === "telegram") {
        openTelegram(text, contractUrl);
      } else {
        openEmail(draft.clientEmail || customer.email, "FleetCore rental confirmation", text);
      }
      setMessage(`Подтверждение аренды открыто для отправки: ${channel}`);
      return rental;
    });
  }

  async function closeRentalWorkflowReturn(draft: RentalWorkflowDraft, returnFiles: FileList | null) {
    return runAction("Оформляем возврат...", async () => {
      const rental = data.rentals.find((item) => item.id === draft.selectedRentalId) ?? await saveRentalWorkflow(draft, null);
      if (!rental) throw new Error("Сначала сохраните аренду");
      if (rental.status === "closed") {
        setMessage("Эта аренда уже закрыта");
        return rental;
      }
      const vehicle = data.vehicles.find((item) => item.id === rental.vehicleId) ?? await ensureVehicle();
      await saveRentalWorkflowReturnChecklist(rental, draft, returnFiles);
      const closedRental = (await api<Rental>(`/rentals/${rental.id}/return`, {
        body: JSON.stringify({
          finalAmount: Number(draft.rentalAmount || rental.totalAmount),
          odometerKm: vehicle.odometerKm + 25,
          returnedAt: rentalWorkflowReturnAt(draft.returnDate, rental.pickupAt),
        }),
        method: "POST",
      }, token)).data;
      const refund = Number(draft.depositRefund || 0);
      if (refund > 0) {
        try {
          await api<Expense>("/operations/expenses", {
            body: JSON.stringify({
              amount: refund,
              category: "other",
              currency: data.company?.currency ?? "EUR",
              note: `Возврат депозита по аренде ${closedRental.id}`,
              vehicleId: vehicle.id,
            }),
            method: "POST",
          }, token);
        } catch {
          setMessage("Аренда закрыта. Возврат депозита нужно проверить в финансах.");
        }
      }
      await loadData();
      setMessage("Возврат оформлен, аренда закрыта");
      return closedRental;
    });
  }

  async function createRentalChecklist(phase: RentalChecklist["phase"], rentalOverride?: Rental) {
    await runAction(phase === "pickup" ? "Сохраняем чек-лист выдачи..." : "Сохраняем чек-лист возврата...", async () => {
      await saveRentalChecklist(phase, rentalOverride);
      await loadData();
      setMessage(phase === "pickup" ? "Чек-лист выдачи сохранен" : "Чек-лист возврата сохранен");
    });
  }

  async function openRentalContractPdf(flowOverride?: RentalFlow) {
    const flow = flowOverride ?? activeRentalFlow;
    if (!flow) {
      setMessage("Нет активной аренды для PDF договора. Создайте бронь или выберите аренду.");
      return;
    }
    await runAction("Готовим PDF договор...", async () => {
      const response = await fetch(`${API_URL}${flow.contractPdfUrl}`, {
        headers: token ? { authorization: `Bearer ${token}` } : { "x-tenant-id": TENANT_ID },
      });
      if (!response.ok) throw new Error(await parseApiError(response));
      const fileUrl = URL.createObjectURL(await response.blob());
      window.open(fileUrl, "_blank", "noreferrer");
      setMessage("PDF договор открыт");
    });
  }

  async function openRentalContractPdfForRental(rental: Rental) {
    const flow = data.rentalFlows.find((item) => item.rental.id === rental.id);
    if (flow) {
      await openRentalContractPdf(flow);
      return;
    }

    await runAction("Готовим PDF договор...", async () => {
      const response = await fetch(`${API_URL}/rentals/${rental.id}/contract.pdf`, {
        headers: token ? { authorization: `Bearer ${token}` } : { "x-tenant-id": TENANT_ID },
      });
      if (!response.ok) throw new Error(await parseApiError(response));
      const fileUrl = URL.createObjectURL(await response.blob());
      window.open(fileUrl, "_blank", "noreferrer");
      setMessage("PDF договор открыт");
    });
  }

  async function payRentalInvoice(flow: RentalFlow) {
    const invoice = flow.invoice ?? (await api<Invoice>("/finance/invoices", {
      body: JSON.stringify({
        currency: data.company?.currency ?? "EUR",
        customerId: flow.customer.id,
        dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        rentalId: flow.rental.id,
        status: "issued",
        subtotal: flow.rental.totalAmount,
        tax: 0,
      }),
      method: "POST",
    }, token)).data;
    await api<Payment>(`/finance/invoices/${invoice.id}/payments`, {
      body: JSON.stringify({
        amount: Math.max(0, invoice.total - flow.paidAmount),
        currency: invoice.currency,
        method: "manual",
        reference: `FLOW-${Date.now()}`,
      }),
      method: "POST",
    }, token);
  }

  async function startRental(flow: RentalFlow) {
    await api<Rental>(`/rentals/${flow.rental.id}`, {
      body: JSON.stringify({ status: "active" }),
      method: "PATCH",
    }, token);
    await api<Vehicle>(`/fleet/vehicles/${flow.vehicle.id}`, {
      body: JSON.stringify({ status: "rented" }),
      method: "PATCH",
    }, token);
  }

  async function completeFlowReturn(flow: RentalFlow) {
    await saveRentalChecklist("return", flow.rental);
  }

  async function finalizeRentalFlow(flow: RentalFlow) {
    const hasReturnChecklist = flow.checklists.some((item) => item.phase === "return");
    if (!hasReturnChecklist) {
      await saveRentalChecklist("return", flow.rental);
    }
    await api<Rental>(`/rentals/${flow.rental.id}/return`, {
      body: JSON.stringify({
        finalAmount: flow.rental.totalAmount,
        odometerKm: flow.vehicle.odometerKm + 25,
      }),
      method: "POST",
    }, token);
    await api<Expense>("/operations/expenses", {
      body: JSON.stringify({
        amount: flow.rental.depositAmount,
        category: "other",
        currency: data.company?.currency ?? "EUR",
        note: `Deposit returned after final settlement for rental ${flow.rental.id}`,
        vehicleId: flow.vehicle.id,
      }),
      method: "POST",
    }, token);
  }

  async function processFlowAction(flowOverride?: RentalFlow) {
    const flow = flowOverride ?? activeRentalFlow;
    if (!flow) {
      setMessage("Нет активного Rental Flow. Создайте бронь или выберите аренду.");
      return;
    }
    if (!flow.nextAction) {
      setMessage("Rental Flow уже завершен. Следующих обязательных действий нет.");
      return;
    }
    await runAction(`Rental Flow: ${flow.nextAction.actionLabel ?? flow.nextAction.label}`, async () => {
      if (flow.nextAction?.key === "contract") {
        await createContractRecord("sent", "whatsapp", flow.rental);
      } else if (flow.nextAction?.key === "payment") {
        await payRentalInvoice(flow);
      } else if (flow.nextAction?.key === "pickup") {
        await saveRentalChecklist("pickup", flow.rental);
      } else if (flow.nextAction?.key === "activeRental") {
        await startRental(flow);
      } else if (flow.nextAction?.key === "return") {
        await completeFlowReturn(flow);
      } else if (flow.nextAction?.key === "deposit") {
        await finalizeRentalFlow(flow);
      }
      await loadData();
      setMessage("Rental Flow обновлен");
    });
  }

  async function signRentalFlow(flow: RentalFlow) {
    await runAction("Подписываем договор Rental Flow...", async () => {
      await createContractRecord("signed", "manual", flow.rental);
      await loadData();
      setMessage("Договор подписан, Rental Flow обновлен");
    });
  }

  async function finalizeRentalFlowAction(flow: RentalFlow) {
    await runAction("Финальный расчет и возврат депозита...", async () => {
      await finalizeRentalFlow(flow);
      await loadData();
      setMessage("Финальный расчет выполнен, аренда закрыта");
    });
  }

  async function runRentalWizardStep(step: RentalWizardStep) {
    if (step === "vehicle") {
      await runAction("Мастер аренды: готовим автомобиль...", async () => {
        const vehicle = await ensureVehicle();
        await loadData();
        selectSection("Vehicles");
        setSelectedVehicleId(vehicle.id);
        setMessage(`Автомобиль готов: ${vehicle.make} ${vehicle.model}`);
      });
      return;
    }
    if (step === "customer") {
      await runAction("Мастер аренды: готовим клиента...", async () => {
        const customer = await ensureCustomer();
        await loadData();
        selectSection("Drivers/Clients");
        setSelectedCustomerId(customer.id);
        setMessage(`Клиент готов: ${customer.displayName}`);
      });
      return;
    }
    if (step === "booking") {
      await runAction("Мастер аренды: создаем бронь...", async () => {
        const rental = selectedRental && selectedRental.status !== "closed" ? selectedRental : await createNewRental();
        await loadData();
        selectSection("Bookings");
        setSelectedRentalId(rental.id);
        setMessage("Бронь создана и выбрана");
      });
      return;
    }
    if (step === "contract") {
      await runAction("Мастер аренды: создаем договор...", async () => {
        const rental = await ensureRental();
        await createContractRecord("draft", "manual", rental);
        await loadData();
        selectSection("Bookings");
        setSelectedRentalId(rental.id);
        setMessage("Договор создан");
      });
      return;
    }
    if (step === "send") {
      const rental = selectedRental ?? activeRental ?? data.rentals.find((item) => item.status !== "closed");
      await shareRentalContract("whatsapp", rental);
      return;
    }
    if (step === "payment") {
      await payActiveInvoice();
      selectSection("Finance");
      return;
    }
    await returnActiveRental();
    selectSection("Bookings");
  }

  async function requestEmailVerification() {
    await runAction("Отправляем подтверждение email...", async () => {
      const response = await api<{ delivery: "development" | "email"; verificationToken?: string }>("/auth/request-email-verification", {
        body: JSON.stringify({ email: session?.user.email }),
        method: "POST",
      }, token);
      setMessage(response.data.verificationToken
        ? `Verification token: ${response.data.verificationToken}`
        : "Email verification instructions sent.");
    });
  }

  async function saveProfilePhoto(file: File | undefined) {
    if (!file) {
      setMessage("Фото профиля не выбрано. Нажмите кнопку еще раз и выберите изображение.");
      return;
    }
    if (!session) {
      setMessage("Сессия не найдена. Войдите в аккаунт еще раз.");
      return;
    }
    await runAction("Загружаем фото профиля...", async () => {
      const storedFile = await uploadFile(file);
      const response = await api<User>("/auth/me", {
        body: JSON.stringify({ photoUrl: storedFile.publicUrl }),
        method: "PATCH",
      }, token);
      const nextSession = { ...session, user: response.data };
      setSession(nextSession);
      saveStoredSession(nextSession);
      setProfileName(response.data.fullName);
      setProfilePhoto(response.data.photoUrl ?? storedFile.publicUrl);
      localStorage.setItem(`fleetcore-profile-photo:${session.user.id}`, response.data.photoUrl ?? storedFile.publicUrl);
      await loadData(nextSession.accessToken);
      setMessage("Фото профиля сохранено");
    });
  }

  async function saveOwnerProfile() {
    if (!session) {
      setMessage("Сессия не найдена. Войдите в аккаунт еще раз.");
      return;
    }
    await runAction("Сохраняем профиль...", async () => {
      const response = await api<User>("/auth/me", {
        body: JSON.stringify({ fullName: profileName }),
        method: "PATCH",
      }, token);
      const nextSession = { ...session, user: response.data };
      setSession(nextSession);
      saveStoredSession(nextSession);
      setProfilePhoto(response.data.photoUrl ?? "");
      await loadData(nextSession.accessToken);
      setMessage("Профиль обновлен");
    });
  }

  async function addTeamMember() {
    await runAction("Добавляем менеджера...", async () => {
      await api<User>("/auth/team", {
        body: JSON.stringify(teamForm),
        method: "POST",
      }, token);
      setTeamForm((current) => ({
        ...current,
        email: `manager-${Date.now().toString().slice(-5)}@example.com`,
        fullName: "Fleet Manager",
        password: "manager-pass-123",
      }));
      await loadData();
      setMessage("Менеджер добавлен и может войти по email и паролю");
    });
  }

  async function logout(nextMode: "login" | "register" = "login") {
    const stored = readStoredSession();
    if (stored?.refreshToken) {
      try {
        await api<{ ok: boolean }>("/auth/logout", {
          body: JSON.stringify({ refreshToken: stored.refreshToken }),
          method: "POST",
        }, stored.accessToken, false);
      } catch {
        // Local logout must still work if the network is unavailable.
      }
    }
    localStorage.removeItem("fleetcore-session");
    setAuthMode(nextMode);
    setSession(undefined);
  }

  if (clientIntakeParams) {
    return <ClientIntakeScreen params={clientIntakeParams} />;
  }

  if (!session) {
    return <AuthScreen initialMode={authMode} locale={locale} onLocaleChange={changeLocale} onSession={setSession} />;
  }

  const sectionFocus: SectionFocus = (() => {
    const firstIssue = operations.issues[0];
    if (activeSection === "Dashboard") {
      return {
        meta: firstIssue ? firstIssue.meta : `${operations.activeRentals.length} активных аренд · ${notifications.length} уведомлений`,
        primary: firstIssue
          ? { label: firstIssue.label, onClick: firstIssue.action }
          : { label: "Создать аренду", onClick: openRentalWorkflow },
        secondary: [
          { label: "Новая аренда", onClick: openRentalWorkflow },
          { label: "Документы", onClick: () => selectSection("Service") },
        ],
        title: firstIssue ? "Сначала решите самое важное" : "Сегодня всё спокойно",
      };
    }
    if (activeSection === "GPS") {
      return {
        meta: `${data.gpsDevices.length} устройств · ${operations.offlineGps.length} без сигнала`,
        primary: { label: "Подключить GPS", onClick: () => openOperation("gps") },
        secondary: [
          { label: "Обновить данные", onClick: () => void loadData() },
          { label: "Автомобили", onClick: () => selectSection("Vehicles") },
        ],
        title: operations.offlineGps.length ? "Проверьте автомобили без сигнала" : "GPS-мониторинг работает",
      };
    }
    if (activeSection === "Vehicles") {
      return {
        meta: `${data.vehicles.length} авто · ${operations.missingVehicleDocs.length} без документов`,
        primary: { label: "Добавить авто", onClick: openVehicleCreate },
        secondary: [
          { label: "Загрузить документ", onClick: requestVehicleDocumentUpload },
          { label: "Создать ТО", onClick: () => openOperation("service") },
        ],
        title: "Управляйте автопарком из одной карточки",
      };
    }
    if (activeSection === "Calendar") {
      return {
        meta: `${visibleRentals.filter((rental) => rental.status !== "closed").length} резерваций · ${visibleVehicles.filter((vehicle) => vehicle.status === "available").length} свободных авто`,
        primary: { label: "Создать аренду", onClick: openRentalWorkflow },
        secondary: [
          { label: "Открыть аренды", onClick: () => selectSection("Bookings") },
          { label: "Обновить календарь", onClick: () => void loadData() },
        ],
        title: "Calendly календарь резерваций",
      };
    }
    if (activeSection === "Drivers/Clients") {
      return {
        meta: `${data.customers.length} клиентов · ${data.customerDocuments.length} документов`,
        primary: { label: "Добавить клиента", onClick: openCustomerCreate },
        secondary: [
          { label: "Прикрепить авто", onClick: () => void assignVehicleToNewCustomer() },
          { label: "Загрузить паспорт", onClick: requestCustomerDocumentUpload },
        ],
        title: "Клиент, документы и аренды в одном профиле",
      };
    }
    if (activeSection === "Bookings") {
      const nextLabel = activeRentalFlow?.nextAction?.actionLabel ?? activeRentalFlow?.nextAction?.label;
      return {
        meta: selectedRentalDetail
          ? `${selectedRentalDetail.vehicle?.plateNumber ?? "Авто"} · ${rentalStatusLabel(locale, selectedRentalDetail.rental.status)}`
          : `${data.rentals.length} аренд`,
        primary: activeRentalFlow && nextLabel
          ? { disabled: activeRentalFlow.nextAction?.status === "blocked", label: nextLabel, onClick: () => void processFlowAction(activeRentalFlow) }
          : { label: "Создать аренду", onClick: openRentalWorkflow },
        secondary: [
          { label: "Новая аренда", onClick: openRentalWorkflow },
          { label: "Отправить ссылку", onClick: openShareDialog },
        ],
        title: "Ведите аренду от брони до финального расчёта",
      };
    }
    if (activeSection === "Finance") {
      return {
        meta: `${money.format(finance.netProfit)} чистая прибыль · ${overdueInvoices.length} просрочек`,
        primary: { label: "Провести оплату", onClick: () => openOperation("payment") },
        secondary: [
          { label: "Добавить расход", onClick: () => openOperation("expense") },
          { label: "Возврат депозита", onClick: () => openOperation("depositReturn") },
        ],
        title: overdueInvoices.length ? "Сначала закройте просроченные оплаты" : "Финансы под контролем",
      };
    }
    if (activeSection === "Service") {
      return {
        meta: `${data.files.length + data.documents.length + data.customerDocuments.length} файлов · ${operations.expiringDocs.length} сроков`,
        primary: { label: "Загрузить документ", onClick: requestVehicleDocumentUpload },
        secondary: [
          { label: "Папка клиента", onClick: requestCustomerFolderUpload },
          { label: "Создать ТО", onClick: () => openOperation("service") },
        ],
        title: "Документы, сроки и акты без лишних разделов",
      };
    }
    return {
      meta: `${session.companyId} · ${session.user.role}`,
      primary: { label: "Профиль владельца", onClick: openProfileDialog },
      secondary: [
        { label: "Мастер настройки", onClick: () => setOnboardingOpen(true) },
        { label: "Выйти", onClick: () => void logout() },
      ],
      title: "Настройки компании и доступа",
    };
  })();

  return (
    <main className="product-shell fleet-app">
      <input
        accept=".pdf,.jpg,.jpeg,.png,.webp"
        className="hidden-file-input"
        multiple
        onChange={(event) => {
          void saveVehicleFiles(event.currentTarget.files);
          event.currentTarget.value = "";
        }}
        ref={vehicleDocumentInputRef}
        type="file"
      />
      <input
        className="hidden-file-input"
        multiple
        onChange={(event) => {
          void saveVehicleFiles(event.currentTarget.files);
          event.currentTarget.value = "";
        }}
        ref={vehicleFolderInputRef}
        type="file"
        {...folderPickerProps}
      />
      <input
        accept=".jpg,.jpeg,.png,.webp"
        className="hidden-file-input"
        onChange={(event) => {
          void saveVehiclePhoto(event.currentTarget.files);
          event.currentTarget.value = "";
        }}
        ref={vehiclePhotoInputRef}
        type="file"
      />
      <input
        accept=".jpg,.jpeg,.png,.webp,.svg"
        className="hidden-file-input"
        onChange={(event) => {
          void saveCompanyLogo(event.currentTarget.files);
          event.currentTarget.value = "";
        }}
        ref={companyLogoInputRef}
        type="file"
      />
      <input
        accept=".pdf,.jpg,.jpeg,.png,.webp"
        className="hidden-file-input"
        multiple
        onChange={(event) => {
          void saveCustomerFiles(event.currentTarget.files);
          event.currentTarget.value = "";
        }}
        ref={customerDocumentInputRef}
        type="file"
      />
      <input
        className="hidden-file-input"
        multiple
        onChange={(event) => {
          void saveCustomerFiles(event.currentTarget.files);
          event.currentTarget.value = "";
        }}
        ref={customerFolderInputRef}
        type="file"
        {...folderPickerProps}
      />
      <input
        accept=".pdf,.doc,.docx,.html,.jpg,.jpeg,.png,.webp"
        className="hidden-file-input"
        multiple
        onChange={(event) => {
          void saveRentalContractFiles(event.currentTarget.files, "draft");
          event.currentTarget.value = "";
        }}
        ref={contractInputRef}
        type="file"
      />
      <input
        accept=".pdf,.jpg,.jpeg,.png,.webp"
        className="hidden-file-input"
        multiple
        onChange={(event) => {
          void saveDepositFiles(event.currentTarget.files);
          event.currentTarget.value = "";
        }}
        ref={depositInputRef}
        type="file"
      />
      <input
        accept=".pdf,.jpg,.jpeg,.png,.webp"
        className="hidden-file-input"
        multiple
        onChange={(event) => {
          void saveRentalContractFiles(event.currentTarget.files, "signed");
          event.currentTarget.value = "";
        }}
        ref={signatureInputRef}
        type="file"
      />
      <aside className="desktop-sidebar">
        <button className="profile profile-button" onClick={openProfileDialog} type="button">
          <div className="avatar">{profilePhoto ? <img alt="" src={profilePhoto} /> : session.user.fullName.slice(0, 1)}</div>
          <div>
            <strong>{session.user.fullName}</strong>
            <span>{session.user.role} · {session.companyId.slice(0, 12)}</span>
          </div>
          <small>Manage</small>
        </button>
        <nav className="side-nav">
          {sections.map((item) => (
            <button className={activeSection === item ? "active" : ""} key={item} onClick={() => selectSection(item)} type="button">
              <span className="nav-icon">{sectionIcon(item)}</span>
              <span className="nav-label">{sectionLabel(locale, item)}</span>
              {item === "Service" && notifications.length ? <em>{notifications.length}</em> : null}
            </button>
          ))}
        </nav>
        <div className="plan-card">
          <span>{session.user.role === "owner" ? t("tariff.name") : "Team"}</span>
          <strong>€499 <small>/ {t("tariff.month")}</small></strong>
          <div className="usage"><i /></div>
          <button onClick={() => selectSection("Settings")} type="button">{t("tariff.manage")}</button>
        </div>
        <button className="sidebar-signout-button" onClick={() => void logout()} type="button">
          <span>↩</span>
          <strong>{t("common.signOut")}</strong>
        </button>
      </aside>

      <section className="desktop-workspace">
        <header className="desktop-header">
          <div className="header-title-block">
            <button className="mobile-menu-button" onClick={() => { setCreateSheetOpen(false); setProfileOpen(false); setMobileDrawerOpen(true); }} type="button" aria-label="Open menu">☰</button>
            <div>
              <h1>{sectionLabel(locale, activeSection)}</h1>
              <p className={`api-status ${message ? "has-message" : ""}`}>{loading ? t("common.loading") : message || sectionSubtitle(locale, activeSection)}</p>
            </div>
          </div>
          <div className="header-actions">
            <div className={`global-search ${searchOpen && search.trim().length >= 2 ? "is-open" : ""}`} role="search">
              <span>⌕</span>
              <input
                aria-label={t("common.search")}
                placeholder={t("common.search")}
                value={search}
                onBlur={() => window.setTimeout(() => setSearchOpen(false), 160)}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setAiSearchError("");
                  if (aiSearch?.query !== event.target.value.trim()) setAiSearch(undefined);
                  setSearchOpen(true);
                }}
                onFocus={() => setSearchOpen(true)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void runAiSearch();
                  }
                }}
              />
              <button
                aria-label="AI поиск"
                className={`search-ai-button ${aiSearchLoading ? "loading" : ""}`}
                disabled={aiSearchLoading}
                onClick={() => void runAiSearch()}
                onMouseDown={(event) => event.preventDefault()}
                type="button"
              >
                {aiSearchLoading ? "..." : "AI"}
              </button>
              <button
                aria-label="Голосовой поиск"
                className={`search-voice-button ${voiceListening ? "listening" : ""}`}
                onClick={startVoiceSearch}
                onMouseDown={(event) => event.preventDefault()}
                type="button"
              >
                {voiceListening ? "●" : "🎙"}
              </button>
              {search ? <button aria-label="Очистить поиск" className="search-clear-button" onClick={() => { setSearch(""); setSearchOpen(false); }} onMouseDown={(event) => event.preventDefault()} type="button">×</button> : null}
              {searchOpen && search.trim().length >= 2 ? (
                <div className="global-search-results" data-testid="global-search-results">
                  <div className="search-results-head">
                    <strong>{aiSearch ? `AI поиск · ${aiSearch.mode === "openai" ? "OpenAI" : "local"}` : "Результаты поиска"}</strong>
                    <span>{searchResults.length ? `${searchResults.length}` : "0"}</span>
                  </div>
                  {aiSearch?.summary ? <p className="search-ai-summary">{aiSearch.summary}</p> : null}
                  {aiSearchError ? <p className="search-ai-error">{aiSearchError}</p> : null}
                  {searchResults.map((result) => (
                    <button
                      className="search-result-row"
                      key={result.id}
                      onClick={() => openSearchResult(result)}
                      onPointerDown={(event) => {
                        event.preventDefault();
                        openSearchResult(result);
                      }}
                      type="button"
                    >
                      <span>{result.kind === "vehicle" ? "Авто" : result.kind === "customer" ? "Клиент" : result.kind === "rental" ? "Бронь" : result.kind === "finance" ? "Финансы" : result.kind === "gps" ? "GPS" : "Документ"}</span>
                      <div>
                        <strong>{result.label}</strong>
                        <small>{result.meta}</small>
                      </div>
                    </button>
                  ))}
                  {!searchResults.length ? (
                    <div className="search-empty-state">
                      <strong>Ничего не найдено</strong>
                      <span>Попробуйте номер авто, VIN, имя клиента, телефон, email или нажмите AI.</span>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
            <LanguageSelect locale={locale} onChange={changeLocale} />
            <button className="ghost-button" disabled={Boolean(busyAction)} onClick={() => void loadData()} title={t("common.refresh")} type="button">↻</button>
            <button className="primary-button" disabled={Boolean(busyAction)} onClick={openCreateSheet} type="button">{busyAction ? "..." : "+ Создать"}</button>
          </div>
        </header>

        <SimplifiedCommandCenter
          busy={Boolean(busyAction)}
          busyAction={busyAction}
          focus={sectionFocus}
          message={message}
          onCreateCustomer={openCustomerCreate}
          onCreateExpense={() => openOperation("expense")}
          onCreateService={() => openOperation("service")}
          onCreateVehicle={openVehicleCreate}
          onOpenWizard={openRentalWorkflow}
          onShareContract={openShareDialog}
          onUploadDocument={requestVehicleDocumentUpload}
          stats={workflowStats}
          subtitle={t("command.subtitle")}
          title={t("command.title")}
        />

        <WorkspaceStatusBanner loading={loading} message={message} />

        {activeSection === "Dashboard" ? (
          loading && !data.vehicles.length && !data.rentals.length ? (
            <DashboardLoadingState />
          ) : (
            <TodayOperationsDashboard
              cards={dashboardCards}
              gpsDevices={data.gpsDevices}
              locale={locale}
              onCreateBooking={openRentalWorkflow}
              onSelectVehicle={setSelectedVehicleId}
              rentals={visibleRentals}
              selectedVehicleId={selectedVehicle?.id}
              token={session.accessToken}
              vehicles={filteredVehicles}
            />
          )
        ) : null}

        {activeSection === "GPS" ? (
          <section className="workspace-grid">
            <div className="main-column">
              <MapPanel gpsDevices={data.gpsDevices} locale={locale} vehicles={filteredVehicles} rentals={visibleRentals} selectedVehicleId={selectedVehicle?.id} onSelect={setSelectedVehicleId} />
              <div className="quick-actions-grid">
                <button className="primary-button" disabled={Boolean(busyAction)} onClick={() => openOperation("gps")} type="button">{t("gps.connectVehicle")}</button>
                <button className="ghost-button" disabled={Boolean(busyAction)} onClick={() => void connectGps()} type="button">{t("gps.fastConnect")}</button>
              </div>
              <div className="table-panel gps-platform-panel">
                <div className="section-title compact-title"><h2>{t("gps.supported")}</h2><Badge value="Manual" /></div>
                <p>{t("gps.supportedHint")}</p>
                <div className="provider-grid">
                  <span>Google Maps</span>
                  <span>Apple Maps</span>
                  <span>Manual device</span>
                  <span>API-ready later</span>
                </div>
              </div>
            </div>
            <aside className="side-column">
              <div className="table-panel">
                <h2>{t("gps.devices")}</h2>
                {data.gpsDevices.map((device) => {
                  const vehicle = visibleVehicles.find((item) => item.id === device.vehicleId);
                  return <p className="history-row" key={device.id}>{vehicle?.plateNumber} · {device.provider} · {device.status} · {device.speedKph} км/ч</p>;
                })}
                {!data.gpsDevices.length ? <p className="history-row">{t("gps.empty")}</p> : null}
              </div>
            </aside>
          </section>
        ) : null}

        {activeSection === "Vehicles" ? (
          <section className="vehicles-workspace">
            <VehicleHero
              customer={activeCustomer}
              documentsCount={data.documents.filter((doc) => doc.vehicleId === selectedVehicle?.id).length}
              finance={finance.incomeByVehicle.find((item) => item.vehicle.id === selectedVehicle?.id)}
              locale={locale}
              onDocument={requestVehicleDocumentUpload}
              onExpense={() => openOperation("expense")}
              onPhoto={() => vehiclePhotoInputRef.current?.click()}
              onRemovePhoto={() => void removeVehiclePhoto(selectedVehicle)}
              onService={() => openOperation("service")}
              rental={activeRental}
              serviceCount={data.serviceRecords.filter((record) => record.vehicleId === selectedVehicle?.id).length}
              vehicle={selectedVehicle}
            />
            <div className="vehicle-kpi-strip">
              <article><span>{t("dashboard.totalVehicles")}</span><strong>{visibleVehicles.length}</strong></article>
              <article><span>{t("dashboard.available")}</span><strong>{visibleVehicles.filter((vehicle) => vehicle.status === "available").length}</strong></article>
              <article><span>{t("dashboard.activeRentals")}</span><strong>{visibleVehicles.filter((vehicle) => vehicle.status === "rented").length}</strong></article>
              <article><span>{t("vehicle.documents")}</span><strong>{data.documents.length}</strong></article>
            </div>
            <div className="main-column">
              <ListControlBar
                count={sortedVehicles.length}
                emptyLabel="Нет авто в текущем виде"
                label="Fleet list"
                onClearSelection={() => setSelectedFleetIds([])}
                onExport={() => exportVehiclesCsv(sortedVehicles)}
                onExportSelected={() => exportVehiclesCsv(selectedVehiclesForBulk)}
                onSelectVisible={() => setSelectedFleetIds(sortedVehicles.map((vehicle) => vehicle.id))}
                onSortChange={(value) => changeVehicleSort(value as VehicleSortKey)}
                selectedCount={selectedFleetIds.length}
                sortOptions={vehicleSortViews}
                sortValue={vehicleSort}
              />
              <div className="filter-row">
                {(["all", "available", "rented", "maintenance", "offline"] as const).map((filter) => (
                  <button className={mapFilter === filter ? "active" : ""} key={filter} onClick={() => setMapFilter(filter)} type="button">{filter}</button>
                ))}
              </div>
              <div className="vehicle-card-grid">
                {sortedVehicles.map((vehicle) => {
                  const rental = visibleRentals.find((item) => item.vehicleId === vehicle.id && item.status !== "closed");
                  const customer = data.customers.find((item) => item.id === rental?.customerId);
                  const gps = data.gpsDevices.find((item) => item.vehicleId === vehicle.id);
                  const vehicleFinance = finance.incomeByVehicle.find((item) => item.vehicle.id === vehicle.id);
                  const hasRentalHistory = visibleRentals.some((item) => item.vehicleId === vehicle.id);
                  return <VehicleGridCard canDelete={!hasRentalHistory} customer={customer} finance={vehicleFinance} gps={gps} isSelected={selectedVehicleId === vehicle.id} key={vehicle.id} locale={locale} onDelete={() => void removeVehicle(vehicle)} onSelect={() => setSelectedVehicleId(vehicle.id)} rental={rental} selectedForBulk={selectedFleetIds.includes(vehicle.id)} vehicle={vehicle} onToggleBulk={() => setSelectedFleetIds((current) => current.includes(vehicle.id) ? current.filter((id) => id !== vehicle.id) : [...current, vehicle.id])} />;
                })}
              </div>
              {!sortedVehicles.length ? (
                <EmptyWorkspaceState
                  action="Добавить автомобиль"
                  description="Измените поиск или создайте новый автомобиль, чтобы начать работу с автопарком."
                  onAction={openVehicleCreate}
                  title="Автомобили не найдены"
                />
              ) : null}
            </div>
            <VehicleForm form={vehicleForm} formRef={vehicleCreateRef} locale={locale} setForm={setVehicleForm} onSubmit={submitVehicle} />
          </section>
        ) : null}

        {activeSection === "Drivers/Clients" ? (
          <section className="client-crm-workspace">
            <div className="client-list-panel table-panel">
              <div className="section-title compact-title">
                <div>
                  <h2>Client CRM</h2>
                  <p>Клиенты, документы, аренды, долги и прикрепленные автомобили.</p>
                </div>
                <Badge value={String(data.customers.length)} />
              </div>
              <ListControlBar
                count={filteredCustomers.length}
                emptyLabel="Нет клиентов в текущем виде"
                label="CRM list"
                onClearSelection={() => setSelectedClientIds([])}
                onExport={() => exportCustomersCsv(filteredCustomers)}
                onExportSelected={() => exportCustomersCsv(selectedCustomersForBulk)}
                onSelectVisible={() => setSelectedClientIds(filteredCustomers.map((customer) => customer.id))}
                onSortChange={(value) => changeCustomerSort(value as CustomerSortKey)}
                selectedCount={selectedClientIds.length}
                sortOptions={customerSortViews}
                sortValue={customerSort}
              />
              {filteredCustomers.map((customer) => (
                <article className={`customer-line ${selectedCustomer?.id === customer.id ? "selected" : ""} ${selectedClientIds.includes(customer.id) ? "bulk-selected" : ""}`} key={customer.id} onClick={() => setSelectedCustomerId(customer.id)} onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") setSelectedCustomerId(customer.id);
                }} role="button" tabIndex={0}>
                  <button aria-pressed={selectedClientIds.includes(customer.id)} className="bulk-check" onClick={(event) => {
                    event.stopPropagation();
                    setSelectedClientIds((current) => current.includes(customer.id) ? current.filter((id) => id !== customer.id) : [...current, customer.id]);
                  }} type="button">{selectedClientIds.includes(customer.id) ? "✓" : "+"}</button>
                  <div className="avatar small">{customer.displayName.slice(0, 1)}</div>
                  <div><strong>{customer.displayName}</strong><span>{customer.phone} · {customer.email}</span></div>
                  <Badge value={customer.riskLevel === "low" ? t("status.active") : customer.riskLevel} />
                </article>
              ))}
              {!filteredCustomers.length ? (
                <EmptyWorkspaceState
                  action="Добавить клиента"
                  description="Измените поиск или создайте нового клиента. После создания можно сразу закрепить автомобиль."
                  onAction={() => customerCreateRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
                  title="Клиенты не найдены"
                />
              ) : null}
            </div>
            <ClientProfilePanel
              customer={selectedCustomer}
              customerDocuments={data.customerDocuments}
              invoices={data.invoices}
              onAssignVehicle={() => void assignVehicleToNewCustomer()}
              onCreateBooking={openRentalWorkflow}
              onCreateVehicle={openVehicleCreate}
              onDocumentPreview={setDocumentPreview}
              onUploadDocument={requestCustomerDocumentUpload}
              onUploadFolder={requestCustomerFolderUpload}
              payments={data.payments}
              rentals={visibleRentals}
              vehicles={visibleVehicles}
            />
            <aside className="side-column client-create-column">
              <CustomerForm
                form={customerForm}
                formRef={customerCreateRef}
                locale={locale}
                onAssignVehicle={() => void assignVehicleToNewCustomer()}
                onCreateVehicle={openVehicleCreate}
                onSubmit={submitCustomer}
                rentals={visibleRentals}
                setForm={setCustomerForm}
                vehicles={visibleVehicles}
              />
            </aside>
          </section>
        ) : null}

        {activeSection === "Calendar" ? (
          <CalendarWorkspace
            calendlyUrl={CALENDLY_URL}
            customers={data.customers}
            locale={locale}
            onCreateBooking={openRentalWorkflow}
            rentals={visibleRentals}
            vehicles={visibleVehicles}
          />
        ) : null}

        {activeSection === "Bookings" ? (
          <section className="table-panel bookings-board">
            <div className="section-title compact-title">
              <div>
                <h2>Rental Details</h2>
                <p>Бронь, договор, ссылка клиенту, подпись, депозит, выдача, возврат и финальный расчёт.</p>
              </div>
              <button className="primary-button" disabled={Boolean(busyAction)} onClick={openRentalWorkflow} type="button">Создать аренду</button>
            </div>
            <div className="rental-details-layout">
              <RentalDetailPanel
                busy={Boolean(busyAction)}
                detail={selectedRentalDetail}
                locale={locale}
                money={money}
                onCreateContract={() => void createDraftContract()}
                onCreatePickup={(rental) => void createRentalChecklist("pickup", rental)}
                onCreateReturn={(rental) => void createRentalChecklist("return", rental)}
                onOpenPdf={(detail) => detail.flow ? void openRentalContractPdf(detail.flow) : void openRentalContractPdfForRental(detail.rental)}
                onPay={() => openOperation("payment")}
                onRequestContractUpload={requestContractUpload}
                onRequestSignature={requestSignatureUpload}
                onSettle={(detail) => detail.flow ? void finalizeRentalFlowAction(detail.flow) : openOperation("depositReturn")}
                onShare={(channel, rental) => void shareRentalContract(channel, rental)}
                onSign={(detail) => detail.flow ? void signRentalFlow(detail.flow) : requestSignatureUpload()}
              />
              <aside className="rental-details-side">
                <section className="table-panel rental-side-focus">
                  <span className="eyebrow">Быстро</span>
                  <h3>Новая аренда</h3>
                  <p>Создайте бронь, а FleetCore дальше проведёт по договору, оплате, выдаче и возврату.</p>
                  <button className="primary-button full" disabled={Boolean(busyAction)} onClick={openRentalWorkflow} type="button">Создать аренду</button>
                </section>
                <details className="calendar-collapse">
                  <summary>Calendly резервации</summary>
                  <section className="calendly-mini-panel">
                    <p>Используйте Calendly как единый календарь свободных слотов. FleetCore аренды остаются в карточке аренды и готовы к отправке клиенту.</p>
                    <a className="ghost-button full" href={CALENDLY_URL} rel="noreferrer" target="_blank">Открыть Calendly</a>
                  </section>
                </details>
              </aside>
            </div>
            <RentalWorkbench
              busy={Boolean(busyAction)}
              checklists={data.rentalChecklists}
              contractEvents={data.rentalContractEvents}
              contracts={data.rentalContracts}
              customers={data.customers}
              locale={locale}
              money={money}
              onCreatePickup={(rental) => void createRentalChecklist("pickup", rental)}
              onCreateReturn={(rental) => void createRentalChecklist("return", rental)}
              onOpenPdf={(rental) => void openRentalContractPdfForRental(rental)}
              onPay={() => openOperation("payment")}
              onSelectRental={setSelectedRentalId}
              onShare={(channel, rental) => void shareRentalContract(channel, rental)}
              rentals={visibleRentals}
              selectedRentalId={selectedRental?.id}
              vehicles={visibleVehicles}
            />
          </section>
        ) : null}

        {activeSection === "Finance" ? (
          <section className="finance-layout">
            <article className="metric-card"><span>{t("finance.income")}</span><strong className="green">{money.format(finance.totalIncome)}</strong></article>
            <article className="metric-card"><span>{t("finance.expenses")}</span><strong className="red">{money.format(finance.expenses)}</strong></article>
            <article className="metric-card"><span>{t("finance.net")}</span><strong className="blue">{money.format(finance.netProfit)}</strong></article>
            <article className="metric-card"><span>Депозиты</span><strong className="green">{money.format(totalDeposits)}</strong></article>
            <article className="metric-card"><span>Просрочено</span><strong className="red">{overdueInvoices.length}</strong></article>
            <div className="finance-primary-actions">
              <button className="primary-button" disabled={Boolean(busyAction)} onClick={() => openOperation("payment")} type="button">Провести оплату</button>
              <details className="action-menu">
                <summary>Финансовые действия</summary>
                <div>
                  <button className="ghost-button" disabled={Boolean(busyAction)} onClick={() => openOperation("expense")} type="button">Добавить расход</button>
                  <button className="ghost-button" disabled={Boolean(busyAction)} onClick={requestDepositUpload} type="button">Загрузить депозит/возврат</button>
                  <button className="ghost-button" disabled={Boolean(busyAction)} onClick={() => openOperation("depositReturn")} type="button">Оформить возврат депозита</button>
                </div>
              </details>
            </div>
            <div className="table-panel finance-wide">
              <h2>ROI по каждому авто</h2>
              {finance.incomeByVehicle.map((item) => (
                <article className="finance-row" key={item.vehicle.id}>
                  <div><strong>{item.vehicle.make} {item.vehicle.model}</strong><span>{item.vehicle.plateNumber}</span></div>
                  <span>Доход {money.format(item.income)}</span>
                  <span>Расход {money.format(item.expenses)}</span>
                  <Badge value={`ROI ${item.roi}%`} />
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {activeSection === "Service" ? (
          <section className="workspace-grid">
            <NotificationsPanel locale={locale} notifications={notifications} />
            <DocumentVault
              checklists={data.rentalChecklists}
              customerDocuments={data.customerDocuments}
              files={data.files}
              invoices={data.invoices}
              locale={locale}
              onCustomerFolder={requestCustomerFolderUpload}
              onDocumentPreview={setDocumentPreview}
              onService={() => openOperation("service")}
              onVehicleDocument={requestVehicleDocumentUpload}
              onVehicleFolder={requestVehicleFolderUpload}
              rentalContracts={data.rentalContracts}
              rentalContractEvents={data.rentalContractEvents}
              rentals={visibleRentals}
              customers={data.customers}
              payments={data.payments}
              serviceRecords={data.serviceRecords}
              vehicles={visibleVehicles}
              vehicleDocuments={data.documents}
            />
          </section>
        ) : null}

        {activeSection === "Settings" ? (
          <section className="settings-grid">
            <section className="table-panel settings-panel company-branding-panel">
              <div className="section-title compact-title">
                <h2>Company branding</h2>
                <Badge value="Premium" />
              </div>
              <div className="brand-preview" style={{ borderColor: companyForm.brandColor }}>
                <div className="brand-logo" style={{ background: companyForm.brandColor }}>
                  {companyForm.logoUrl ? <img alt="" src={companyForm.logoUrl} /> : companyForm.tradingName.slice(0, 1)}
                </div>
                <div>
                  <strong>{companyForm.tradingName || data.company?.tradingName}</strong>
                  <span>{companyForm.legalName || data.company?.legalName}</span>
                </div>
              </div>
              <div className="brand-actions">
                <button className="ghost-button" disabled={Boolean(busyAction)} onClick={() => companyLogoInputRef.current?.click()} type="button">{companyForm.logoUrl ? "Заменить логотип" : "Загрузить логотип"}</button>
                {companyForm.logoUrl ? <button className="ghost-button" disabled={Boolean(busyAction)} onClick={() => void removeCompanyLogo()} type="button">Убрать логотип</button> : null}
              </div>
              <div className="branding-form">
                <label>Trading name<input value={companyForm.tradingName} onChange={(event) => setCompanyForm({ ...companyForm, tradingName: event.target.value })} /></label>
                <label>Legal name<input value={companyForm.legalName} onChange={(event) => setCompanyForm({ ...companyForm, legalName: event.target.value })} /></label>
                <label>Brand color<input type="color" value={companyForm.brandColor} onChange={(event) => setCompanyForm({ ...companyForm, brandColor: event.target.value })} /></label>
                <label>Billing email<input inputMode="email" type="email" value={companyForm.billingEmail} onChange={(event) => setCompanyForm({ ...companyForm, billingEmail: event.target.value })} /></label>
                <label>VAT / NIP<input value={companyForm.taxId} onChange={(event) => setCompanyForm({ ...companyForm, taxId: event.target.value })} /></label>
                <label>IBAN<input value={companyForm.iban} onChange={(event) => setCompanyForm({ ...companyForm, iban: event.target.value })} /></label>
                <label className="wide-field">Business address<textarea value={companyForm.businessAddress} onChange={(event) => setCompanyForm({ ...companyForm, businessAddress: event.target.value })} /></label>
                <label className="wide-field">Contract footer<textarea value={companyForm.contractFooter} onChange={(event) => setCompanyForm({ ...companyForm, contractFooter: event.target.value })} /></label>
              </div>
              <button className="primary-button full" disabled={Boolean(busyAction)} onClick={() => void saveCompanyBranding()} type="button">Сохранить бренд компании</button>
            </section>
            <section className="table-panel settings-panel">
              <h2>{t("settings.account")}</h2>
              <p className="history-row">{session.user.fullName} · {session.user.email}</p>
              <p className="history-row">{t("settings.role")}: {session.user.role}</p>
              <p className="history-row">{t("settings.companyId")}: {session.companyId}</p>
              <button className="primary-button full" onClick={() => setOnboardingOpen(true)} type="button">Открыть мастер настройки</button>
              <button className="ghost-button full-button" onClick={() => void requestEmailVerification()} type="button">Verify email</button>
              <button className="ghost-button full-button" onClick={() => void logout()} type="button">{t("common.signOut")}</button>
            </section>

            <section className="table-panel settings-panel">
              <h2>{t("settings.integrations")}</h2>
              <p className="history-row">{t("settings.maps")}: {GOOGLE_MAPS_API_KEY ? t("settings.mapsActive") : t("settings.mapsPreview")}</p>
              <p className="history-row">{t("settings.platform")}</p>
              <button className="primary-button full" onClick={() => openOperation("gps")} type="button">{t("gps.connect")}</button>
            </section>

            <section className="table-panel settings-panel">
              <h2>Subscription</h2>
              <p className="history-row">Business plan: €499 / {t("tariff.month")}</p>
              <p className="history-row">Automatic monthly billing: Stripe-ready</p>
              <button className="ghost-button full-button" onClick={() => setMessage("Stripe billing готов к подключению. Следующий шаг: добавить Stripe keys и webhook.")} type="button">Подключить Stripe позже</button>
            </section>

            <section className="table-panel settings-panel">
              <h2>{t("settings.data")}</h2>
              <p className="history-row">{t("settings.vehicles")}: {data.vehicles.length}</p>
              <p className="history-row">{t("settings.customers")}: {data.customers.length}</p>
              <p className="history-row">{t("settings.documents")}: {data.documents.length + data.customerDocuments.length}</p>
              <p className="history-row">{t("settings.contracts")}: {data.rentalContracts.length}</p>
              <button className="ghost-button full-button" onClick={() => void loadData()} type="button">{t("settings.update")}</button>
            </section>

            <section className="table-panel settings-panel settings-wide">
              <h2>Document center</h2>
              <p className="history-row">Storage provider: database now, S3-ready metadata enabled</p>
              <div className="file-object-list">
                {data.files.slice(0, 12).map((file) => <FileObjectRow file={file} key={file.id} onPreview={setDocumentPreview} />)}
                {!data.files.length ? <p className="history-row">No uploaded files yet</p> : null}
              </div>
            </section>
          </section>
        ) : null}
      </section>

      {onboardingOpen ? (
        <OnboardingWizard
          company={data.company}
          customersCount={data.customers.length}
          gpsCount={data.gpsDevices.length}
          onAction={runOnboardingAction}
          onClose={closeOnboarding}
          rentalsCount={data.rentals.length}
          teamCount={data.teamUsers.length}
          vehiclesCount={data.vehicles.length}
        />
      ) : null}

      {operation ? (
        <OperationDialog
          data={data}
          files={operationFiles}
          form={operationForm}
          kind={operation}
          locale={locale}
          onChange={setOperationForm}
          onClose={() => setOperation(undefined)}
          onFiles={setOperationFiles}
          onSubmit={submitOperation}
          saving={Boolean(busyAction)}
        />
      ) : null}

      {profileOpen ? (
        <OwnerProfileDialog
          busy={Boolean(busyAction)}
          form={teamForm}
          onAddTeamMember={() => void addTeamMember()}
          onClose={() => setProfileOpen(false)}
          onFormChange={setTeamForm}
          onLogout={() => void logout()}
          onNameChange={setProfileName}
          onPhoto={(file) => void saveProfilePhoto(file)}
          onSave={() => void saveOwnerProfile()}
          photo={profilePhoto}
          profileName={profileName}
          session={session}
          teamUsers={data.teamUsers}
        />
      ) : null}

      {shareDialogOpen ? (
        <ShareContractDialog
          busy={Boolean(busyAction)}
          onClose={closeShareDialog}
          onShare={(channel) => {
            setShareDialogOpen(false);
            void shareRentalContract(channel);
          }}
          rental={activeRental ?? data.rentals[0]}
          customer={activeCustomer ?? data.customers[0]}
          vehicle={selectedVehicle ?? data.vehicles[0]}
        />
      ) : null}

      {clientIntakeDialogOpen ? (
        <ClientIntakeShareDialog
          busy={Boolean(busyAction)}
          customer={activeCustomer ?? selectedCustomer ?? data.customers[0]}
          intakeUrl={buildClientIntakeUrl(session, selectedRental ?? activeRental)}
          onClose={() => setClientIntakeDialogOpen(false)}
          onShare={shareClientIntake}
          vehicle={selectedVehicle}
        />
      ) : null}

      {rentalWorkflowOpen ? (
        <RentalWorkflow
          busy={Boolean(busyAction)}
          customers={data.customers}
          initialCustomer={activeCustomer ?? selectedCustomer}
          initialRental={selectedRental}
          initialVehicle={selectedVehicle}
          money={money}
          onClose={() => setRentalWorkflowOpen(false)}
          onReturn={closeRentalWorkflowReturn}
          onSave={saveRentalWorkflow}
          onSend={sendRentalWorkflowConfirmation}
          rentals={visibleRentals}
          vehicles={visibleVehicles}
        />
      ) : null}

      {rentalWizardOpen ? (
        <RentalScenarioWizard
          busy={Boolean(busyAction)}
          data={data}
          locale={locale}
          money={money}
          onClose={() => setRentalWizardOpen(false)}
          onRunStep={(step) => void runRentalWizardStep(step)}
          selectedRental={selectedRental}
        />
      ) : null}

      {documentPreview ? (
        <DocumentPreviewDialog
          document={documentPreview}
          onClose={() => setDocumentPreview(undefined)}
        />
      ) : null}

      <button className="mobile-fab" disabled={Boolean(busyAction)} onClick={openCreateSheet} type="button" aria-label="Create">+</button>

      <CreateActionSheet
        busy={Boolean(busyAction)}
        locale={locale}
        onClose={() => setCreateSheetOpen(false)}
        onCreateCustomer={openCustomerCreate}
        onCreateExpense={() => openOperation("expense")}
        onCreateService={() => openOperation("service")}
        onCreateVehicle={openVehicleCreate}
        onOpenClientIntake={() => setClientIntakeDialogOpen(true)}
        onOpenRentalWizard={openRentalWorkflow}
        onShareContract={openShareDialog}
        onUploadDocument={requestVehicleDocumentUpload}
        open={createSheetOpen}
      />

      <MobileDrawer
        activeSection={activeSection}
        locale={locale}
        notificationsCount={notifications.length}
        onClose={() => setMobileDrawerOpen(false)}
        onLocaleChange={changeLocale}
        onLogin={() => void logout("login")}
        onLogout={() => void logout()}
        onOpenProfile={() => {
          setMobileDrawerOpen(false);
          setCreateSheetOpen(false);
          openProfileDialog();
        }}
        onRegister={() => void logout("register")}
        onSelect={(section) => {
          selectSection(section);
        }}
        open={mobileDrawerOpen}
        photo={profilePhoto}
        planMonth={t("tariff.month")}
        planName={t("tariff.name")}
        planSubtitle={t("drawer.planSubtitle")}
        profileLabel={t("drawer.profileTeam")}
        registerLabel={t("auth.register")}
        session={session}
        switchAccountLabel={t("drawer.switchAccount")}
      />
    </main>
  );
}

function ClientProfilePanel({
  customer,
  customerDocuments,
  invoices,
  onAssignVehicle,
  onCreateBooking,
  onCreateVehicle,
  onDocumentPreview,
  onUploadDocument,
  onUploadFolder,
  payments,
  rentals,
  vehicles,
}: {
  customer: Customer | undefined;
  customerDocuments: CustomerDocument[];
  invoices: Invoice[];
  onAssignVehicle: () => void;
  onCreateBooking: () => void;
  onCreateVehicle: () => void;
  onDocumentPreview: (document: DocumentPreview) => void;
  onUploadDocument: () => void;
  onUploadFolder: () => void;
  payments: Payment[];
  rentals: Rental[];
  vehicles: Vehicle[];
}) {
  if (!customer) {
    return (
      <section className="client-profile-panel empty">
        <span className="eyebrow">Client Profile</span>
        <h2>Клиент не выбран</h2>
        <p>Создайте клиента или выберите его из CRM-списка.</p>
        <button className="primary-button" onClick={onCreateBooking} type="button">Создать бронь</button>
      </section>
    );
  }

  const clientRentals = rentals.filter((rental) => rental.customerId === customer.id);
  const clientRentalIds = new Set(clientRentals.map((rental) => rental.id));
  const clientInvoices = invoices.filter((invoice) => invoice.customerId === customer.id || (invoice.rentalId && clientRentalIds.has(invoice.rentalId)));
  const paidAmount = clientInvoices.reduce((sum, invoice) => sum + payments.filter((payment) => payment.invoiceId === invoice.id).reduce((paymentSum, payment) => paymentSum + payment.amount, 0), 0);
  const invoiceTotal = clientInvoices.reduce((sum, invoice) => sum + invoice.total, 0);
  const unpaidAmount = Math.max(0, invoiceTotal - paidAmount);
  const docs = customerDocuments.filter((doc) => doc.customerId === customer.id);
  const verifiedDocs = docs.filter((doc) => doc.verified).length;
  const activeRental = clientRentals.find((rental) => rental.status !== "closed");
  const activeVehicle = vehicles.find((vehicle) => vehicle.id === activeRental?.vehicleId);
  const lastRental = clientRentals[0];
  const lifetimeValue = clientRentals.reduce((sum, rental) => sum + rental.totalAmount, 0);
  const readiness = [
    { done: docs.length > 0, label: "Паспорт/ID загружен" },
    { done: verifiedDocs > 0, label: "Документы проверены" },
    { done: unpaidAmount <= 0, label: "Нет долга" },
    { done: Boolean(activeRental), label: "Есть активная аренда" },
  ];

  return (
    <section className="client-profile-panel" data-testid="client-profile-panel">
      <div className="client-profile-hero">
        <div className="avatar large">{customer.displayName.slice(0, 1)}</div>
        <div>
          <span className="eyebrow">Client Profile</span>
          <h2>{customer.displayName}</h2>
          <p>{customer.phone} · {customer.email}</p>
        </div>
        <Badge value={customer.riskLevel === "low" ? "active" : customer.riskLevel} />
      </div>

      <div className="client-profile-kpis">
        <article><span>Аренды</span><strong>{clientRentals.length}</strong></article>
        <article><span>Документы</span><strong>{verifiedDocs}/{docs.length}</strong></article>
        <article><span>Оплачено</span><strong>{money.format(paidAmount)}</strong></article>
        <article className={unpaidAmount > 0 ? "attention" : "done"}><span>Долг</span><strong>{money.format(unpaidAmount)}</strong></article>
      </div>

      <div className="client-priority-card">
        <div>
          <span>Следующее лучшее действие</span>
          <strong>{unpaidAmount > 0 ? "Закрыть долг клиента" : !docs.length ? "Загрузить паспорт / ID" : activeRental ? "Контролировать текущую аренду" : "Создать новую бронь"}</strong>
          <small>{lastRental ? `Последняя аренда: ${dateFmt.format(new Date(lastRental.pickupAt))} · LTV ${money.format(lifetimeValue)}` : "Клиент готов к первой аренде"}</small>
        </div>
        <button className="primary-button" onClick={activeRental ? onAssignVehicle : onCreateBooking} type="button">
          {activeRental ? "Открыть авто" : "Новая бронь"}
        </button>
      </div>

      <div className="client-workflow-grid">
        <section>
          <h3>Готовность клиента</h3>
          {readiness.map((item) => (
            <p className={item.done ? "done" : "attention"} key={item.label}><span>{item.done ? "✓" : "!"}</span><strong>{item.label}</strong></p>
          ))}
        </section>
        <section>
          <h3>Текущая аренда</h3>
          {activeRental ? (
            <>
              <strong>{activeVehicle ? `${activeVehicle.make} ${activeVehicle.model}` : "Автомобиль"}</strong>
              <span>{activeVehicle?.plateNumber ?? "без номера"} · возврат {dateFmt.format(new Date(activeRental.returnAt))}</span>
            </>
          ) : <span>Нет активной аренды</span>}
        </section>
      </div>

      <div className="client-action-bar">
        <button className="primary-button" onClick={onCreateBooking} type="button">Новая бронь</button>
        <details className="action-menu">
          <summary>Еще по клиенту</summary>
          <div>
            <button className="ghost-button" onClick={onAssignVehicle} type="button">Добавить авто клиенту</button>
            <button className="ghost-button" onClick={onUploadDocument} type="button">Паспорт / ID</button>
            <button className="ghost-button" onClick={onUploadFolder} type="button">Папка клиента</button>
            <button className="ghost-button" onClick={onCreateVehicle} type="button">Новое авто</button>
          </div>
        </details>
      </div>

      <div className="client-profile-columns">
        <section>
          <h3>История аренд</h3>
          {clientRentals.slice(0, 5).map((rental) => {
            const vehicle = vehicles.find((item) => item.id === rental.vehicleId);
            return <p className="history-row" key={rental.id}>{vehicle?.plateNumber ?? "Авто"} · {rental.status} · {money.format(rental.totalAmount)}</p>;
          })}
          {!clientRentals.length ? <p className="history-row">Истории аренд пока нет.</p> : null}
        </section>
        <section>
          <h3>Документы клиента</h3>
          {docs.slice(0, 5).map((doc) => (
            <p className="history-row" key={doc.id}>
              <FilePreviewLink fileUrl={doc.fileUrl} onPreview={onDocumentPreview} title={`${doc.title} · ${doc.verified ? "verified" : "pending"}`} />
            </p>
          ))}
          {!docs.length ? <p className="history-row">Загрузите паспорт, ID или водительские права.</p> : null}
        </section>
      </div>
    </section>
  );
}

function WorkspaceStatusBanner({ loading, message }: { loading: boolean; message: string }) {
  if (!loading && !message) return null;
  const normalized = message.toLowerCase();
  const tone = loading ? "loading" : /ошибка|error|failed|не удалось|нельзя|invalid|unauthorized|forbidden/.test(normalized) ? "error" : "success";
  const title = tone === "loading" ? "Синхронизируем данные" : tone === "error" ? "Нужно проверить действие" : "Готово";
  const text = loading ? "FleetCore обновляет автомобили, аренды, документы и финансы." : message;

  return (
    <section className={`workspace-status-banner ${tone}`} role={tone === "error" ? "alert" : "status"}>
      <span>{tone === "loading" ? "↻" : tone === "error" ? "!" : "✓"}</span>
      <div>
        <strong>{title}</strong>
        <p>{text}</p>
      </div>
    </section>
  );
}

function createDashboardFolder(index: number, name?: string): DashboardFolder {
  return {
    createdAt: new Date().toISOString(),
    files: [],
    id: `folder_${Date.now().toString(36)}_${index.toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    name: name?.trim() || `Папка ${index}`,
    notes: [],
  };
}

function defaultDashboardFolders() {
  return [];
}

function isLegacyDashboardFolder(folder: DashboardFolder) {
  return /^Папка\s+[1-7]$/i.test(folder.name.trim());
}

function normalizeDashboardFolder(folder: DashboardFolder): DashboardFolder {
  return {
    ...folder,
    files: Array.isArray(folder.files) ? folder.files : [],
    notes: Array.isArray(folder.notes) ? folder.notes : [],
  };
}

function DashboardFolders({ token }: { token: string | undefined }) {
  const storageKey = "fleetcore-dashboard-folders";
  const [activeFolderId, setActiveFolderId] = useState<string | undefined>();
  const [folderNote, setFolderNote] = useState("");
  const [folderBusy, setFolderBusy] = useState(false);
  const [folderMessage, setFolderMessage] = useState("");
  const [folders, setFolders] = useState<DashboardFolder[]>(() => {
    if (typeof window === "undefined") return defaultDashboardFolders();
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (!stored) return defaultDashboardFolders();
      const parsed = JSON.parse(stored) as DashboardFolder[];
      if (!Array.isArray(parsed)) return defaultDashboardFolders();
      return parsed.filter((folder) => !isLegacyDashboardFolder(folder)).map(normalizeDashboardFolder);
    } catch {
      return defaultDashboardFolders();
    }
  });
  const activeFolder = folders.find((folder) => folder.id === activeFolderId);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(folders));
  }, [folders]);

  function addFolder() {
    const nextIndex = folders.length + 1;
    const requestedName = window.prompt("Название папки", `Папка ${nextIndex}`) ?? "";
    setFolders((current) => [...current, createDashboardFolder(nextIndex, requestedName || `Папка ${nextIndex}`)]);
  }

  function updateFolder(folderId: string, updater: (folder: DashboardFolder) => DashboardFolder) {
    setFolders((current) => current.map((folder) => folder.id === folderId ? normalizeDashboardFolder(updater(normalizeDashboardFolder(folder))) : folder));
  }

  function addFolderNote() {
    const text = folderNote.trim();
    if (!activeFolder || !text) return;
    updateFolder(activeFolder.id, (folder) => ({
      ...folder,
      notes: [
        ...(folder.notes ?? []),
        {
          createdAt: new Date().toISOString(),
          id: `note_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
          text,
        },
      ],
    }));
    setFolderNote("");
    setFolderMessage("Заметка добавлена");
  }

  function removeFolderNote(folderId: string, noteId: string) {
    updateFolder(folderId, (folder) => ({
      ...folder,
      notes: (folder.notes ?? []).filter((note) => note.id !== noteId),
    }));
  }

  function removeFolderFile(folderId: string, fileId: string) {
    updateFolder(folderId, (folder) => ({
      ...folder,
      files: (folder.files ?? []).filter((file) => file.id !== fileId),
    }));
  }

  async function uploadFolderFiles(folder: DashboardFolder, files: FileList | null) {
    if (!files?.length) return;
    if (!token) {
      setFolderMessage("Сначала войдите в аккаунт, чтобы загружать файлы.");
      return;
    }

    setFolderBusy(true);
    setFolderMessage("Загружаем файлы...");
    try {
      const uploaded = await Promise.all(Array.from(files).map(async (file) => {
        const response = await api<FileObject>("/uploads", {
          body: JSON.stringify({
            base64: await fileToBase64(file),
            mimeType: file.type || "application/octet-stream",
            originalName: file.name,
          }),
          method: "POST",
        }, token);
        return response.data;
      }));
      updateFolder(folder.id, (current) => ({
        ...current,
        files: [
          ...(current.files ?? []),
          ...uploaded.map<DashboardFolderFile>((file) => ({
            addedAt: new Date().toISOString(),
            fileUrl: file.publicUrl,
            id: file.id,
            mimeType: file.mimeType,
            name: file.originalName,
            sizeBytes: file.sizeBytes,
          })),
        ],
      }));
      setFolderMessage(`Файлы добавлены: ${uploaded.length}`);
    } catch (error) {
      setFolderMessage(error instanceof Error ? error.message : "Не удалось загрузить файлы");
    } finally {
      setFolderBusy(false);
    }
  }

  return (
    <section className="dashboard-folder-board" data-testid="dashboard-folder-board" aria-label="Dashboard folders">
      <div className="dashboard-folder-grid">
        {folders.map((folder) => (
          <button className="dashboard-folder-card" key={folder.id} onClick={() => {
            setActiveFolderId(folder.id);
            setFolderMessage("");
          }} type="button">
            <span className="folder-icon" aria-hidden="true" />
            <strong>{folder.name}</strong>
            <small>{(folder.files ?? []).length} файлов · {(folder.notes ?? []).length} заметок</small>
          </button>
        ))}
        <button className="dashboard-folder-add" onClick={addFolder} type="button">
          <span>+</span>
          <strong>Добавить папку</strong>
        </button>
      </div>

      {activeFolder ? (
        <div className="modal-backdrop" role="presentation">
          <section className="folder-detail-modal" role="dialog" aria-modal="true" aria-label={`Папка ${activeFolder.name}`}>
            <header>
              <div>
                <span className="eyebrow">Папка</span>
                <h3>{activeFolder.name}</h3>
                <p>{new Date(activeFolder.createdAt).toLocaleDateString("ru-RU", { day: "2-digit", month: "long", year: "numeric" })}</p>
              </div>
              <button className="icon-button" onClick={() => setActiveFolderId(undefined)} type="button" aria-label="Закрыть">×</button>
            </header>

            <div className="folder-drop-zone">
              <input
                disabled={folderBusy}
                multiple
                onChange={(event) => void uploadFolderFiles(activeFolder, event.currentTarget.files)}
                type="file"
              />
              <strong>Добавить файлы</strong>
              <small>PDF, фото, договоры, таблицы, документы клиента или любые рабочие файлы.</small>
            </div>

            <div className="folder-note-form">
              <textarea
                onChange={(event) => setFolderNote(event.target.value)}
                placeholder="Добавить заметку, ссылку, инструкцию или внутреннюю информацию..."
                value={folderNote}
              />
              <button className="primary-button" disabled={!folderNote.trim()} onClick={addFolderNote} type="button">Добавить данные</button>
            </div>

            {folderMessage ? <p className="folder-message">{folderMessage}</p> : null}

            <div className="folder-content-grid">
              <section>
                <h4>Файлы</h4>
                {(activeFolder.files ?? []).length ? (activeFolder.files ?? []).map((file) => (
                  <article className="folder-content-row" key={file.id}>
                    <div>
                      <strong>{file.name}</strong>
                      <small>{formatBytes(file.sizeBytes)} · {file.mimeType}</small>
                    </div>
                    <a className="ghost-button" href={file.fileUrl} rel="noreferrer" target="_blank">Открыть</a>
                    <button className="ghost-button" onClick={() => removeFolderFile(activeFolder.id, file.id)} type="button">Убрать</button>
                  </article>
                )) : <p className="folder-empty">Файлов пока нет.</p>}
              </section>

              <section>
                <h4>Данные и заметки</h4>
                {(activeFolder.notes ?? []).length ? (activeFolder.notes ?? []).map((note) => (
                  <article className="folder-note-row" key={note.id}>
                    <p>{note.text}</p>
                    <div>
                      <small>{new Date(note.createdAt).toLocaleString("ru-RU")}</small>
                      <button className="ghost-button" onClick={() => removeFolderNote(activeFolder.id, note.id)} type="button">Удалить</button>
                    </div>
                  </article>
                )) : <p className="folder-empty">Добавьте первую заметку или ссылку.</p>}
              </section>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}

function TodayOperationsDashboard({
  cards,
  gpsDevices,
  locale,
  onCreateBooking,
  onSelectVehicle,
  rentals,
  selectedVehicleId,
  token,
  vehicles,
}: {
  cards: readonly (readonly [string, string | number, string])[];
  gpsDevices: GpsDevice[];
  locale: Locale;
  onCreateBooking: () => void;
  onSelectVehicle: (id: string) => void;
  rentals: Rental[];
  selectedVehicleId: string | undefined;
  token: string | undefined;
  vehicles: Vehicle[];
}) {
  return (
    <section className="today-operations-board">
      <section className="dashboard-map-overview" data-testid="dashboard-map-overview" aria-label="Dashboard fleet map">
        <div className="dashboard-map-head">
          <div>
            <span className="eyebrow">Fleet GPS</span>
            <h2>Карта автопарка</h2>
            <p>Google Maps и Apple Maps прямо на главной: позиции авто, скорость, статус GPS и текущие аренды.</p>
          </div>
          <button className="primary-button" onClick={onCreateBooking} type="button">Создать аренду</button>
        </div>
        <MapPanel gpsDevices={gpsDevices} locale={locale} vehicles={vehicles} rentals={rentals} selectedVehicleId={selectedVehicleId} onSelect={onSelectVehicle} />
      </section>

      <div className="operations-kpi-grid compact">
        {cards.slice(0, 4).map(([label, value, tone]) => (
          <article className="metric-card" key={label}>
            <span>{label}</span>
            <strong className={tone}>{value}</strong>
          </article>
        ))}
      </div>

      <DashboardFolders token={token} />
    </section>
  );
}

function DashboardLoadingState() {
  return (
    <section className="dashboard-loading-state" data-testid="dashboard-loading-state">
      <span className="eyebrow">FleetCore</span>
      <h2>Загружаем рабочий центр</h2>
      <p>Подтягиваем автомобили, аренды, документы, финансы и GPS. Через несколько секунд появится карта автопарка.</p>
      <div className="loading-card-grid">
        <i />
        <i />
        <i />
        <i />
      </div>
    </section>
  );
}

function RentalDetailPanel({
  busy,
  detail,
  locale,
  money: rentalMoney,
  onCreateContract,
  onCreatePickup,
  onCreateReturn,
  onOpenPdf,
  onPay,
  onRequestContractUpload,
  onRequestSignature,
  onSettle,
  onShare,
  onSign,
}: {
  busy: boolean;
  detail: RentalDetailContext | undefined;
  locale: Locale;
  money: Intl.NumberFormat;
  onCreateContract: () => void;
  onCreatePickup: (rental: Rental) => void;
  onCreateReturn: (rental: Rental) => void;
  onOpenPdf: (detail: RentalDetailContext) => void;
  onPay: () => void;
  onRequestContractUpload: () => void;
  onRequestSignature: () => void;
  onSettle: (detail: RentalDetailContext) => void;
  onShare: (channel: "whatsapp" | "telegram" | "email", rental: Rental) => void;
  onSign: (detail: RentalDetailContext) => void;
}) {
  if (!detail) {
    return (
      <section className="rental-detail-panel empty">
        <span className="eyebrow">Rental Details</span>
        <h2>Аренда не выбрана</h2>
        <p>Создайте первую бронь или выберите аренду из списка ниже.</p>
        <button className="primary-button" onClick={onCreateContract} type="button">Создать договор</button>
      </section>
    );
  }

  const pickup = detail.checklists.some((item) => item.phase === "pickup");
  const returned = detail.checklists.some((item) => item.phase === "return");
  const contractSigned = detail.contract?.status === "signed";
  const paymentReady = detail.remainingAmount <= 0;
  const rentalReady = Boolean(detail.contract) && paymentReady && pickup;
  const settlementReady = returned && paymentReady;
  const operationalHealth = [
    { done: Boolean(detail.customer), label: "Клиент", meta: detail.customer?.email ?? "нет email" },
    { done: Boolean(detail.vehicle), label: "Автомобиль", meta: detail.vehicle?.plateNumber ?? "нет номера" },
    { done: Boolean(detail.contract), label: "Договор", meta: contractStatusLabel(locale, detail.contract?.status) },
    { done: paymentReady, label: "Оплата", meta: detail.remainingAmount > 0 ? `осталось ${rentalMoney.format(detail.remainingAmount)}` : invoiceStatusLabel(locale, "paid") },
    { done: pickup, label: "Выдача", meta: pickup ? "акт готов" : "нужен акт" },
    { done: returned, label: "Возврат", meta: returned ? "акт готов" : "ожидает" },
  ];
  const internalBlocks = [
    {
      done: Boolean(detail.contract) && contractSigned,
      label: "Клиент и договор",
      meta: detail.contract ? `${contractStatusLabel(locale, detail.contract.status)} · ${contractSigned ? "подпись есть" : "ждём подпись"}` : "создать и отправить",
    },
    {
      done: paymentReady,
      label: "Оплата и депозит",
      meta: `${rentalMoney.format(detail.paidAmount)} оплачено · депозит ${rentalMoney.format(detail.rental.depositAmount)}`,
    },
    {
      done: pickup && returned,
      label: "Выдача и закрытие",
      meta: returned ? "можно закрыть аренду" : pickup ? "авто выдано, ждём возврат" : "нужен акт выдачи",
    },
  ];
  const primaryAction = !detail.contract
    ? { disabled: busy, label: "Создать договор", onClick: onCreateContract }
    : !contractSigned
      ? { disabled: busy, label: "Отправить клиенту", onClick: () => onShare("whatsapp", detail.rental) }
      : !paymentReady
        ? { disabled: busy, label: "Принять оплату", onClick: onPay }
        : !pickup
          ? { disabled: busy, label: "Выдать авто", onClick: () => onCreatePickup(detail.rental) }
          : !returned
            ? { disabled: busy, label: "Оформить возврат", onClick: () => onCreateReturn(detail.rental) }
            : detail.rental.status !== "closed"
              ? { disabled: busy, label: "Финальный расчёт", onClick: () => onSettle(detail) }
              : { disabled: true, label: "Аренда закрыта", onClick: () => undefined };

  return (
    <section className="rental-detail-panel" data-testid="rental-detail-panel">
      <div className="rental-detail-hero">
        <div>
          <span className="eyebrow">Rental Detail</span>
          <h2>{detail.vehicle ? `${detail.vehicle.make} ${detail.vehicle.model}` : "Автомобиль"} · {detail.vehicle?.plateNumber ?? "без номера"}</h2>
          <p>{detail.customer?.displayName ?? "Клиент"} · {dateFmt.format(new Date(detail.rental.pickupAt))} - {dateFmt.format(new Date(detail.rental.returnAt))}</p>
        </div>
        <Badge value={rentalStatusLabel(locale, detail.rental.status)} />
      </div>

      <div className="rental-master-card" data-testid="rental-step-master">
        <div>
          <span className="eyebrow">Следующее лучшее действие</span>
          <h3>{primaryAction.label}</h3>
          <p>{detail.rental.status === "closed" ? "Аренда полностью закрыта." : "Одна аренда, одна главная кнопка. Договор, оплата, депозит, выдача и возврат находятся внутри карточки."}</p>
        </div>
        <button className="primary-button" disabled={primaryAction.disabled} onClick={primaryAction.onClick} type="button">{primaryAction.label}</button>
      </div>

      <div className="rental-detail-timeline rental-step-wizard" data-testid="rental-detail-timeline">
        {internalBlocks.map((block) => (
          <article className={block.done ? "done" : ""} key={block.label}>
            <span>{block.done ? "✓" : "•"}</span>
            <strong>{block.label}</strong>
            <small>{block.meta}</small>
          </article>
        ))}
      </div>

      <div className="rental-detail-grid">
        <article>
          <span>Сумма аренды</span>
          <strong>{rentalMoney.format(detail.rental.totalAmount)}</strong>
        </article>
        <article>
          <span>Депозит</span>
          <strong>{rentalMoney.format(detail.rental.depositAmount)}</strong>
        </article>
        <article>
          <span>Оплачено</span>
          <strong>{rentalMoney.format(detail.paidAmount)}</strong>
        </article>
        <article className={detail.remainingAmount > 0 ? "attention" : "done"}>
          <span>К оплате</span>
          <strong>{rentalMoney.format(detail.remainingAmount)}</strong>
        </article>
      </div>

      <section className="rental-delivery-card compact-delivery" aria-label="Отправка аренды клиенту">
        <div>
          <span className="eyebrow">Client delivery</span>
          <h3>Отправить клиенту</h3>
          <p>Ссылка, договор, авто, даты, сумма и депозит в одном сообщении.</p>
        </div>
        <div className="rental-delivery-actions">
          <button className="primary-button" disabled={busy} onClick={() => onShare("whatsapp", detail.rental)} type="button">WhatsApp</button>
          <button className="ghost-button" disabled={busy} onClick={() => onShare("telegram", detail.rental)} type="button">Telegram</button>
          <button className="ghost-button" disabled={busy} onClick={() => onShare("email", detail.rental)} type="button">Email</button>
        </div>
        <small>{detail.contract ? `Договор: ${contractStatusLabel(locale, detail.contract.status)}` : "Договора ещё нет. FleetCore создаст его автоматически перед отправкой."}</small>
      </section>

      <div className="rental-health-strip" aria-label="Rental health">
        {operationalHealth.map((item) => (
          <article className={item.done ? "done" : "attention"} key={item.label}>
            <span>{item.done ? "✓" : "!"}</span>
            <div>
              <strong>{item.label}</strong>
              <small>{item.meta}</small>
            </div>
          </article>
        ))}
      </div>

      <details className="rental-secondary-details">
        <summary>Документы, оплата и возврат</summary>
        <div className="rental-document-strip">
          <div>
            <strong>Договор</strong>
            {detail.contract ? <FilePreviewLink fileUrl={detail.contract.documentUrl} title={contractStatusLabel(locale, detail.contract.status)} /> : <span>не создан</span>}
            <small>{contractSigned ? "Подписан клиентом" : "Создайте, отправьте и получите подпись"}</small>
          </div>
          <div>
            <strong>История</strong>
            {detail.contractEvents.slice(0, 3).map((event) => <span key={event.id}>{contractEventLabel(locale, event)} · {event.channel}</span>)}
            {!detail.contractEvents.length ? <span>Событий пока нет</span> : null}
          </div>
        </div>
        <div className="rental-flow-plus-grid compact" data-testid="rental-flow-plus">
          <section>
            <h3>Контроль</h3>
            <p className={detail.contract ? "done" : "pending"}><span>{detail.contract ? "✓" : "•"}</span><strong>PDF договора</strong><small>{detail.contract ? "создан" : "создаётся из карточки"}</small></p>
            <p className={contractSigned ? "done" : "pending"}><span>{contractSigned ? "✓" : "•"}</span><strong>Подпись клиента</strong><small>{contractSigned ? "получена" : "можно отправить ссылку"}</small></p>
            <p className={rentalReady ? "done" : "pending"}><span>{rentalReady ? "✓" : "•"}</span><strong>Выдача разрешена</strong><small>{rentalReady ? "документы и оплата готовы" : "проверьте договор, оплату и акт"}</small></p>
            <p className={settlementReady ? "done" : "pending"}><span>{settlementReady ? "✓" : "•"}</span><strong>Закрытие аренды</strong><small>{settlementReady ? "можно делать финальный расчёт" : "нужен возврат и оплата"}</small></p>
          </section>
          <section className="settlement-mini-card">
            <h3>Финальный расчёт</h3>
            <div><span>Аренда</span><strong>{rentalMoney.format(detail.rental.totalAmount)}</strong></div>
            <div><span>Депозит</span><strong>{rentalMoney.format(detail.rental.depositAmount)}</strong></div>
            <div><span>Остаток</span><strong>{rentalMoney.format(detail.remainingAmount)}</strong></div>
            <small>{returned ? "Акт возврата готов" : "Сначала создайте акт возврата"}</small>
          </section>
        </div>
      </details>

      <div className="rental-action-bar">
        <button className="primary-button" disabled={primaryAction.disabled} onClick={primaryAction.onClick} type="button">{primaryAction.label}</button>
        <details className="action-menu">
          <summary>Еще действия</summary>
          <div>
            <button className="ghost-button" disabled={busy} onClick={() => onCreateContract()} type="button">{detail.contract ? "Обновить договор" : "Создать договор"}</button>
            <button className="ghost-button" disabled={busy || !detail.contract} onClick={() => onOpenPdf(detail)} type="button">Открыть PDF</button>
            <button className="ghost-button" disabled={busy} onClick={onRequestContractUpload} type="button">Загрузить договор</button>
            <button className="ghost-button" disabled={busy} onClick={() => onShare("whatsapp", detail.rental)} type="button">WhatsApp</button>
            <button className="ghost-button" disabled={busy} onClick={() => onShare("telegram", detail.rental)} type="button">Telegram</button>
            <button className="ghost-button" disabled={busy} onClick={() => onShare("email", detail.rental)} type="button">Email</button>
            <button className="ghost-button" disabled={busy} onClick={() => onSign(detail)} type="button">{contractSigned ? "Подписано" : "Подписать"}</button>
            <button className="ghost-button" disabled={busy} onClick={() => onCreatePickup(detail.rental)} type="button">{pickup ? "Выдача OK" : "Акт выдачи"}</button>
            <button className="ghost-button" disabled={busy} onClick={() => onCreateReturn(detail.rental)} type="button">{returned ? "Возврат OK" : "Акт возврата"}</button>
            <button className="ghost-button" disabled={busy || paymentReady} onClick={onPay} type="button">Провести оплату</button>
            <button className="ghost-button" disabled={busy} onClick={onRequestSignature} type="button">Загрузить подпись</button>
          </div>
        </details>
      </div>
    </section>
  );
}

function DocumentVault({
  checklists,
  customerDocuments,
  customers,
  files,
  invoices,
  locale,
  onCustomerFolder,
  onDocumentPreview,
  onService,
  onVehicleDocument,
  onVehicleFolder,
  payments,
  rentalContractEvents,
  rentalContracts,
  rentals,
  serviceRecords,
  vehicles,
  vehicleDocuments,
}: {
  checklists: RentalChecklist[];
  customerDocuments: CustomerDocument[];
  customers: Customer[];
  files: FileObject[];
  invoices: Invoice[];
  locale: Locale;
  onCustomerFolder: () => void;
  onDocumentPreview: (document: DocumentPreview) => void;
  onService: () => void;
  onVehicleDocument: () => void;
  onVehicleFolder: () => void;
  payments: Payment[];
  rentalContractEvents: RentalContractEvent[];
  rentalContracts: RentalContract[];
  rentals: Rental[];
  serviceRecords: ServiceRecord[];
  vehicles: Vehicle[];
  vehicleDocuments: VehicleDocument[];
}) {
  const now = Date.now();
  const expiringDocuments = vehicleDocuments
    .filter((doc) => doc.expiresAt)
    .filter((doc) => new Date(doc.expiresAt ?? "").getTime() - now < 30 * 24 * 60 * 60 * 1000)
    .slice(0, 5);
  const rentalFolders: RentalDocumentFolder[] = rentals.slice(0, 8).map((rental) => {
    const invoice = invoices.find((item) => item.rentalId === rental.id);
    const paymentTotal = invoice ? payments.filter((payment) => payment.invoiceId === invoice.id).reduce((sum, payment) => sum + payment.amount, 0) : 0;
    return {
      checklists: checklists.filter((item) => item.rentalId === rental.id),
      contract: rentalContracts.find((contract) => contract.rentalId === rental.id),
      customer: customers.find((customer) => customer.id === rental.customerId),
      invoice,
      paymentTotal,
      rental,
      vehicle: vehicles.find((vehicle) => vehicle.id === rental.vehicleId),
    };
  });
  const signedContracts = rentalContracts.filter((contract) => contract.status === "signed").length;
  const overdueDocuments = expiringDocuments.filter((doc) => doc.expiresAt && new Date(doc.expiresAt).getTime() < now);
  const verifiedCustomerDocs = customerDocuments.filter((doc) => doc.verified).length;
  const activeRentalFolders = rentalFolders.filter((folder) => folder.rental.status !== "closed").length;
  const documentStatusCards = [
    { label: "Авто", meta: "страховка, техосмотр, регистрация", status: `${vehicleDocuments.length} файлов`, tone: vehicleDocuments.length ? "green" : "orange" },
    { label: "Клиент", meta: "паспорт, ID, права, KYC", status: `${verifiedCustomerDocs}/${customerDocuments.length} verified`, tone: customerDocuments.length && verifiedCustomerDocs === customerDocuments.length ? "green" : "orange" },
    { label: "Аренда", meta: "договор, акты, депозит", status: `${activeRentalFolders} активных папок`, tone: activeRentalFolders ? "blue" : "black" },
    { label: "Сроки", meta: "истекающие и просроченные документы", status: `${overdueDocuments.length} overdue · ${expiringDocuments.length} soon`, tone: overdueDocuments.length ? "red" : expiringDocuments.length ? "orange" : "green" },
    { label: "Статус", meta: "создан, отправлен, открыт, подписан", status: `${signedContracts}/${rentalContracts.length} signed`, tone: rentalContracts.length && signedContracts === rentalContracts.length ? "green" : "blue" },
  ];
  const unsignedContracts = rentalContracts.filter((contract) => contract.status !== "signed");
  const pendingCustomerDocs = customerDocuments.filter((doc) => !doc.verified);
  const missingVehicleDocs = vehicles.filter((vehicle) => !vehicleDocuments.some((doc) => doc.vehicleId === vehicle.id));
  const documentInbox = [
    ...overdueDocuments.slice(0, 3).map((doc) => ({
      action: () => onDocumentPreview({ fileUrl: doc.fileUrl, meta: doc.type, title: doc.title }),
      label: "Просроченный документ",
      meta: `${doc.title} · ${doc.expiresAt ? dateFmt.format(new Date(doc.expiresAt)) : "без срока"}`,
      tone: "red",
    })),
    ...expiringDocuments.filter((doc) => !overdueDocuments.some((overdue) => overdue.id === doc.id)).slice(0, 3).map((doc) => ({
      action: () => onDocumentPreview({ fileUrl: doc.fileUrl, meta: doc.type, title: doc.title }),
      label: "Скоро истекает",
      meta: `${doc.title} · ${doc.expiresAt ? dateFmt.format(new Date(doc.expiresAt)) : "без срока"}`,
      tone: "orange",
    })),
    ...unsignedContracts.slice(0, 3).map((contract) => {
      const rental = rentals.find((item) => item.id === contract.rentalId);
      const vehicle = vehicles.find((item) => item.id === rental?.vehicleId);
      return {
        action: () => onDocumentPreview({ fileUrl: contract.documentUrl, meta: contract.status, title: `Договор ${contract.id}` }),
        label: "Договор не подписан",
        meta: `${contract.id} · ${vehicle?.plateNumber ?? "аренда"} · ${contractStatusLabel(locale, contract.status)}`,
        tone: "blue",
      };
    }),
    ...pendingCustomerDocs.slice(0, 3).map((doc) => {
      const customer = customers.find((item) => item.id === doc.customerId);
      return {
        action: () => onDocumentPreview({ fileUrl: doc.fileUrl, meta: doc.type, title: doc.title }),
        label: "Проверить документ клиента",
        meta: `${customer?.displayName ?? "Клиент"} · ${doc.title}`,
        tone: "orange",
      };
    }),
    ...missingVehicleDocs.slice(0, 3).map((vehicle) => ({
      action: onVehicleDocument,
      label: "Нет папки авто",
      meta: `${vehicle.make} ${vehicle.model} · ${vehicle.plateNumber}`,
      tone: "black",
    })),
  ].slice(0, 8);
  const [activeTab, setActiveTab] = useState<DocumentCenterTab>("attention");
  const tabs: Array<{ count: number; key: DocumentCenterTab; label: string }> = [
    { count: expiringDocuments.length + overdueDocuments.length, key: "attention", label: "Требует внимания" },
    { count: vehicleDocuments.length, key: "vehicles", label: "Авто" },
    { count: customerDocuments.length, key: "customers", label: "Клиенты" },
    { count: rentalFolders.length, key: "rentals", label: "Аренды" },
    { count: files.length, key: "files", label: "Файлы" },
  ];

  return (
    <div className="document-vault">
      <section className="table-panel vault-hero">
        <div>
          <span className="eyebrow">Document Vault</span>
          <h2>Документы, сроки и операционные акты</h2>
          <p>Одна рабочая зона. Откройте нужную папку: авто, клиент, аренда или файлы.</p>
        </div>
        <div className="vault-actions">
          <button className="primary-button" onClick={onVehicleDocument} type="button">Загрузить документ</button>
          <button className="ghost-button" onClick={onService} type="button">Создать ТО</button>
        </div>
      </section>

      <section className="document-center-tabs" aria-label="Document center tabs">
        {tabs.map((tab) => (
          <button className={activeTab === tab.key ? "active" : ""} key={tab.key} onClick={() => setActiveTab(tab.key)} type="button">
            <strong>{tab.label}</strong>
            <span>{tab.count}</span>
          </button>
        ))}
      </section>

      {activeTab === "attention" ? (
        <>
          <section className="document-inbox table-panel" data-testid="document-inbox">
            <div className="section-title compact-title">
              <div>
                <h2>Document Inbox</h2>
                <p>Сначала закрывайте эти документы: сроки, подписи, проверки и отсутствующие папки.</p>
              </div>
              <Badge value={`${documentInbox.length || 1} задач`} />
            </div>
            <div className="document-inbox-list">
              {documentInbox.map((item) => (
                <button className={`document-inbox-row ${item.tone}`} key={`${item.label}-${item.meta}`} onClick={item.action} type="button">
                  <span>{item.tone === "red" ? "!" : item.tone === "orange" ? "•" : "→"}</span>
                  <div>
                    <strong>{item.label}</strong>
                    <small>{item.meta}</small>
                  </div>
                </button>
              ))}
              {!documentInbox.length ? (
                <button className="document-inbox-row green" onClick={onVehicleDocument} type="button">
                  <span>✓</span>
                  <div>
                    <strong>Документы под контролем</strong>
                    <small>Можно загрузить новый документ авто или проверить папки аренды.</small>
                  </div>
                </button>
              ) : null}
            </div>
          </section>
          <section className="document-status-board" aria-label="Document status matrix">
            {documentStatusCards.map((card) => (
              <article className={card.tone} key={card.label}>
                <span>{card.label}</span>
                <strong>{card.status}</strong>
                <small>{card.meta}</small>
              </article>
            ))}
          </section>
          <section className="split-panels">
            <div className="table-panel">
              <h2>Сроки документов</h2>
              {expiringDocuments.map((doc) => (
                <p className="history-row" key={doc.id}>
                  <FilePreviewLink fileUrl={doc.fileUrl} onPreview={onDocumentPreview} title={`${doc.title} · ${doc.expiresAt ? dateFmt.format(new Date(doc.expiresAt)) : "без срока"}`} />
                </p>
              ))}
              {!expiringDocuments.length ? <p className="history-row">Нет документов, которые истекают в ближайшие 30 дней.</p> : null}
            </div>
            <div className="table-panel">
              <h2>Выдача и возврат</h2>
              {checklists.slice(0, 5).map((item) => (
                <p className="history-row" key={item.id}>{item.phase === "pickup" ? "Акт выдачи" : "Акт возврата"} · {item.odometerKm.toLocaleString()} км · топливо {item.fuelLevel}%</p>
              ))}
              {!checklists.length ? <p className="history-row">Акты выдачи/возврата появятся после первого rental flow.</p> : null}
            </div>
          </section>
        </>
      ) : null}

      {activeTab === "vehicles" ? (
        <section className="document-workbench-grid" data-testid="document-workbench-grid">
          <article className="table-panel">
            <div className="section-title compact-title">
              <h2>Авто-документы</h2>
              <button className="ghost-button" onClick={onVehicleFolder} type="button">Загрузить папку авто</button>
            </div>
            {vehicles.slice(0, 8).map((vehicle) => {
              const docs = vehicleDocuments.filter((doc) => doc.vehicleId === vehicle.id);
              const soon = docs.filter((doc) => doc.expiresAt && new Date(doc.expiresAt).getTime() < now + 30 * 24 * 60 * 60 * 1000).length;
              return (
                <p className="document-workbench-row" key={vehicle.id}>
                  <strong>{vehicle.plateNumber}</strong>
                  <span>{docs.length} файлов · {soon} сроков</span>
                </p>
              );
            })}
          </article>
        </section>
      ) : null}

      {activeTab === "customers" ? (
        <section className="split-panels">
          <div className="table-panel">
            <div className="section-title compact-title">
              <h2>Клиентские папки</h2>
              <button className="ghost-button" onClick={onCustomerFolder} type="button">Загрузить папку клиента</button>
            </div>
            {customers.slice(0, 8).map((customer) => {
              const docs = customerDocuments.filter((doc) => doc.customerId === customer.id);
              return (
                <p className="document-workbench-row" key={customer.id}>
                  <strong>{customer.displayName}</strong>
                  <span>{docs.filter((doc) => doc.verified).length}/{docs.length} verified</span>
                </p>
              );
            })}
          </div>
          <div className="table-panel">
            <h2>Документы клиентов</h2>
            {customerDocuments.slice(0, 6).map((doc) => (
              <p className="history-row" key={doc.id}>
                <FilePreviewLink fileUrl={doc.fileUrl} onPreview={onDocumentPreview} title={`${doc.title} · ${doc.verified ? "verified" : "pending"}`} />
              </p>
            ))}
            {!customerDocuments.length ? <p className="history-row">Загрузите паспорт, ID или водительское удостоверение клиента.</p> : null}
          </div>
        </section>
      ) : null}

      {activeTab === "rentals" ? (
        <section className="table-panel rental-folder-panel">
          <div className="section-title compact-title">
            <h2>Папки аренды</h2>
            <Badge value={`${rentalFolders.length} активных`} />
          </div>
          <div className="rental-folder-grid">
            {rentalFolders.map((folder) => {
              const paid = folder.paymentTotal >= (folder.invoice?.total ?? folder.rental.totalAmount);
              const pickup = folder.checklists.some((item) => item.phase === "pickup");
              const returned = folder.checklists.some((item) => item.phase === "return");
              return (
                <article className="rental-folder-card" key={folder.rental.id}>
                  <div>
                    <strong>{folder.vehicle ? `${folder.vehicle.make} ${folder.vehicle.model}` : "Автомобиль"}</strong>
                    <span>{folder.vehicle?.plateNumber ?? "без номера"} · {folder.customer?.displayName ?? "Клиент"}</span>
                  </div>
                  <Badge value={rentalStatusLabel(locale, folder.rental.status)} />
                  <div className="document-center-row">
                    <span>Договор</span>
                    {folder.contract ? (
                      <FilePreviewLink fileUrl={folder.contract.documentUrl} onPreview={onDocumentPreview} title={contractStatusLabel(locale, folder.contract.status)} />
                    ) : <strong>не создан</strong>}
                  </div>
                  <div className="document-center-row">
                    <span>Оплата</span>
                    <strong>{money.format(folder.paymentTotal)} / {money.format(folder.invoice?.total ?? folder.rental.totalAmount)}</strong>
                  </div>
                  <div className="rental-folder-statuses">
                    <span className={folder.contract?.status === "signed" ? "done" : ""}>PDF</span>
                    <span className={paid ? "done" : ""}>Оплата</span>
                    <span className={pickup ? "done" : ""}>Выдача</span>
                    <span className={returned ? "done" : ""}>Возврат</span>
                  </div>
                </article>
              );
            })}
            {!rentalFolders.length ? <p className="history-row">Создайте первую бронь, и здесь появится полная папка аренды.</p> : null}
          </div>
        </section>
      ) : null}

      {activeTab === "files" ? (
        <section className="split-panels">
          <div className="table-panel">
            <h2>Последние файлы и ТО</h2>
            <div className="file-object-list">
              {files.slice(0, 6).map((file) => <FileObjectRow file={file} key={file.id} onPreview={onDocumentPreview} />)}
              {serviceRecords.slice(0, 4).map((record) => <p className="history-row" key={record.id}>{record.type} · {record.status} · {money.format(record.cost)} · {record.odometerKm.toLocaleString()} км</p>)}
              {!files.length && !serviceRecords.length ? <p className="history-row">Загрузите первый документ или создайте ТО.</p> : null}
            </div>
          </div>
          <div className="table-panel">
            <h2>История договоров</h2>
            {rentalContractEvents.slice(0, 7).map((event) => (
              <p className="history-row" key={event.id}>{contractEventLabel(locale, event)} · {event.channel} · {dateFmt.format(new Date(event.createdAt))}</p>
            ))}
            {!rentalContractEvents.length ? <p className="history-row">История появится после создания и отправки первого договора.</p> : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function OnboardingWizard({
  company,
  customersCount,
  gpsCount,
  onAction,
  onClose,
  rentalsCount,
  teamCount,
  vehiclesCount,
}: {
  company: Company | undefined;
  customersCount: number;
  gpsCount: number;
  onAction: (action: "company" | "vehicle" | "customer" | "gps" | "contract" | "manager") => void;
  onClose: () => void;
  rentalsCount: number;
  teamCount: number;
  vehiclesCount: number;
}) {
  const steps = [
    { action: "company" as const, done: Boolean(company?.billingEmail || company?.businessAddress || company?.taxId), label: "Данные компании", text: "Страна, валюта, реквизиты, логотип и шаблон договора." },
    { action: "vehicle" as const, done: vehiclesCount > 0, label: "Первый автомобиль", text: "Добавьте марку, VIN, пробег, ставку аренды и фото." },
    { action: "customer" as const, done: customersCount > 0, label: "Первый клиент", text: "Создайте CRM-карточку клиента и загрузите паспорт/ID." },
    { action: "gps" as const, done: gpsCount > 0, label: "GPS вручную", text: "Подключите устройство, скорость, последний сигнал и координаты." },
    { action: "contract" as const, done: rentalsCount > 0, label: "Договор аренды", text: "Создайте PDF, публичную ссылку и историю статусов." },
    { action: "manager" as const, done: teamCount > 1, label: "Менеджер", text: "Пригласите менеджера с доступом к рабочей системе." },
  ];
  const completed = steps.filter((step) => step.done).length;

  return (
    <div className="modal-backdrop onboarding-backdrop" role="dialog" aria-modal="true">
      <section className="onboarding-modal">
        <div className="modal-title">
          <div>
            <span>FleetCore setup</span>
            <h2>Мастер запуска SaaS</h2>
          </div>
          <button onClick={onClose} type="button">×</button>
        </div>
        <div className="onboarding-progress">
          <strong>{completed}/{steps.length}</strong>
          <span>готово для полноценной работы</span>
          <i style={{ width: `${Math.round((completed / steps.length) * 100)}%` }} />
        </div>
        <div className="onboarding-grid">
          {steps.map((step) => (
            <article className={step.done ? "done" : ""} key={step.action}>
              <span>{step.done ? "✓" : "•"}</span>
              <div>
                <strong>{step.label}</strong>
                <p>{step.text}</p>
              </div>
              <button className={step.done ? "ghost-button" : "primary-button"} onClick={() => onAction(step.action)} type="button">
                {step.done ? "Открыть" : "Настроить"}
              </button>
            </article>
          ))}
        </div>
        <button className="ghost-button full-button" onClick={onClose} type="button">Продолжить в FleetCore</button>
      </section>
    </div>
  );
}

function OwnerProfileDialog({
  busy,
  form,
  onAddTeamMember,
  onClose,
  onFormChange,
  onLogout,
  onNameChange,
  onPhoto,
  onSave,
  photo,
  profileName,
  session,
  teamUsers,
}: {
  busy: boolean;
  form: { email: string; fullName: string; password: string; role: Exclude<UserRole, "owner"> };
  onAddTeamMember: () => void;
  onClose: () => void;
  onFormChange: (form: { email: string; fullName: string; password: string; role: Exclude<UserRole, "owner"> }) => void;
  onLogout: () => void;
  onNameChange: (name: string) => void;
  onPhoto: (file: File | undefined) => void;
  onSave: () => void;
  photo: string;
  profileName: string;
  session: AuthSession;
  teamUsers: User[];
}) {
  const canManageTeam = session.user.role === "owner";

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <section className="owner-profile-modal">
        <div className="modal-title">
          <div>
            <span>Профиль аккаунта</span>
            <h2>{session.user.fullName}</h2>
          </div>
          <button onClick={onClose} type="button">×</button>
        </div>

        <div className="owner-profile-grid">
          <section className="owner-profile-card">
            <label className="owner-photo">
              {photo ? <img alt={`Фото ${session.user.fullName}`} src={photo} /> : <span>{session.user.fullName.slice(0, 1)}</span>}
              <input accept=".jpg,.jpeg,.png,.webp" onChange={(event) => onPhoto(event.currentTarget.files?.[0])} type="file" />
              <strong>Загрузить фото</strong>
            </label>
            <p className="owner-photo-hint">JPG, PNG или WebP. Фото сохраняется в аккаунте и будет видно на телефоне и компьютере.</p>
            <label>Имя и фамилия
              <input value={profileName} onChange={(event) => onNameChange(event.target.value)} />
            </label>
            <p>{session.user.email}</p>
            <div className="profile-actions">
              <button className="primary-button" disabled={busy} onClick={onSave} type="button">Сохранить профиль</button>
              <button className="ghost-button" onClick={onLogout} type="button">Выйти</button>
            </div>
          </section>

          <section className="team-panel">
            <div className="section-title compact-title">
              <h2>Команда</h2>
              <Badge value={String(teamUsers.length)} />
            </div>
            <div className="team-list">
              {teamUsers.map((user) => (
                <article className="team-row" key={user.id}>
                  <div className="avatar small">{user.fullName.slice(0, 1)}</div>
                  <div>
                    <strong>{user.fullName}</strong>
                    <span>{user.email} · {user.role}</span>
                  </div>
                </article>
              ))}
            </div>

            {canManageTeam ? (
              <div className="team-create">
                <label>Имя менеджера<input value={form.fullName} onChange={(event) => onFormChange({ ...form, fullName: event.target.value })} /></label>
                <label>Email<input inputMode="email" type="email" value={form.email} onChange={(event) => onFormChange({ ...form, email: event.target.value })} /></label>
                <label>Роль
                  <select value={form.role} onChange={(event) => onFormChange({ ...form, role: event.target.value as Exclude<UserRole, "owner"> })}>
                    <option value="manager">Manager</option>
                  </select>
                </label>
                <label>Пароль<input minLength={8} type="password" value={form.password} onChange={(event) => onFormChange({ ...form, password: event.target.value })} /></label>
                <button className="primary-button full" disabled={busy} onClick={onAddTeamMember} type="button">Добавить менеджера</button>
              </div>
            ) : (
              <p className="history-row">Управление командой доступно только owner.</p>
            )}
          </section>
        </div>
      </section>
    </div>
  );
}

function CalendarWorkspace({
  calendlyUrl,
  customers,
  locale,
  onCreateBooking,
  rentals,
  vehicles,
}: {
  calendlyUrl: string;
  customers: Customer[];
  locale: Locale;
  onCreateBooking: () => void;
  rentals: Rental[];
  vehicles: Vehicle[];
}) {
  const activeRentals = rentals
    .filter((rental) => rental.status !== "closed")
    .sort((left, right) => new Date(left.pickupAt).getTime() - new Date(right.pickupAt).getTime());
  const freeVehicles = vehicles.filter((vehicle) => vehicle.status === "available" && !activeRentals.some((rental) => rental.vehicleId === vehicle.id));
  const now = Date.now();
  const upcomingReturns = activeRentals
    .filter((rental) => new Date(rental.returnAt).getTime() >= now)
    .slice(0, 5);
  const validCalendlyUrl = calendlyUrl.startsWith("https://calendly.com/");
  const dateLocale = locale === "ru" ? "ru-RU" : locale === "es" ? "es-ES" : locale === "fr" ? "fr-FR" : locale === "de" ? "de-DE" : "en-US";

  function calendlyReservationUrl(rental: Rental) {
    const vehicle = vehicles.find((item) => item.id === rental.vehicleId);
    const customer = customers.find((item) => item.id === rental.customerId);
    if (!validCalendlyUrl) return calendlyUrl;
    const url = new URL(calendlyUrl);
    if (customer?.displayName) url.searchParams.set("name", customer.displayName);
    if (customer?.email) url.searchParams.set("email", customer.email);
    url.searchParams.set("a1", `${vehicle ? `${vehicle.make} ${vehicle.model}` : "Автомобиль"} · ${vehicle?.plateNumber ?? "без номера"}`);
    url.searchParams.set("a2", `${new Date(rental.pickupAt).toLocaleString(dateLocale)} - ${new Date(rental.returnAt).toLocaleString(dateLocale)}`);
    url.searchParams.set("hide_gdpr_banner", "1");
    url.searchParams.set("primary_color", "2346d8");
    return url.toString();
  }

  return (
    <section className="calendar-workspace">
      <div className="calendar-hero table-panel">
        <div>
          <span className="eyebrow">Calendly</span>
          <h2>Calendly календарь резерваций</h2>
          <p>Один внешний календарь для свободных слотов. Резервации FleetCore получают готовую Calendly-ссылку с клиентом, автомобилем и датами.</p>
        </div>
        <button className="primary-button" onClick={onCreateBooking} type="button">Создать аренду</button>
      </div>

      <div className="calendar-kpi-grid">
        <article>
          <span>Активные резервации</span>
          <strong>{activeRentals.length}</strong>
        </article>
        <article>
          <span>Свободно сейчас</span>
          <strong>{freeVehicles.length}</strong>
        </article>
        <article>
          <span>Ближайшие возвраты</span>
          <strong>{upcomingReturns.length}</strong>
        </article>
      </div>

      <div className="calendar-layout">
        <div className="calendar-main">
          <section className="table-panel calendly-panel primary-calendly-panel">
            <div className="section-title compact-title">
              <div>
                <span className="eyebrow">Calendly</span>
                <h2>Свободное время</h2>
                <p>Клиент выбирает слот напрямую через Calendly.</p>
              </div>
            </div>
            {validCalendlyUrl ? (
              <iframe
                loading="lazy"
                src={`${calendlyUrl}?hide_gdpr_banner=1&primary_color=2346d8`}
                title="Calendly reservation calendar"
              />
            ) : (
              <div className="calendly-empty">
                <strong>Calendly URL не настроен</strong>
                <span>Добавьте NEXT_PUBLIC_CALENDLY_URL со ссылкой на ваш Calendly event.</span>
              </div>
            )}
          </section>
        </div>

        <aside className="calendar-side">
          <section className="table-panel reservations-panel">
            <div className="section-title compact-title">
              <div>
                <h2>Резервации FleetCore</h2>
                <p>Созданные аренды готовы к привязке и отправке через Calendly.</p>
              </div>
            </div>
            {activeRentals.slice(0, 6).map((rental) => {
              const vehicle = vehicles.find((item) => item.id === rental.vehicleId);
              const customer = customers.find((item) => item.id === rental.customerId);
              return (
                <article className="reservation-row" key={rental.id}>
                  <div>
                    <strong>{vehicle ? `${vehicle.make} ${vehicle.model}` : "Автомобиль"}</strong>
                    <span>{vehicle?.plateNumber ?? "без номера"} · {customer?.displayName ?? "Без клиента"}</span>
                    <em>Calendly ready</em>
                  </div>
                  <div className="reservation-actions">
                    <small>{new Date(rental.pickupAt).toLocaleDateString(dateLocale, { day: "2-digit", month: "short" })} - {new Date(rental.returnAt).toLocaleDateString(dateLocale, { day: "2-digit", month: "short" })}</small>
                    <a className="ghost-button" href={calendlyReservationUrl(rental)} rel="noreferrer" target="_blank">Calendly</a>
                  </div>
                </article>
              );
            })}
            {!activeRentals.length ? <p className="history-row">Резерваций пока нет. Создайте первую аренду.</p> : null}
          </section>
        </aside>
      </div>
    </section>
  );
}

function toDatetimeLocal(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function rentalWorkflowReturnAt(returnDate: string, pickupAt: string) {
  const pickupMs = new Date(pickupAt).getTime();
  const requestedMs = returnDate ? new Date(returnDate).getTime() : Date.now();
  const safeMs = Number.isFinite(requestedMs) && requestedMs > pickupMs ? requestedMs : pickupMs + 60_000;
  return new Date(safeMs).toISOString();
}

function normalizeRentalWorkflowDates(draft: RentalWorkflowDraft) {
  const pickupMs = new Date(draft.pickupAt).getTime();
  const returnMs = new Date(draft.returnAt).getTime();
  const safePickup = Number.isFinite(pickupMs) ? pickupMs : Date.now();
  const safeReturn = Number.isFinite(returnMs) && returnMs > safePickup ? returnMs : safePickup + 2 * 24 * 60 * 60 * 1000;
  const returnDateMs = new Date(draft.returnDate).getTime();
  const safeReturnDate = Number.isFinite(returnDateMs) && returnDateMs > safePickup ? returnDateMs : safeReturn;
  return {
    ...draft,
    pickupAt: toDatetimeLocal(new Date(safePickup)),
    returnAt: toDatetimeLocal(new Date(safeReturn)),
    returnDate: toDatetimeLocal(new Date(safeReturnDate)),
  };
}

function buildRentalWorkflowDraft(vehicle: Vehicle | undefined, customer: Customer | undefined, rental: Rental | undefined): RentalWorkflowDraft {
  const pickupAt = rental?.pickupAt ?? new Date().toISOString();
  const returnAt = rental?.returnAt ?? new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
  const rentalAmount = String(rental?.totalAmount ?? Math.max(1, (vehicle?.dailyRate ?? 90) * 2));
  const depositAmount = String(rental?.depositAmount ?? 500);
  return normalizeRentalWorkflowDates({
    clientEmail: customer?.email ?? "",
    clientName: customer?.displayName ?? "",
    clientNote: "",
    clientPassportId: "",
    clientPhone: customer?.phone ?? "",
    clientTelegram: "",
    clientWhatsApp: customer?.phone ?? "",
    depositAmount,
    depositRefund: depositAmount,
    paymentAmount: rentalAmount,
    paymentMethod: "card",
    paymentStatus: "unpaid",
    pickupAt: toDatetimeLocal(pickupAt),
    rentalAmount,
    returnAt: toDatetimeLocal(returnAt),
    returnCondition: "ok",
    returnDamages: "",
    returnDate: toDatetimeLocal(returnAt),
    selectedCustomerId: customer?.id ?? "",
    selectedRentalId: rental?.id ?? "",
    selectedVehicleId: vehicle?.id ?? "",
  });
}

function RentalWorkflow({
  busy,
  customers,
  initialCustomer,
  initialRental,
  initialVehicle,
  money,
  onClose,
  onReturn,
  onSave,
  onSend,
  rentals,
  vehicles,
}: {
  busy: boolean;
  customers: Customer[];
  initialCustomer: Customer | undefined;
  initialRental: Rental | undefined;
  initialVehicle: Vehicle | undefined;
  money: Intl.NumberFormat;
  onClose: () => void;
  onReturn: (draft: RentalWorkflowDraft, returnFiles: FileList | null) => Promise<Rental | undefined>;
  onSave: (draft: RentalWorkflowDraft, customerFiles: FileList | null) => Promise<Rental | undefined>;
  onSend: (channel: "email" | "telegram" | "whatsapp", draft: RentalWorkflowDraft) => Promise<Rental | undefined>;
  rentals: Rental[];
  vehicles: Vehicle[];
}) {
  const storageKey = "fleetcore-rental-workflow-draft";
  const initialWorkflowVehicle = initialVehicle?.status === "available"
    ? initialVehicle
    : vehicles.find((vehicle) => vehicle.status === "available" && !rentals.some((rental) => rental.status !== "closed" && rental.vehicleId === vehicle.id))
      ?? vehicles.find((vehicle) => vehicle.status === "available")
      ?? initialVehicle;
  const [draft, setDraft] = useState<RentalWorkflowDraft>(() => {
    const fallback = buildRentalWorkflowDraft(initialWorkflowVehicle, initialCustomer, initialRental);
    if (typeof window === "undefined") return fallback;
    const stored = localStorage.getItem(storageKey);
    if (!stored) return fallback;
    try {
      const parsed = { ...fallback, ...(JSON.parse(stored) as Partial<RentalWorkflowDraft>) };
      const rentalExists = rentals.some((rental) => rental.id === parsed.selectedRentalId && rental.status !== "closed");
      const unavailableVehicleIds = new Set(rentals.filter((rental) => rental.status !== "closed" && rental.id !== parsed.selectedRentalId).map((rental) => rental.vehicleId));
      const vehicleExists = vehicles.some((vehicle) => vehicle.id === parsed.selectedVehicleId && vehicle.status === "available" && !unavailableVehicleIds.has(vehicle.id));
      const customerExists = customers.some((customer) => customer.id === parsed.selectedCustomerId);
      return {
        ...normalizeRentalWorkflowDates(parsed),
        selectedCustomerId: customerExists ? parsed.selectedCustomerId : fallback.selectedCustomerId,
        selectedRentalId: rentalExists ? parsed.selectedRentalId : "",
        selectedVehicleId: vehicleExists ? parsed.selectedVehicleId : fallback.selectedVehicleId,
      };
    } catch {
      localStorage.removeItem(storageKey);
      return fallback;
    }
  });
  const [customerFiles, setCustomerFiles] = useState<FileList | null>(null);
  const [returnFiles, setReturnFiles] = useState<FileList | null>(null);
  const [savedRentalId, setSavedRentalId] = useState(draft.selectedRentalId);
  const [sendPanelOpen, setSendPanelOpen] = useState(Boolean(draft.selectedRentalId));

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(draft));
  }, [draft]);

  const selectedVehicle = vehicles.find((vehicle) => vehicle.id === draft.selectedVehicleId) ?? initialVehicle;
  const selectedCustomer = customers.find((customer) => customer.id === draft.selectedCustomerId) ?? initialCustomer;
  const currentRental = rentals.find((rental) => rental.id === savedRentalId || rental.id === draft.selectedRentalId) ?? initialRental;
  const unavailableVehicleIds = new Set(rentals.filter((rental) => rental.status !== "closed" && rental.id !== currentRental?.id).map((rental) => rental.vehicleId));
  const days = Math.max(1, Math.ceil((new Date(draft.returnAt).getTime() - new Date(draft.pickupAt).getTime()) / (24 * 60 * 60 * 1000)) || 1);
  const totalPreview = Number(draft.rentalAmount || 0);
  const depositPreview = Number(draft.depositAmount || 0);
  const canSaveRental = Boolean(draft.clientName.trim() && draft.clientPhone.trim() && draft.selectedVehicleId);
  const canSendRental = Boolean(savedRentalId || draft.selectedRentalId);

  function patch(key: keyof RentalWorkflowDraft, value: string) {
    setDraft((current) => normalizeRentalWorkflowDates({ ...current, [key]: value }));
  }

  function chooseCustomer(customerId: string) {
    const customer = customers.find((item) => item.id === customerId);
    setDraft((current) => ({
      ...current,
      clientEmail: customer?.email ?? current.clientEmail,
      clientName: customer?.displayName ?? current.clientName,
      clientPhone: customer?.phone ?? current.clientPhone,
      clientWhatsApp: customer?.phone ?? current.clientWhatsApp,
      selectedCustomerId: customerId,
    }));
  }

  function chooseVehicle(vehicleId: string) {
    const vehicle = vehicles.find((item) => item.id === vehicleId);
    setDraft((current) => ({
      ...current,
      depositAmount: vehicle ? String(Math.max(300, Math.round(vehicle.dailyRate * 5))) : current.depositAmount,
      depositRefund: vehicle ? String(Math.max(300, Math.round(vehicle.dailyRate * 5))) : current.depositRefund,
      paymentAmount: vehicle ? String(Math.max(1, vehicle.dailyRate * days)) : current.paymentAmount,
      rentalAmount: vehicle ? String(Math.max(1, vehicle.dailyRate * days)) : current.rentalAmount,
      selectedVehicleId: vehicleId,
    }));
  }

  const quickCustomers = customers.slice(0, 4);
  const quickVehicles = vehicles.filter((vehicle) => vehicle.status === "available" && !unavailableVehicleIds.has(vehicle.id)).slice(0, 4);

  async function save(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const rental = await onSave(draft, customerFiles);
    if (rental) {
      setSavedRentalId(rental.id);
      setDraft((current) => ({ ...current, selectedRentalId: rental.id, selectedVehicleId: rental.vehicleId }));
    }
  }

  async function saveAndPrepareSend() {
    const rental = await onSave(draft, customerFiles);
    if (rental) {
      setSavedRentalId(rental.id);
      setSendPanelOpen(true);
      setDraft((current) => ({ ...current, selectedRentalId: rental.id, selectedVehicleId: rental.vehicleId }));
    }
  }

  async function send(channel: "email" | "telegram" | "whatsapp") {
    const nextDraft = savedRentalId ? { ...draft, selectedRentalId: savedRentalId } : draft;
    const rental = await onSend(channel, nextDraft);
    if (rental) {
      setSavedRentalId(rental.id);
      setSendPanelOpen(true);
      setDraft((current) => ({ ...current, selectedRentalId: rental.id, selectedVehicleId: rental.vehicleId }));
    }
  }

  async function closeReturn() {
    const nextDraft = savedRentalId ? { ...draft, selectedRentalId: savedRentalId } : draft;
    const rental = await onReturn(nextDraft, returnFiles);
    if (rental) {
      setSavedRentalId(rental.id);
      setDraft((current) => ({ ...current, selectedRentalId: rental.id, selectedVehicleId: rental.vehicleId }));
    }
  }

  return (
    <div className="modal-backdrop rental-workflow-backdrop" role="dialog" aria-modal="true" aria-label="Rental workflow">
      <section className="rental-workflow">
        <div className="rental-workflow-hero">
          <div>
            <span className="eyebrow">FleetCore Rental Flow</span>
            <h2>Создать аренду</h2>
            <p>Два рабочих события для менеджера: создать аренду за 60 секунд и закрыть аренду за 30 секунд.</p>
          </div>
          <button className="ghost-button" onClick={onClose} type="button">Закрыть</button>
        </div>

        <div className="rental-workflow-progress two-events" aria-label="Rental workflow events">
          {["Создать аренду", "Закрыть аренду"].map((step, index) => (
            <span className={index < (savedRentalId ? 2 : 1) ? "active" : ""} key={step}>{index + 1}. {step}</span>
          ))}
        </div>

        <section className="rental-workflow-promo" aria-label="Быстрая сборка аренды">
          <div>
            <span className="eyebrow">One-click rental assembly</span>
            <h3>Соберите аренду и подготовьте ссылку клиенту одним действием</h3>
            <p>FleetCore создаст клиента, аренду, счет, оплату по статусу и подготовит отправку в WhatsApp, Telegram или email.</p>
          </div>
          <button className="primary-button" disabled={busy || !canSaveRental} onClick={() => void saveAndPrepareSend()} type="button">
            Собрать аренду
          </button>
        </section>

        <div className="rental-workflow-summary" aria-label="Rental workflow summary">
          <article>
            <span>Клиент</span>
            <strong>{draft.clientName || selectedCustomer?.displayName || "Новый клиент"}</strong>
            <small>{draft.clientPhone || draft.clientEmail || "телефон / email"}</small>
          </article>
          <article>
            <span>Автомобиль</span>
            <strong>{selectedVehicle ? `${selectedVehicle.make} ${selectedVehicle.model}` : "Выберите авто"}</strong>
            <small>{selectedVehicle?.plateNumber ?? "номер авто"}</small>
          </article>
          <article>
            <span>Детали</span>
            <strong>{money.format(totalPreview || 0)}</strong>
            <small>депозит {money.format(depositPreview || 0)}</small>
          </article>
          <article className={savedRentalId ? "saved" : ""}>
            <span>Статус</span>
            <strong>{savedRentalId ? "Сохранена" : "Черновик"}</strong>
            <small>{savedRentalId || "автосохранение"}</small>
          </article>
        </div>

        {savedRentalId ? (
          <div className="rental-workflow-result" role="status">
            <div>
              <span className="eyebrow">Rental record</span>
              <strong>Карточка аренды создана и доступна в поиске</strong>
              <p>Оплата, депозит, документы, отправка и возврат хранятся внутри карточки. Ищите по клиенту, авто, сумме, депозиту или ID: {savedRentalId}.</p>
            </div>
            <button className="ghost-button" onClick={() => void send("whatsapp")} type="button">Отправить клиенту</button>
          </div>
        ) : null}

        <form className="rental-workflow-grid" onSubmit={(event) => void save(event)}>
          <section className="workflow-block">
            <div className="workflow-block-title">
              <span>1</span>
              <div>
                <h3>Создать аренду</h3>
                <p>Клиент, автомобиль и детали карточки аренды в одном действии.</p>
              </div>
            </div>
            <label>Выбрать из CRM
              <select value={draft.selectedCustomerId} onChange={(event) => chooseCustomer(event.target.value)}>
                <option value="">Новый клиент</option>
                {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.displayName} · {customer.phone}</option>)}
              </select>
            </label>
            {quickCustomers.length ? (
              <div className="workflow-quick-picks" aria-label="Быстрый выбор клиента">
                {quickCustomers.map((customer) => (
                  <button className={draft.selectedCustomerId === customer.id ? "active" : ""} key={customer.id} onClick={() => chooseCustomer(customer.id)} type="button">
                    <strong>{customer.displayName}</strong>
                    <span>{customer.phone}</span>
                  </button>
                ))}
              </div>
            ) : null}
            <div className="workflow-two">
              <label>Имя<input required value={draft.clientName} onChange={(event) => patch("clientName", event.target.value)} /></label>
              <label>Телефон<input required inputMode="tel" value={draft.clientPhone} onChange={(event) => patch("clientPhone", event.target.value)} /></label>
            </div>
            <div className="workflow-two">
              <label>Email<input inputMode="email" type="email" value={draft.clientEmail} onChange={(event) => patch("clientEmail", event.target.value)} /></label>
              <label>WhatsApp<input inputMode="tel" value={draft.clientWhatsApp} onChange={(event) => patch("clientWhatsApp", event.target.value)} /></label>
            </div>
            <div className="workflow-two">
              <label>Telegram<input value={draft.clientTelegram} onChange={(event) => patch("clientTelegram", event.target.value)} /></label>
              <label>Паспорт / ID<input value={draft.clientPassportId} onChange={(event) => patch("clientPassportId", event.target.value)} /></label>
            </div>
            <label>Паспорт / ID / водительское удостоверение
              <input multiple onChange={(event) => setCustomerFiles(event.target.files)} type="file" />
            </label>
            <label>Заметка<textarea value={draft.clientNote} onChange={(event) => patch("clientNote", event.target.value)} /></label>
          </section>

          <section className="workflow-block">
            <div className="workflow-block-title">
              <span>•</span>
              <div>
                <h3>Автомобиль</h3>
                <p>Выберите свободный автомобиль из текущего автопарка.</p>
              </div>
            </div>
            <label>Автомобиль
              <select required value={draft.selectedVehicleId} onChange={(event) => chooseVehicle(event.target.value)}>
                <option value="">Выберите автомобиль</option>
                {vehicles.map((vehicle) => {
                  const unavailable = unavailableVehicleIds.has(vehicle.id) || vehicle.status !== "available";
                  return (
                    <option disabled={unavailable} key={vehicle.id} value={vehicle.id}>
                      {vehicle.plateNumber} · {vehicle.make} {vehicle.model} · {vehicle.status} · {money.format(vehicle.dailyRate)}/day
                    </option>
                  );
                })}
              </select>
            </label>
            {quickVehicles.length ? (
              <div className="workflow-quick-picks vehicle-picks" aria-label="Быстрый выбор автомобиля">
                {quickVehicles.map((vehicle) => (
                  <button className={draft.selectedVehicleId === vehicle.id ? "active" : ""} key={vehicle.id} onClick={() => chooseVehicle(vehicle.id)} type="button">
                    <strong>{vehicle.make} {vehicle.model}</strong>
                    <span>{vehicle.plateNumber} · {money.format(vehicle.dailyRate)}/day</span>
                  </button>
                ))}
              </div>
            ) : null}
            <div className="vehicle-selection-preview">
              <strong>{selectedVehicle ? `${selectedVehicle.make} ${selectedVehicle.model}` : "Автомобиль не выбран"}</strong>
              <span>Номер: {selectedVehicle?.plateNumber ?? "-"}</span>
              <span>Статус: {selectedVehicle?.status ?? "-"}</span>
              <span>Цена за день: {selectedVehicle ? money.format(selectedVehicle.dailyRate) : "-"}</span>
              <span>Депозит: {money.format(depositPreview || 0)}</span>
            </div>
            <div className="workflow-two">
              <label>Дата выдачи<input required type="datetime-local" value={draft.pickupAt} onChange={(event) => patch("pickupAt", event.target.value)} /></label>
              <label>Дата возврата<input required type="datetime-local" value={draft.returnAt} onChange={(event) => patch("returnAt", event.target.value)} /></label>
            </div>
          </section>

          <section className="workflow-block">
            <div className="workflow-block-title">
              <span>•</span>
              <div>
                <h3>Детали карточки аренды</h3>
                <p>Оплата, депозит и статус хранятся внутри аренды.</p>
              </div>
            </div>
            <div className="workflow-two">
              <label>Сумма аренды<input required inputMode="decimal" value={draft.rentalAmount} onChange={(event) => patch("rentalAmount", event.target.value)} /></label>
              <label>Депозит<input required inputMode="decimal" value={draft.depositAmount} onChange={(event) => patch("depositAmount", event.target.value)} /></label>
            </div>
            <div className="workflow-two">
              <label>Способ оплаты
                <select value={draft.paymentMethod} onChange={(event) => patch("paymentMethod", event.target.value)}>
                  <option value="cash">Наличные</option>
                  <option value="bank_transfer">Банковский перевод</option>
                  <option value="card">Карта</option>
                </select>
              </label>
              <label>Статус оплаты
                <select value={draft.paymentStatus} onChange={(event) => patch("paymentStatus", event.target.value)}>
                  <option value="paid">Оплачено</option>
                  <option value="partial">Частично оплачено</option>
                  <option value="unpaid">Не оплачено</option>
                </select>
              </label>
            </div>
            <label>Сумма внесенной оплаты<input inputMode="decimal" value={draft.paymentAmount} onChange={(event) => patch("paymentAmount", event.target.value)} /></label>
          </section>

          <section className={`workflow-block workflow-send-block ${sendPanelOpen ? "ready" : ""}`}>
            <div className="workflow-block-title">
              <span>•</span>
              <div>
                <h3>Отправить клиенту</h3>
                <p>{canSendRental ? "Ссылка готова. Выберите канал отправки." : "Сначала сохраните аренду, затем отправьте подтверждение клиенту."}</p>
              </div>
            </div>
            <div className="workflow-confirmation-card">
              <strong>{draft.clientName || selectedCustomer?.displayName || "Клиент"}</strong>
              <span>{selectedVehicle ? `${selectedVehicle.make} ${selectedVehicle.model} · ${selectedVehicle.plateNumber}` : "Автомобиль не выбран"}</span>
              <span>{days} дн. · {money.format(totalPreview || 0)} · депозит {money.format(depositPreview || 0)}</span>
              <span>{draft.paymentMethod} · {draft.paymentStatus}</span>
            </div>
            <div className="workflow-send-actions">
              <button className="ghost-button" disabled={busy || !canSendRental} onClick={() => void send("whatsapp")} type="button">WhatsApp</button>
              <button className="ghost-button" disabled={busy || !canSendRental} onClick={() => void send("telegram")} type="button">Telegram</button>
              <button className="ghost-button" disabled={busy || !canSendRental} onClick={() => void send("email")} type="button">Email</button>
            </div>
          </section>

          <section className="workflow-block">
            <div className="workflow-block-title">
              <span>2</span>
              <div>
                <h3>Закрыть аренду</h3>
                <p>Состояние авто, фото, повреждения и возврат депозита.</p>
              </div>
            </div>
            <div className="workflow-two">
              <label>Дата возврата<input type="datetime-local" value={draft.returnDate} onChange={(event) => patch("returnDate", event.target.value)} /></label>
              <label>Состояние автомобиля
                <select value={draft.returnCondition} onChange={(event) => patch("returnCondition", event.target.value)}>
                  <option value="ok">Без проблем</option>
                  <option value="dirty">Нужна чистка</option>
                  <option value="damaged">Есть повреждения</option>
                </select>
              </label>
            </div>
            <label>Фото до/после<input multiple accept="image/*" onChange={(event) => setReturnFiles(event.target.files)} type="file" /></label>
            <label>Повреждения<textarea value={draft.returnDamages} onChange={(event) => patch("returnDamages", event.target.value)} /></label>
            <label>Возврат депозита<input inputMode="decimal" value={draft.depositRefund} onChange={(event) => patch("depositRefund", event.target.value)} /></label>
            <button className="secondary-button full" disabled={busy || !savedRentalId} onClick={() => void closeReturn()} type="button">Закрыть аренду</button>
          </section>

          <div className="rental-workflow-footer">
            <div>
              <strong>{savedRentalId ? "Аренда сохранена" : "Черновик автосохранён"}</strong>
              <span>{savedRentalId || "Заполните блоки и нажмите сохранить."}</span>
            </div>
            <div className="rental-workflow-footer-actions">
              <button className="ghost-button" disabled={busy || !canSaveRental} onClick={() => void saveAndPrepareSend()} type="button">Сохранить и подготовить отправку</button>
              <button className="primary-button" disabled={busy || !canSaveRental} type="submit">Сохранить аренду</button>
            </div>
          </div>
        </form>
      </section>
    </div>
  );
}

function RentalScenarioWizard({
  busy,
  data,
  locale,
  money,
  onClose,
  onRunStep,
  selectedRental,
}: {
  busy: boolean;
  data: AppData;
  locale: Locale;
  money: Intl.NumberFormat;
  onClose: () => void;
  onRunStep: (step: RentalWizardStep) => void;
  selectedRental: Rental | undefined;
}) {
  const rental = selectedRental ?? data.rentals.find((item) => item.status !== "closed") ?? data.rentals[0];
  const vehicle = data.vehicles.find((item) => item.id === rental?.vehicleId) ?? data.vehicles[0];
  const customer = data.customers.find((item) => item.id === rental?.customerId) ?? data.customers[0];
  const contract = data.rentalContracts.find((item) => item.rentalId === rental?.id);
  const invoice = data.invoices.find((item) => item.rentalId === rental?.id);
  const paidAmount = invoice ? data.payments.filter((item) => item.invoiceId === invoice.id).reduce((sum, item) => sum + item.amount, 0) : 0;
  const returnDone = Boolean(rental?.status === "closed" || data.rentalChecklists.some((item) => item.rentalId === rental?.id && item.phase === "return"));
  const steps: Array<{ done: boolean; key: RentalWizardStep; label: string; meta: string }> = [
    { done: Boolean(vehicle), key: "vehicle", label: "1. Автомобиль", meta: vehicle ? `${vehicle.make} ${vehicle.model} · ${vehicle.plateNumber}` : "Создать или выбрать авто" },
    { done: Boolean(customer), key: "customer", label: "2. Клиент", meta: customer ? `${customer.displayName} · ${customer.phone}` : "Создать клиента" },
    { done: Boolean(rental), key: "booking", label: "3. Бронь", meta: rental ? `${rentalStatusLabel(locale, rental.status)} · ${money.format(rental.totalAmount)}` : "Создать период аренды" },
    { done: Boolean(contract), key: "contract", label: "4. Договор", meta: contract ? contractStatusLabel(locale, contract.status) : "Сгенерировать PDF/ссылку" },
    { done: Boolean(contract && contract.status !== "draft"), key: "send", label: "5. Отправка", meta: contract?.publicUrl ? "Ссылка готова для клиента" : "WhatsApp / Telegram / Email" },
    { done: Boolean(invoice && paidAmount >= invoice.total), key: "payment", label: "6. Оплата", meta: invoice ? `${money.format(paidAmount)} / ${money.format(invoice.total)}` : "Создать инвойс и оплату" },
    { done: returnDone, key: "return", label: "7. Возврат", meta: returnDone ? "Аренда закрыта" : "Акт возврата и финальный расчёт" },
  ];
  const nextStep = steps.find((step) => !step.done) ?? steps.at(-1)!;
  const progress = Math.round((steps.filter((step) => step.done).length / steps.length) * 100);

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <section className="rental-scenario-wizard" data-testid="rental-scenario-wizard">
        <div className="wizard-hero">
          <div>
            <span className="eyebrow">Rental Flow</span>
            <h2>Новая аренда с нуля</h2>
            <p>FleetCore ведёт менеджера по одному рабочему процессу: авто, клиент, бронь, договор, отправка, оплата и возврат.</p>
          </div>
          <button className="ghost-button" onClick={onClose} type="button">Закрыть</button>
        </div>

        <div className="wizard-progress-row">
          <div className="flow-progress-track" aria-label={`Rental wizard ${progress}%`}>
            <span style={{ width: `${progress}%` }} />
          </div>
          <strong>{progress}%</strong>
        </div>

        <div className="rental-scenario-grid">
          <div className="wizard-step-list">
            {steps.map((step) => (
              <button className={step.done ? "done" : step.key === nextStep.key ? "next" : ""} disabled={busy} key={step.key} onClick={() => onRunStep(step.key)} type="button">
                <span>{step.done ? "✓" : step.key === nextStep.key ? "→" : "•"}</span>
                <div>
                  <strong>{step.label}</strong>
                  <small>{step.meta}</small>
                </div>
              </button>
            ))}
          </div>

          <aside className="wizard-summary-card">
            <span className="eyebrow">Следующий шаг</span>
            <h3>{nextStep.label}</h3>
            <p>{nextStep.meta}</p>
            <button className="primary-button full" disabled={busy} onClick={() => onRunStep(nextStep.key)} type="button">
              {nextStep.done ? "Проверить финальный расчёт" : `Выполнить: ${nextStep.label.replace(/^\d+\.\s*/, "")}`}
            </button>
            <div className="wizard-rental-snapshot">
              <strong>{vehicle ? `${vehicle.make} ${vehicle.model}` : "Автомобиль ещё не выбран"}</strong>
              <span>{customer?.displayName ?? "Клиент ещё не выбран"}</span>
              <span>{rental ? `${money.format(rental.totalAmount)} · депозит ${money.format(rental.depositAmount)}` : "Бронь ещё не создана"}</span>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}

function SimplifiedCommandCenter({
  busy,
  busyAction,
  focus,
  message,
  onCreateCustomer,
  onCreateExpense,
  onCreateService,
  onCreateVehicle,
  onOpenWizard,
  onShareContract,
  onUploadDocument,
  stats,
  subtitle,
  title,
}: {
  busy: boolean;
  busyAction: string | undefined;
  focus: SectionFocus;
  message: string;
  onCreateCustomer: () => void;
  onCreateExpense: () => void;
  onCreateService: () => void;
  onCreateVehicle: () => void;
  onOpenWizard: () => void;
  onShareContract: () => void;
  onUploadDocument: () => void;
  stats: Array<{ label: string; tone: string; value: number | string }>;
  subtitle: string;
  title: string;
}) {
  const secondaryActions: Array<SmartAction & { testId?: string | undefined }> = [
    ...focus.secondary.map((action) => ({ ...action, testId: undefined })),
    { label: "Создать аренду", onClick: onOpenWizard, testId: "command-create-booking" },
    { label: "Автомобиль", onClick: onCreateVehicle, testId: "command-create-vehicle" },
    { label: "Клиент", onClick: onCreateCustomer, testId: "command-create-customer" },
    { label: "Документ", onClick: onUploadDocument, testId: "command-upload-document" },
    { label: "Расход", onClick: onCreateExpense, testId: "command-create-expense" },
    { label: "ТО", onClick: onCreateService, testId: "command-create-service" },
    { label: "WhatsApp / Telegram", onClick: onShareContract, testId: "command-share-contract" },
  ].filter((action, index, list) => list.findIndex((item) => item.label === action.label) === index);

  return (
    <section className="command-center simplified-command-center" data-testid="section-focus-bar" aria-label="Операционный фокус FleetCore">
      <div className="command-copy">
        <span className="eyebrow">{title}</span>
        <strong>{busyAction ?? focus.title}</strong>
        <p>{message || focus.meta || subtitle}</p>
      </div>
      <div className="workflow-stats">
        {stats.slice(0, 4).map((item) => (
          <article className={`workflow-chip ${item.tone}`} key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </article>
        ))}
      </div>
      <div className="command-actions" data-testid="fleet-command-actions">
        <button className="primary-button" disabled={busy || focus.primary.disabled} onClick={focus.primary.onClick} type="button">
          {focus.primary.label}
        </button>
        <details className="action-menu command-action-menu">
          <summary>Другие действия</summary>
          <div>
            {secondaryActions.map((action) => (
              <button className="ghost-button" data-testid={action.testId} disabled={busy || action.disabled} key={action.label} onClick={action.onClick} type="button">
                {action.label}
              </button>
            ))}
          </div>
        </details>
      </div>
    </section>
  );
}

function CreateActionSheet({
  busy,
  locale,
  onClose,
  onCreateCustomer,
  onCreateExpense,
  onCreateService,
  onCreateVehicle,
  onOpenClientIntake,
  onOpenRentalWizard,
  onShareContract,
  onUploadDocument,
  open,
}: {
  busy: boolean;
  locale: Locale;
  onClose: () => void;
  onCreateCustomer: () => void;
  onCreateExpense: () => void;
  onCreateService: () => void;
  onCreateVehicle: () => void;
  onOpenClientIntake: () => void;
  onOpenRentalWizard: () => void;
  onShareContract: () => void;
  onUploadDocument: () => void;
  open: boolean;
}) {
  if (!open) return null;

  function run(action: () => void) {
    if (busy) return;
    action();
    onClose();
  }

  const createLabel = locale === "ru" ? "Создать" : "Create";
  const closeLabel = locale === "ru" ? "Закрыть" : "Close";
  const helper = locale === "ru"
    ? "Выберите одно действие. Остальные шаги FleetCore предложит внутри процесса."
    : "Choose one action. FleetCore will guide the next steps inside the workflow.";
  const actions = [
    { description: locale === "ru" ? "Клиент, авто и детали аренды в одной карточке." : "Client, vehicle and rental details in one card.", label: locale === "ru" ? "Создать аренду" : "Create rental", onClick: onOpenRentalWizard },
    { description: locale === "ru" ? "Клиент сам заполнит данные и загрузит документы." : "Client fills data and uploads documents.", label: locale === "ru" ? "Заявка клиента" : "Client intake", onClick: onOpenClientIntake },
    { description: locale === "ru" ? "Добавить машину в автопарк." : "Add a vehicle to the fleet.", label: locale === "ru" ? "Автомобиль" : "Vehicle", onClick: onCreateVehicle },
    { description: locale === "ru" ? "CRM-карточка клиента и документы." : "Customer CRM profile and documents.", label: locale === "ru" ? "Клиент" : "Customer", onClick: onCreateCustomer },
    { description: locale === "ru" ? "Паспорт, договор, страховка, депозит." : "Passport, contract, insurance or deposit.", label: locale === "ru" ? "Документ" : "Document", onClick: onUploadDocument },
    { description: locale === "ru" ? "Сервис, мойка, штраф, ремонт." : "Service, cleaning, fine or repair.", label: locale === "ru" ? "Расход" : "Expense", onClick: onCreateExpense },
    { description: locale === "ru" ? "Плановое обслуживание автомобиля." : "Scheduled vehicle maintenance.", label: locale === "ru" ? "ТО" : "Service", onClick: onCreateService },
    { description: locale === "ru" ? "Отправить ссылку клиенту." : "Send a client link.", label: "WhatsApp / Telegram", onClick: onShareContract },
  ];

  return (
    <div className="create-action-sheet open" role="dialog" aria-modal="true" aria-label={createLabel}>
      <button className="create-action-backdrop" onClick={onClose} type="button" aria-label={closeLabel} />
      <section className="create-action-panel">
        <div className="section-title compact-title">
          <div>
            <span className="eyebrow">FleetCore</span>
            <h2>{createLabel}</h2>
            <p>{helper}</p>
          </div>
          <button className="ghost-button" onClick={onClose} type="button">{closeLabel}</button>
        </div>
        <div className="create-action-grid">
          {actions.map((action) => (
            <button className="create-action-item" disabled={busy} key={action.label} onClick={() => run(action.onClick)} type="button">
              <strong>{action.label}</strong>
              <span>{action.description}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function MobileDrawer({
  activeSection,
  locale,
  notificationsCount,
  onClose,
  onLocaleChange,
  onLogin,
  onLogout,
  onOpenProfile,
  onRegister,
  onSelect,
  open,
  photo,
  planMonth,
  planName,
  planSubtitle,
  profileLabel,
  registerLabel,
  session,
  switchAccountLabel,
}: {
  activeSection: Section;
  locale: Locale;
  notificationsCount: number;
  onClose: () => void;
  onLocaleChange: (locale: Locale) => void;
  onLogin: () => void;
  onLogout: () => void;
  onOpenProfile: () => void;
  onRegister: () => void;
  onSelect: (section: Section) => void;
  open: boolean;
  photo: string;
  planMonth: string;
  planName: string;
  planSubtitle: string;
  profileLabel: string;
  registerLabel: string;
  session: AuthSession;
  switchAccountLabel: string;
}) {
  function openProfile() {
    onOpenProfile();
    onClose();
  }

  function login() {
    onClose();
    onLogin();
  }

  function logout() {
    onClose();
    onLogout();
  }

  function register() {
    onClose();
    onRegister();
  }

  const primarySections: Section[] = ["Dashboard", "Bookings", "Vehicles", "Calendar"];
  const secondarySections = sections.filter((section) => !primarySections.includes(section));

  return (
    <div className={`mobile-drawer-shell ${open ? "open" : ""}`} aria-hidden={!open}>
      <button className="mobile-drawer-backdrop" onClick={onClose} type="button" aria-label="Close menu" />
      <aside className="mobile-drawer" aria-label="Mobile navigation">
        <div className="mobile-drawer-head">
          <button className="mobile-drawer-profile" onClick={openProfile} type="button">
            <span className="avatar">{photo ? <img alt="" src={photo} /> : session.user.fullName.slice(0, 1)}</span>
            <span>
              <strong>{session.user.fullName}</strong>
              <small>{session.user.role} · {session.user.email}</small>
            </span>
          </button>
          <button className="mobile-drawer-close" onClick={onClose} type="button" aria-label="Close menu">×</button>
        </div>

        <nav className="mobile-drawer-nav">
          {primarySections.map((item) => (
            <button className={activeSection === item ? "active" : ""} key={item} onClick={() => onSelect(item)} type="button">
              <span className="nav-icon">{sectionIcon(item)}</span>
              <span>{sectionLabel(locale, item)}</span>
              {item === "Service" && notificationsCount ? <em>{notificationsCount}</em> : null}
            </button>
          ))}
          <details className="mobile-drawer-more">
            <summary>{moreLabel(locale)}</summary>
            <div>
              {secondarySections.map((item) => (
                <button className={activeSection === item ? "active" : ""} key={item} onClick={() => onSelect(item)} type="button">
                  <span className="nav-icon">{sectionIcon(item)}</span>
                  <span>{sectionLabel(locale, item)}</span>
                  {item === "Service" && notificationsCount ? <em>{notificationsCount}</em> : null}
                </button>
              ))}
            </div>
          </details>
        </nav>

        <div className="mobile-drawer-tools">
          <LanguageSelect locale={locale} onChange={onLocaleChange} />
          <button className="ghost-button" onClick={openProfile} type="button">{profileLabel}</button>
          <button className="mobile-drawer-signout" onClick={logout} type="button">{translate(locale, "common.signOut")}</button>
          <button className="ghost-button" onClick={login} type="button">{switchAccountLabel}</button>
          <button className="primary-button" onClick={register} type="button">{registerLabel}</button>
        </div>

        <div className="mobile-drawer-plan">
          <span>{planName}</span>
          <strong>€499 / {planMonth}</strong>
          <small>{planSubtitle}</small>
        </div>
      </aside>
    </div>
  );
}

function MapPanel({ gpsDevices, locale, onSelect, selectedVehicleId, vehicles, rentals }: { gpsDevices: GpsDevice[]; locale: Locale; onSelect: (id: string) => void; selectedVehicleId: string | undefined; vehicles: Vehicle[]; rentals: Rental[] }) {
  const googleMapRef = useRef<HTMLDivElement>(null);
  const googleMapInstanceRef = useRef<GoogleMapInstance | null>(null);
  const googleMarkersRef = useRef<GoogleMarkerInstance[]>([]);
  const [googleMapsReady, setGoogleMapsReady] = useState(false);
  const [mapProvider, setMapProvider] = useState<MapProvider>("google");
  const selectedGps = gpsDevices.find((device) => device.vehicleId === selectedVehicleId) ?? gpsDevices[0];
  const mapQuery = selectedGps ? `${selectedGps.latitude},${selectedGps.longitude}` : "Warsaw, Poland";
  const center = selectedGps ? { lat: selectedGps.latitude, lng: selectedGps.longitude } : { lat: 52.2297, lng: 21.0122 };

  useEffect(() => {
    let cancelled = false;
    if (mapProvider !== "google") {
      setGoogleMapsReady(false);
      return () => {
        cancelled = true;
      };
    }

    loadGoogleMaps(GOOGLE_MAPS_API_KEY)
      .then((maps) => {
        if (cancelled || !maps || !googleMapRef.current) return;
        if (!googleMapInstanceRef.current) {
          googleMapInstanceRef.current = new maps.Map(googleMapRef.current, {
            center,
            mapTypeControl: false,
            streetViewControl: false,
            styles: [
              { featureType: "poi", stylers: [{ visibility: "off" }] },
              { featureType: "transit", stylers: [{ visibility: "off" }] },
            ],
            zoom: 12,
          });
        }

        googleMapInstanceRef.current.setCenter(center);
        googleMapInstanceRef.current.setZoom(12);
        googleMarkersRef.current.forEach((marker) => marker.setMap(null));
        googleMarkersRef.current = gpsDevices.map((device) => {
          const vehicle = vehicles.find((item) => item.id === device.vehicleId);
          return new maps.Marker({
            label: vehicle?.plateNumber.slice(0, 2) ?? "FC",
            map: googleMapInstanceRef.current!,
            position: { lat: device.latitude, lng: device.longitude },
            title: `${vehicle?.plateNumber ?? "FleetCore"} · ${device.speedKph} км/ч`,
          });
        });
        setGoogleMapsReady(true);
      })
      .catch(() => setGoogleMapsReady(false));

    return () => {
      cancelled = true;
    };
  }, [center.lat, center.lng, gpsDevices, mapProvider, vehicles]);

  return (
    <section className={`map-card large-map business-map google-map-panel ${mapProvider === "apple" ? "apple-map-panel" : ""}`}>
      {mapProvider === "google" && GOOGLE_MAPS_API_KEY ? <div className="google-js-map" ref={googleMapRef} /> : null}
      {mapProvider === "google" && (!GOOGLE_MAPS_API_KEY || !googleMapsReady) ? (
        <iframe
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          src={`https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&z=12&output=embed`}
          title="Google Maps GPS fleet"
        />
      ) : null}
      {mapProvider === "apple" ? (
        <div className="apple-map-canvas" aria-label="Apple Maps inside FleetCore">
          <div className="apple-map-road road-one" />
          <div className="apple-map-road road-two" />
          <div className="apple-map-road road-three" />
          <div className="apple-map-water" />
          <div className="apple-map-label label-one">FleetCore GPS</div>
          <div className="apple-map-label label-two">{selectedGps ? `${selectedGps.latitude.toFixed(4)}, ${selectedGps.longitude.toFixed(4)}` : "Warsaw"}</div>
        </div>
      ) : null}
      <div className="map-provider-badge">{mapProvider === "apple" ? "Apple Maps inside FleetCore" : GOOGLE_MAPS_API_KEY && googleMapsReady ? "Google Maps API" : "Google Maps preview"}</div>
      <div className="map-action-bar">
        <button className={`ghost-button ${mapProvider === "google" ? "active" : ""}`} onClick={() => setMapProvider("google")} type="button">Google Maps</button>
        <button className={`ghost-button ${mapProvider === "apple" ? "active" : ""}`} onClick={() => setMapProvider("apple")} type="button">Apple Maps</button>
        <span>{selectedGps ? `${selectedGps.status} · ${selectedGps.speedKph} км/ч · ${dateFmt.format(new Date(selectedGps.lastSignalAt))}` : translate(locale, "gps.notConnected")}</span>
      </div>
      {vehicles.slice(0, 8).map((vehicle, index) => {
        const rental = rentals.find((item) => item.vehicleId === vehicle.id && item.status !== "closed");
        const gps = gpsDevices.find((item) => item.vehicleId === vehicle.id);
        return (
          <button className={`map-pin pin-${(index % 5) + 1} ${statusTone(vehicle, rental)} ${selectedVehicleId === vehicle.id ? "selected" : ""}`} key={vehicle.id} onClick={() => onSelect(vehicle.id)} type="button">
            <span>▣</span>
            <strong>{vehicle.plateNumber}</strong>
            <small>{gps ? `${gps.speedKph} км/ч · ${gps.status}` : translate(locale, "gps.notConnected")}</small>
          </button>
        );
      })}
      <div className="map-legend">
        <span><i className="green" /> {translate(locale, "status.available")}</span>
        <span><i className="blue" /> {translate(locale, "status.reserved")}</span>
        <span><i className="orange" /> {translate(locale, "status.returnDue")}</span>
        <span><i className="red" /> {translate(locale, "status.overdue")}</span>
        <span><i className="black" /> {translate(locale, "status.maintenance")}</span>
      </div>
    </section>
  );
}

function NotificationsPanel({ locale, notifications }: { locale: Locale; notifications: UiNotification[] }) {
  return (
    <section className="table-panel">
      <div className="section-title compact-title"><h2>{translate(locale, "panel.notifications")}</h2><Badge value={String(notifications.length)} /></div>
      <div className="notification-list">
        {(notifications.length ? notifications : [{ id: "ok", meta: translate(locale, "status.system"), time: translate(locale, "time.now"), title: translate(locale, "status.noCritical"), tone: "green" as const }]).map((item) => (
          <article className="notification-row" key={item.id}>
            <i className={item.tone}>{item.tone === "green" ? "✓" : "!"}</i>
            <div><strong>{item.title}</strong><span>{item.meta}</span></div>
            <time>{item.time}</time>
          </article>
        ))}
      </div>
    </section>
  );
}

function ShareContractDialog({ busy, customer, onClose, onShare, rental, vehicle }: { busy: boolean; customer: Customer | undefined; onClose: () => void; onShare: (channel: "email" | "telegram" | "whatsapp") => void; rental: Rental | undefined; vehicle: Vehicle | undefined }) {
  const title = rental && vehicle ? `${vehicle.make} ${vehicle.model} · ${vehicle.plateNumber}` : "Договор аренды";
  const customerLabel = customer ? `${customer.displayName} · ${customer.phone}` : "Клиент будет выбран автоматически";

  return (
    <div className="modal-backdrop">
      <section className="operation-modal share-modal" role="dialog" aria-modal="true" aria-label="Отправка договора">
        <div className="modal-title">
          <div>
            <span>Contract delivery</span>
            <h2>Отправить договор клиенту</h2>
          </div>
          <button onClick={onClose} type="button">×</button>
        </div>
        <div className="share-hero">
          <strong>{title}</strong>
          <span>{customerLabel}</span>
          <p>FleetCore создаст публичную ссылку договора и откроет выбранный канал отправки. Статус договора сохранится в системе.</p>
        </div>
        <div className="share-channel-grid">
          <button disabled={busy} onClick={() => onShare("whatsapp")} type="button">
            <strong>WhatsApp</strong>
            <span>Открыть чат с готовой ссылкой</span>
          </button>
          <button disabled={busy} onClick={() => onShare("telegram")} type="button">
            <strong>Telegram</strong>
            <span>Открыть отправку ссылки</span>
          </button>
          <button disabled={busy} onClick={() => onShare("email")} type="button">
            <strong>Email</strong>
            <span>Создать письмо клиенту</span>
          </button>
        </div>
        <div className="modal-actions">
          <button className="ghost-button" disabled={busy} onClick={onClose} type="button">Отмена</button>
        </div>
      </section>
    </div>
  );
}

function ClientIntakeShareDialog({ busy, customer, intakeUrl, onClose, onShare, vehicle }: { busy: boolean; customer: Customer | undefined; intakeUrl: string; onClose: () => void; onShare: (channel: "email" | "telegram" | "whatsapp") => void; vehicle: Vehicle | undefined }) {
  const title = vehicle ? `${vehicle.make} ${vehicle.model} · ${vehicle.plateNumber}` : "Заявка клиента";
  const customerLabel = customer ? `${customer.displayName} · ${customer.phone}` : "Можно отправить новому клиенту";

  return (
    <div className="modal-backdrop">
      <section className="operation-modal share-modal" role="dialog" aria-modal="true" aria-label="Отправка заявки клиента">
        <div className="modal-title">
          <div>
            <span>Client intake</span>
            <h2>Отправить заявку клиенту</h2>
          </div>
          <button onClick={onClose} type="button">×</button>
        </div>
        <div className="share-hero">
          <strong>{title}</strong>
          <span>{customerLabel}</span>
          <p>Клиент откроет ссылку, заполнит данные, загрузит фото, паспорт/ID и водительские права. После отправки клиент и документы появятся в CRM и Document Center.</p>
        </div>
        <div className="client-intake-link-box">{intakeUrl}</div>
        <div className="share-channel-grid">
          <button disabled={busy} onClick={() => onShare("whatsapp")} type="button">
            <strong>WhatsApp</strong>
            <span>Открыть чат с заявкой</span>
          </button>
          <button disabled={busy} onClick={() => onShare("telegram")} type="button">
            <strong>Telegram</strong>
            <span>Отправить ссылку заявки</span>
          </button>
          <button disabled={busy} onClick={() => onShare("email")} type="button">
            <strong>Email</strong>
            <span>Создать письмо клиенту</span>
          </button>
        </div>
        <div className="modal-actions">
          <button className="ghost-button" disabled={busy} onClick={onClose} type="button">Отмена</button>
        </div>
      </section>
    </div>
  );
}

function DocumentPreviewDialog({ document, onClose }: { document: DocumentPreview; onClose: () => void }) {
  const isImage = /\.(png|jpe?g|webp|gif|avif)$/i.test(document.fileUrl);

  return (
    <div className="modal-backdrop">
      <section className="operation-modal document-preview-modal" role="dialog" aria-modal="true" aria-label="Предпросмотр документа">
        <div className="modal-title">
          <div>
            <span>Document preview</span>
            <h2>{document.title}</h2>
          </div>
          <button onClick={onClose} type="button">×</button>
        </div>
        <div className="document-preview-frame">
          {isImage ? <img alt={document.title} src={document.fileUrl} /> : <iframe src={document.fileUrl} title={document.title} />}
        </div>
        <div className="document-preview-actions">
          <a className="primary-button" href={document.fileUrl} rel="noreferrer" target="_blank">Открыть в новой вкладке</a>
          <a className="ghost-button" download href={document.fileUrl}>Скачать</a>
          <button className="ghost-button" onClick={onClose} type="button">Закрыть</button>
        </div>
      </section>
    </div>
  );
}

function VehicleHero({
  customer,
  documentsCount,
  finance,
  locale,
  onDocument,
  onExpense,
  onPhoto,
  onRemovePhoto,
  onService,
  rental,
  serviceCount,
  vehicle,
}: {
  customer: Customer | undefined;
  documentsCount: number;
  finance: { expenses: number; income: number; roi: number; vehicle: Vehicle } | undefined;
  locale: Locale;
  onDocument: () => void;
  onExpense: () => void;
  onPhoto: () => void;
  onRemovePhoto: () => void;
  onService: () => void;
  rental: Rental | undefined;
  serviceCount: number;
  vehicle: Vehicle | undefined;
}) {
  if (!vehicle) {
    return (
      <section className="vehicle-hero empty">
        <div>
          <span className="eyebrow">{translate(locale, "nav.Vehicles")}</span>
          <h2>{translate(locale, "vehicle.add")}</h2>
          <p>{translate(locale, "section.subtitle.Vehicles")}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="vehicle-hero">
      <div className="vehicle-hero-copy">
        <span className="eyebrow">{vehicleStatusLabel(locale, vehicle, rental)}</span>
        <h2>{vehicle.make} {vehicle.model}</h2>
        <p>{vehicle.plateNumber} · VIN {vehicle.vin}</p>
        <div className="vehicle-hero-actions">
          <button className="primary-button" onClick={onPhoto} type="button">{vehicle.photoUrl ? translate(locale, "vehicle.photoReplace") : translate(locale, "vehicle.photoAdd")}</button>
          {vehicle.photoUrl ? <button className="ghost-button" onClick={onRemovePhoto} type="button">{translate(locale, "vehicle.photoRemove")}</button> : null}
          <button className="primary-button" onClick={onDocument} type="button">{translate(locale, "vehicle.uploadDocument")}</button>
          <button className="ghost-button" onClick={onExpense} type="button">{translate(locale, "vehicle.expense")}</button>
          <button className="ghost-button" onClick={onService} type="button">{translate(locale, "vehicle.serviceCreate")}</button>
        </div>
      </div>
      <div className="vehicle-hero-art">
        <VehicleVisual tone="dark" vehicle={vehicle} />
      </div>
      <div className="vehicle-hero-stats">
        <article><span>{translate(locale, "vehicle.mileage")}</span><strong>{vehicle.odometerKm.toLocaleString()} км</strong></article>
        <article><span>{translate(locale, "vehicle.client")}</span><strong>{customer?.displayName ?? translate(locale, "common.noClient")}</strong></article>
        <article><span>{translate(locale, "vehicle.return")}</span><strong>{rental ? dateFmt.format(new Date(rental.returnAt)) : translate(locale, "common.noReturn")}</strong></article>
        <article><span>{translate(locale, "vehicle.documents")}</span><strong>{documentsCount}</strong></article>
        <article><span>{translate(locale, "vehicle.service")}</span><strong>{serviceCount}</strong></article>
        <article><span>ROI</span><strong>{finance?.roi ?? 0}%</strong></article>
      </div>
    </section>
  );
}

function VehicleGridCard({
  customer,
  canDelete,
  finance,
  gps,
  isSelected,
  locale,
  onDelete,
  onSelect,
  onToggleBulk,
  rental,
  selectedForBulk,
  vehicle,
}: {
  canDelete: boolean;
  customer: Customer | undefined;
  finance: { expenses: number; income: number; roi: number; vehicle: Vehicle } | undefined;
  gps: GpsDevice | undefined;
  isSelected: boolean;
  locale: Locale;
  onDelete: () => void;
  onSelect: () => void;
  onToggleBulk: () => void;
  rental: Rental | undefined;
  selectedForBulk: boolean;
  vehicle: Vehicle;
}) {
  return (
    <article className={`fleet-vehicle-card ${isSelected ? "selected" : ""} ${selectedForBulk ? "bulk-selected" : ""}`} onClick={onSelect} onKeyDown={(event) => {
      if (event.key === "Enter" || event.key === " ") onSelect();
    }} role="button" tabIndex={0}>
      <button aria-pressed={selectedForBulk} className="bulk-select-button" onClick={(event) => {
        event.stopPropagation();
        onToggleBulk();
      }} type="button">{selectedForBulk ? "✓" : "+"}</button>
      <button aria-label={translate(locale, "vehicle.delete")} className="vehicle-remove-button" data-disabled={!canDelete} onClick={(event) => {
        event.stopPropagation();
        onDelete();
      }} title={canDelete ? translate(locale, "vehicle.delete") : translate(locale, "vehicle.deleteBlocked")} type="button">×</button>
      <div className="fleet-vehicle-top">
        <VehicleVisual vehicle={vehicle} />
        <Badge value={vehicleStatusLabel(locale, vehicle, rental)} />
      </div>
      <div className="fleet-vehicle-title">
        <strong>{vehicle.make} {vehicle.model}</strong>
        <span>{vehicle.plateNumber}</span>
      </div>
      <div className="fleet-vehicle-meta">
        <span>{customer?.displayName ?? translate(locale, "common.noClient")}</span>
        <span>{rental ? dateFmt.format(new Date(rental.returnAt)) : translate(locale, "common.noReturn")}</span>
      </div>
      <div className="fleet-vehicle-stats">
        <article><span>{translate(locale, "vehicle.mileage")}</span><strong>{vehicle.odometerKm.toLocaleString()}</strong></article>
        <article><span>GPS</span><strong>{gps ? gps.status : "off"}</strong></article>
        <article><span>ROI</span><strong>{finance?.roi ?? 0}%</strong></article>
      </div>
    </article>
  );
}

function OperationDialog({
  data,
  files,
  form,
  kind,
  locale,
  onChange,
  onClose,
  onFiles,
  onSubmit,
  saving,
}: {
  data: AppData;
  files: FileList | null;
  form: typeof defaultOperationForm;
  kind: OperationKind;
  locale: Locale;
  onChange: (form: typeof defaultOperationForm) => void;
  onClose: () => void;
  onFiles: (files: FileList | null) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  saving: boolean;
}) {
  const modalCopy: Record<Locale, Record<string, string>> = {
    en: {
      operation: "FleetCore operation",
      "title.booking": "Create booking",
      "title.contract": "Rental contract",
      "title.customerDocument": "Customer document",
      "title.depositDocument": "Deposit / refund document",
      "title.depositReturn": "Deposit refund",
      "title.expense": "Add expense",
      "title.gps": "Connect GPS",
      "title.payment": "Record payment",
      "title.signature": "Electronic signature",
      "title.service": "Create maintenance",
      "title.vehicleDocument": "Vehicle document",
      vehicle: "Vehicle",
      customer: "Customer",
      rental: "Rental",
      returnAt: "Return date",
      totalAmount: "Rental amount",
      depositAmount: "Deposit",
      category: "Category",
      maintenance: "Repair / service",
      insurance: "Insurance",
      fuel: "Fuel",
      cleaning: "Cleaning",
      parking: "Parking",
      other: "Other",
      amount: "Amount",
      note: "Comment",
      serviceType: "Service type",
      inspection: "Inspection",
      oil: "Oil",
      repair: "Repair",
      tires: "Tires",
      date: "Date",
      odometer: "Mileage",
      cost: "Cost",
      status: "Status",
      planned: "Planned",
      completed: "Completed",
      invoice: "Invoice",
      method: "Method",
      reference: "Reference",
      finalAmount: "Final rental amount",
      depositRefundAmount: "Deposit refund amount",
      returnOdometer: "Return mileage",
      documentTitle: "Document title",
      documentPlaceholder: "Optional",
      documentType: "Document type",
      registration: "Registration",
      rentalContract: "Rental contract",
      passport: "Passport",
      idCard: "ID card",
      driverLicense: "Driver license",
      files: "Files",
      fileChoose: "Choose file",
      fileContractHint: "You can choose a file or create a contract without a file",
      filesSelected: "Files selected",
    },
    ru: {
      operation: "Операция FleetCore",
      "title.booking": "Создать бронь",
      "title.contract": "Договор аренды",
      "title.customerDocument": "Документ клиента",
      "title.depositDocument": "Документ депозита / возврата",
      "title.depositReturn": "Возврат депозита",
      "title.expense": "Добавить расход",
      "title.gps": "Подключить GPS",
      "title.payment": "Провести оплату",
      "title.signature": "Электронная подпись",
      "title.service": "Создать техобслуживание",
      "title.vehicleDocument": "Документ автомобиля",
      vehicle: "Автомобиль",
      customer: "Клиент",
      rental: "Аренда",
      returnAt: "Дата возврата",
      totalAmount: "Сумма аренды",
      depositAmount: "Депозит",
      category: "Категория",
      maintenance: "Ремонт / ТО",
      insurance: "Страховка",
      fuel: "Топливо",
      cleaning: "Мойка",
      parking: "Парковка",
      other: "Другое",
      amount: "Сумма",
      note: "Комментарий",
      serviceType: "Тип ТО",
      inspection: "Техосмотр",
      oil: "Масло",
      repair: "Ремонт",
      tires: "Шины",
      date: "Дата",
      odometer: "Пробег",
      cost: "Стоимость",
      status: "Статус",
      planned: "Запланировано",
      completed: "Выполнено",
      invoice: "Инвойс",
      method: "Метод",
      reference: "Референс",
      finalAmount: "Итоговая сумма аренды",
      depositRefundAmount: "Сумма возврата депозита",
      returnOdometer: "Пробег при возврате",
      documentTitle: "Название документа",
      documentPlaceholder: "Можно оставить пустым",
      documentType: "Тип документа",
      registration: "Регистрация",
      rentalContract: "Договор аренды",
      passport: "Паспорт",
      idCard: "ID card",
      driverLicense: "Водительские права",
      files: "Файлы",
      fileChoose: "Выберите файл",
      fileContractHint: "Можно выбрать файл или создать договор без файла",
      filesSelected: "Выбрано файлов",
    },
    es: {
      operation: "Operación FleetCore",
      "title.booking": "Crear reserva",
      "title.contract": "Contrato de alquiler",
      "title.customerDocument": "Documento del cliente",
      "title.depositDocument": "Documento de depósito / reembolso",
      "title.depositReturn": "Reembolso de depósito",
      "title.expense": "Añadir gasto",
      "title.gps": "Conectar GPS",
      "title.payment": "Registrar pago",
      "title.signature": "Firma electrónica",
      "title.service": "Crear mantenimiento",
      "title.vehicleDocument": "Documento del vehículo",
      vehicle: "Vehículo",
      customer: "Cliente",
      rental: "Alquiler",
      returnAt: "Fecha de devolución",
      totalAmount: "Importe de alquiler",
      depositAmount: "Depósito",
      category: "Categoría",
      maintenance: "Reparación / servicio",
      insurance: "Seguro",
      fuel: "Combustible",
      cleaning: "Limpieza",
      parking: "Parking",
      other: "Otro",
      amount: "Importe",
      note: "Comentario",
      serviceType: "Tipo de servicio",
      inspection: "Inspección",
      oil: "Aceite",
      repair: "Reparación",
      tires: "Neumáticos",
      date: "Fecha",
      odometer: "Kilometraje",
      cost: "Coste",
      status: "Estado",
      planned: "Planificado",
      completed: "Completado",
      invoice: "Factura",
      method: "Método",
      reference: "Referencia",
      finalAmount: "Importe final de alquiler",
      depositRefundAmount: "Importe de reembolso",
      returnOdometer: "Kilometraje de devolución",
      documentTitle: "Título del documento",
      documentPlaceholder: "Opcional",
      documentType: "Tipo de documento",
      registration: "Registro",
      rentalContract: "Contrato de alquiler",
      passport: "Pasaporte",
      idCard: "ID card",
      driverLicense: "Permiso de conducir",
      files: "Archivos",
      fileChoose: "Elegir archivo",
      fileContractHint: "Puedes elegir un archivo o crear contrato sin archivo",
      filesSelected: "Archivos seleccionados",
    },
    fr: {
      operation: "Opération FleetCore",
      "title.booking": "Créer réservation",
      "title.contract": "Contrat de location",
      "title.customerDocument": "Document client",
      "title.depositDocument": "Document dépôt / remboursement",
      "title.depositReturn": "Remboursement dépôt",
      "title.expense": "Ajouter dépense",
      "title.gps": "Connecter GPS",
      "title.payment": "Enregistrer paiement",
      "title.signature": "Signature électronique",
      "title.service": "Créer maintenance",
      "title.vehicleDocument": "Document véhicule",
      vehicle: "Véhicule",
      customer: "Client",
      rental: "Location",
      returnAt: "Date de retour",
      totalAmount: "Montant location",
      depositAmount: "Dépôt",
      category: "Catégorie",
      maintenance: "Réparation / service",
      insurance: "Assurance",
      fuel: "Carburant",
      cleaning: "Nettoyage",
      parking: "Parking",
      other: "Autre",
      amount: "Montant",
      note: "Commentaire",
      serviceType: "Type service",
      inspection: "Inspection",
      oil: "Huile",
      repair: "Réparation",
      tires: "Pneus",
      date: "Date",
      odometer: "Kilométrage",
      cost: "Coût",
      status: "Statut",
      planned: "Planifié",
      completed: "Terminé",
      invoice: "Facture",
      method: "Méthode",
      reference: "Référence",
      finalAmount: "Montant final location",
      depositRefundAmount: "Montant remboursement",
      returnOdometer: "Kilométrage retour",
      documentTitle: "Titre du document",
      documentPlaceholder: "Optionnel",
      documentType: "Type document",
      registration: "Immatriculation",
      rentalContract: "Contrat de location",
      passport: "Passeport",
      idCard: "ID card",
      driverLicense: "Permis de conduire",
      files: "Fichiers",
      fileChoose: "Choisir fichier",
      fileContractHint: "Vous pouvez choisir un fichier ou créer un contrat sans fichier",
      filesSelected: "Fichiers sélectionnés",
    },
    de: {
      operation: "FleetCore Vorgang",
      "title.booking": "Buchung erstellen",
      "title.contract": "Mietvertrag",
      "title.customerDocument": "Kundendokument",
      "title.depositDocument": "Kaution / Erstattung Dokument",
      "title.depositReturn": "Kaution erstatten",
      "title.expense": "Kosten hinzufügen",
      "title.gps": "GPS verbinden",
      "title.payment": "Zahlung erfassen",
      "title.signature": "Elektronische Signatur",
      "title.service": "Wartung erstellen",
      "title.vehicleDocument": "Fahrzeugdokument",
      vehicle: "Fahrzeug",
      customer: "Kunde",
      rental: "Miete",
      returnAt: "Rückgabedatum",
      totalAmount: "Mietbetrag",
      depositAmount: "Kaution",
      category: "Kategorie",
      maintenance: "Reparatur / Service",
      insurance: "Versicherung",
      fuel: "Kraftstoff",
      cleaning: "Reinigung",
      parking: "Parken",
      other: "Andere",
      amount: "Betrag",
      note: "Kommentar",
      serviceType: "Servicetyp",
      inspection: "Inspektion",
      oil: "Öl",
      repair: "Reparatur",
      tires: "Reifen",
      date: "Datum",
      odometer: "Kilometerstand",
      cost: "Kosten",
      status: "Status",
      planned: "Geplant",
      completed: "Abgeschlossen",
      invoice: "Rechnung",
      method: "Methode",
      reference: "Referenz",
      finalAmount: "Finaler Mietbetrag",
      depositRefundAmount: "Kautionserstattung",
      returnOdometer: "Kilometerstand bei Rückgabe",
      documentTitle: "Dokumenttitel",
      documentPlaceholder: "Optional",
      documentType: "Dokumenttyp",
      registration: "Registrierung",
      rentalContract: "Mietvertrag",
      passport: "Reisepass",
      idCard: "ID card",
      driverLicense: "Führerschein",
      files: "Dateien",
      fileChoose: "Datei wählen",
      fileContractHint: "Sie können eine Datei wählen oder Vertrag ohne Datei erstellen",
      filesSelected: "Dateien ausgewählt",
    },
  };
  const m = (key: string) => modalCopy[locale][key] ?? modalCopy.en[key] ?? key;
  const titleByKind: Record<OperationKind, string> = {
    booking: m("title.booking"),
    contract: m("title.contract"),
    customerDocument: m("title.customerDocument"),
    depositDocument: m("title.depositDocument"),
    depositReturn: m("title.depositReturn"),
    expense: m("title.expense"),
    gps: m("title.gps"),
    payment: m("title.payment"),
    signature: m("title.signature"),
    service: m("title.service"),
    vehicleDocument: m("title.vehicleDocument"),
  };

  const showVehicle = ["booking", "expense", "gps", "service", "vehicleDocument"].includes(kind);
  const showCustomer = ["booking", "customerDocument"].includes(kind);
  const showRental = ["contract", "depositDocument", "depositReturn", "signature"].includes(kind);
  const showFiles = ["contract", "customerDocument", "depositDocument", "expense", "signature", "vehicleDocument"].includes(kind);
  const needsAutoVehicle = showVehicle && !data.vehicles.length;
  const needsAutoCustomer = showCustomer && !data.customers.length;
  const needsAutoRental = showRental && !data.rentals.length;
  const needsAutoInvoice = kind === "payment" && !data.invoices.some((invoice) => invoice.status !== "paid");
  const autoContextNotes = [
    needsAutoVehicle ? "FleetCore создаст первый автомобиль автоматически." : "",
    needsAutoCustomer ? "FleetCore создаст первого клиента автоматически." : "",
    needsAutoRental ? "FleetCore создаст аренду автоматически, если активной аренды ещё нет." : "",
    needsAutoInvoice ? "FleetCore создаст инвойс автоматически, если нет неоплаченного счёта." : "",
  ].filter(Boolean);

  function patch(key: keyof typeof defaultOperationForm, value: string) {
    onChange({ ...form, [key]: value });
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <form className="operation-modal" onSubmit={onSubmit}>
        <div className="modal-title">
          <div>
            <span>{m("operation")}</span>
            <h2>{titleByKind[kind]}</h2>
          </div>
          <button onClick={onClose} type="button">×</button>
        </div>

        {autoContextNotes.length ? (
          <div className="operation-auto-context" data-testid="operation-auto-context">
            <strong>Можно сохранить сразу</strong>
            {autoContextNotes.map((note) => <span key={note}>{note}</span>)}
          </div>
        ) : null}

        <div className="form-grid">
          {showVehicle ? (
            <label>{m("vehicle")}
              <select value={form.vehicleId} onChange={(event) => patch("vehicleId", event.target.value)}>
                {!data.vehicles.length ? <option value="">Создать автомобиль автоматически</option> : null}
                {data.vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.make} {vehicle.model} · {vehicle.plateNumber}</option>)}
              </select>
            </label>
          ) : null}

          {showCustomer ? (
            <label>{m("customer")}
              <select value={form.customerId} onChange={(event) => patch("customerId", event.target.value)}>
                {!data.customers.length ? <option value="">Создать клиента автоматически</option> : null}
                {data.customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.displayName} · {customer.phone}</option>)}
              </select>
            </label>
          ) : null}

          {showRental ? (
            <label>{m("rental")}
              <select value={form.rentalId} onChange={(event) => patch("rentalId", event.target.value)}>
                {!data.rentals.length ? <option value="">Создать аренду автоматически</option> : null}
                {data.rentals.map((rental) => {
                  const vehicle = data.vehicles.find((item) => item.id === rental.vehicleId);
                  const customer = data.customers.find((item) => item.id === rental.customerId);
                  return <option key={rental.id} value={rental.id}>{customer?.displayName} · {vehicle?.plateNumber} · {money.format(rental.totalAmount)}</option>;
                })}
              </select>
            </label>
          ) : null}

          {kind === "booking" ? (
            <>
              <label>{m("returnAt")}<input type="datetime-local" value={form.returnAt} onChange={(event) => patch("returnAt", event.target.value)} /></label>
              <label>{m("totalAmount")}<input type="number" min="0" value={form.totalAmount} onChange={(event) => patch("totalAmount", event.target.value)} /></label>
              <label>{m("depositAmount")}<input type="number" min="0" value={form.depositAmount} onChange={(event) => patch("depositAmount", event.target.value)} /></label>
            </>
          ) : null}

          {kind === "expense" ? (
            <>
              <label>{m("category")}
                <select value={form.category} onChange={(event) => patch("category", event.target.value)}>
                  <option value="maintenance">{m("maintenance")}</option>
                  <option value="insurance">{m("insurance")}</option>
                  <option value="fuel">{m("fuel")}</option>
                  <option value="cleaning">{m("cleaning")}</option>
                  <option value="parking">{m("parking")}</option>
                  <option value="other">{m("other")}</option>
                </select>
              </label>
              <label>{m("amount")}<input type="number" min="0" value={form.amount} onChange={(event) => patch("amount", event.target.value)} /></label>
              <label className="wide-field">{m("note")}<input value={form.note} onChange={(event) => patch("note", event.target.value)} /></label>
            </>
          ) : null}

          {kind === "service" ? (
            <>
              <label>{m("serviceType")}
                <select value={form.serviceType} onChange={(event) => patch("serviceType", event.target.value)}>
                  <option value="inspection">{m("inspection")}</option>
                  <option value="oil">{m("oil")}</option>
                  <option value="repair">{m("repair")}</option>
                  <option value="tires">{m("tires")}</option>
                  <option value="other">{m("other")}</option>
                </select>
              </label>
              <label>{m("date")}<input type="date" value={form.serviceAt} onChange={(event) => patch("serviceAt", event.target.value)} /></label>
              <label>{m("odometer")}<input type="number" min="0" value={form.odometerKm} onChange={(event) => patch("odometerKm", event.target.value)} /></label>
              <label>{m("cost")}<input type="number" min="0" value={form.cost} onChange={(event) => patch("cost", event.target.value)} /></label>
              <label>{m("status")}
                <select value={form.status} onChange={(event) => patch("status", event.target.value)}>
                  <option value="planned">{m("planned")}</option>
                  <option value="completed">{m("completed")}</option>
                </select>
              </label>
              <label className="wide-field">{m("note")}<input value={form.note} onChange={(event) => patch("note", event.target.value)} /></label>
            </>
          ) : null}

          {kind === "payment" ? (
            <>
              <label>{m("invoice")}
                <select value={form.invoiceId} onChange={(event) => patch("invoiceId", event.target.value)}>
                  {!data.invoices.some((invoice) => invoice.status !== "paid") ? <option value="">Создать инвойс автоматически</option> : null}
                  {data.invoices.filter((invoice) => invoice.status !== "paid").map((invoice) => <option key={invoice.id} value={invoice.id}>{invoice.invoiceNumber} · {money.format(invoice.total)}</option>)}
                </select>
              </label>
              <label>{m("amount")}<input type="number" min="0" value={form.amount} onChange={(event) => patch("amount", event.target.value)} /></label>
              <label>{m("method")}
                <select value={form.method} onChange={(event) => patch("method", event.target.value)}>
                  <option value="manual">Manual</option>
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="bank_transfer">Bank transfer</option>
                  <option value="stripe">Stripe</option>
                </select>
              </label>
              <label>{m("reference")}<input value={form.reference} onChange={(event) => patch("reference", event.target.value)} /></label>
            </>
          ) : null}

          {kind === "gps" ? (
            <>
              <label>{translate(locale, "gps.platform")}
                <select value={form.provider} onChange={(event) => patch("provider", event.target.value)}>
                  {gpsProviderOptions.map((provider) => <option key={provider.value} value={provider.value}>{provider.label}</option>)}
                </select>
              </label>
              <label>{translate(locale, "gps.deviceId")}<input value={form.externalDeviceId} onChange={(event) => patch("externalDeviceId", event.target.value)} /></label>
              <label>Latitude<input value={form.latitude} onChange={(event) => patch("latitude", event.target.value)} /></label>
              <label>Longitude<input value={form.longitude} onChange={(event) => patch("longitude", event.target.value)} /></label>
              <label>{translate(locale, "gps.speed")}<input type="number" min="0" value={form.speedKph} onChange={(event) => patch("speedKph", event.target.value)} /></label>
            </>
          ) : null}

          {kind === "depositReturn" ? (
            <>
              <label>{m("finalAmount")}<input type="number" min="0" value={form.finalAmount} onChange={(event) => patch("finalAmount", event.target.value)} /></label>
              <label>{m("depositRefundAmount")}<input type="number" min="0" value={form.depositAmount} onChange={(event) => patch("depositAmount", event.target.value)} /></label>
              <label>{m("returnOdometer")}<input type="number" min="0" value={form.odometerKm} onChange={(event) => patch("odometerKm", event.target.value)} /></label>
              <label className="wide-field">{m("note")}<input value={form.note} onChange={(event) => patch("note", event.target.value)} /></label>
            </>
          ) : null}

          {["contract", "customerDocument", "depositDocument", "signature", "vehicleDocument"].includes(kind) ? (
            <>
              <label className="wide-field">{m("documentTitle")}<input value={form.documentTitle} placeholder={m("documentPlaceholder")} onChange={(event) => patch("documentTitle", event.target.value)} /></label>
              {kind === "vehicleDocument" ? (
                <label>{m("documentType")}
                  <select value={form.documentType} onChange={(event) => patch("documentType", event.target.value)}>
                    <option value="insurance">{m("insurance")}</option>
                    <option value="registration">{m("registration")}</option>
                    <option value="inspection">{m("inspection")}</option>
                    <option value="rental_contract">{m("rentalContract")}</option>
                    <option value="other">{m("other")}</option>
                  </select>
                </label>
              ) : null}
              {kind === "customerDocument" ? (
                <label>{m("documentType")}
                  <select value={form.documentType} onChange={(event) => patch("documentType", event.target.value)}>
                    <option value="passport">{m("passport")}</option>
                    <option value="id_card">{m("idCard")}</option>
                    <option value="driver_license">{m("driverLicense")}</option>
                    <option value="other">{m("other")}</option>
                  </select>
                </label>
              ) : null}
            </>
          ) : null}

          {showFiles ? (
            <label className="file-drop wide-field">{m("files")}
              <input multiple type="file" onChange={(event) => onFiles(event.currentTarget.files)} />
              <span>{files?.length ? `${m("filesSelected")}: ${files.length}` : kind === "contract" ? m("fileContractHint") : m("fileChoose")}</span>
            </label>
          ) : null}
        </div>

        <div className="modal-actions">
          <button className="ghost-button" disabled={saving} onClick={onClose} type="button">{translate(locale, "common.cancel")}</button>
          <button className="primary-button" disabled={saving} type="submit">{saving ? translate(locale, "common.loading") : translate(locale, "common.save")}</button>
        </div>
      </form>
    </div>
  );
}

function VehicleForm({ form, formRef, locale, onSubmit, setForm }: { form: Record<string, string>; formRef: RefObject<HTMLFormElement | null>; locale: Locale; onSubmit: (event: FormEvent<HTMLFormElement>) => void; setForm: (form: any) => void }) {
  return (
    <form className="live-form" onSubmit={onSubmit} ref={formRef}>
      <h2>{translate(locale, "vehicle.add")}</h2>
      <div className="form-grid single">
        {(["make", "model", "year", "plateNumber", "vin", "location", "odometerKm", "dailyRate"] as const).map((key) => (
          <label key={key}>{translate(locale, `form.${key}`)}<input value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} /></label>
        ))}
      </div>
      <button className="primary-button full" type="submit">{translate(locale, "vehicle.save")}</button>
    </form>
  );
}

function CustomerForm({
  form,
  formRef,
  locale,
  onAssignVehicle,
  onCreateVehicle,
  onSubmit,
  rentals,
  setForm,
  vehicles,
}: {
  form: Record<string, string>;
  formRef: RefObject<HTMLFormElement | null>;
  locale: Locale;
  onAssignVehicle: () => void;
  onCreateVehicle: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  rentals: Rental[];
  setForm: (form: any) => void;
  vehicles: Vehicle[];
}) {
  const unavailableVehicleIds = new Set(rentals.filter((rental) => rental.status !== "closed").map((rental) => rental.vehicleId));
  const availableVehicles = vehicles.filter((vehicle) => vehicle.status === "available" && !unavailableVehicleIds.has(vehicle.id));
  const hasVehicles = vehicles.length > 0;

  return (
    <form className="live-form" onSubmit={onSubmit} ref={formRef}>
      <h2>{translate(locale, "customer.add")}</h2>
      <div className="form-grid single">
        {(["displayName", "email", "phone"] as const).map((key) => (
          <label key={key}>{translate(locale, `form.${key}`)}<input value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} /></label>
        ))}
        <label>{translate(locale, "customer.vehicle")}
          <select disabled={!availableVehicles.length} value={form.vehicleId} onChange={(event) => setForm({ ...form, vehicleId: event.target.value })}>
            <option value="">{availableVehicles.length ? translate(locale, "customer.vehiclePlaceholder") : translate(locale, "customer.noAvailableVehicle")}</option>
            {availableVehicles.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>{vehicle.make} {vehicle.model} · {vehicle.plateNumber} · €{vehicle.dailyRate}/день</option>
            ))}
          </select>
        </label>
      </div>
      <button className="primary-button full" type="submit">{translate(locale, "common.save")}</button>
      {availableVehicles.length ? (
        <button className="ghost-button full-button customer-assign-vehicle" onClick={onAssignVehicle} type="button">
          {translate(locale, "customer.assignVehicle")}
        </button>
      ) : (
        <button className="ghost-button full-button customer-create-vehicle" onClick={onCreateVehicle} type="button">
          {hasVehicles ? translate(locale, "customer.noAvailableVehicle") : translate(locale, "customer.createVehicleFirst")}
        </button>
      )}
    </form>
  );
}
