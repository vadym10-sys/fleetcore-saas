import { pool } from "./client.js";
import { defaultCompanyId, defaultTenantId } from "./constants.js";

export async function seedDatabase() {
  await pool.query(
    `insert into tenants (id, name)
     values ($1, $2)
     on conflict (id) do nothing`,
    [defaultTenantId, "Atlas Mobility"],
  );

  await pool.query(
    `insert into companies (
      id, tenant_id, legal_name, trading_name, country, currency, plan, fleet_size_limit
    ) values ($1, $2, $3, $4, $5, $6, $7, $8)
    on conflict (id) do nothing`,
    [defaultCompanyId, defaultTenantId, "Atlas Mobility Group Ltd", "Atlas Mobility", "GB", "USD", "enterprise", 2500],
  );

  await pool.query(
    `insert into users (
      id, tenant_id, company_id, email, password_hash, full_name, role
    ) values ($1, $2, $3, $4, $5, $6, $7)
    on conflict (tenant_id, email) do nothing`,
    ["user_founder", defaultTenantId, defaultCompanyId, "founder@atlas.example", "development-only", "Maya Carter", "owner"],
  );

  await pool.query(
    `insert into vehicles (
      id, tenant_id, company_id, vin, plate_number, make, model, year, status,
      location, odometer_km, daily_rate
    ) values
      ('veh_001', $1, $2, '5YJYGDEE1MF000001', 'EV-2048', 'Tesla', 'Model Y', 2024, 'rented', 'Berlin', 38421, 118),
      ('veh_002', $1, $2, 'WBAJU21090B000002', 'PR-8821', 'BMW', 'X5', 2023, 'available', 'London Heathrow', 52184, 164),
      ('veh_003', $1, $2, 'WF0XXXTTGXK000003', 'VN-7132', 'Ford', 'Transit', 2022, 'maintenance', 'Warsaw', 91008, 92)
    on conflict (id) do nothing`,
    [defaultTenantId, defaultCompanyId],
  );

  await pool.query(
    `insert into customers (
      id, tenant_id, company_id, display_name, email, phone, type, risk_level
    ) values
      ('cus_001', $1, $2, 'Northstar Logistics', 'ops@northstar.example', '+44 20 0000 0101', 'business', 'low'),
      ('cus_002', $1, $2, 'CareNow Medical', 'fleet@carenow.example', '+1 212 000 0202', 'business', 'medium')
    on conflict (id) do nothing`,
    [defaultTenantId, defaultCompanyId],
  );

  await pool.query(
    `insert into rentals (
      id, tenant_id, company_id, customer_id, vehicle_id, status,
      pickup_at, return_at, total_amount, deposit_amount
    ) values
      ('ren_001', $1, $2, 'cus_001', 'veh_001', 'active', '2026-06-14T09:00:00.000Z', '2026-06-21T09:00:00.000Z', 826, 600),
      ('ren_002', $1, $2, 'cus_002', 'veh_002', 'reserved', '2026-06-19T10:30:00.000Z', '2026-06-26T10:30:00.000Z', 1148, 800)
    on conflict (id) do nothing`,
    [defaultTenantId, defaultCompanyId],
  );

  await pool.query(
    `insert into invoices (
      id, tenant_id, company_id, customer_id, rental_id, invoice_number,
      status, currency, subtotal, tax, due_at
    ) values
      ('inv_001', $1, $2, 'cus_001', 'ren_001', 'INV-2026-0001', 'issued', 'USD', 826, 165.2, '2026-06-24T23:59:59.000Z'),
      ('inv_002', $1, $2, 'cus_002', 'ren_002', 'INV-2026-0002', 'overdue', 'USD', 1148, 229.6, '2026-06-15T23:59:59.000Z')
    on conflict (id) do nothing`,
    [defaultTenantId, defaultCompanyId],
  );
}
