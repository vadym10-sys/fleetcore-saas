"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { Customer, DashboardMetrics, GpsDevice, Invoice, Payment, Rental, Vehicle, VehicleDocument } from "@fleetcore/shared";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const TENANT_ID = "tenant_atlas";

const navItems = [
  ["⌂", "Главная"],
  ["▣", "Автомобили"],
  ["♙", "Клиенты"],
  ["⌖", "Карта GPS"],
  ["◴", "Уведомления"],
  ["▤", "Отчеты"],
  ["□", "Документы"],
  ["⚙", "Настройки"],
] as const;

const notifications = [
  ["Просроченный возврат", "Toyota Camry · KA 5678 AC", "12:30", "red"],
  ["Возврат через 2 часа", "BMW X5 · AA 1234 BB", "10:00", "orange"],
  ["Оплата не внесена", "Audi A6 · CA 3456 KA", "09:15", "blue"],
  ["Депозит получен", "Mercedes C200 · AB 9876 CD", "08:30", "green"],
] as const;

type ApiEnvelope<T> = { data: T };

type AppData = {
  customers: Customer[];
  documents: VehicleDocument[];
  gpsDevices: GpsDevice[];
  invoices: Invoice[];
  metrics: DashboardMetrics;
  payments: Payment[];
  rentals: Rental[];
  vehicles: Vehicle[];
};

const emptyMetrics: DashboardMetrics = {
  activeRentals: 0,
  availableVehicles: 0,
  fleetUtilization: 0,
  monthlyRevenue: 0,
  overdueInvoices: 0,
};

const money = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

async function api<T>(path: string, options: RequestInit = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      "x-tenant-id": TENANT_ID,
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

function CarPin({ className, color, label }: { className: string; color: string; label: string }) {
  return (
    <div className={`map-pin ${className} ${color}`}>
      <span>▣</span>
      <strong>{label}</strong>
    </div>
  );
}

function MobileNav({ active, dark = false }: { active: string; dark?: boolean }) {
  const items = ["Главная", "Авто", "Клиенты", "Карта", "Уведомления"];
  return (
    <nav className={`mobile-nav ${dark ? "dark" : ""}`}>
      {items.map((item) => (
        <span className={item === active ? "active" : ""} key={item}>
          {item === "Главная" ? "⌂" : item === "Авто" ? "▣" : item === "Клиенты" ? "♙" : item === "Карта" ? "⌖" : "◴"}
          <small>{item}</small>
        </span>
      ))}
    </nav>
  );
}

export default function DashboardClient() {
  const [data, setData] = useState<AppData>({
    customers: [],
    documents: [],
    gpsDevices: [],
    invoices: [],
    metrics: emptyMetrics,
    payments: [],
    rentals: [],
    vehicles: [],
  });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("Подключаемся к backend API...");
  const [vehicleForm, setVehicleForm] = useState({
    dailyRate: "95",
    location: "Barcelona",
    make: "BMW",
    model: "X5",
    odometerKm: "1000",
    plateNumber: `WEB-${Date.now().toString().slice(-5)}`,
    vin: `WEBVIN${Date.now().toString().slice(-8)}`,
    year: "2026",
  });
  const [customerForm, setCustomerForm] = useState({
    displayName: "Новый клиент",
    email: `client-${Date.now()}@example.com`,
    phone: "+34 600 111 222",
  });

  async function loadData() {
    setLoading(true);
    const [metrics, vehicles, customers, rentals, invoices, payments, gpsDevices, documents] = await Promise.all([
      api<DashboardMetrics>("/dashboard"),
      api<Vehicle[]>("/fleet/vehicles"),
      api<Customer[]>("/customers"),
      api<Rental[]>("/rentals"),
      api<Invoice[]>("/finance/invoices"),
      api<Payment[]>("/finance/payments"),
      api<GpsDevice[]>("/gps/devices"),
      api<VehicleDocument[]>("/documents/vehicles"),
    ]);

    setData({
      customers: customers.data,
      documents: documents.data,
      gpsDevices: gpsDevices.data,
      invoices: invoices.data,
      metrics: metrics.data,
      payments: payments.data,
      rentals: rentals.data,
      vehicles: vehicles.data,
    });
    setLoading(false);
    setMessage("Данные загружены из PostgreSQL через backend API");
  }

  useEffect(() => {
    loadData().catch((error: unknown) => {
      setLoading(false);
      setMessage(error instanceof Error ? error.message : "Не удалось загрузить данные");
    });
  }, []);

  const activeVehicle = data.vehicles[0];
  const activeCustomer = data.customers[0];
  const activeRental = data.rentals[0];
  const activeInvoice = data.invoices.find((invoice) => invoice.status !== "paid") ?? data.invoices[0];

  const gpsStats = useMemo(
    () => [
      ["Всего автомобилей", String(data.vehicles.length), "100%", "blue"],
      ["В движении", String(data.vehicles.filter((vehicle) => vehicle.status === "rented").length), `${data.metrics.fleetUtilization}%`, "green"],
      ["Свободно", String(data.metrics.availableVehicles), "готовы", "blue"],
      ["Просрочено счетов", String(data.metrics.overdueInvoices), "важно", "red"],
    ] as const,
    [data.metrics, data.vehicles],
  );

  async function submitCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      setMessage("Создаем клиента...");
      await api<Customer>("/customers", {
        body: JSON.stringify({
          ...customerForm,
          riskLevel: "low",
          type: "business",
        }),
        method: "POST",
      });
      setCustomerForm((current) => ({
        ...current,
        displayName: "Новый клиент",
        email: `client-${Date.now()}@example.com`,
      }));
      await loadData();
      setMessage("Клиент сохранен в PostgreSQL");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось сохранить клиента");
    }
  }

  async function submitVehicle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      setMessage("Создаем автомобиль...");
      await api<Vehicle>("/fleet/vehicles", {
        body: JSON.stringify({
          dailyRate: Number(vehicleForm.dailyRate),
          location: vehicleForm.location,
          make: vehicleForm.make,
          model: vehicleForm.model,
          odometerKm: Number(vehicleForm.odometerKm),
          plateNumber: vehicleForm.plateNumber,
          status: "available",
          vin: vehicleForm.vin,
          year: Number(vehicleForm.year),
        }),
        method: "POST",
      });
      setVehicleForm((current) => ({
        ...current,
        plateNumber: `WEB-${Date.now().toString().slice(-5)}`,
        vin: `WEBVIN${Date.now().toString().slice(-8)}`,
      }));
      await loadData();
      setMessage("Автомобиль сохранен в PostgreSQL");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось сохранить автомобиль");
    }
  }

  async function returnActiveRental() {
    if (!activeRental || !activeVehicle) return;

    try {
      setMessage("Закрываем аренду...");
      await api<Rental>(`/rentals/${activeRental.id}/return`, {
        body: JSON.stringify({
          finalAmount: activeRental.totalAmount,
          odometerKm: activeVehicle.odometerKm + 25,
        }),
        method: "POST",
      });
      await loadData();
      setMessage("Аренда закрыта, автомобиль снова доступен");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось закрыть аренду");
    }
  }

  async function payActiveInvoice() {
    if (!activeInvoice) return;

    try {
      setMessage("Проводим оплату...");
      await api<Payment>(`/finance/invoices/${activeInvoice.id}/payments`, {
        body: JSON.stringify({
          amount: activeInvoice.total,
          currency: activeInvoice.currency,
          method: "manual",
          reference: `UI-${Date.now()}`,
        }),
        method: "POST",
      });
      await loadData();
      setMessage("Платеж сохранен, счет обновлен");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось провести оплату");
    }
  }

  async function connectGps() {
    if (!activeVehicle) return;

    try {
      setMessage("Подключаем GPS...");
      await api<GpsDevice>("/gps/devices", {
        body: JSON.stringify({
          externalDeviceId: `device-${activeVehicle.id}`,
          latitude: 41.3874,
          longitude: 2.1686,
          provider: "traccar",
          speedKph: activeVehicle.status === "rented" ? 72 : 0,
          status: activeVehicle.status === "rented" ? "online" : "idle",
          vehicleId: activeVehicle.id,
        }),
        method: "POST",
      });
      await loadData();
      setMessage("GPS-устройство подключено");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось подключить GPS");
    }
  }

  async function addVehicleDocument() {
    if (!activeVehicle) return;

    try {
      setMessage("Добавляем документ...");
      await api<VehicleDocument>("/documents/vehicles", {
        body: JSON.stringify({
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          fileUrl: "https://example.com/fleetcore/demo-insurance.pdf",
          title: `Страховка ${activeVehicle.plateNumber}`,
          type: "insurance",
          vehicleId: activeVehicle.id,
        }),
        method: "POST",
      });
      await loadData();
      setMessage("Документ автомобиля сохранен");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось добавить документ");
    }
  }

  return (
    <main className="product-shell">
      <aside className="desktop-sidebar">
        <div className="profile">
          <div className="avatar">И</div>
          <div>
            <strong>Иван Петров</strong>
            <span>Best Rent Cars</span>
          </div>
          <button title="Workspace">⌄</button>
        </div>

        <nav className="side-nav">
          {navItems.map(([icon, label]) => (
            <a className={label === "Карта GPS" ? "active" : ""} href={`#${label}`} key={label}>
              <span>{icon}</span>
              {label}
              {label === "Уведомления" ? <em>3</em> : null}
            </a>
          ))}
        </nav>

        <div className="plan-card">
          <span>Тариф Business</span>
          <strong>€499 <small>/ месяц</small></strong>
          <div className="usage"><i /></div>
          <button>Управление подпиской</button>
        </div>
      </aside>

      <section className="desktop-workspace">
        <header className="desktop-header">
          <div>
            <h1>Карта GPS</h1>
            <p className="api-status">{loading ? "Загрузка..." : message}</p>
          </div>
          <div className="header-actions">
            <button className="ghost-button" onClick={() => void loadData()}>↻ Обновить</button>
            <button className="primary-button">⊕ Подключить GPS</button>
            <button className="icon-button">◴<span /></button>
          </div>
        </header>

        <section className="gps-layout">
          <div className="gps-main">
            <div className="gps-stat-grid">
              {gpsStats.map(([label, value, percent, tone]) => (
                <article className="stat-card" key={label}>
                  <span>{label}</span>
                  <strong className={tone}>{value}</strong>
                  <small>{percent}</small>
                </article>
              ))}
            </div>

            <div className="map-card large-map">
              <CarPin className="pin-one" color="green" label={data.vehicles[0]?.model ?? "Vehicle"} />
              <CarPin className="pin-two" color="blue" label={data.vehicles[1]?.model ?? "Vehicle"} />
              <CarPin className="pin-three" color="red" label={data.vehicles[2]?.model ?? "Vehicle"} />
              <CarPin className="pin-four" color="orange" label={data.vehicles[3]?.model ?? "Vehicle"} />
              <div className="map-controls">
                <button>⌖</button>
                <button>＋</button>
                <button>−</button>
              </div>
              <div className="map-label">Барселона</div>
            </div>
          </div>

          <aside className="gps-connect-panel">
            <div className="panel-title">
              <h2>Подключение GPS</h2>
              <button>×</button>
            </div>
            <div className="step">
              <strong>1. Выберите способ подключения</strong>
              <div className="choice-grid">
                <article className="choice-card selected">
                  <span>●</span>
                  <strong>У меня уже есть GPS-платформа</strong>
                  <small>Подключите через API за 2 минуты</small>
                </article>
                <article className="choice-card">
                  <span>○</span>
                  <strong>У меня есть GPS-трекер</strong>
                  <small>Подключите трекер напрямую к системе</small>
                </article>
              </div>
            </div>
            <div className="step">
              <strong>2. Выберите платформу</strong>
              <div className="platform-grid">
                <button>Wialon</button>
                <button className="selected">Traccar</button>
                <button>Navixy</button>
              </div>
            </div>
            <button className="primary-button full">Далее</button>
          </aside>
        </section>

        <section className="live-forms" id="Главная">
          <form className="live-form" onSubmit={(event) => void submitVehicle(event)}>
            <div className="section-title compact-title">
              <h2>Добавить автомобиль</h2>
              <Badge value="PostgreSQL" />
            </div>
            <div className="form-grid">
              <label>Марка<input value={vehicleForm.make} onChange={(event) => setVehicleForm({ ...vehicleForm, make: event.target.value })} /></label>
              <label>Модель<input value={vehicleForm.model} onChange={(event) => setVehicleForm({ ...vehicleForm, model: event.target.value })} /></label>
              <label>Год<input type="number" value={vehicleForm.year} onChange={(event) => setVehicleForm({ ...vehicleForm, year: event.target.value })} /></label>
              <label>Номер<input value={vehicleForm.plateNumber} onChange={(event) => setVehicleForm({ ...vehicleForm, plateNumber: event.target.value })} /></label>
              <label>VIN<input value={vehicleForm.vin} onChange={(event) => setVehicleForm({ ...vehicleForm, vin: event.target.value })} /></label>
              <label>Локация<input value={vehicleForm.location} onChange={(event) => setVehicleForm({ ...vehicleForm, location: event.target.value })} /></label>
              <label>Пробег<input type="number" value={vehicleForm.odometerKm} onChange={(event) => setVehicleForm({ ...vehicleForm, odometerKm: event.target.value })} /></label>
              <label>Цена/день<input type="number" value={vehicleForm.dailyRate} onChange={(event) => setVehicleForm({ ...vehicleForm, dailyRate: event.target.value })} /></label>
            </div>
            <button className="primary-button full">Сохранить авто</button>
          </form>

          <form className="live-form" onSubmit={(event) => void submitCustomer(event)}>
            <div className="section-title compact-title">
              <h2>Добавить клиента</h2>
              <Badge value="API" />
            </div>
            <div className="form-grid single">
              <label>Имя<input value={customerForm.displayName} onChange={(event) => setCustomerForm({ ...customerForm, displayName: event.target.value })} /></label>
              <label>Email<input value={customerForm.email} onChange={(event) => setCustomerForm({ ...customerForm, email: event.target.value })} /></label>
              <label>Телефон<input value={customerForm.phone} onChange={(event) => setCustomerForm({ ...customerForm, phone: event.target.value })} /></label>
            </div>
            <button className="primary-button full">Сохранить клиента</button>
          </form>

          <div className="live-form">
            <div className="section-title compact-title">
              <h2>Операции MVP</h2>
              <Badge value="JWT roles" />
            </div>
            <div className="ops-grid">
              <button className="ghost-button" onClick={() => void returnActiveRental()} type="button">Закрыть аренду</button>
              <button className="ghost-button" onClick={() => void payActiveInvoice()} type="button">Оплатить счет</button>
              <button className="ghost-button" onClick={() => void connectGps()} type="button">Подключить GPS</button>
              <button className="ghost-button" onClick={() => void addVehicleDocument()} type="button">Добавить документ</button>
            </div>
            <div className="ops-summary">
              <span>Платежи: <strong>{data.payments.length}</strong></span>
              <span>GPS: <strong>{data.gpsDevices.length}</strong></span>
              <span>Документы: <strong>{data.documents.length}</strong></span>
            </div>
          </div>
        </section>
      </section>

      <section className="mobile-showcase">
        <article className="phone-screen">
          <div className="phone-status"><span>9:41</span><span>▰ ▱</span></div>
          <div className="mobile-header">
            <div className="profile compact">
              <div className="avatar small">И</div>
              <div><strong>Иван Петров</strong><span>Best Rent Cars</span></div>
            </div>
            <button className="bell">◴<i /></button>
          </div>
          <h2>Сегодня</h2>
          <div className="mini-grid">
            <article><strong>{data.vehicles.filter((vehicle) => vehicle.status === "rented").length}</strong><span>В аренде</span></article>
            <article><strong>{data.metrics.availableVehicles}</strong><span>Свободно</span></article>
            <article><strong>{data.rentals.length}</strong><span>Брони</span></article>
            <article><strong>{money.format(data.metrics.monthlyRevenue)}</strong><span>Доход</span></article>
          </div>
          <div className="mobile-list">
            <h3>Ближайшие события <a>Все</a></h3>
            {notifications.slice(0, 3).map(([title, meta, time, tone]) => (
              <div className="event-row" key={title}>
                <i className={tone} />
                <div><strong>{title}</strong><span>{meta}</span></div>
                <time>{time}</time>
              </div>
            ))}
          </div>
          <MobileNav active="Главная" />
        </article>

        <article className="phone-screen dark-map">
          <div className="phone-status"><span>9:41</span><span>▰ ▱</span></div>
          <div className="map-top"><button>☰</button><strong>Карта и авто</strong><button>⌁</button></div>
          <div className="chip-row"><span>Все авто {data.vehicles.length}</span><span>В аренде {data.vehicles.filter((vehicle) => vehicle.status === "rented").length}</span></div>
          <div className="night-map">
            <CarPin className="pin-one" color="green" label={data.vehicles[0]?.model ?? "Auto"} />
            <CarPin className="pin-two" color="blue" label={data.vehicles[1]?.model ?? "Auto"} />
            <CarPin className="pin-four" color="orange" label={data.vehicles[2]?.model ?? "Auto"} />
          </div>
          <div className="vehicle-feed">
            {data.vehicles.slice(0, 4).map((vehicle) => (
              <div className="feed-row" key={vehicle.id}>
                <VehicleArt tone="dark" />
                <div><strong>{vehicle.make} {vehicle.model}</strong><span>{vehicle.plateNumber}</span></div>
                <small>{vehicle.status === "rented" ? "В движении" : "На месте"}</small>
              </div>
            ))}
          </div>
          <MobileNav active="Карта" dark />
        </article>

        <article className="phone-screen">
          <div className="phone-status"><span>9:41</span><span>▰ ▱</span></div>
          <div className="mobile-title"><button>‹</button><h2>{activeVehicle ? `${activeVehicle.make} ${activeVehicle.model}` : "Авто"}</h2><button>⋯</button></div>
          <VehicleArt />
          {activeVehicle ? <Badge value={activeVehicle.status === "available" ? "Свободно" : "В аренде"} /> : null}
          <h3>{activeVehicle?.plateNumber ?? "Нет авто"} · {activeVehicle?.year ?? ""}</h3>
          <div className="detail-grid">
            <article><span>Год</span><strong>{activeVehicle?.year ?? "-"}</strong></article>
            <article><span>Пробег</span><strong>{activeVehicle?.odometerKm.toLocaleString() ?? "-"} км</strong></article>
            <article><span>Цена</span><strong>{money.format(activeVehicle?.dailyRate ?? 0)}</strong></article>
            <article><span>Клиент</span><strong>{activeCustomer?.displayName ?? "-"}</strong></article>
            <article><span>Депозит</span><strong>{money.format(activeRental?.depositAmount ?? 0)}</strong></article>
            <article><span>Бронь</span><strong>{activeRental?.status ?? "-"}</strong></article>
          </div>
          <button className="success-button">Вернуть авто</button>
        </article>
      </section>

      <section className="data-section">
        <div className="section-title">
          <h2>Автомобили</h2>
          <button>＋</button>
        </div>
        <div className="data-grid">
          <div className="table-panel">
            {data.vehicles.map((vehicle) => {
              const rental = data.rentals.find((item) => item.vehicleId === vehicle.id);
              const customer = data.customers.find((item) => item.id === rental?.customerId);
              return (
                <article className="vehicle-row" key={vehicle.id}>
                  <VehicleArt />
                  <div>
                    <strong>{vehicle.make} {vehicle.model}</strong>
                    <span>{vehicle.plateNumber}</span>
                    <small>{customer?.displayName ?? "Без клиента"}</small>
                  </div>
                  <Badge value={vehicle.status === "maintenance" ? "На ТО" : vehicle.status === "available" ? "Свободно" : "В аренде"} />
                </article>
              );
            })}
          </div>

          <div className="table-panel">
            <div className="section-title compact-title"><h2>Клиенты и финансы</h2></div>
            {data.customers.slice(-5).map((customer) => (
              <article className="finance-row" key={customer.id}>
                <div><strong>{customer.displayName}</strong><span>{customer.email}</span></div>
                <Badge value={customer.riskLevel} />
              </article>
            ))}
            {data.invoices.map((invoice) => {
              const customer = data.customers.find((item) => item.id === invoice.customerId);
              return (
                <article className="finance-row" key={invoice.id}>
                  <div><strong>{invoice.invoiceNumber}</strong><span>{customer?.displayName}</span></div>
                  <Badge value={invoice.status} />
                  <strong>{money.format(invoice.total)}</strong>
                </article>
              );
            })}
          </div>
        </div>
      </section>
    </main>
  );
}
