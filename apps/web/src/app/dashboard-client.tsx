"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { AuthSession, Customer, CustomerDocument, DashboardMetrics, Expense, GpsDevice, Invoice, Payment, Rental, RentalContract, ServiceRecord, Vehicle, VehicleDocument } from "@fleetcore/shared";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const TENANT_ID = "tenant_atlas";

type ApiEnvelope<T> = { data: T };
type Section = "Dashboard" | "Vehicles" | "Drivers/Clients" | "Bookings" | "Finance" | "Service" | "Settings";

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

const sections: Section[] = ["Dashboard", "Vehicles", "Drivers/Clients", "Bookings", "Finance", "Service", "Settings"];

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
    throw new Error(body || `Request failed: ${response.status}`);
  }

  return (await response.json()) as ApiEnvelope<T>;
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

function documentUrlForFile(file: File) {
  return `https://fleetcore.local/uploads/${encodeURIComponent(`${Date.now()}-${file.name}`)}`;
}

function documentTypeFromName(name: string): "insurance" | "registration" | "inspection" | "rental_contract" | "other" {
  const normalized = name.toLowerCase();
  if (normalized.includes("insurance") || normalized.includes("страх")) return "insurance";
  if (normalized.includes("registration") || normalized.includes("регистр")) return "registration";
  if (normalized.includes("inspection") || normalized.includes("то") || normalized.includes("tech")) return "inspection";
  if (normalized.includes("contract") || normalized.includes("договор")) return "rental_contract";
  return "other";
}

function AuthScreen({ onSession }: { onSession: (session: AuthSession) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("Войдите как владелец компании или создайте B2B-аккаунт.");
  const [login, setLogin] = useState({ email: "founder@atlas.example", password: "development-only" });
  const [register, setRegister] = useState({
    country: "PL",
    currency: "EUR",
    email: `owner-${Date.now().toString().slice(-5)}@rent.example`,
    fleetSizeLimit: "25",
    fullName: "Иван Петров",
    legalName: "Best Rent Cars Sp. z o.o.",
    password: "secure-pass-123",
    plan: "starter",
    tradingName: "Best Rent Cars",
  });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(mode === "login" ? "Проверяем доступ..." : "Создаем компанию...");
    try {
      const response = mode === "login"
        ? await api<AuthSession>("/auth/login", { body: JSON.stringify(login), method: "POST" })
        : await api<AuthSession>("/auth/register-company", {
            body: JSON.stringify({
              company: {
                country: register.country,
                currency: register.currency,
                fleetSizeLimit: Number(register.fleetSizeLimit),
                legalName: register.legalName,
                plan: register.plan,
                tradingName: register.tradingName,
              },
              owner: {
                email: register.email,
                fullName: register.fullName,
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

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div>
          <span className="auth-kicker">FleetCore SaaS</span>
          <h1>{mode === "login" ? "Вход в аккаунт компании" : "Регистрация B2B-компании"}</h1>
          <p>{message}</p>
        </div>
        <div className="auth-tabs">
          <button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")} type="button">Вход</button>
          <button className={mode === "register" ? "active" : ""} onClick={() => setMode("register")} type="button">Новая компания</button>
        </div>
        <form className="auth-form" onSubmit={(event) => void submit(event)}>
          {mode === "login" ? (
            <>
              <label>Email<input value={login.email} onChange={(event) => setLogin({ ...login, email: event.target.value })} /></label>
              <label>Пароль<input type="password" value={login.password} onChange={(event) => setLogin({ ...login, password: event.target.value })} /></label>
            </>
          ) : (
            <>
              <label>Название бизнеса<input value={register.tradingName} onChange={(event) => setRegister({ ...register, tradingName: event.target.value })} /></label>
              <label>Юридическое имя<input value={register.legalName} onChange={(event) => setRegister({ ...register, legalName: event.target.value })} /></label>
              <div className="auth-two">
                <label>Страна<input value={register.country} onChange={(event) => setRegister({ ...register, country: event.target.value.toUpperCase().slice(0, 2) })} /></label>
                <label>Валюта<input value={register.currency} onChange={(event) => setRegister({ ...register, currency: event.target.value.toUpperCase().slice(0, 3) })} /></label>
              </div>
              <label>Лимит автопарка<input type="number" value={register.fleetSizeLimit} onChange={(event) => setRegister({ ...register, fleetSizeLimit: event.target.value })} /></label>
              <label>Имя владельца<input value={register.fullName} onChange={(event) => setRegister({ ...register, fullName: event.target.value })} /></label>
              <label>Email владельца<input value={register.email} onChange={(event) => setRegister({ ...register, email: event.target.value })} /></label>
              <label>Пароль<input type="password" value={register.password} onChange={(event) => setRegister({ ...register, password: event.target.value })} /></label>
            </>
          )}
          <button className="primary-button full" disabled={loading}>{loading ? "Подождите..." : mode === "login" ? "Войти" : "Создать аккаунт"}</button>
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
  const [session, setSession] = useState<AuthSession | undefined>();
  const [activeSection, setActiveSection] = useState<Section>("Dashboard");
  const [search, setSearch] = useState("");
  const [mapFilter, setMapFilter] = useState<"all" | "available" | "rented" | "maintenance" | "offline">("all");
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("Подключаемся к backend API...");
  const [busyAction, setBusyAction] = useState<string | undefined>();
  const vehicleDocumentInputRef = useRef<HTMLInputElement>(null);
  const vehicleFolderInputRef = useRef<HTMLInputElement>(null);
  const customerDocumentInputRef = useRef<HTMLInputElement>(null);
  const customerFolderInputRef = useRef<HTMLInputElement>(null);
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

  useEffect(() => {
    const stored = localStorage.getItem("fleetcore-session");
    if (stored) {
      setSession(JSON.parse(stored) as AuthSession);
    }
  }, []);

  async function loadData(currentToken = token) {
    setLoading(true);
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
    setLoading(false);
    setMessage("Данные загружены из PostgreSQL через backend API");
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
    ["Всего автомобилей", data.vehicles.length, "blue"],
    ["Свободно сейчас", data.vehicles.filter((vehicle) => vehicle.status === "available").length, "green"],
    ["В аренде", data.vehicles.filter((vehicle) => vehicle.status === "rented").length, "blue"],
    ["На сервисе", data.vehicles.filter((vehicle) => vehicle.status === "maintenance").length, "black"],
    ["Доход за месяц", money.format(data.metrics.monthlyRevenue), "green"],
    ["Доход сегодня", money.format(incomeToday), "green"],
  ] as const;

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
      await Promise.all(Array.from(files).map((file) => api<VehicleDocument>("/documents/vehicles", {
        body: JSON.stringify({
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          fileUrl: documentUrlForFile(file),
          title: file.name,
          type: documentTypeFromName(file.name),
          vehicleId: vehicle.id,
        }),
        method: "POST",
      }, token)));
      await loadData();
      setMessage(`Загружено документов авто: ${files.length}`);
    });
  }

  async function saveCustomerFiles(files: FileList | null) {
    if (!files?.length) return;
    await runAction(`Загружаем документы клиента: ${files.length}`, async () => {
      const customer = await ensureCustomer();
      await Promise.all(Array.from(files).map((file) => api<CustomerDocument>("/operations/customer-documents", {
        body: JSON.stringify({
          customerId: customer.id,
          fileUrl: documentUrlForFile(file),
          title: file.name,
          type: file.name.toLowerCase().includes("license") ? "driver_license" : "passport",
          verified: false,
        }),
        method: "POST",
      }, token)));
      await loadData();
      setMessage(`Загружено документов клиента: ${files.length}`);
    });
  }

  function requestVehicleDocumentUpload() {
    vehicleDocumentInputRef.current?.click();
  }

  function requestVehicleFolderUpload() {
    vehicleFolderInputRef.current?.click();
  }

  function requestCustomerDocumentUpload() {
    customerDocumentInputRef.current?.click();
  }

  function requestCustomerFolderUpload() {
    customerFolderInputRef.current?.click();
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

  async function sendRentalContract() {
    await runAction("Отправляем договор...", async () => {
      const rental = await ensureRental();
      await api<RentalContract>("/operations/rental-contracts", {
        body: JSON.stringify({
          documentUrl: `https://fleetcore.local/contracts/${rental.id}.pdf`,
          rentalId: rental.id,
          sentVia: "whatsapp",
          status: "sent",
        }),
        method: "POST",
      }, token);
      await loadData();
      setMessage("Договор отправлен через WhatsApp");
    });
  }

  function logout() {
    localStorage.removeItem("fleetcore-session");
    setSession(undefined);
  }

  if (!session) {
    return <AuthScreen onSession={setSession} />;
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
              <span>{item === "Dashboard" ? "⌂" : item === "Vehicles" ? "▣" : item === "Finance" ? "€" : item === "Service" ? "◷" : item === "Settings" ? "⚙" : "♙"}</span>
              {item}
              {item === "Service" && notifications.length ? <em>{notifications.length}</em> : null}
            </button>
          ))}
        </nav>
        <div className="plan-card">
          <span>Тариф {session.user.role === "owner" ? "Business" : "Team"}</span>
          <strong>€499 <small>/ месяц</small></strong>
          <div className="usage"><i /></div>
          <button type="button">Управление подпиской</button>
        </div>
      </aside>

      <section className="desktop-workspace">
        <header className="desktop-header">
          <div>
            <h1>{activeSection}</h1>
            <p className="api-status">{loading ? "Загрузка..." : message}</p>
          </div>
          <div className="header-actions">
            <label className="global-search">
              <span>⌕</span>
              <input placeholder="Номер, VIN, клиент, телефон" value={search} onChange={(event) => setSearch(event.target.value)} />
            </label>
            <button className="ghost-button" disabled={Boolean(busyAction)} onClick={() => void loadData()} type="button">↻</button>
            <button className="primary-button" disabled={Boolean(busyAction)} onClick={() => void connectGps()} type="button">{busyAction ? "..." : "⊕ GPS"}</button>
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
              <MapPanel vehicles={filteredVehicles} rentals={data.rentals} selectedVehicleId={selectedVehicle?.id} onSelect={setSelectedVehicleId} />
              <section className="split-panels">
                <UpcomingReturns rentals={data.rentals} vehicles={data.vehicles} customers={data.customers} />
                <LatestRequests customers={data.customers} invoices={data.invoices} />
              </section>
            </div>
            <aside className="side-column">
              <NotificationsPanel notifications={notifications} />
              <VehicleCard vehicle={selectedVehicle} rental={activeRental} customer={activeCustomer} documents={data.documents} finance={finance.incomeByVehicle.find((item) => item.vehicle.id === selectedVehicle?.id)} serviceRecords={data.serviceRecords} onDocument={requestVehicleDocumentUpload} onExpense={() => void createExpenseForVehicle()} onService={() => void createServiceForVehicle()} />
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
              <VehicleCard vehicle={selectedVehicle} rental={activeRental} customer={activeCustomer} documents={data.documents} finance={finance.incomeByVehicle.find((item) => item.vehicle.id === selectedVehicle?.id)} serviceRecords={data.serviceRecords} onDocument={requestVehicleDocumentUpload} onExpense={() => void createExpenseForVehicle()} onService={() => void createServiceForVehicle()} />
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
            <button className="primary-button" disabled={Boolean(busyAction)} onClick={() => void createQuickBooking()} type="button">Создать быструю бронь</button>
            <button className="ghost-button" disabled={Boolean(busyAction)} onClick={() => void sendRentalContract()} type="button">Отправить договор WhatsApp</button>
            {data.rentals.map((rental) => {
              const vehicle = data.vehicles.find((item) => item.id === rental.vehicleId);
              const customer = data.customers.find((item) => item.id === rental.customerId);
              return (
                <article className="booking-card" key={rental.id}>
                  <div><strong>{customer?.displayName}</strong><span>{vehicle?.make} {vehicle?.model} · {vehicle?.plateNumber}</span></div>
                  <Badge value={rental.status} />
                  <span>Депозит {money.format(rental.depositAmount)}</span>
                  <span>Возврат {dateFmt.format(new Date(rental.returnAt))}</span>
                </article>
              );
            })}
          </section>
        ) : null}

        {activeSection === "Finance" ? (
          <section className="finance-layout">
            <article className="metric-card"><span>Доход</span><strong className="green">{money.format(finance.totalIncome)}</strong></article>
            <article className="metric-card"><span>Расходы</span><strong className="red">{money.format(finance.expenses)}</strong></article>
            <article className="metric-card"><span>Чистая прибыль</span><strong className="blue">{money.format(finance.netProfit)}</strong></article>
            <button className="primary-button" disabled={Boolean(busyAction)} onClick={() => void payActiveInvoice()} type="button">Провести оплату</button>
            <button className="ghost-button" disabled={Boolean(busyAction)} onClick={() => void createExpenseForVehicle()} type="button">Добавить расход</button>
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
              <button className="ghost-button full-button" disabled={Boolean(busyAction)} onClick={() => void createServiceForVehicle()} type="button">Создать ТО</button>
            </div>
          </section>
        ) : null}

        {activeSection === "Settings" ? (
          <section className="settings-grid">
            <ActionCard title="Электронный договор аренды" text={`${data.rentalContracts.length} договоров`} onClick={() => void sendRentalContract()} />
            <ActionCard title="Загрузка паспорта/ID клиента" text={`${data.customerDocuments.length} документов`} onClick={requestCustomerDocumentUpload} />
            <ActionCard title="Загрузка папки клиента" text="Можно выбрать всю папку с документами" onClick={requestCustomerFolderUpload} />
            <ActionCard title="Депозит и возврат депозита" text="Депозит хранится в бронировании" onClick={() => void returnActiveRental()} />
            <ActionCard title="WhatsApp-интеграция" text="Отправка договора через API" onClick={() => void sendRentalContract()} />
            <ActionCard title="Автоотправка договора" text="Создает запись договора" onClick={() => void sendRentalContract()} />
            <ActionCard title="Электронная подпись" text="Статус signed готов в модели" onClick={() => void sendRentalContract()} />
          </section>
        ) : null}
      </section>

      <MobileAppNav activeSection={activeSection} notificationsCount={notifications.length} onSelect={setActiveSection} />
    </main>
  );
}

function MobileAppNav({ activeSection, notificationsCount, onSelect }: { activeSection: Section; notificationsCount: number; onSelect: (section: Section) => void }) {
  return (
    <nav className="mobile-app-nav" aria-label="Mobile app navigation">
      {sections.map((item) => (
        <button className={activeSection === item ? "active" : ""} key={item} onClick={() => onSelect(item)} type="button">
          <span>{item === "Dashboard" ? "⌂" : item === "Vehicles" ? "▣" : item === "Finance" ? "€" : item === "Service" ? "◷" : item === "Settings" ? "⚙" : "♙"}</span>
          <small>{item === "Drivers/Clients" ? "Clients" : item}</small>
          {item === "Service" && notificationsCount ? <em>{notificationsCount}</em> : null}
        </button>
      ))}
    </nav>
  );
}

function MapPanel({ onSelect, selectedVehicleId, vehicles, rentals }: { onSelect: (id: string) => void; selectedVehicleId: string | undefined; vehicles: Vehicle[]; rentals: Rental[] }) {
  return (
    <section className="map-card large-map business-map">
      {vehicles.slice(0, 8).map((vehicle, index) => {
        const rental = rentals.find((item) => item.vehicleId === vehicle.id && item.status !== "closed");
        return (
          <button className={`map-pin pin-${(index % 5) + 1} ${statusTone(vehicle, rental)} ${selectedVehicleId === vehicle.id ? "selected" : ""}`} key={vehicle.id} onClick={() => onSelect(vehicle.id)} type="button">
            <span>▣</span>
            <strong>{vehicle.plateNumber}</strong>
          </button>
        );
      })}
      <div className="map-controls"><button>⌖</button><button>＋</button><button>−</button></div>
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

function ActionCard({ onClick, text, title }: { onClick: () => void; text: string; title: string }) {
  return (
    <button className="integration-card action-card" onClick={onClick} type="button">
      <strong>{title}</strong>
      <span>{text}</span>
    </button>
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
