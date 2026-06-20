"use client";

import { Fragment, useEffect, useMemo, useRef, useState, type FormEvent, type RefObject } from "react";
import type { AuthSession, Company, Customer, CustomerDocument, DashboardMetrics, Expense, FileObject, GpsDevice, Invoice, Payment, Rental, RentalChecklist, RentalContract, RentalContractEvent, RentalFlow, ServiceRecord, User, UserRole, Vehicle, VehicleDocument } from "@fleetcore/shared";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
const TENANT_ID = "tenant_atlas";

type GoogleLatLngLiteral = { lat: number; lng: number };
type GoogleMapInstance = {
  setCenter: (position: GoogleLatLngLiteral) => void;
  setZoom: (zoom: number) => void;
};
type GoogleMarkerInstance = {
  setMap: (map: GoogleMapInstance | null) => void;
};
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
type Section = "Dashboard" | "GPS" | "Vehicles" | "Drivers/Clients" | "Bookings" | "Finance" | "Service" | "Settings";
type Locale = "en" | "ru" | "es" | "fr" | "de";
type MapProvider = "apple" | "google";
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

type GlobalSearchResult = {
  id: string;
  kind: "vehicle" | "customer" | "rental" | "document";
  label: string;
  meta: string;
  section: Section;
  vehicleId?: string;
  customerId?: string;
  preview?: DocumentPreview;
};

const sections: Section[] = ["Dashboard", "GPS", "Vehicles", "Drivers/Clients", "Bookings", "Finance", "Service", "Settings"];
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
    "section.subtitle.Drivers/Clients": "Customer CRM, documents, rental history and verification files.",
    "section.subtitle.Bookings": "Create bookings, contracts, signatures and WhatsApp customer links.",
    "section.subtitle.Finance": "Payments, expenses, deposits, refunds and ROI by vehicle.",
    "section.subtitle.Service": "Maintenance, inspections, documents and service workload.",
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
    "nav.Bookings": "Bookings",
    "nav.Dashboard": "Dashboard",
    "nav.Drivers/Clients": "Clients",
    "nav.Finance": "Finance",
    "nav.GPS": "GPS",
    "nav.Service": "Service",
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
    "section.subtitle.Drivers/Clients": "CRM клиентов, документы, история аренд и проверочные файлы.",
    "section.subtitle.Bookings": "Брони, договоры, подписи и WhatsApp-ссылки для клиентов.",
    "section.subtitle.Finance": "Оплаты, расходы, депозиты, возвраты и ROI по автомобилям.",
    "section.subtitle.Service": "ТО, техосмотры, документы и сервисная нагрузка.",
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
    "nav.Bookings": "Брони",
    "nav.Dashboard": "Главная",
    "nav.Drivers/Clients": "Клиенты",
    "nav.Finance": "Финансы",
    "nav.GPS": "GPS",
    "nav.Service": "Сервис",
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
    "section.subtitle.Drivers/Clients": "CRM de clientes, documentos, historial de alquileres y verificación.",
    "section.subtitle.Bookings": "Reservas, contratos, firmas y enlaces WhatsApp para clientes.",
    "section.subtitle.Finance": "Pagos, gastos, depósitos, reembolsos y ROI por vehículo.",
    "section.subtitle.Service": "Mantenimiento, inspecciones, documentos y carga de servicio.",
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
    "nav.Bookings": "Reservas",
    "nav.Dashboard": "Panel",
    "nav.Drivers/Clients": "Clientes",
    "nav.Finance": "Finanzas",
    "nav.GPS": "GPS",
    "nav.Service": "Servicio",
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
    "section.subtitle.Drivers/Clients": "CRM clients, documents, historique de location et vérification.",
    "section.subtitle.Bookings": "Réservations, contrats, signatures et liens WhatsApp clients.",
    "section.subtitle.Finance": "Paiements, dépenses, dépôts, remboursements et ROI par véhicule.",
    "section.subtitle.Service": "Maintenance, inspections, documents et charge de service.",
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
    "nav.Bookings": "Réservations",
    "nav.Dashboard": "Tableau",
    "nav.Drivers/Clients": "Clients",
    "nav.Finance": "Finance",
    "nav.GPS": "GPS",
    "nav.Service": "Service",
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
    "section.subtitle.Drivers/Clients": "Kunden-CRM, Dokumente, Mietverlauf und Verifizierungsdateien.",
    "section.subtitle.Bookings": "Buchungen, Verträge, Signaturen und WhatsApp-Kundenlinks.",
    "section.subtitle.Finance": "Zahlungen, Kosten, Kautionen, Rückgaben und ROI je Fahrzeug.",
    "section.subtitle.Service": "Wartung, Inspektionen, Dokumente und Serviceauslastung.",
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
    "nav.Bookings": "Buchungen",
    "nav.Dashboard": "Dashboard",
    "nav.Drivers/Clients": "Kunden",
    "nav.Finance": "Finanzen",
    "nav.GPS": "GPS",
    "nav.Service": "Service",
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
  if (section === "Finance") return "€";
  if (section === "Service") return "◷";
  if (section === "Settings") return "⚙";
  return "♙";
}

function sectionSubtitle(locale: Locale, section: Section) {
  return translate(locale, `section.subtitle.${section}`);
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

function requestProfileSetup(session: AuthSession) {
  if (typeof window !== "undefined") {
    localStorage.setItem(`fleetcore-profile-open:${session.companyId}:${session.user.id}`, "1");
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
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
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

function CarPin({ className, color, label }: { className: string; color: UiNotification["tone"]; label: string }) {
  return (
    <div className={`map-pin ${className} ${color}`}>
      <span>▣</span>
      <strong>{label}</strong>
    </div>
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
        requestProfileSetup(response.data);
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
      requestProfileSetup(response.data);
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
  const [session, setSession] = useState<AuthSession | undefined>();
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [activeSection, setActiveSection] = useState<Section>("Dashboard");
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [mapFilter, setMapFilter] = useState<"all" | "available" | "rented" | "maintenance" | "offline">("all");
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [busyAction, setBusyAction] = useState<string | undefined>();
  const [operation, setOperation] = useState<OperationKind | undefined>();
  const [documentPreview, setDocumentPreview] = useState<DocumentPreview | undefined>();
  const [profileOpen, setProfileOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
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
      if (session && localStorage.getItem(`fleetcore-profile-open:${session.companyId}:${session.user.id}`) === "1") {
        setProfileOpen(true);
        localStorage.setItem(`fleetcore-profile-open:${session.companyId}:${session.user.id}`, "0");
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
    loadData().catch((error: unknown) => {
      setLoading(false);
      setMessage(error instanceof Error ? error.message : "Не удалось загрузить данные");
    });
  }, [session?.accessToken]);

  const selectedVehicle = data.vehicles.find((vehicle) => vehicle.id === selectedVehicleId) ?? data.vehicles[0];
  const activeRental = data.rentals.find((rental) => rental.vehicleId === selectedVehicle?.id && rental.status !== "closed");
  const activeCustomer = data.customers.find((customer) => customer.id === activeRental?.customerId) ?? data.customers[0];
  const activeInvoice = data.invoices.find((invoice) => invoice.status !== "paid") ?? data.invoices[0];
  const activeRentalFlow = data.rentalFlows.find((flow) => flow.rental.id === activeRental?.id)
    ?? data.rentalFlows.find((flow) => flow.rental.status !== "closed")
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

    const vehicleResults = data.vehicles
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

    const rentalResults = data.rentals
      .map((rental) => ({
        customer: data.customers.find((customer) => customer.id === rental.customerId),
        rental,
        vehicle: data.vehicles.find((vehicle) => vehicle.id === rental.vehicleId),
      }))
      .filter(({ customer, rental, vehicle }) => matches(rental.status, rental.totalAmount, rental.depositAmount, vehicle?.plateNumber, vehicle?.vin, vehicle?.make, vehicle?.model, customer?.displayName, customer?.phone, customer?.email))
      .slice(0, 5)
      .map<GlobalSearchResult>(({ customer, rental, vehicle }) => ({
        ...(customer?.id ? { customerId: customer.id } : {}),
        ...(vehicle?.id ? { vehicleId: vehicle.id } : {}),
        id: `rental-${rental.id}`,
        kind: "rental",
        label: `${vehicle?.make ?? "Авто"} ${vehicle?.model ?? ""}`.trim(),
        meta: `${customer?.displayName ?? "Клиент"} · ${vehicle?.plateNumber ?? "без номера"} · возврат ${dateFmt.format(new Date(rental.returnAt))}`,
        section: "Bookings",
      }));

    const vehicleDocumentResults = data.documents
      .map((doc) => ({
        doc,
        vehicle: data.vehicles.find((vehicle) => vehicle.id === doc.vehicleId),
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

    return [...vehicleResults, ...customerResults, ...rentalResults, ...vehicleDocumentResults, ...customerDocumentResults].slice(0, 10);
  }, [data.customerDocuments, data.customers, data.documents, data.rentals, data.vehicles, search]);

  function openSearchResult(result: GlobalSearchResult) {
    if (result.vehicleId) {
      setSelectedVehicleId(result.vehicleId);
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
    setActiveSection(result.section);
    setSearchOpen(false);
    if (result.preview) {
      setDocumentPreview(result.preview);
    }
  }

  const filteredVehicles = useMemo(() => {
    const query = search.trim().toLowerCase();
    return data.vehicles.filter((vehicle) => {
      const rental = data.rentals.find((item) => item.vehicleId === vehicle.id && item.status !== "closed");
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
  }, [data.customers, data.rentals, data.vehicles, mapFilter, search]);

  const incomeToday = useMemo(() => data.payments
    .filter((payment) => new Date(payment.paidAt).toDateString() === new Date().toDateString())
    .reduce((sum, payment) => sum + payment.amount, 0), [data.payments]);

  const finance = useMemo(() => {
    const incomeByVehicle = data.vehicles.map((vehicle) => {
      const rentalIds = data.rentals.filter((rental) => rental.vehicleId === vehicle.id).map((rental) => rental.id);
      const income = data.invoices.filter((invoice) => invoice.rentalId && rentalIds.includes(invoice.rentalId)).reduce((sum, invoice) => sum + invoice.total, 0);
      const expenses = data.expenses.filter((expense) => expense.vehicleId === vehicle.id).reduce((sum, expense) => sum + expense.amount, 0);
      return { expenses, income, roi: expenses ? Math.round(((income - expenses) / expenses) * 100) : 0, vehicle };
    });
    const totalIncome = incomeByVehicle.reduce((sum, item) => sum + item.income, 0);
    const expenses = incomeByVehicle.reduce((sum, item) => sum + item.expenses, 0);
    return { expenses, incomeByVehicle, netProfit: totalIncome - expenses, totalIncome };
  }, [data.expenses, data.invoices, data.rentals, data.vehicles]);
  const totalDeposits = data.rentals.reduce((sum, rental) => sum + rental.depositAmount, 0);
  const overdueInvoices = data.invoices.filter((invoice) => invoice.status === "overdue");

  const notifications = useMemo<UiNotification[]>(() => {
    const now = Date.now();
    const dueRentals = data.rentals
      .filter((rental) => rental.status !== "closed" && new Date(rental.returnAt).getTime() < now)
      .map((rental) => {
        const vehicle = data.vehicles.find((item) => item.id === rental.vehicleId);
        return { id: `rental-${rental.id}`, meta: vehicle?.plateNumber ?? sectionLabel(locale, "Vehicles"), time: t("time.now"), title: t("status.returnDue"), tone: "red" as const };
      });
    const paymentAlerts = data.invoices
      .filter((invoice) => invoice.status === "overdue")
      .map((invoice) => ({ id: `invoice-${invoice.id}`, meta: invoice.invoiceNumber, time: dateFmt.format(new Date(invoice.dueAt)), title: t("status.overdue"), tone: "red" as const }));
    const docAlerts = data.documents
      .filter((doc) => doc.expiresAt && new Date(doc.expiresAt).getTime() < now + 30 * 24 * 60 * 60 * 1000)
      .map((doc) => ({ id: `doc-${doc.id}`, meta: doc.title, time: doc.expiresAt ? dateFmt.format(new Date(doc.expiresAt)) : "-", title: t("settings.documents"), tone: "orange" as const }));
    const serviceAlerts = data.vehicles
      .filter((vehicle) => vehicle.odometerKm > 40_000)
      .map((vehicle) => ({ id: `service-${vehicle.id}`, meta: vehicle.plateNumber, time: `${vehicle.odometerKm.toLocaleString()} км`, title: t("vehicle.serviceCreate"), tone: "blue" as const }));
    return [...dueRentals, ...paymentAlerts, ...docAlerts, ...serviceAlerts].slice(0, 8);
  }, [data.documents, data.invoices, data.rentals, data.vehicles, locale]);

  const dashboardCards = [
    [t("dashboard.totalVehicles"), data.vehicles.length, "blue"],
    [t("dashboard.available"), data.vehicles.filter((vehicle) => vehicle.status === "available").length, "green"],
    [t("dashboard.activeRentals"), data.vehicles.filter((vehicle) => vehicle.status === "rented").length, "blue"],
    [t("dashboard.overdue"), data.vehicles.filter((vehicle) => vehicle.status === "maintenance").length, "black"],
    [t("dashboard.monthlyRevenue"), money.format(data.metrics.monthlyRevenue), "green"],
    [t("dashboard.todayRevenue"), money.format(incomeToday), "green"],
  ] as const;
  const workflowStats = [
    { label: t("command.returns"), value: data.rentals.filter((rental) => rental.status === "return_due").length, tone: "orange" },
    { label: t("command.overdue"), value: notifications.filter((item) => item.tone === "red").length, tone: "red" },
    { label: t("command.documents"), value: data.documents.length + data.customerDocuments.length, tone: "blue" },
    { label: t("command.contracts"), value: data.rentalContracts.length, tone: "green" },
  ];

  function openOperation(kind: OperationKind) {
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
    setShareDialogOpen(true);
    setMessage("Выберите канал отправки договора клиенту.");
  }

  function closeShareDialog() {
    setShareDialogOpen(false);
    setMessage("");
  }

  function focusCreateForm(section: Section, formRef: RefObject<HTMLFormElement | null>, label: string) {
    setActiveSection(section);
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
      setActiveSection("Settings");
    } else if (action === "vehicle") {
      openVehicleCreate();
    } else if (action === "customer") {
      openCustomerCreate();
    } else if (action === "gps") {
      setActiveSection("GPS");
      openOperation("gps");
    } else if (action === "contract") {
      setActiveSection("Bookings");
      void createDraftContract();
    } else if (action === "manager") {
      setProfileOpen(true);
    }
    closeOnboarding();
  }

  async function runAction(label: string, action: () => Promise<void>) {
    if (busyAction) {
      setMessage(`Дождитесь завершения операции: ${busyAction}`);
      return;
    }
    setBusyAction(label);
    setMessage(label);
    try {
      await action();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Операция не выполнена");
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
    return created;
  }

  async function ensureCustomer() {
    if (activeCustomer) return activeCustomer;
    if (data.customers[0]) return data.customers[0];
    return createCustomerRecord({
      displayName: "Новый клиент",
      email: `client-${Date.now().toString().slice(-5)}@example.com`,
      phone: "+48 600 111 222",
    });
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
      await createCustomerRecord();
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
        await api<Rental>("/rentals", {
          body: JSON.stringify({
            customerId: customer.id,
            depositAmount: Number(operationForm.depositAmount),
            pickupAt: new Date().toISOString(),
            returnAt: new Date(operationForm.returnAt || Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
            status: "reserved",
            totalAmount: Number(operationForm.totalAmount),
            vehicleId: vehicle.id,
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
      await api<Rental>(`/rentals/${rental.id}/return`, {
        body: JSON.stringify({ finalAmount: rental.totalAmount, odometerKm: vehicle.odometerKm + 25 }),
        method: "POST",
      }, token);
      await loadData();
      setMessage("Возврат автомобиля закрыт");
    });
  }

  async function createQuickBooking() {
    await runAction("Создаем бронь...", async () => {
      await ensureRental();
      await loadData();
      setMessage("Бронь создана");
    });
  }

  async function createExpenseForVehicle() {
    await runAction("Добавляем расход...", async () => {
      const vehicle = await ensureVehicle();
      await api<Expense>("/operations/expenses", {
        body: JSON.stringify({
          amount: Math.max(50, Math.round(vehicle.dailyRate * 1.4)),
          category: "maintenance",
          currency: "EUR",
          note: `Расход по ${vehicle.plateNumber}`,
          vehicleId: vehicle.id,
        }),
        method: "POST",
      }, token);
      await loadData();
      setMessage("Расход сохранен");
    });
  }

  async function createServiceForVehicle() {
    await runAction("Создаем ТО...", async () => {
      const vehicle = await ensureVehicle();
      await api<ServiceRecord>("/operations/service-records", {
        body: JSON.stringify({
          cost: Math.max(80, Math.round(vehicle.dailyRate * 2)),
          note: `Плановое ТО ${vehicle.plateNumber}`,
          odometerKm: vehicle.odometerKm,
          serviceAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          status: "planned",
          type: "inspection",
          vehicleId: vehicle.id,
        }),
        method: "POST",
      }, token);
      await loadData();
      setMessage("Сервисная запись создана");
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

  async function sendRentalContract() {
    await runAction("Формируем и отправляем договор...", async () => {
      const rental = await ensureRental();
      const customer = data.customers.find((item) => item.id === rental.customerId) ?? await ensureCustomer();
      const contract = await createContractRecord("sent", "whatsapp");
      await loadData();
      openWhatsApp(customer.phone, `Здравствуйте, ${customer.displayName}. Ваш договор аренды FleetCore для просмотра и подписи: ${contract.publicUrl ?? contract.documentUrl}`);
      setMessage("Договор создан и ссылка открыта для отправки в WhatsApp");
    });
  }

  async function shareRentalContract(channel: "email" | "telegram" | "whatsapp", rentalOverride?: Rental) {
    await runAction(`Готовим ссылку договора: ${channel}`, async () => {
      const rental = rentalOverride ?? await ensureRental();
      const customer = data.customers.find((item) => item.id === rental.customerId) ?? await ensureCustomer();
      const contract = await createContractRecord("sent", channel === "email" ? "email" : "whatsapp", rental);
      const contractUrl = contract.publicUrl ?? contract.documentUrl;
      const text = `Здравствуйте, ${customer.displayName}. Ваш договор аренды FleetCore: ${contractUrl}`;
      await loadData();
      if (channel === "whatsapp") {
        openWhatsApp(customer.phone, text);
      } else if (channel === "telegram") {
        openTelegram(`Договор аренды FleetCore для ${customer.displayName}`, contractUrl);
      } else {
        openEmail(customer.email, "FleetCore rental contract", text);
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

  async function createRentalChecklist(phase: RentalChecklist["phase"], rentalOverride?: Rental) {
    await runAction(phase === "pickup" ? "Сохраняем чек-лист выдачи..." : "Сохраняем чек-лист возврата...", async () => {
      await saveRentalChecklist(phase, rentalOverride);
      await loadData();
      setMessage(phase === "pickup" ? "Чек-лист выдачи сохранен" : "Чек-лист возврата сохранен");
    });
  }

  async function signContract() {
    await runAction("Подписываем договор...", async () => {
      await createContractRecord("signed", "manual");
      await loadData();
      setMessage("Электронная подпись сохранена");
    });
  }

  async function returnDeposit() {
    await runAction("Оформляем возврат депозита...", async () => {
      const rental = await ensureRental();
      const vehicle = data.vehicles.find((item) => item.id === rental.vehicleId) ?? await ensureVehicle();
      await api<Rental>(`/rentals/${rental.id}/return`, {
        body: JSON.stringify({ finalAmount: rental.totalAmount, odometerKm: vehicle.odometerKm + 25 }),
        method: "POST",
      }, token);
      await api<Expense>("/operations/expenses", {
        body: JSON.stringify({
          amount: rental.depositAmount,
          category: "other",
          currency: "EUR",
          note: `Возврат депозита по аренде ${rental.id}`,
          vehicleId: rental.vehicleId,
        }),
        method: "POST",
      }, token);
      await loadData();
      setMessage("Возврат депозита записан в финансах");
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

  if (!session) {
    return <AuthScreen initialMode={authMode} locale={locale} onLocaleChange={changeLocale} onSession={setSession} />;
  }

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
        <button className="profile profile-button" onClick={() => setProfileOpen(true)} type="button">
          <div className="avatar">{profilePhoto ? <img alt="" src={profilePhoto} /> : session.user.fullName.slice(0, 1)}</div>
          <div>
            <strong>{session.user.fullName}</strong>
            <span>{session.user.role} · {session.companyId.slice(0, 12)}</span>
          </div>
          <small>Manage</small>
        </button>
        <nav className="side-nav">
          {sections.map((item) => (
            <button className={activeSection === item ? "active" : ""} key={item} onClick={() => setActiveSection(item)} type="button">
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
          <button onClick={() => setActiveSection("Settings")} type="button">{t("tariff.manage")}</button>
        </div>
        <button className="sidebar-signout-button" onClick={() => void logout()} type="button">
          <span>↩</span>
          <strong>{t("common.signOut")}</strong>
        </button>
      </aside>

      <section className="desktop-workspace">
        <header className="desktop-header">
          <div className="header-title-block">
            <button className="mobile-menu-button" onClick={() => setMobileDrawerOpen(true)} type="button" aria-label="Open menu">☰</button>
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
                  setSearchOpen(true);
                }}
                onFocus={() => setSearchOpen(true)}
              />
              {search ? <button aria-label="Очистить поиск" className="search-clear-button" onClick={() => { setSearch(""); setSearchOpen(false); }} onMouseDown={(event) => event.preventDefault()} type="button">×</button> : null}
              {searchOpen && search.trim().length >= 2 ? (
                <div className="global-search-results" data-testid="global-search-results">
                  <div className="search-results-head">
                    <strong>Результаты поиска</strong>
                    <span>{globalSearchResults.length ? `${globalSearchResults.length}` : "0"}</span>
                  </div>
                  {globalSearchResults.map((result) => (
                    <button className="search-result-row" key={result.id} onClick={() => openSearchResult(result)} onMouseDown={(event) => { event.preventDefault(); openSearchResult(result); }} type="button">
                      <span>{result.kind === "vehicle" ? "Авто" : result.kind === "customer" ? "Клиент" : result.kind === "rental" ? "Бронь" : "Документ"}</span>
                      <div>
                        <strong>{result.label}</strong>
                        <small>{result.meta}</small>
                      </div>
                    </button>
                  ))}
                  {!globalSearchResults.length ? (
                    <div className="search-empty-state">
                      <strong>Ничего не найдено</strong>
                      <span>Попробуйте номер авто, VIN, имя клиента, телефон или email.</span>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
            <LanguageSelect locale={locale} onChange={changeLocale} />
            <button className="ghost-button" disabled={Boolean(busyAction)} onClick={() => void loadData()} title={t("common.refresh")} type="button">↻</button>
            <button className="primary-button" disabled={Boolean(busyAction)} onClick={() => setActiveSection("GPS")} type="button">{busyAction ? "..." : "⊕ GPS"}</button>
          </div>
        </header>

        <section className="command-center" aria-label="FleetCore command center">
          <div className="command-copy">
            <span className="eyebrow">{t("command.kicker")}</span>
            <strong>{busyAction ? busyAction : t("command.title")}</strong>
            <p>{message || t("command.subtitle")}</p>
          </div>
          <div className="workflow-stats">
            {workflowStats.map((item) => (
              <article className={`workflow-chip ${item.tone}`} key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </article>
            ))}
          </div>
          <div className="command-actions" data-testid="fleet-command-actions">
            <button aria-label="Быстро создать бронь" className="primary-button" data-testid="command-create-booking" disabled={Boolean(busyAction)} onClick={() => openOperation("booking")} type="button">{t("command.newBooking")}</button>
            <button aria-label="Быстро добавить автомобиль" className="ghost-button" data-testid="command-create-vehicle" disabled={Boolean(busyAction)} onClick={openVehicleCreate} type="button">{t("command.vehicle")}</button>
            <button aria-label="Быстро добавить клиента" className="ghost-button" data-testid="command-create-customer" disabled={Boolean(busyAction)} onClick={openCustomerCreate} type="button">{t("command.customer")}</button>
            <button aria-label="Быстро загрузить документ автомобиля" className="ghost-button" data-testid="command-upload-document" disabled={Boolean(busyAction)} onClick={requestVehicleDocumentUpload} type="button">{t("command.document")}</button>
            <button aria-label="Быстро добавить расход" className="ghost-button" data-testid="command-create-expense" disabled={Boolean(busyAction)} onClick={() => openOperation("expense")} type="button">{t("command.expense")}</button>
            <button aria-label="Быстро создать ТО" className="ghost-button" data-testid="command-create-service" disabled={Boolean(busyAction)} onClick={() => openOperation("service")} type="button">{t("command.service")}</button>
            <button aria-label="Отправить договор через WhatsApp Telegram или Email" className="ghost-button" data-testid="command-share-contract" disabled={Boolean(busyAction)} onClick={openShareDialog} type="button">WhatsApp</button>
          </div>
        </section>

        {activeRentalFlow ? (
          <RentalFlowPanel
            busy={Boolean(busyAction)}
            events={activeRentalFlow.contract ? data.rentalContractEvents.filter((event) => event.contractId === activeRentalFlow.contract?.id) : []}
            flow={activeRentalFlow}
            locale={locale}
            money={money}
            onOpenPdf={() => void openRentalContractPdf(activeRentalFlow)}
            onPrimaryAction={() => void processFlowAction(activeRentalFlow)}
            onShare={(channel) => void shareRentalContract(channel, activeRentalFlow.rental)}
            onSign={() => void signRentalFlow(activeRentalFlow)}
            onSettle={() => void finalizeRentalFlowAction(activeRentalFlow)}
          />
        ) : null}

        {activeSection === "Dashboard" ? (
          <section className="workspace-grid">
            <div className="main-column">
              <div className="dashboard-grid">
                {dashboardCards.map(([label, value, tone]) => (
                  <article className="metric-card" key={label}>
                    <span>{label}</span>
                    <strong className={tone}>{value}</strong>
                  </article>
                ))}
              </div>
              <MapPanel gpsDevices={data.gpsDevices} locale={locale} vehicles={filteredVehicles} rentals={data.rentals} selectedVehicleId={selectedVehicle?.id} onSelect={setSelectedVehicleId} />
              <section className="split-panels">
                <UpcomingReturns customers={data.customers} locale={locale} rentals={data.rentals} vehicles={data.vehicles} />
                <LatestRequests customers={data.customers} invoices={data.invoices} locale={locale} />
              </section>
            </div>
            <aside className="side-column">
              <NotificationsPanel locale={locale} notifications={notifications} />
              <VehicleCard locale={locale} vehicle={selectedVehicle} rental={activeRental} customer={activeCustomer} documents={data.documents} finance={finance.incomeByVehicle.find((item) => item.vehicle.id === selectedVehicle?.id)} serviceRecords={data.serviceRecords} onDocument={requestVehicleDocumentUpload} onDocumentPreview={setDocumentPreview} onExpense={() => openOperation("expense")} onPhoto={() => vehiclePhotoInputRef.current?.click()} onRemovePhoto={() => void removeVehiclePhoto(selectedVehicle)} onService={() => openOperation("service")} />
            </aside>
          </section>
        ) : null}

        {activeSection === "GPS" ? (
          <section className="workspace-grid">
            <div className="main-column">
              <MapPanel gpsDevices={data.gpsDevices} locale={locale} vehicles={filteredVehicles} rentals={data.rentals} selectedVehicleId={selectedVehicle?.id} onSelect={setSelectedVehicleId} />
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
                  const vehicle = data.vehicles.find((item) => item.id === device.vehicleId);
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
              <article><span>{t("dashboard.totalVehicles")}</span><strong>{data.vehicles.length}</strong></article>
              <article><span>{t("dashboard.available")}</span><strong>{data.vehicles.filter((vehicle) => vehicle.status === "available").length}</strong></article>
              <article><span>{t("dashboard.activeRentals")}</span><strong>{data.vehicles.filter((vehicle) => vehicle.status === "rented").length}</strong></article>
              <article><span>{t("vehicle.documents")}</span><strong>{data.documents.length}</strong></article>
            </div>
            <div className="main-column">
              <div className="filter-row">
                {(["all", "available", "rented", "maintenance", "offline"] as const).map((filter) => (
                  <button className={mapFilter === filter ? "active" : ""} key={filter} onClick={() => setMapFilter(filter)} type="button">{filter}</button>
                ))}
              </div>
              <div className="vehicle-card-grid">
                {filteredVehicles.map((vehicle) => {
                  const rental = data.rentals.find((item) => item.vehicleId === vehicle.id && item.status !== "closed");
                  const customer = data.customers.find((item) => item.id === rental?.customerId);
                  const gps = data.gpsDevices.find((item) => item.vehicleId === vehicle.id);
                  const vehicleFinance = finance.incomeByVehicle.find((item) => item.vehicle.id === vehicle.id);
                  const hasRentalHistory = data.rentals.some((item) => item.vehicleId === vehicle.id);
                  return <VehicleGridCard canDelete={!hasRentalHistory} customer={customer} finance={vehicleFinance} gps={gps} isSelected={selectedVehicleId === vehicle.id} key={vehicle.id} locale={locale} onDelete={() => void removeVehicle(vehicle)} onSelect={() => setSelectedVehicleId(vehicle.id)} rental={rental} vehicle={vehicle} />;
                })}
              </div>
            </div>
            <VehicleForm form={vehicleForm} formRef={vehicleCreateRef} locale={locale} setForm={setVehicleForm} onSubmit={submitVehicle} />
          </section>
        ) : null}

        {activeSection === "Drivers/Clients" ? (
          <section className="workspace-grid">
            <div className="main-column table-panel">
              {data.customers.filter((customer) => !search || `${customer.displayName} ${customer.phone} ${customer.email}`.toLowerCase().includes(search.toLowerCase())).map((customer) => (
                <article className="customer-line" key={customer.id}>
                  <div className="avatar small">{customer.displayName.slice(0, 1)}</div>
                  <div><strong>{customer.displayName}</strong><span>{customer.phone} · {customer.email}</span></div>
                  <Badge value={customer.riskLevel === "low" ? t("status.active") : customer.riskLevel} />
                </article>
              ))}
            </div>
            <aside className="side-column">
              <CustomerForm
                form={customerForm}
                formRef={customerCreateRef}
                locale={locale}
                onAssignVehicle={() => void assignVehicleToNewCustomer()}
                onCreateVehicle={openVehicleCreate}
                onSubmit={submitCustomer}
                rentals={data.rentals}
                setForm={setCustomerForm}
                vehicles={data.vehicles}
              />
              <div className="table-panel">
                <h2>CRM история</h2>
                <button className="ghost-button full-button" onClick={requestCustomerDocumentUpload} type="button">Загрузить паспорт/ID</button>
                <button className="ghost-button full-button" onClick={requestCustomerFolderUpload} type="button">Загрузить папку клиента</button>
                <p className="history-row">Документы клиентов: {data.customerDocuments.length}</p>
                {data.rentals.slice(-5).map((rental) => {
                  const customer = data.customers.find((item) => item.id === rental.customerId);
                  const vehicle = data.vehicles.find((item) => item.id === rental.vehicleId);
                  return <p className="history-row" key={rental.id}>{customer?.displayName} · {vehicle?.plateNumber} · {money.format(rental.totalAmount)}</p>;
                })}
              </div>
            </aside>
          </section>
        ) : null}

        {activeSection === "Bookings" ? (
          <section className="table-panel bookings-board">
            <button className="primary-button" disabled={Boolean(busyAction)} onClick={() => openOperation("booking")} type="button">Создать быструю бронь</button>
            <div className="quick-actions-grid">
              <button className="ghost-button" disabled={Boolean(busyAction)} onClick={() => void createDraftContract()} type="button">Создать электронный договор</button>
              <button className="ghost-button" disabled={Boolean(busyAction)} onClick={requestContractUpload} type="button">Загрузить договор аренды</button>
              <button className="ghost-button" disabled={Boolean(busyAction)} onClick={() => void shareRentalContract("whatsapp")} type="button">WhatsApp</button>
              <button className="ghost-button" disabled={Boolean(busyAction)} onClick={() => void shareRentalContract("telegram")} type="button">Telegram</button>
              <button className="ghost-button" disabled={Boolean(busyAction)} onClick={() => void shareRentalContract("email")} type="button">Email</button>
              <button className="ghost-button" disabled={Boolean(busyAction)} onClick={requestSignatureUpload} type="button">Загрузить подпись</button>
            </div>
            <BookingCalendar customers={data.customers} rentals={data.rentals} vehicles={data.vehicles} />
            {data.rentals.map((rental) => {
              const vehicle = data.vehicles.find((item) => item.id === rental.vehicleId);
              const customer = data.customers.find((item) => item.id === rental.customerId);
              const contract = data.rentalContracts.find((item) => item.rentalId === rental.id);
              const contractEvents = contract
                ? data.rentalContractEvents.filter((item) => item.contractId === contract.id).slice(0, 3)
                : [];
              const checklists = data.rentalChecklists.filter((item) => item.rentalId === rental.id);
              const pickupChecklist = checklists.find((item) => item.phase === "pickup");
              const returnChecklist = checklists.find((item) => item.phase === "return");
              return (
                <article className="booking-card" key={rental.id}>
                  <div><strong>{customer?.displayName}</strong><span>{vehicle?.make} {vehicle?.model} · {vehicle?.plateNumber}</span></div>
                  <Badge value={rental.status} />
                  <span>Депозит {money.format(rental.depositAmount)}</span>
                  <span>Возврат {dateFmt.format(new Date(rental.returnAt))}</span>
                  <div className="checklist-cell">
                    <button className="ghost-button" disabled={Boolean(busyAction)} onClick={() => void createRentalChecklist("pickup", rental)} type="button">
                      {pickupChecklist ? "Выдача OK" : "Чек-лист выдачи"}
                    </button>
                    <button className="ghost-button" disabled={Boolean(busyAction)} onClick={() => void createRentalChecklist("return", rental)} type="button">
                      {returnChecklist ? "Возврат OK" : "Чек-лист возврата"}
                    </button>
                    {checklists.length ? <span>{checklists.length}/2 чек-листа</span> : null}
                  </div>
                  <div className="contract-cell">
                    {contract ? <FilePreviewLink fileUrl={contract.documentUrl} title={`Договор: ${contract.status}`} /> : null}
                    <button className="ghost-button" disabled={Boolean(busyAction)} onClick={() => void openRentalContractPdfForRental(rental)} type="button">PDF</button>
                    {contractEvents.length ? (
                      <div className="contract-timeline">
                        {contractEvents.map((event) => (
                          <span key={event.id}>{contractEventLabel(locale, event)} · {dateFmt.format(new Date(event.createdAt))}</span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </section>
        ) : null}

        {activeSection === "Finance" ? (
          <section className="finance-layout">
            <article className="metric-card"><span>{t("finance.income")}</span><strong className="green">{money.format(finance.totalIncome)}</strong></article>
            <article className="metric-card"><span>{t("finance.expenses")}</span><strong className="red">{money.format(finance.expenses)}</strong></article>
            <article className="metric-card"><span>{t("finance.net")}</span><strong className="blue">{money.format(finance.netProfit)}</strong></article>
            <article className="metric-card"><span>Депозиты</span><strong className="green">{money.format(totalDeposits)}</strong></article>
            <article className="metric-card"><span>Просрочено</span><strong className="red">{overdueInvoices.length}</strong></article>
            <button className="primary-button" disabled={Boolean(busyAction)} onClick={() => openOperation("payment")} type="button">Провести оплату</button>
            <button className="ghost-button" disabled={Boolean(busyAction)} onClick={() => openOperation("expense")} type="button">Добавить расход</button>
            <button className="ghost-button" disabled={Boolean(busyAction)} onClick={requestDepositUpload} type="button">Загрузить депозит/возврат</button>
            <button className="ghost-button" disabled={Boolean(busyAction)} onClick={() => openOperation("depositReturn")} type="button">Оформить возврат депозита</button>
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
              onDeposit={requestDepositUpload}
              onDocumentPreview={setDocumentPreview}
              onService={() => openOperation("service")}
              onVehicleDocument={requestVehicleDocumentUpload}
              onVehicleFolder={requestVehicleFolderUpload}
              rentalContracts={data.rentalContracts}
              rentalContractEvents={data.rentalContractEvents}
              rentals={data.rentals}
              customers={data.customers}
              payments={data.payments}
              serviceRecords={data.serviceRecords}
              vehicles={data.vehicles}
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

      {documentPreview ? (
        <DocumentPreviewDialog
          document={documentPreview}
          onClose={() => setDocumentPreview(undefined)}
        />
      ) : null}

      <button className="mobile-fab" disabled={Boolean(busyAction)} onClick={() => openOperation("booking")} type="button" aria-label="Create booking">+</button>

      <MobileDrawer
        activeSection={activeSection}
        locale={locale}
        notificationsCount={notifications.length}
        onClose={() => setMobileDrawerOpen(false)}
        onLocaleChange={changeLocale}
        onLogin={() => void logout("login")}
        onLogout={() => void logout()}
        onOpenProfile={() => setProfileOpen(true)}
        onRegister={() => void logout("register")}
        onSelect={(section) => {
          setActiveSection(section);
          setMobileDrawerOpen(false);
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

function DocumentVault({
  checklists,
  customerDocuments,
  customers,
  files,
  invoices,
  locale,
  onCustomerFolder,
  onDeposit,
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
  onDeposit: () => void;
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
  const folders = [
    { action: onVehicleFolder, count: vehicleDocuments.length, label: "Папка авто", text: "Страховка, регистрация, техосмотр, PDF и фото." },
    { action: onCustomerFolder, count: customerDocuments.length, label: "Папка клиента", text: "Паспорт, ID, водительские права и KYC." },
    { action: onDeposit, count: customerDocuments.filter((doc) => doc.title.toLowerCase().includes("депозит")).length, label: "Депозит / возврат", text: "Чеки, подтверждения и документы возврата." },
    { action: onVehicleDocument, count: rentalContracts.length, label: "Договоры", text: "PDF, публичная ссылка, статус и история действий." },
  ];
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
  const sentContracts = rentalContracts.filter((contract) => contract.status === "sent" || contract.status === "viewed").length;
  const openReturnActs = checklists.filter((item) => item.phase === "return").length;

  return (
    <div className="document-vault">
      <section className="table-panel vault-hero">
        <div>
          <span className="eyebrow">Document Vault</span>
          <h2>Документы, сроки и операционные акты</h2>
          <p>Одна рабочая зона для авто, клиента, договора, депозита, выдачи, возврата и ТО.</p>
        </div>
        <div className="vault-actions">
          <button className="primary-button" onClick={onVehicleDocument} type="button">Загрузить документ</button>
          <button className="ghost-button" onClick={onService} type="button">Создать ТО</button>
        </div>
      </section>

      <section className="document-center-board" aria-label="Document center">
        <article>
          <span>Договоры</span>
          <strong>{rentalContracts.length}</strong>
          <small>{signedContracts} подписано · {sentContracts} в работе</small>
        </article>
        <article>
          <span>Акты</span>
          <strong>{checklists.length}</strong>
          <small>{openReturnActs} актов возврата · выдача и возврат</small>
        </article>
        <article>
          <span>Файлы</span>
          <strong>{files.length + vehicleDocuments.length + customerDocuments.length}</strong>
          <small>Авто, клиент, депозит, PDF</small>
        </article>
        <article>
          <span>История</span>
          <strong>{rentalContractEvents.length}</strong>
          <small>Создан, отправлен, открыт, подписан</small>
        </article>
      </section>

      <section className="vault-folder-grid">
        {folders.map((folder) => (
          <button className="vault-folder" key={folder.label} onClick={folder.action} type="button">
            <span>{folder.count}</span>
            <strong>{folder.label}</strong>
            <small>{folder.text}</small>
          </button>
        ))}
      </section>

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
                <Badge value={folder.rental.status} />
                <div className="document-center-row">
                  <span>Договор</span>
                  {folder.contract ? (
                    <FilePreviewLink fileUrl={folder.contract.documentUrl} onPreview={onDocumentPreview} title={folder.contract.status} />
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
          {checklists.slice(0, 6).map((item) => (
            <p className="history-row" key={item.id}>{item.phase === "pickup" ? "Акт выдачи" : "Акт возврата"} · {item.odometerKm.toLocaleString()} км · топливо {item.fuelLevel}%</p>
          ))}
          {!checklists.length ? <p className="history-row">Акты выдачи/возврата появятся после первого rental flow.</p> : null}
        </div>
      </section>

      <section className="split-panels">
        <div className="table-panel">
          <h2>Документы клиентов</h2>
          {customerDocuments.slice(0, 6).map((doc) => (
            <p className="history-row" key={doc.id}>
              <FilePreviewLink fileUrl={doc.fileUrl} onPreview={onDocumentPreview} title={`${doc.title} · ${doc.verified ? "verified" : "pending"}`} />
            </p>
          ))}
          {!customerDocuments.length ? <p className="history-row">Загрузите паспорт, ID или водительское удостоверение клиента.</p> : null}
        </div>
        <div className="table-panel">
          <h2>История договоров</h2>
          {rentalContractEvents.slice(0, 7).map((event) => (
            <p className="history-row" key={event.id}>{contractEventLabel(locale, event)} · {event.channel} · {dateFmt.format(new Date(event.createdAt))}</p>
          ))}
          {!rentalContractEvents.length ? <p className="history-row">История появится после создания и отправки первого договора.</p> : null}
        </div>
      </section>

      <section className="table-panel">
        <h2>Последние файлы и ТО</h2>
        <div className="file-object-list">
          {files.slice(0, 6).map((file) => <FileObjectRow file={file} key={file.id} onPreview={onDocumentPreview} />)}
          {serviceRecords.slice(0, 4).map((record) => <p className="history-row" key={record.id}>{record.type} · {record.status} · {money.format(record.cost)} · {record.odometerKm.toLocaleString()} км</p>)}
          {!files.length && !serviceRecords.length ? <p className="history-row">Загрузите первый документ или создайте ТО.</p> : null}
        </div>
      </section>
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

function BookingCalendar({ customers, rentals, vehicles }: { customers: Customer[]; rentals: Rental[]; vehicles: Vehicle[] }) {
  const days = Array.from({ length: 14 }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + index);
    return date;
  });

  function rentalForDay(vehicle: Vehicle, day: Date) {
    const start = day.getTime();
    const end = start + 24 * 60 * 60 * 1000;
    return rentals.find((rental) => {
      if (rental.vehicleId !== vehicle.id || rental.status === "closed") return false;
      const pickup = new Date(rental.pickupAt).getTime();
      const dropoff = new Date(rental.returnAt).getTime();
      return pickup < end && dropoff >= start;
    });
  }

  return (
    <section className="booking-calendar">
      <div className="section-title compact-title">
        <h2>Booking calendar</h2>
        <Badge value={`${vehicles.length} авто`} />
      </div>
      <div className="calendar-scroll">
        <div className="calendar-grid" style={{ gridTemplateColumns: `180px repeat(${days.length}, minmax(78px, 1fr))` }}>
          <div className="calendar-head">Автомобиль</div>
          {days.map((day) => <div className="calendar-head" key={day.toISOString()}>{day.toLocaleDateString("ru-RU", { day: "2-digit", month: "short" })}</div>)}
          {vehicles.map((vehicle) => (
            <Fragment key={vehicle.id}>
              <div className="calendar-car" key={`${vehicle.id}-car`}>
                <strong>{vehicle.make} {vehicle.model}</strong>
                <span>{vehicle.plateNumber}</span>
              </div>
              {days.map((day) => {
                const rental = rentalForDay(vehicle, day);
                const customer = customers.find((item) => item.id === rental?.customerId);
                return (
                  <div className={`calendar-slot ${rental ? rental.status : "free"}`} key={`${vehicle.id}-${day.toISOString()}`}>
                    <strong>{rental ? rental.status.replaceAll("_", " ") : "free"}</strong>
                    <span>{customer?.displayName ?? ""}</span>
                  </div>
                );
              })}
            </Fragment>
          ))}
        </div>
      </div>
    </section>
  );
}

function RentalFlowPanel({
  busy,
  events,
  flow,
  locale,
  money,
  onOpenPdf,
  onPrimaryAction,
  onSettle,
  onShare,
  onSign,
}: {
  busy: boolean;
  events: RentalContractEvent[];
  flow: RentalFlow;
  locale: Locale;
  money: Intl.NumberFormat;
  onOpenPdf: () => void;
  onPrimaryAction: () => void;
  onSettle: () => void;
  onShare: (channel: "email" | "telegram" | "whatsapp") => void;
  onSign: () => void;
}) {
  const completed = flow.steps.filter((step) => step.status === "done").length;
  const progress = Math.round((completed / flow.steps.length) * 100);
  const nextLabel = flow.nextAction?.actionLabel ?? flow.nextAction?.label ?? "Flow complete";
  const pickupDone = flow.checklists.some((item) => item.phase === "pickup");
  const returnDone = flow.checklists.some((item) => item.phase === "return");
  const paidAmount = flow.paidAmount;
  const remaining = Math.max(0, (flow.invoice?.total ?? flow.rental.totalAmount) - paidAmount);
  const canSettle = returnDone && flow.rental.status !== "closed";

  return (
    <section className="rental-flow-panel" aria-label="Rental workflow">
      <div className="flow-heading">
        <div>
          <span className="eyebrow">Rental Flow</span>
          <h2>{flow.vehicle.make} {flow.vehicle.model} · {flow.vehicle.plateNumber}</h2>
          <p>{flow.customer.displayName} · {completed}/{flow.steps.length} steps · {flow.rental.status}</p>
        </div>
        <div className="flow-actions">
          <button className="ghost-button" disabled={busy} onClick={onOpenPdf} type="button">PDF договор</button>
          <button className="primary-button" disabled={busy || !flow.nextAction || flow.nextAction.status === "blocked"} onClick={onPrimaryAction} type="button">{nextLabel}</button>
        </div>
      </div>
      <div className="flow-progress-row">
        <div className="flow-progress-track" aria-label={`Rental Flow ${progress}%`}>
          <span style={{ width: `${progress}%` }} />
        </div>
        <strong>{progress}%</strong>
      </div>
      <div className="flow-control-grid">
        <article>
          <span>Договор</span>
          <strong>{flow.contract?.status ?? "not created"}</strong>
          <small>{flow.contract?.publicUrl ? "public link ready" : "PDF available"}</small>
        </article>
        <article>
          <span>Оплата</span>
          <strong>{money.format(paidAmount)}</strong>
          <small>{remaining ? `Осталось ${money.format(remaining)}` : "paid"}</small>
        </article>
        <article>
          <span>Депозит</span>
          <strong>{money.format(flow.rental.depositAmount)}</strong>
          <small>{flow.rental.status === "closed" ? "settled" : "held / pending"}</small>
        </article>
        <article>
          <span>Выдача / возврат</span>
          <strong>{pickupDone ? "Выдача OK" : "Выдача ждёт"}</strong>
          <small>{returnDone ? "Возврат OK" : "Возврат не закрыт"}</small>
        </article>
      </div>
      <div className="flow-playbook">
        <button className="ghost-button" disabled={busy} onClick={() => onShare("whatsapp")} type="button">WhatsApp</button>
        <button className="ghost-button" disabled={busy} onClick={() => onShare("telegram")} type="button">Telegram</button>
        <button className="ghost-button" disabled={busy} onClick={() => onShare("email")} type="button">Email</button>
        <button className="ghost-button" disabled={busy || flow.contract?.status === "signed"} onClick={onSign} type="button">Подписать</button>
        <button className="ghost-button" disabled={busy || !canSettle} onClick={onSettle} type="button">Депозит и финальный расчёт</button>
      </div>
      <div className="flow-operations-grid">
        <RentalFlowHistoryPanel events={events} flow={flow} locale={locale} />
        <FinalSettlementPanel busy={busy} canSettle={canSettle} flow={flow} money={money} onSettle={onSettle} />
      </div>
      <div className="flow-steps">
        {flow.steps.map((step, index) => (
          <article className={`flow-step ${step.status}`} key={step.key}>
            <span>{index + 1}</span>
            <strong>{step.label}</strong>
            <small>{step.detail}</small>
          </article>
        ))}
      </div>
    </section>
  );
}

function RentalFlowHistoryPanel({ events, flow, locale }: { events: RentalContractEvent[]; flow: RentalFlow; locale: Locale }) {
  const history = [
    { at: flow.rental.createdAt, done: true, label: "Бронь создана", meta: `${flow.customer.displayName} · ${flow.vehicle.plateNumber}` },
    ...events.map((event) => ({
      at: event.createdAt,
      done: true,
      label: contractEventLabel(locale, event),
      meta: `${event.channel}${event.actorLabel ? ` · ${event.actorLabel}` : ""}`,
    })),
    ...flow.checklists.map((checklist) => ({
      at: checklist.createdAt,
      done: true,
      label: checklist.phase === "pickup" ? "Акт выдачи создан" : "Акт возврата создан",
      meta: `${checklist.odometerKm.toLocaleString()} км · топливо ${checklist.fuelLevel}%`,
    })),
  ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  return (
    <section className="flow-history-panel" aria-label="Rental Flow history">
      <div className="section-title compact-title">
        <h3>История Rental Flow</h3>
        <Badge value={`${history.length} событий`} />
      </div>
      <div className="flow-history-list">
        {history.map((item, index) => (
          <article className={item.done ? "done" : ""} key={`${item.label}-${item.at}-${index}`}>
            <span>{item.done ? "✓" : index + 1}</span>
            <div>
              <strong>{item.label}</strong>
              <small>{item.meta}</small>
            </div>
            <time>{dateFmt.format(new Date(item.at))}</time>
          </article>
        ))}
      </div>
    </section>
  );
}

function FinalSettlementPanel({ busy, canSettle, flow, money, onSettle }: { busy: boolean; canSettle: boolean; flow: RentalFlow; money: Intl.NumberFormat; onSettle: () => void }) {
  const invoiceTotal = flow.invoice?.total ?? flow.rental.totalAmount;
  const paidAmount = flow.paidAmount;
  const remaining = Math.max(0, invoiceTotal - paidAmount);
  const deposit = flow.rental.depositAmount;
  const depositReturn = flow.rental.status === "closed" ? 0 : Math.max(0, deposit - remaining);
  const finalDue = Math.max(0, remaining - deposit);
  const closed = flow.rental.status === "closed";

  return (
    <section className="settlement-panel" aria-label="Final rental settlement">
      <div className="section-title compact-title">
        <h3>Финальный расчёт</h3>
        <Badge value={closed ? "закрыто" : canSettle ? "готов" : "ожидает возврат"} />
      </div>
      <div className="settlement-grid">
        <article><span>Стоимость аренды</span><strong>{money.format(invoiceTotal)}</strong></article>
        <article><span>Оплачено</span><strong>{money.format(paidAmount)}</strong></article>
        <article><span>Остаток</span><strong>{money.format(remaining)}</strong></article>
        <article><span>Депозит</span><strong>{money.format(deposit)}</strong></article>
        <article><span>К возврату клиенту</span><strong>{money.format(depositReturn)}</strong></article>
        <article><span>Доплата клиента</span><strong>{money.format(finalDue)}</strong></article>
      </div>
      <button className="primary-button full-button" disabled={busy || !canSettle} onClick={onSettle} type="button">
        {closed ? "Аренда закрыта" : canSettle ? "Закрыть аренду и депозит" : "Сначала создайте акт возврата"}
      </button>
    </section>
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
          {sections.map((item) => (
            <button className={activeSection === item ? "active" : ""} key={item} onClick={() => onSelect(item)} type="button">
              <span className="nav-icon">{sectionIcon(item)}</span>
              <span>{sectionLabel(locale, item)}</span>
              {item === "Service" && notificationsCount ? <em>{notificationsCount}</em> : null}
            </button>
          ))}
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

function VehicleCard({ customer, documents, finance, locale, onDocument, onDocumentPreview, onExpense, onPhoto, onRemovePhoto, onService, rental, serviceRecords, vehicle }: { customer: Customer | undefined; documents: VehicleDocument[]; finance: { expenses: number; income: number; roi: number; vehicle: Vehicle } | undefined; locale: Locale; onDocument: () => void; onDocumentPreview: (document: DocumentPreview) => void; onExpense: () => void; onPhoto: () => void; onRemovePhoto: () => void; onService: () => void; rental: Rental | undefined; serviceRecords: ServiceRecord[]; vehicle: Vehicle | undefined }) {
  if (!vehicle) return <section className="table-panel"><h2>{translate(locale, "panel.vehicleCard")}</h2><p>{translate(locale, "vehicle.add")}</p></section>;
  const vehicleDocuments = documents.filter((doc) => doc.vehicleId === vehicle.id);
  const vehicleServiceRecords = serviceRecords.filter((record) => record.vehicleId === vehicle.id);
  return (
    <section className="table-panel vehicle-card-panel">
      <VehicleVisual vehicle={vehicle} />
      <Badge value={vehicleStatusLabel(locale, vehicle, rental)} />
      <h2>{vehicle.make} {vehicle.model}</h2>
      <p>{vehicle.plateNumber} · VIN {vehicle.vin}</p>
      <div className="detail-grid">
        <article><span>{translate(locale, "vehicle.mileage")}</span><strong>{vehicle.odometerKm.toLocaleString()} км</strong></article>
        <article><span>{translate(locale, "vehicle.client")}</span><strong>{customer?.displayName ?? translate(locale, "common.noClient")}</strong></article>
        <article><span>{translate(locale, "vehicle.return")}</span><strong>{rental ? dateFmt.format(new Date(rental.returnAt)) : "-"}</strong></article>
        <article><span>{translate(locale, "vehicle.documents")}</span><strong>{vehicleDocuments.length}</strong></article>
        <article><span>{translate(locale, "vehicle.service")}</span><strong>{vehicleServiceRecords.length}</strong></article>
        <article><span>{translate(locale, "finance.expenses")}</span><strong>{money.format(finance?.expenses ?? 0)}</strong></article>
        <article><span>ROI</span><strong>{finance?.roi ?? 0}%</strong></article>
      </div>
      {vehicleDocuments.length ? (
        <div className="document-mini-list">
          {vehicleDocuments.slice(0, 3).map((doc) => (
            <FilePreviewLink fileUrl={doc.fileUrl} key={doc.id} onPreview={onDocumentPreview} title={`${doc.title} · ${doc.type}`} />
          ))}
        </div>
      ) : null}
      <div className="vehicle-photo-actions">
        <button className="ghost-button full-button" onClick={onPhoto} type="button">{vehicle.photoUrl ? translate(locale, "vehicle.photoReplace") : translate(locale, "vehicle.photoAdd")}</button>
        {vehicle.photoUrl ? <button className="ghost-button full-button" onClick={onRemovePhoto} type="button">{translate(locale, "vehicle.photoRemove")}</button> : null}
      </div>
      <button className="ghost-button full-button" onClick={onDocument} type="button">{translate(locale, "vehicle.uploadDocument")}</button>
      <button className="ghost-button full-button" onClick={onExpense} type="button">{translate(locale, "vehicle.expense")}</button>
      <button className="ghost-button full-button" onClick={onService} type="button">{translate(locale, "vehicle.serviceCreate")}</button>
    </section>
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
  rental,
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
  rental: Rental | undefined;
  vehicle: Vehicle;
}) {
  return (
    <article className={`fleet-vehicle-card ${isSelected ? "selected" : ""}`} onClick={onSelect} onKeyDown={(event) => {
      if (event.key === "Enter" || event.key === " ") onSelect();
    }} role="button" tabIndex={0}>
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

        <div className="form-grid">
          {showVehicle ? (
            <label>{m("vehicle")}
              <select value={form.vehicleId} onChange={(event) => patch("vehicleId", event.target.value)}>
                {data.vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.make} {vehicle.model} · {vehicle.plateNumber}</option>)}
              </select>
            </label>
          ) : null}

          {showCustomer ? (
            <label>{m("customer")}
              <select value={form.customerId} onChange={(event) => patch("customerId", event.target.value)}>
                {data.customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.displayName} · {customer.phone}</option>)}
              </select>
            </label>
          ) : null}

          {showRental ? (
            <label>{m("rental")}
              <select value={form.rentalId} onChange={(event) => patch("rentalId", event.target.value)}>
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
                  {data.invoices.map((invoice) => <option key={invoice.id} value={invoice.id}>{invoice.invoiceNumber} · {money.format(invoice.total)}</option>)}
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

function UpcomingReturns({ customers, locale, rentals, vehicles }: { customers: Customer[]; locale: Locale; rentals: Rental[]; vehicles: Vehicle[] }) {
  return (
    <section className="table-panel">
      <h2>{translate(locale, "panel.returns")}</h2>
      {rentals.slice(0, 4).map((rental) => {
        const vehicle = vehicles.find((item) => item.id === rental.vehicleId);
        const customer = customers.find((item) => item.id === rental.customerId);
        return <p className="history-row" key={rental.id}>{vehicle?.plateNumber} · {customer?.displayName} · {dateFmt.format(new Date(rental.returnAt))}</p>;
      })}
    </section>
  );
}

function LatestRequests({ customers, invoices, locale }: { customers: Customer[]; invoices: Invoice[]; locale: Locale }) {
  return (
    <section className="table-panel">
      <h2>{translate(locale, "panel.latestRequests")}</h2>
      {invoices.slice(-4).map((invoice) => {
        const customer = customers.find((item) => item.id === invoice.customerId);
        return <p className="history-row" key={invoice.id}>{invoice.invoiceNumber} · {customer?.displayName} · {money.format(invoice.total)}</p>;
      })}
    </section>
  );
}
