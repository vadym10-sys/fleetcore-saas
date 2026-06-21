"use client";

import type {
  Customer,
  CustomerDocument,
  GpsDevice,
  Invoice,
  Payment,
  Rental,
  RentalChecklist,
  RentalContract,
  RentalContractEvent,
  RentalFlow,
  Vehicle,
  VehicleDocument,
} from "@fleetcore/shared";

type Tone = "green" | "blue" | "orange" | "red" | "black";

type CommandAction = {
  label: string;
  onClick: () => void;
  tone?: Tone;
};

type CommandCenterDashboardProps = {
  checklists: RentalChecklist[];
  contracts: RentalContract[];
  contractEvents: RentalContractEvent[];
  customerDocuments: CustomerDocument[];
  customers: Customer[];
  documents: VehicleDocument[];
  gpsDevices: GpsDevice[];
  invoices: Invoice[];
  onCreateBooking: () => void;
  onCreateCustomer: () => void;
  onOpenDocuments: () => void;
  onOpenFinance: () => void;
  onOpenRental: (rental: Rental) => void;
  onOpenVehicles: () => void;
  payments: Payment[];
  rentalFlows: RentalFlow[];
  rentals: Rental[];
  vehicles: Vehicle[];
};

type WorkflowStep = {
  action: CommandAction;
  detail: string;
  key: string;
  label: string;
  status: "done" | "current" | "blocked" | "pending";
  value: number;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru", { day: "2-digit", month: "short" }).format(new Date(value));
}

function uniqueBy<T>(items: T[], getKey: (item: T) => string) {
  return items.filter((item, index, list) => list.findIndex((candidate) => getKey(candidate) === getKey(item)) === index);
}

export function CommandCenterDashboard({
  checklists,
  contracts,
  contractEvents,
  customerDocuments,
  customers,
  documents,
  gpsDevices,
  invoices,
  onCreateBooking,
  onCreateCustomer,
  onOpenDocuments,
  onOpenFinance,
  onOpenRental,
  onOpenVehicles,
  payments,
  rentalFlows,
  rentals,
  vehicles,
}: CommandCenterDashboardProps) {
  const now = Date.now();
  const activeRentals = rentals.filter((rental) => rental.status !== "closed");
  const overdueRentals = activeRentals.filter((rental) => new Date(rental.returnAt).getTime() < now);
  const unsignedContracts = contracts.filter((contract) => contract.status !== "signed");
  const unpaidInvoices = invoices.filter((invoice) => invoice.status === "issued" || invoice.status === "overdue");
  const missingVehicleDocs = vehicles.filter((vehicle) => !documents.some((document) => document.vehicleId === vehicle.id));
  const clientsWithoutDocs = customers.filter((customer) => !customerDocuments.some((document) => document.customerId === customer.id));
  const pickupMissing = activeRentals.filter((rental) => !checklists.some((checklist) => checklist.rentalId === rental.id && checklist.phase === "pickup"));
  const returnMissing = overdueRentals.filter((rental) => !checklists.some((checklist) => checklist.rentalId === rental.id && checklist.phase === "return"));
  const offlineGps = gpsDevices.filter((device) => device.status !== "online" || now - new Date(device.lastSignalAt).getTime() > 2 * 60 * 60 * 1000);

  const workflow: WorkflowStep[] = [
    {
      action: { label: "Создать бронь", onClick: onCreateBooking },
      detail: `${activeRentals.length} активных аренд`,
      key: "booking",
      label: "Бронирование",
      status: activeRentals.length ? "done" : "current",
      value: activeRentals.length,
    },
    {
      action: { label: "Добавить клиента", onClick: onCreateCustomer },
      detail: `${clientsWithoutDocs.length} клиентов без документов`,
      key: "client",
      label: "Клиент",
      status: clientsWithoutDocs.length ? "current" : "done",
      value: customers.length,
    },
    {
      action: { label: "Открыть автопарк", onClick: onOpenVehicles },
      detail: `${missingVehicleDocs.length} авто без обязательных документов`,
      key: "vehicle",
      label: "Автомобиль",
      status: missingVehicleDocs.length ? "blocked" : "done",
      value: vehicles.length,
    },
    {
      action: { label: "Открыть документы", onClick: onOpenDocuments },
      detail: `${unsignedContracts.length} договоров не подписаны`,
      key: "contract",
      label: "Договор",
      status: unsignedContracts.length ? "current" : "done",
      value: unsignedContracts.length,
    },
    {
      action: { label: "Открыть финансы", onClick: onOpenFinance },
      detail: `${unpaidInvoices.length} счетов ждут оплаты`,
      key: "payment",
      label: "Оплата",
      status: unpaidInvoices.some((invoice) => invoice.status === "overdue") ? "blocked" : unpaidInvoices.length ? "current" : "done",
      value: unpaidInvoices.length,
    },
    {
      action: { label: "Проверить выдачи", onClick: () => pickupMissing[0] ? onOpenRental(pickupMissing[0]) : onCreateBooking() },
      detail: `${pickupMissing.length} выдач без чеклиста`,
      key: "pickup",
      label: "Выдача",
      status: pickupMissing.length ? "current" : "done",
      value: pickupMissing.length,
    },
    {
      action: { label: "Закрыть возврат", onClick: () => returnMissing[0] ? onOpenRental(returnMissing[0]) : onCreateBooking() },
      detail: `${returnMissing.length} возвратов требуют закрытия`,
      key: "return",
      label: "Возврат",
      status: returnMissing.length ? "blocked" : "done",
      value: returnMissing.length,
    },
  ];

  const fallbackStep = workflow[0];
  if (!fallbackStep) return null;
  const nextStep = workflow.find((step) => step.status === "blocked") ?? workflow.find((step) => step.status === "current") ?? fallbackStep;
  const recommendedRental = overdueRentals[0] ?? pickupMissing[0] ?? activeRentals[0];
  const recommendedVehicle = recommendedRental ? vehicles.find((vehicle) => vehicle.id === recommendedRental.vehicleId) : undefined;
  const recommendedCustomer = recommendedRental ? customers.find((customer) => customer.id === recommendedRental.customerId) : undefined;

  const activity = uniqueBy([
    ...contractEvents.map((event) => ({
      key: `contract-${event.id}`,
      label: event.eventType === "signed" ? "Договор подписан" : event.eventType === "sent" ? "Договор отправлен" : "Событие договора",
      meta: `${event.channel} · ${formatDate(event.createdAt)}`,
      tone: event.eventType === "signed" ? "green" as Tone : "blue" as Tone,
      when: event.createdAt,
    })),
    ...payments.map((payment) => ({
      key: `payment-${payment.id}`,
      label: "Оплата проведена",
      meta: `${payment.amount.toLocaleString()} ${payment.currency} · ${formatDate(payment.paidAt)}`,
      tone: "green" as Tone,
      when: payment.paidAt,
    })),
    ...activeRentals.map((rental) => {
      const vehicle = vehicles.find((item) => item.id === rental.vehicleId);
      const customer = customers.find((item) => item.id === rental.customerId);
      return {
        key: `rental-${rental.id}`,
        label: rental.status === "return_due" ? "Возврат ожидается" : "Активная аренда",
        meta: `${vehicle?.plateNumber ?? "Авто"} · ${customer?.displayName ?? "Клиент"} · ${formatDate(rental.returnAt)}`,
        tone: rental.status === "return_due" ? "orange" as Tone : "blue" as Tone,
        when: rental.returnAt,
      };
    }),
  ], (item) => item.key).sort((left, right) => new Date(right.when).getTime() - new Date(left.when).getTime()).slice(0, 6);

  const aiInsight = nextStep.status === "blocked"
    ? `Сначала закройте блокер: ${nextStep.label.toLowerCase()}. ${nextStep.detail}.`
    : recommendedRental
      ? `Следующее действие: ${nextStep.label.toLowerCase()} по аренде ${recommendedVehicle?.plateNumber ?? "авто"} для ${recommendedCustomer?.displayName ?? "клиента"}.`
      : "Срочных блокеров нет. Лучшее действие сейчас — создать новую аренду или проверить документы.";

  return (
    <section className="command-center-dashboard" data-testid="command-center-dashboard">
      <div className="process-map-card">
        <div className="section-title compact-title">
          <div>
            <span className="eyebrow">Command Center</span>
            <h2>Процесс аренды</h2>
            <p>Бронирование → клиент → автомобиль → договор → оплата → выдача → возврат.</p>
          </div>
          <button className="primary-button" onClick={nextStep.action.onClick} type="button">{nextStep.action.label}</button>
        </div>
        <div className="rental-process-rail" aria-label="Rental process">
          {workflow.map((step, index) => (
            <button className={`process-step ${step.status}`} key={step.key} onClick={step.action.onClick} type="button">
              <span>{index + 1}</span>
              <strong>{step.label}</strong>
              <small>{step.detail}</small>
              <em>{step.value}</em>
            </button>
          ))}
        </div>
      </div>

      <div className="command-center-side-grid">
        <section className="ai-assistant-card">
          <span className="eyebrow">AI Assistant</span>
          <h3>Следующий лучший шаг</h3>
          <p>{aiInsight}</p>
          <button className="primary-button" onClick={nextStep.action.onClick} type="button">{nextStep.action.label}</button>
          <small>{offlineGps.length} GPS offline · {rentalFlows.length} rental flows · {documents.length + customerDocuments.length} документов</small>
        </section>

        <section className="activity-feed-card">
          <div className="section-title compact-title">
            <h3>Activity Feed</h3>
            <span>{activity.length}</span>
          </div>
          <div className="activity-feed-list">
            {activity.map((item) => (
              <article className={`activity-feed-row ${item.tone}`} key={item.key}>
                <span />
                <div>
                  <strong>{item.label}</strong>
                  <small>{item.meta}</small>
                </div>
              </article>
            ))}
            {!activity.length ? (
              <article className="activity-feed-empty">
                <strong>История пока пустая</strong>
                <small>Создайте бронь, договор или оплату.</small>
              </article>
            ) : null}
          </div>
        </section>
      </div>
    </section>
  );
}
