"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { AuthSession, Customer, CustomerDocument, DashboardMetrics, Expense, FileObject, GpsDevice, Invoice, Payment, Rental, RentalContract, ServiceRecord, Vehicle, VehicleDocument } from "@fleetcore/shared";

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
  customers: Customer[];
  documents: VehicleDocument[];
  gpsDevices: GpsDevice[];
  invoices: Invoice[];
  metrics: DashboardMetrics;
  payments: Payment[];
  rentals: Rental[];
  customerDocuments: CustomerDocument[];
  expenses: Expense[];
  rentalContracts: RentalContract[];
  serviceRecords: ServiceRecord[];
  vehicles: Vehicle[];
};

type UiNotification = {
  id: string;
  tone: "green" | "blue" | "orange" | "red" | "black";
  title: string;
  meta: string;
  time: string;
};

const sections: Section[] = ["Dashboard", "GPS", "Vehicles", "Drivers/Clients", "Bookings", "Finance", "Service", "Settings"];
const locales: Array<{ code: Locale; label: string }> = [
  { code: "en", label: "EN" },
  { code: "ru", label: "RU" },
  { code: "es", label: "ES" },
  { code: "fr", label: "FR" },
  { code: "de", label: "DE" },
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
    "auth.register": "Create account",
    "auth.registerTitle": "Register B2B company",
    "auth.businessName": "Business name",
    "auth.legalName": "Legal name",
    "auth.country": "Country",
    "auth.currency": "Currency",
    "auth.fleetLimit": "Fleet limit",
    "common.loading": "Loading...",
    "common.refresh": "Refresh data",
    "common.search": "Plate, VIN, client, phone",
    "common.signOut": "Sign out",
    "dashboard.apiReady": "Data loaded from PostgreSQL through backend API",
    "dashboard.activeRentals": "In rental",
    "dashboard.available": "Available now",
    "dashboard.monthlyRevenue": "Monthly revenue",
    "dashboard.overdue": "On service",
    "dashboard.todayRevenue": "Today revenue",
    "dashboard.totalVehicles": "Total vehicles",
    "finance.expenses": "Expenses",
    "finance.income": "Income",
    "finance.net": "Net profit",
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
    "auth.register": "Создать аккаунт",
    "auth.registerTitle": "Регистрация B2B-компании",
    "auth.businessName": "Название бизнеса",
    "auth.legalName": "Юридическое имя",
    "auth.country": "Страна",
    "auth.currency": "Валюта",
    "auth.fleetLimit": "Лимит автопарка",
    "common.loading": "Загрузка...",
    "common.refresh": "Обновить данные",
    "common.search": "Номер, VIN, клиент, телефон",
    "common.signOut": "Выйти из аккаунта",
    "dashboard.apiReady": "Данные загружены из PostgreSQL через backend API",
    "dashboard.activeRentals": "В аренде",
    "dashboard.available": "Свободно сейчас",
    "dashboard.monthlyRevenue": "Доход за месяц",
    "dashboard.overdue": "На сервисе",
    "dashboard.todayRevenue": "Доход сегодня",
    "dashboard.totalVehicles": "Всего автомобилей",
    "finance.expenses": "Расходы",
    "finance.income": "Доход",
    "finance.net": "Чистая прибыль",
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
    "auth.register": "Crear cuenta",
    "auth.registerTitle": "Registrar empresa B2B",
    "auth.businessName": "Nombre comercial",
    "auth.legalName": "Razón social",
    "auth.country": "País",
    "auth.currency": "Moneda",
    "auth.fleetLimit": "Límite de flota",
    "common.loading": "Cargando...",
    "common.refresh": "Actualizar datos",
    "common.search": "Matrícula, VIN, cliente, teléfono",
    "common.signOut": "Cerrar sesión",
    "dashboard.apiReady": "Datos cargados desde PostgreSQL vía backend API",
    "dashboard.activeRentals": "En alquiler",
    "dashboard.available": "Disponible ahora",
    "dashboard.monthlyRevenue": "Ingresos mensuales",
    "dashboard.overdue": "En servicio",
    "dashboard.todayRevenue": "Ingresos hoy",
    "dashboard.totalVehicles": "Vehículos totales",
    "finance.expenses": "Gastos",
    "finance.income": "Ingresos",
    "finance.net": "Beneficio neto",
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
    "auth.register": "Créer un compte",
    "auth.registerTitle": "Inscription société B2B",
    "auth.businessName": "Nom commercial",
    "auth.legalName": "Raison sociale",
    "auth.country": "Pays",
    "auth.currency": "Devise",
    "auth.fleetLimit": "Limite de flotte",
    "common.loading": "Chargement...",
    "common.refresh": "Actualiser",
    "common.search": "Plaque, VIN, client, téléphone",
    "common.signOut": "Se déconnecter",
    "dashboard.apiReady": "Données chargées depuis PostgreSQL via backend API",
    "dashboard.activeRentals": "En location",
    "dashboard.available": "Disponible",
    "dashboard.monthlyRevenue": "Revenu mensuel",
    "dashboard.overdue": "En service",
    "dashboard.todayRevenue": "Revenu du jour",
    "dashboard.totalVehicles": "Véhicules",
    "finance.expenses": "Dépenses",
    "finance.income": "Revenus",
    "finance.net": "Profit net",
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
    "auth.register": "Konto erstellen",
    "auth.registerTitle": "B2B-Firma registrieren",
    "auth.businessName": "Firmenname",
    "auth.legalName": "Rechtsname",
    "auth.country": "Land",
    "auth.currency": "Währung",
    "auth.fleetLimit": "Flottenlimit",
    "common.loading": "Wird geladen...",
    "common.refresh": "Daten aktualisieren",
    "common.search": "Kennzeichen, VIN, Kunde, Telefon",
    "common.signOut": "Abmelden",
    "dashboard.apiReady": "Daten aus PostgreSQL über Backend API geladen",
    "dashboard.activeRentals": "Vermietet",
    "dashboard.available": "Jetzt verfügbar",
    "dashboard.monthlyRevenue": "Monatsumsatz",
    "dashboard.overdue": "Im Service",
    "dashboard.todayRevenue": "Umsatz heute",
    "dashboard.totalVehicles": "Fahrzeuge gesamt",
    "finance.expenses": "Kosten",
    "finance.income": "Umsatz",
    "finance.net": "Nettogewinn",
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

async function api<T>(path: string, options: RequestInit = {}, token?: string) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : { "x-tenant-id": TENANT_ID }),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new ApiRequestError(body || `Request failed: ${response.status}`, response.status);
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

function VehicleArt({ tone = "light" }: { tone?: "light" | "dark" }) {
  return (
    <div className={`vehicle-art ${tone}`}>
      <span className="car-roof" />
      <span className="car-body" />
      <span className="wheel left" />
      <span className="wheel right" />
    </div>
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

function vehicleStatusLabel(vehicle: Vehicle, rental?: Rental) {
  if (vehicle.status === "maintenance") return "На ремонте";
  if (rental?.status === "reserved") return "Забронирован";
  if (rental?.status === "return_due") return "Скоро возврат";
  if (vehicle.status === "rented") return "В аренде";
  if (vehicle.status === "offline") return "Оффлайн";
  return "Свободен";
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

function AuthScreen({ locale, onLocaleChange, onSession }: { locale: Locale; onLocaleChange: (locale: Locale) => void; onSession: (session: AuthSession) => void }) {
  const t = (key: string) => translate(locale, key);
  const [mode, setMode] = useState<"login" | "register">("login");
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
    if (!loading) setMessage(t("auth.message"));
  }, [locale, loading]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(mode === "login" ? "Проверяем доступ..." : "Создаем компанию...");
    try {
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
      localStorage.setItem("fleetcore-session", JSON.stringify(response.data));
      onSession(response.data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось войти");
      setLoading(false);
    }
  }

  async function loginDemo() {
    setLoading(true);
    setMessage("Открываем демо-аккаунт...");
    try {
      const response = await api<AuthSession>("/auth/login", {
        body: JSON.stringify({ email: "founder@atlas.example", password: "development-only" }),
        method: "POST",
      });
      localStorage.setItem("fleetcore-session", JSON.stringify(response.data));
      onSession(response.data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось открыть демо");
      setLoading(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div>
          <span className="auth-kicker">FleetCore SaaS</span>
          <h1>{mode === "login" ? t("auth.loginTitle") : t("auth.registerTitle")}</h1>
          <p>{message}</p>
        </div>
        <LanguageSelect locale={locale} onChange={onLocaleChange} />
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
          <button className="primary-button full" disabled={loading}>{loading ? t("common.loading") : mode === "login" ? t("auth.login") : t("auth.register")}</button>
          {mode === "login" ? (
            <button className="ghost-button full-button" disabled={loading} onClick={() => void loginDemo()} type="button">{t("auth.demo")}</button>
          ) : null}
        </form>
      </section>
      <section className="auth-preview">
        <div className="preview-map">
          <CarPin className="pin-one" color="green" label="BMW X5" />
          <CarPin className="pin-two" color="blue" label="Audi A6" />
          <CarPin className="pin-four" color="orange" label="Camry" />
        </div>
        <div className="preview-card">
          <strong>B2B изоляция данных</strong>
          <span>Каждая компания получает свой tenant, owner-аккаунт, автопарк, клиентов, аренды и финансы.</span>
        </div>
      </section>
    </main>
  );
}

export default function DashboardClient() {
  const [locale, setLocale] = useState<Locale>("ru");
  const [session, setSession] = useState<AuthSession | undefined>();
  const [activeSection, setActiveSection] = useState<Section>("Dashboard");
  const [search, setSearch] = useState("");
  const [mapFilter, setMapFilter] = useState<"all" | "available" | "rented" | "maintenance" | "offline">("all");
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("Подключаемся к backend API...");
  const [busyAction, setBusyAction] = useState<string | undefined>();
  const [operation, setOperation] = useState<OperationKind | undefined>();
  const [operationForm, setOperationForm] = useState(defaultOperationForm);
  const [operationFiles, setOperationFiles] = useState<FileList | null>(null);
  const vehicleDocumentInputRef = useRef<HTMLInputElement>(null);
  const vehicleFolderInputRef = useRef<HTMLInputElement>(null);
  const customerDocumentInputRef = useRef<HTMLInputElement>(null);
  const customerFolderInputRef = useRef<HTMLInputElement>(null);
  const contractInputRef = useRef<HTMLInputElement>(null);
  const depositInputRef = useRef<HTMLInputElement>(null);
  const signatureInputRef = useRef<HTMLInputElement>(null);
  const [data, setData] = useState<AppData>({
    customers: [],
    documents: [],
    gpsDevices: [],
    invoices: [],
    metrics: emptyMetrics,
    payments: [],
    rentals: [],
    customerDocuments: [],
    expenses: [],
    rentalContracts: [],
    serviceRecords: [],
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

  function changeLocale(nextLocale: Locale) {
    setLocale(nextLocale);
    localStorage.setItem("fleetcore-locale", nextLocale);
  }

  async function loadData(currentToken = token) {
    setLoading(true);
    try {
      const [metrics, vehicles, customers, rentals, invoices, payments, gpsDevices, documents, expenses, serviceRecords, customerDocuments, rentalContracts] = await Promise.all([
        api<DashboardMetrics>("/dashboard", {}, currentToken),
        api<Vehicle[]>("/fleet/vehicles", {}, currentToken),
        api<Customer[]>("/customers", {}, currentToken),
        api<Rental[]>("/rentals", {}, currentToken),
        api<Invoice[]>("/finance/invoices", {}, currentToken),
        api<Payment[]>("/finance/payments", {}, currentToken),
        api<GpsDevice[]>("/gps/devices", {}, currentToken),
        api<VehicleDocument[]>("/documents/vehicles", {}, currentToken),
        api<Expense[]>("/operations/expenses", {}, currentToken),
        api<ServiceRecord[]>("/operations/service-records", {}, currentToken),
        api<CustomerDocument[]>("/operations/customer-documents", {}, currentToken),
        api<RentalContract[]>("/operations/rental-contracts", {}, currentToken),
      ]);

      setData({
        customers: customers.data,
        documents: documents.data,
        gpsDevices: gpsDevices.data,
        invoices: invoices.data,
        metrics: metrics.data,
        payments: payments.data,
        rentals: rentals.data,
        customerDocuments: customerDocuments.data,
        expenses: expenses.data,
        rentalContracts: rentalContracts.data,
        serviceRecords: serviceRecords.data,
        vehicles: vehicles.data,
      });
      setSelectedVehicleId((current) => current ?? vehicles.data[0]?.id);
      setMessage(t("dashboard.apiReady"));
    } catch (error) {
      if (error instanceof ApiRequestError && (error.status === 401 || error.status === 403)) {
        logout();
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

  const notifications = useMemo<UiNotification[]>(() => {
    const now = Date.now();
    const dueRentals = data.rentals
      .filter((rental) => rental.status !== "closed" && new Date(rental.returnAt).getTime() < now)
      .map((rental) => {
        const vehicle = data.vehicles.find((item) => item.id === rental.vehicleId);
        return { id: `rental-${rental.id}`, meta: vehicle?.plateNumber ?? "Авто", time: "сейчас", title: "Клиент не вернул авто", tone: "red" as const };
      });
    const paymentAlerts = data.invoices
      .filter((invoice) => invoice.status === "overdue")
      .map((invoice) => ({ id: `invoice-${invoice.id}`, meta: invoice.invoiceNumber, time: dateFmt.format(new Date(invoice.dueAt)), title: "Просрочен платеж", tone: "red" as const }));
    const docAlerts = data.documents
      .filter((doc) => doc.expiresAt && new Date(doc.expiresAt).getTime() < now + 30 * 24 * 60 * 60 * 1000)
      .map((doc) => ({ id: `doc-${doc.id}`, meta: doc.title, time: doc.expiresAt ? dateFmt.format(new Date(doc.expiresAt)) : "-", title: doc.type === "insurance" ? "Заканчивается страховка" : "Заканчивается техосмотр", tone: "orange" as const }));
    const serviceAlerts = data.vehicles
      .filter((vehicle) => vehicle.odometerKm > 40_000)
      .map((vehicle) => ({ id: `service-${vehicle.id}`, meta: vehicle.plateNumber, time: `${vehicle.odometerKm.toLocaleString()} км`, title: "Необходимо ТО через X км", tone: "blue" as const }));
    return [...dueRentals, ...paymentAlerts, ...docAlerts, ...serviceAlerts].slice(0, 8);
  }, [data.documents, data.invoices, data.rentals, data.vehicles]);

  const dashboardCards = [
    [t("dashboard.totalVehicles"), data.vehicles.length, "blue"],
    [t("dashboard.available"), data.vehicles.filter((vehicle) => vehicle.status === "available").length, "green"],
    [t("dashboard.activeRentals"), data.vehicles.filter((vehicle) => vehicle.status === "rented").length, "blue"],
    [t("dashboard.overdue"), data.vehicles.filter((vehicle) => vehicle.status === "maintenance").length, "black"],
    [t("dashboard.monthlyRevenue"), money.format(data.metrics.monthlyRevenue), "green"],
    [t("dashboard.todayRevenue"), money.format(incomeToday), "green"],
  ] as const;

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

  async function runAction(label: string, action: () => Promise<void>) {
    if (busyAction) return;
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
      body: JSON.stringify({ ...draft, riskLevel: "low", type: "individual" }),
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
    await runAction("Создаем автомобиль...", async () => {
      const created = await createVehicleRecord();
      setVehicleForm((current) => ({ ...current, plateNumber: `WA-${Date.now().toString().slice(-5)}`, vin: `VIN${Date.now().toString().slice(-10)}` }));
      setSelectedVehicleId(created.id);
      await loadData();
      setMessage("Автомобиль сохранен");
    });
  }

  async function submitCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runAction("Создаем клиента...", async () => {
      await createCustomerRecord();
      setCustomerForm((current) => ({ ...current, displayName: "Новый клиент", email: `client-${Date.now().toString().slice(-5)}@example.com` }));
      await loadData();
      setMessage("Клиент сохранен");
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
    if (!files?.length) return;
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

  async function saveCustomerFiles(files: FileList | null) {
    if (!files?.length) return;
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
    if (!files?.length) return;
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
    if (!files?.length) return;
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
    if (!operation) return;

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
      openWhatsApp(customer.phone, `Здравствуйте, ${customer.displayName}. Ваш договор аренды FleetCore: ${contract.documentUrl}`);
      setMessage("Договор создан и ссылка открыта для отправки в WhatsApp");
    });
  }

  async function createDraftContract() {
    await runAction("Создаем электронный договор...", async () => {
      await createContractRecord("draft", "manual");
      await loadData();
      setMessage("Электронный договор создан");
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

  function logout() {
    localStorage.removeItem("fleetcore-session");
    setSession(undefined);
  }

  if (!session) {
    return <AuthScreen locale={locale} onLocaleChange={changeLocale} onSession={setSession} />;
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
        <div className="profile">
          <div className="avatar">{session.user.fullName.slice(0, 1)}</div>
          <div>
            <strong>{session.user.fullName}</strong>
            <span>{session.user.role} · {session.companyId.slice(0, 12)}</span>
          </div>
          <button onClick={logout} title="Выйти">×</button>
        </div>
        <nav className="side-nav">
          {sections.map((item) => (
            <button className={activeSection === item ? "active" : ""} key={item} onClick={() => setActiveSection(item)} type="button">
              <span>{item === "Dashboard" ? "⌂" : item === "GPS" ? "⌖" : item === "Vehicles" ? "▣" : item === "Finance" ? "€" : item === "Service" ? "◷" : item === "Settings" ? "⚙" : "♙"}</span>
              {sectionLabel(locale, item)}
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
      </aside>

      <section className="desktop-workspace">
        <header className="desktop-header">
          <div>
            <h1>{sectionLabel(locale, activeSection)}</h1>
            <p className="api-status">{loading ? t("common.loading") : message}</p>
          </div>
          <div className="header-actions">
            <label className="global-search">
              <span>⌕</span>
              <input placeholder={t("common.search")} value={search} onChange={(event) => setSearch(event.target.value)} />
            </label>
            <LanguageSelect locale={locale} onChange={changeLocale} />
            <button className="ghost-button" disabled={Boolean(busyAction)} onClick={() => void loadData()} title={t("common.refresh")} type="button">↻</button>
            <button className="primary-button" disabled={Boolean(busyAction)} onClick={() => setActiveSection("GPS")} type="button">{busyAction ? "..." : "⊕ GPS"}</button>
          </div>
        </header>

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
              <MapPanel gpsDevices={data.gpsDevices} vehicles={filteredVehicles} rentals={data.rentals} selectedVehicleId={selectedVehicle?.id} onSelect={setSelectedVehicleId} />
              <section className="split-panels">
                <UpcomingReturns rentals={data.rentals} vehicles={data.vehicles} customers={data.customers} />
                <LatestRequests customers={data.customers} invoices={data.invoices} />
              </section>
            </div>
            <aside className="side-column">
              <NotificationsPanel notifications={notifications} />
              <VehicleCard vehicle={selectedVehicle} rental={activeRental} customer={activeCustomer} documents={data.documents} finance={finance.incomeByVehicle.find((item) => item.vehicle.id === selectedVehicle?.id)} serviceRecords={data.serviceRecords} onDocument={requestVehicleDocumentUpload} onExpense={() => openOperation("expense")} onService={() => openOperation("service")} />
            </aside>
          </section>
        ) : null}

        {activeSection === "GPS" ? (
          <section className="workspace-grid">
            <div className="main-column">
              <MapPanel gpsDevices={data.gpsDevices} vehicles={filteredVehicles} rentals={data.rentals} selectedVehicleId={selectedVehicle?.id} onSelect={setSelectedVehicleId} />
              <div className="quick-actions-grid">
                <button className="primary-button" disabled={Boolean(busyAction)} onClick={() => openOperation("gps")} type="button">Подключить GPS к авто</button>
                <button className="ghost-button" disabled={Boolean(busyAction)} onClick={() => void connectGps()} type="button">Быстро подключить выбранное авто</button>
              </div>
            </div>
            <aside className="side-column">
              <div className="table-panel">
                <h2>GPS устройства</h2>
                {data.gpsDevices.map((device) => {
                  const vehicle = data.vehicles.find((item) => item.id === device.vehicleId);
                  return <p className="history-row" key={device.id}>{vehicle?.plateNumber} · {device.provider} · {device.status} · {device.speedKph} км/ч</p>;
                })}
                {!data.gpsDevices.length ? <p className="history-row">Подключите первый GPS-трекер.</p> : null}
              </div>
            </aside>
          </section>
        ) : null}

        {activeSection === "Vehicles" ? (
          <section className="workspace-grid">
            <div className="main-column">
              <div className="filter-row">
                {(["all", "available", "rented", "maintenance", "offline"] as const).map((filter) => (
                  <button className={mapFilter === filter ? "active" : ""} key={filter} onClick={() => setMapFilter(filter)} type="button">{filter}</button>
                ))}
              </div>
              <div className="table-panel reduced-list">
                {filteredVehicles.map((vehicle) => {
                  const rental = data.rentals.find((item) => item.vehicleId === vehicle.id && item.status !== "closed");
                  const customer = data.customers.find((item) => item.id === rental?.customerId);
                  return (
                    <button className="vehicle-row clickable" key={vehicle.id} onClick={() => setSelectedVehicleId(vehicle.id)} type="button">
                      <VehicleArt />
                      <div>
                        <strong>{vehicle.make} {vehicle.model}</strong>
                        <span>{vehicle.plateNumber}</span>
                        <small>{customer?.displayName ?? "Без клиента"}</small>
                      </div>
                      <Badge value={vehicleStatusLabel(vehicle, rental)} />
                      <time>{rental ? dateFmt.format(new Date(rental.returnAt)) : "Нет возврата"}</time>
                    </button>
                  );
                })}
              </div>
            </div>
            <aside className="side-column">
              <VehicleForm form={vehicleForm} setForm={setVehicleForm} onSubmit={submitVehicle} />
              <VehicleCard vehicle={selectedVehicle} rental={activeRental} customer={activeCustomer} documents={data.documents} finance={finance.incomeByVehicle.find((item) => item.vehicle.id === selectedVehicle?.id)} serviceRecords={data.serviceRecords} onDocument={requestVehicleDocumentUpload} onExpense={() => openOperation("expense")} onService={() => openOperation("service")} />
            </aside>
          </section>
        ) : null}

        {activeSection === "Drivers/Clients" ? (
          <section className="workspace-grid">
            <div className="main-column table-panel">
              {data.customers.filter((customer) => !search || `${customer.displayName} ${customer.phone} ${customer.email}`.toLowerCase().includes(search.toLowerCase())).map((customer) => (
                <article className="customer-line" key={customer.id}>
                  <div className="avatar small">{customer.displayName.slice(0, 1)}</div>
                  <div><strong>{customer.displayName}</strong><span>{customer.phone} · {customer.email}</span></div>
                  <Badge value={customer.riskLevel === "low" ? "Активен" : customer.riskLevel} />
                </article>
              ))}
            </div>
            <aside className="side-column">
              <CustomerForm form={customerForm} setForm={setCustomerForm} onSubmit={submitCustomer} />
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
              <button className="ghost-button" disabled={Boolean(busyAction)} onClick={requestContractUpload} type="button">Создать электронный договор</button>
              <button className="ghost-button" disabled={Boolean(busyAction)} onClick={requestContractUpload} type="button">Загрузить договор аренды</button>
              <button className="ghost-button" disabled={Boolean(busyAction)} onClick={() => void sendRentalContract()} type="button">Отправить ссылку WhatsApp</button>
              <button className="ghost-button" disabled={Boolean(busyAction)} onClick={requestSignatureUpload} type="button">Загрузить подпись</button>
            </div>
            {data.rentals.map((rental) => {
              const vehicle = data.vehicles.find((item) => item.id === rental.vehicleId);
              const customer = data.customers.find((item) => item.id === rental.customerId);
              const contract = data.rentalContracts.find((item) => item.rentalId === rental.id);
              return (
                <article className="booking-card" key={rental.id}>
                  <div><strong>{customer?.displayName}</strong><span>{vehicle?.make} {vehicle?.model} · {vehicle?.plateNumber}</span></div>
                  <Badge value={rental.status} />
                  <span>Депозит {money.format(rental.depositAmount)}</span>
                  <span>Возврат {dateFmt.format(new Date(rental.returnAt))}</span>
                  {contract ? <a className="document-link" href={contract.documentUrl} rel="noreferrer" target="_blank">{contract.status === "signed" ? "Подписан" : "Открыть договор"}</a> : null}
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
            <NotificationsPanel notifications={notifications} />
            <div className="table-panel">
              <h2>Документы и ТО</h2>
              {data.documents.map((doc) => <p className="history-row" key={doc.id}>{doc.title} · {doc.type} · {doc.expiresAt ? dateFmt.format(new Date(doc.expiresAt)) : "без срока"}</p>)}
              {data.serviceRecords.map((record) => <p className="history-row" key={record.id}>{record.type} · {record.status} · {money.format(record.cost)} · {record.odometerKm.toLocaleString()} км</p>)}
              <button className="primary-button full" disabled={Boolean(busyAction)} onClick={requestVehicleDocumentUpload} type="button">Загрузить PDF документ</button>
              <button className="ghost-button full-button" disabled={Boolean(busyAction)} onClick={requestVehicleFolderUpload} type="button">Загрузить папку авто</button>
              <button className="ghost-button full-button" disabled={Boolean(busyAction)} onClick={() => openOperation("service")} type="button">Создать ТО</button>
            </div>
          </section>
        ) : null}

        {activeSection === "Settings" ? (
          <section className="settings-grid">
            <section className="table-panel settings-panel">
              <h2>{t("settings.account")}</h2>
              <p className="history-row">{session.user.fullName} · {session.user.email}</p>
              <p className="history-row">{t("settings.role")}: {session.user.role}</p>
              <p className="history-row">{t("settings.companyId")}: {session.companyId}</p>
              <button className="ghost-button full-button" onClick={logout} type="button">{t("common.signOut")}</button>
            </section>

            <section className="table-panel settings-panel">
              <h2>{t("settings.integrations")}</h2>
              <p className="history-row">Google Maps: {GOOGLE_MAPS_API_KEY ? "API key подключен" : "работает preview без API key"}</p>
              <p className="history-row">Backend API: {API_URL}</p>
              <button className="primary-button full" onClick={() => openOperation("gps")} type="button">Подключить GPS</button>
            </section>

            <section className="table-panel settings-panel">
              <h2>{t("settings.data")}</h2>
              <p className="history-row">{t("settings.vehicles")}: {data.vehicles.length}</p>
              <p className="history-row">{t("settings.customers")}: {data.customers.length}</p>
              <p className="history-row">{t("settings.documents")}: {data.documents.length + data.customerDocuments.length}</p>
              <p className="history-row">{t("settings.contracts")}: {data.rentalContracts.length}</p>
              <button className="ghost-button full-button" onClick={() => void loadData()} type="button">{t("settings.update")}</button>
            </section>
          </section>
        ) : null}
      </section>

      {operation ? (
        <OperationDialog
          data={data}
          files={operationFiles}
          form={operationForm}
          kind={operation}
          onChange={setOperationForm}
          onClose={() => setOperation(undefined)}
          onFiles={setOperationFiles}
          onSubmit={submitOperation}
        />
      ) : null}

      <MobileAppNav activeSection={activeSection} locale={locale} notificationsCount={notifications.length} onSelect={setActiveSection} />
    </main>
  );
}

function MobileAppNav({ activeSection, locale, notificationsCount, onSelect }: { activeSection: Section; locale: Locale; notificationsCount: number; onSelect: (section: Section) => void }) {
  return (
    <nav className="mobile-app-nav" aria-label="Mobile app navigation">
      {sections.map((item) => (
        <button className={activeSection === item ? "active" : ""} key={item} onClick={() => onSelect(item)} type="button">
          <span>{item === "Dashboard" ? "⌂" : item === "GPS" ? "⌖" : item === "Vehicles" ? "▣" : item === "Finance" ? "€" : item === "Service" ? "◷" : item === "Settings" ? "⚙" : "♙"}</span>
          <small>{sectionLabel(locale, item)}</small>
          {item === "Service" && notificationsCount ? <em>{notificationsCount}</em> : null}
        </button>
      ))}
    </nav>
  );
}

function MapPanel({ gpsDevices, onSelect, selectedVehicleId, vehicles, rentals }: { gpsDevices: GpsDevice[]; onSelect: (id: string) => void; selectedVehicleId: string | undefined; vehicles: Vehicle[]; rentals: Rental[] }) {
  const googleMapRef = useRef<HTMLDivElement>(null);
  const googleMapInstanceRef = useRef<GoogleMapInstance | null>(null);
  const googleMarkersRef = useRef<GoogleMarkerInstance[]>([]);
  const [googleMapsReady, setGoogleMapsReady] = useState(false);
  const selectedGps = gpsDevices.find((device) => device.vehicleId === selectedVehicleId) ?? gpsDevices[0];
  const mapQuery = selectedGps ? `${selectedGps.latitude},${selectedGps.longitude}` : "Warsaw, Poland";
  const center = selectedGps ? { lat: selectedGps.latitude, lng: selectedGps.longitude } : { lat: 52.2297, lng: 21.0122 };

  useEffect(() => {
    let cancelled = false;

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
  }, [center.lat, center.lng, gpsDevices, vehicles]);

  return (
    <section className="map-card large-map business-map google-map-panel">
      {GOOGLE_MAPS_API_KEY ? <div className="google-js-map" ref={googleMapRef} /> : null}
      {!GOOGLE_MAPS_API_KEY || !googleMapsReady ? (
        <iframe
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          src={`https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&z=12&output=embed`}
          title="Google Maps GPS fleet"
        />
      ) : null}
      <div className="map-provider-badge">{GOOGLE_MAPS_API_KEY && googleMapsReady ? "Google Maps API" : "Google Maps preview"}</div>
      {vehicles.slice(0, 8).map((vehicle, index) => {
        const rental = rentals.find((item) => item.vehicleId === vehicle.id && item.status !== "closed");
        const gps = gpsDevices.find((item) => item.vehicleId === vehicle.id);
        return (
          <button className={`map-pin pin-${(index % 5) + 1} ${statusTone(vehicle, rental)} ${selectedVehicleId === vehicle.id ? "selected" : ""}`} key={vehicle.id} onClick={() => onSelect(vehicle.id)} type="button">
            <span>▣</span>
            <strong>{vehicle.plateNumber}</strong>
            <small>{gps ? `${gps.speedKph} км/ч · ${gps.status}` : "GPS не подключен"}</small>
          </button>
        );
      })}
      <div className="map-legend">
        <span><i className="green" /> Свободен</span>
        <span><i className="blue" /> Забронирован</span>
        <span><i className="orange" /> Скоро возврат</span>
        <span><i className="red" /> Просрочен</span>
        <span><i className="black" /> На ремонте</span>
      </div>
    </section>
  );
}

function NotificationsPanel({ notifications }: { notifications: UiNotification[] }) {
  return (
    <section className="table-panel">
      <div className="section-title compact-title"><h2>Уведомления</h2><Badge value={String(notifications.length)} /></div>
      <div className="notification-list">
        {(notifications.length ? notifications : [{ id: "ok", meta: "Система", time: "сейчас", title: "Критических событий нет", tone: "green" as const }]).map((item) => (
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

function VehicleCard({ customer, documents, finance, onDocument, onExpense, onService, rental, serviceRecords, vehicle }: { customer: Customer | undefined; documents: VehicleDocument[]; finance: { expenses: number; income: number; roi: number; vehicle: Vehicle } | undefined; onDocument: () => void; onExpense: () => void; onService: () => void; rental: Rental | undefined; serviceRecords: ServiceRecord[]; vehicle: Vehicle | undefined }) {
  if (!vehicle) return <section className="table-panel"><h2>Карточка автомобиля</h2><p>Добавьте первый автомобиль.</p></section>;
  const vehicleDocuments = documents.filter((doc) => doc.vehicleId === vehicle.id);
  const vehicleServiceRecords = serviceRecords.filter((record) => record.vehicleId === vehicle.id);
  return (
    <section className="table-panel vehicle-card-panel">
      <VehicleArt />
      <Badge value={vehicleStatusLabel(vehicle, rental)} />
      <h2>{vehicle.make} {vehicle.model}</h2>
      <p>{vehicle.plateNumber} · VIN {vehicle.vin}</p>
      <div className="detail-grid">
        <article><span>Пробег</span><strong>{vehicle.odometerKm.toLocaleString()} км</strong></article>
        <article><span>Клиент</span><strong>{customer?.displayName ?? "Нет"}</strong></article>
        <article><span>Возврат</span><strong>{rental ? dateFmt.format(new Date(rental.returnAt)) : "-"}</strong></article>
        <article><span>Документы PDF</span><strong>{vehicleDocuments.length}</strong></article>
        <article><span>Сервис</span><strong>{vehicleServiceRecords.length}</strong></article>
        <article><span>Расходы</span><strong>{money.format(finance?.expenses ?? 0)}</strong></article>
        <article><span>ROI</span><strong>{finance?.roi ?? 0}%</strong></article>
      </div>
      <button className="ghost-button full-button" onClick={onDocument} type="button">Загрузить документ</button>
      <button className="ghost-button full-button" onClick={onExpense} type="button">Добавить расход</button>
      <button className="ghost-button full-button" onClick={onService} type="button">Создать ТО</button>
    </section>
  );
}

function OperationDialog({
  data,
  files,
  form,
  kind,
  onChange,
  onClose,
  onFiles,
  onSubmit,
}: {
  data: AppData;
  files: FileList | null;
  form: typeof defaultOperationForm;
  kind: OperationKind;
  onChange: (form: typeof defaultOperationForm) => void;
  onClose: () => void;
  onFiles: (files: FileList | null) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const titleByKind: Record<OperationKind, string> = {
    booking: "Создать бронь",
    contract: "Договор аренды",
    customerDocument: "Документ клиента",
    depositDocument: "Документ депозита / возврата",
    depositReturn: "Возврат депозита",
    expense: "Добавить расход",
    gps: "Подключить GPS",
    payment: "Провести оплату",
    signature: "Электронная подпись",
    service: "Создать техобслуживание",
    vehicleDocument: "Документ автомобиля",
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
            <span>FleetCore operation</span>
            <h2>{titleByKind[kind]}</h2>
          </div>
          <button onClick={onClose} type="button">×</button>
        </div>

        <div className="form-grid">
          {showVehicle ? (
            <label>Автомобиль
              <select value={form.vehicleId} onChange={(event) => patch("vehicleId", event.target.value)}>
                {data.vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.make} {vehicle.model} · {vehicle.plateNumber}</option>)}
              </select>
            </label>
          ) : null}

          {showCustomer ? (
            <label>Клиент
              <select value={form.customerId} onChange={(event) => patch("customerId", event.target.value)}>
                {data.customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.displayName} · {customer.phone}</option>)}
              </select>
            </label>
          ) : null}

          {showRental ? (
            <label>Аренда
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
              <label>Дата возврата<input type="datetime-local" value={form.returnAt} onChange={(event) => patch("returnAt", event.target.value)} /></label>
              <label>Сумма аренды<input type="number" min="0" value={form.totalAmount} onChange={(event) => patch("totalAmount", event.target.value)} /></label>
              <label>Депозит<input type="number" min="0" value={form.depositAmount} onChange={(event) => patch("depositAmount", event.target.value)} /></label>
            </>
          ) : null}

          {kind === "expense" ? (
            <>
              <label>Категория
                <select value={form.category} onChange={(event) => patch("category", event.target.value)}>
                  <option value="maintenance">Ремонт / ТО</option>
                  <option value="insurance">Страховка</option>
                  <option value="fuel">Топливо</option>
                  <option value="cleaning">Мойка</option>
                  <option value="parking">Парковка</option>
                  <option value="other">Другое</option>
                </select>
              </label>
              <label>Сумма<input type="number" min="0" value={form.amount} onChange={(event) => patch("amount", event.target.value)} /></label>
              <label className="wide-field">Комментарий<input value={form.note} onChange={(event) => patch("note", event.target.value)} /></label>
            </>
          ) : null}

          {kind === "service" ? (
            <>
              <label>Тип ТО
                <select value={form.serviceType} onChange={(event) => patch("serviceType", event.target.value)}>
                  <option value="inspection">Техосмотр</option>
                  <option value="oil">Масло</option>
                  <option value="repair">Ремонт</option>
                  <option value="tires">Шины</option>
                  <option value="other">Другое</option>
                </select>
              </label>
              <label>Дата<input type="date" value={form.serviceAt} onChange={(event) => patch("serviceAt", event.target.value)} /></label>
              <label>Пробег<input type="number" min="0" value={form.odometerKm} onChange={(event) => patch("odometerKm", event.target.value)} /></label>
              <label>Стоимость<input type="number" min="0" value={form.cost} onChange={(event) => patch("cost", event.target.value)} /></label>
              <label>Статус
                <select value={form.status} onChange={(event) => patch("status", event.target.value)}>
                  <option value="planned">Запланировано</option>
                  <option value="completed">Выполнено</option>
                </select>
              </label>
              <label className="wide-field">Комментарий<input value={form.note} onChange={(event) => patch("note", event.target.value)} /></label>
            </>
          ) : null}

          {kind === "payment" ? (
            <>
              <label>Инвойс
                <select value={form.invoiceId} onChange={(event) => patch("invoiceId", event.target.value)}>
                  {data.invoices.map((invoice) => <option key={invoice.id} value={invoice.id}>{invoice.invoiceNumber} · {money.format(invoice.total)}</option>)}
                </select>
              </label>
              <label>Сумма<input type="number" min="0" value={form.amount} onChange={(event) => patch("amount", event.target.value)} /></label>
              <label>Метод
                <select value={form.method} onChange={(event) => patch("method", event.target.value)}>
                  <option value="manual">Manual</option>
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="bank_transfer">Bank transfer</option>
                  <option value="stripe">Stripe</option>
                </select>
              </label>
              <label>Референс<input value={form.reference} onChange={(event) => patch("reference", event.target.value)} /></label>
            </>
          ) : null}

          {kind === "gps" ? (
            <>
              <label>Платформа
                <select value={form.provider} onChange={(event) => patch("provider", event.target.value)}>
                  <option value="traccar">Traccar</option>
                  <option value="wialon">Wialon</option>
                  <option value="navixy">Navixy</option>
                  <option value="gpswox">GPSWOX</option>
                  <option value="manual">Manual</option>
                </select>
              </label>
              <label>ID трекера<input value={form.externalDeviceId} onChange={(event) => patch("externalDeviceId", event.target.value)} /></label>
              <label>Latitude<input value={form.latitude} onChange={(event) => patch("latitude", event.target.value)} /></label>
              <label>Longitude<input value={form.longitude} onChange={(event) => patch("longitude", event.target.value)} /></label>
              <label>Скорость, км/ч<input type="number" min="0" value={form.speedKph} onChange={(event) => patch("speedKph", event.target.value)} /></label>
            </>
          ) : null}

          {kind === "depositReturn" ? (
            <>
              <label>Итоговая сумма аренды<input type="number" min="0" value={form.finalAmount} onChange={(event) => patch("finalAmount", event.target.value)} /></label>
              <label>Сумма возврата депозита<input type="number" min="0" value={form.depositAmount} onChange={(event) => patch("depositAmount", event.target.value)} /></label>
              <label>Пробег при возврате<input type="number" min="0" value={form.odometerKm} onChange={(event) => patch("odometerKm", event.target.value)} /></label>
              <label className="wide-field">Комментарий<input value={form.note} onChange={(event) => patch("note", event.target.value)} /></label>
            </>
          ) : null}

          {["contract", "customerDocument", "depositDocument", "signature", "vehicleDocument"].includes(kind) ? (
            <>
              <label className="wide-field">Название документа<input value={form.documentTitle} placeholder="Можно оставить пустым" onChange={(event) => patch("documentTitle", event.target.value)} /></label>
              {kind === "vehicleDocument" ? (
                <label>Тип документа
                  <select value={form.documentType} onChange={(event) => patch("documentType", event.target.value)}>
                    <option value="insurance">Страховка</option>
                    <option value="registration">Регистрация</option>
                    <option value="inspection">Техосмотр</option>
                    <option value="rental_contract">Договор аренды</option>
                    <option value="other">Другое</option>
                  </select>
                </label>
              ) : null}
              {kind === "customerDocument" ? (
                <label>Тип документа
                  <select value={form.documentType} onChange={(event) => patch("documentType", event.target.value)}>
                    <option value="passport">Паспорт</option>
                    <option value="id_card">ID card</option>
                    <option value="driver_license">Водительские права</option>
                    <option value="other">Другое</option>
                  </select>
                </label>
              ) : null}
            </>
          ) : null}

          {showFiles ? (
            <label className="file-drop wide-field">Файлы
              <input multiple type="file" onChange={(event) => onFiles(event.currentTarget.files)} />
              <span>{files?.length ? `Выбрано файлов: ${files.length}` : kind === "contract" ? "Можно выбрать файл или создать договор без файла" : "Выберите файл"}</span>
            </label>
          ) : null}
        </div>

        <div className="modal-actions">
          <button className="ghost-button" onClick={onClose} type="button">Отмена</button>
          <button className="primary-button" type="submit">Сохранить</button>
        </div>
      </form>
    </div>
  );
}

function VehicleForm({ form, onSubmit, setForm }: { form: Record<string, string>; onSubmit: (event: FormEvent<HTMLFormElement>) => void; setForm: (form: any) => void }) {
  return (
    <form className="live-form" onSubmit={onSubmit}>
      <h2>Добавить автомобиль</h2>
      <div className="form-grid single">
        {(["make", "model", "year", "plateNumber", "vin", "location", "odometerKm", "dailyRate"] as const).map((key) => (
          <label key={key}>{key}<input value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} /></label>
        ))}
      </div>
      <button className="primary-button full">Сохранить авто</button>
    </form>
  );
}

function CustomerForm({ form, onSubmit, setForm }: { form: Record<string, string>; onSubmit: (event: FormEvent<HTMLFormElement>) => void; setForm: (form: any) => void }) {
  return (
    <form className="live-form" onSubmit={onSubmit}>
      <h2>Добавить клиента</h2>
      <div className="form-grid single">
        {(["displayName", "email", "phone"] as const).map((key) => (
          <label key={key}>{key}<input value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} /></label>
        ))}
      </div>
      <button className="primary-button full">Сохранить клиента</button>
    </form>
  );
}

function UpcomingReturns({ customers, rentals, vehicles }: { customers: Customer[]; rentals: Rental[]; vehicles: Vehicle[] }) {
  return (
    <section className="table-panel">
      <h2>Ближайшие возвраты</h2>
      {rentals.slice(0, 4).map((rental) => {
        const vehicle = vehicles.find((item) => item.id === rental.vehicleId);
        const customer = customers.find((item) => item.id === rental.customerId);
        return <p className="history-row" key={rental.id}>{vehicle?.plateNumber} · {customer?.displayName} · {dateFmt.format(new Date(rental.returnAt))}</p>;
      })}
    </section>
  );
}

function LatestRequests({ customers, invoices }: { customers: Customer[]; invoices: Invoice[] }) {
  return (
    <section className="table-panel">
      <h2>Последние заявки</h2>
      {invoices.slice(-4).map((invoice) => {
        const customer = customers.find((item) => item.id === invoice.customerId);
        return <p className="history-row" key={invoice.id}>{invoice.invoiceNumber} · {customer?.displayName} · {money.format(invoice.total)}</p>;
      })}
    </section>
  );
}
