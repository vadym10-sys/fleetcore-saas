create extension if not exists citext;

create table if not exists tenants (
  id text primary key,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists companies (
  id text primary key,
  tenant_id text not null references tenants(id) on delete cascade,
  legal_name text not null,
  trading_name text not null,
  country char(2) not null,
  currency char(3) not null,
  plan text not null check (plan in ('starter', 'growth', 'enterprise')),
  fleet_size_limit integer not null check (fleet_size_limit > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists users (
  id text primary key,
  tenant_id text not null references tenants(id) on delete cascade,
  company_id text not null references companies(id) on delete cascade,
  email citext not null,
  password_hash text not null,
  full_name text not null,
  role text not null check (role in ('owner', 'admin', 'fleet_manager', 'finance_manager', 'support')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, email)
);

create table if not exists customers (
  id text primary key,
  tenant_id text not null references tenants(id) on delete cascade,
  company_id text not null references companies(id) on delete cascade,
  display_name text not null,
  email citext not null,
  phone text not null,
  type text not null check (type in ('individual', 'business')),
  risk_level text not null check (risk_level in ('low', 'medium', 'high')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, email)
);

create table if not exists vehicles (
  id text primary key,
  tenant_id text not null references tenants(id) on delete cascade,
  company_id text not null references companies(id) on delete cascade,
  vin text not null,
  plate_number text not null,
  make text not null,
  model text not null,
  year integer not null check (year >= 1980),
  status text not null check (status in ('available', 'rented', 'maintenance', 'offline')),
  location text not null,
  odometer_km integer not null check (odometer_km >= 0),
  daily_rate numeric(12, 2) not null check (daily_rate >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, vin),
  unique (tenant_id, plate_number)
);

create table if not exists rentals (
  id text primary key,
  tenant_id text not null references tenants(id) on delete cascade,
  company_id text not null references companies(id) on delete cascade,
  customer_id text not null references customers(id),
  vehicle_id text not null references vehicles(id),
  status text not null check (status in ('quote', 'reserved', 'active', 'return_due', 'closed')),
  pickup_at timestamptz not null,
  return_at timestamptz not null,
  total_amount numeric(12, 2) not null check (total_amount >= 0),
  deposit_amount numeric(12, 2) not null check (deposit_amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (return_at > pickup_at)
);

create table if not exists invoices (
  id text primary key,
  tenant_id text not null references tenants(id) on delete cascade,
  company_id text not null references companies(id) on delete cascade,
  customer_id text not null references customers(id),
  rental_id text references rentals(id),
  invoice_number text not null,
  status text not null check (status in ('draft', 'issued', 'paid', 'overdue', 'void')),
  currency char(3) not null,
  subtotal numeric(12, 2) not null check (subtotal >= 0),
  tax numeric(12, 2) not null check (tax >= 0),
  total numeric(12, 2) generated always as (subtotal + tax) stored,
  due_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, invoice_number)
);

create index if not exists companies_tenant_idx on companies (tenant_id);
create index if not exists users_tenant_company_idx on users (tenant_id, company_id);
create index if not exists customers_tenant_company_idx on customers (tenant_id, company_id);
create index if not exists vehicles_tenant_company_status_idx on vehicles (tenant_id, company_id, status);
create index if not exists rentals_tenant_company_status_idx on rentals (tenant_id, company_id, status);
create index if not exists invoices_tenant_company_status_idx on invoices (tenant_id, company_id, status);
