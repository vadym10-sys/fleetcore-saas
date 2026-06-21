"use client";

import type { Customer, Rental, RentalChecklist, RentalContract, RentalContractEvent, Vehicle } from "@fleetcore/shared";

type Locale = "en" | "ru" | "es" | "fr" | "de";

function rentalStatusLabel(locale: Locale, status: Rental["status"]) {
  if (status === "quote") return locale === "ru" ? "Черновик" : "Quote";
  if (status === "reserved") return locale === "ru" ? "Забронирован" : "Reserved";
  if (status === "active") return locale === "ru" ? "В аренде" : "Rented";
  if (status === "return_due") return locale === "ru" ? "Возврат" : "Return due";
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

function nextRentalAction(contract: RentalContract | undefined, paid: boolean, pickup: boolean, returned: boolean, rental: Rental) {
  if (!contract) return "Создать PDF";
  if (contract.status !== "signed") return "Отправить";
  if (!paid) return "Оплата";
  if (!pickup) return "Выдача";
  if (!returned) return "Возврат";
  if (rental.status !== "closed") return "Закрыть";
  return "Готово";
}

function StatusPill({ value }: { value: string }) {
  return <span className={`badge badge-${value.replaceAll(" ", "-").replaceAll("_", "-")}`}>{value.replaceAll("_", " ")}</span>;
}

export function RentalWorkbench({
  busy,
  checklists,
  contractEvents,
  contracts,
  customers,
  locale,
  money,
  onCreatePickup,
  onCreateReturn,
  onOpenPdf,
  onPay,
  onSelectRental,
  onShare,
  rentals,
  selectedRentalId,
  vehicles,
}: {
  busy: boolean;
  checklists: RentalChecklist[];
  contractEvents: RentalContractEvent[];
  contracts: RentalContract[];
  customers: Customer[];
  locale: Locale;
  money: Intl.NumberFormat;
  onCreatePickup: (rental: Rental) => void;
  onCreateReturn: (rental: Rental) => void;
  onOpenPdf: (rental: Rental) => void;
  onPay: () => void;
  onSelectRental: (rentalId: string) => void;
  onShare: (channel: "whatsapp" | "telegram" | "email", rental: Rental) => void;
  rentals: Rental[];
  selectedRentalId: string | undefined;
  vehicles: Vehicle[];
}) {
  const visibleRentals = rentals.slice(0, 8);

  return (
    <section className="rental-workbench table-panel" data-testid="rental-workbench">
      <div className="section-title compact-title">
        <div>
          <h2>Rental workbench</h2>
          <p>Все аренды как рабочая очередь: договор, отправка, оплата, выдача, возврат и финальный контроль.</p>
        </div>
        <StatusPill value={`${rentals.length} rentals`} />
      </div>

      <div className="rental-workbench-head" aria-hidden="true">
        <span>Аренда</span>
        <span>Договор</span>
        <span>Оплата</span>
        <span>Акты</span>
        <span>Следующее</span>
      </div>

      <div className="rental-workbench-list">
        {visibleRentals.map((rental) => {
          const vehicle = vehicles.find((item) => item.id === rental.vehicleId);
          const customer = customers.find((item) => item.id === rental.customerId);
          const contract = contracts.find((item) => item.rentalId === rental.id);
          const events = contract ? contractEvents.filter((item) => item.contractId === contract.id).slice(0, 2) : [];
          const rentalChecklists = checklists.filter((item) => item.rentalId === rental.id);
          const pickup = rentalChecklists.some((item) => item.phase === "pickup");
          const returned = rentalChecklists.some((item) => item.phase === "return");
          const paid = rental.status === "closed" || contract?.status === "signed";
          const nextAction = nextRentalAction(contract, paid, pickup, returned, rental);

          return (
            <article className={`rental-workbench-row ${selectedRentalId === rental.id ? "selected" : ""}`} key={rental.id}>
              <button className="rental-workbench-main" onClick={() => onSelectRental(rental.id)} type="button">
                <strong>{vehicle ? `${vehicle.make} ${vehicle.model}` : "Автомобиль"}</strong>
                <span>{vehicle?.plateNumber ?? "без номера"} · {customer?.displayName ?? "Клиент"}</span>
                <small>{rentalStatusLabel(locale, rental.status)} · {money.format(rental.totalAmount)}</small>
              </button>

              <div className="rental-workbench-cell">
                <StatusPill value={contractStatusLabel(locale, contract?.status)} />
                {events.map((event) => <small key={event.id}>{contractEventLabel(locale, event)} · {event.channel}</small>)}
              </div>

              <div className="rental-workbench-cell">
                <strong>{paid ? "OK" : money.format(rental.totalAmount)}</strong>
                <small>deposit {money.format(rental.depositAmount)}</small>
              </div>

              <div className="rental-workbench-checks">
                <button className={pickup ? "done" : ""} disabled={busy} onClick={() => onCreatePickup(rental)} type="button">{pickup ? "Выдача OK" : "Выдача"}</button>
                <button className={returned ? "done" : ""} disabled={busy} onClick={() => onCreateReturn(rental)} type="button">{returned ? "Возврат OK" : "Возврат"}</button>
              </div>

              <details className="rental-workbench-actions">
                <summary>{nextAction}</summary>
                <div>
                  <button disabled={busy} onClick={() => onOpenPdf(rental)} type="button">PDF</button>
                  <button disabled={busy || !contract} onClick={() => onShare("whatsapp", rental)} type="button">WhatsApp</button>
                  <button disabled={busy || !contract} onClick={() => onShare("telegram", rental)} type="button">Telegram</button>
                  <button disabled={busy || paid} onClick={onPay} type="button">Оплата</button>
                </div>
              </details>
            </article>
          );
        })}
        {!visibleRentals.length ? (
          <div className="rental-workbench-empty">
            <strong>Аренд пока нет</strong>
            <span>Создайте бронь, и здесь появится рабочая очередь аренды.</span>
          </div>
        ) : null}
      </div>
    </section>
  );
}
