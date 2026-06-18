create table if not exists payments (
  id text primary key,
  tenant_id text not null references tenants(id) on delete cascade,
  company_id text not null references companies(id) on delete cascade,
  invoice_id text not null references invoices(id) on delete cascade,
  customer_id text not null references customers(id),
  amount numeric(12, 2) not null check (amount > 0),
  currency char(3) not null,
  method text not null check (method in ('cash', 'card', 'bank_transfer', 'stripe', 'manual')),
  reference text,
  paid_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists gps_devices (
  id text primary key,
  tenant_id text not null references tenants(id) on delete cascade,
  company_id text not null references companies(id) on delete cascade,
  vehicle_id text not null references vehicles(id) on delete cascade,
  provider text not null check (provider in ('traccar', 'wialon', 'navixy', 'gpswox', 'manual')),
  external_device_id text not null,
  status text not null check (status in ('online', 'offline', 'idle')),
  latitude numeric(10, 7) not null,
  longitude numeric(10, 7) not null,
  speed_kph numeric(8, 2) not null check (speed_kph >= 0),
  last_signal_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, provider, external_device_id),
  unique (tenant_id, vehicle_id)
);

create table if not exists vehicle_documents (
  id text primary key,
  tenant_id text not null references tenants(id) on delete cascade,
  company_id text not null references companies(id) on delete cascade,
  vehicle_id text not null references vehicles(id) on delete cascade,
  type text not null check (type in ('insurance', 'registration', 'inspection', 'rental_contract', 'other')),
  title text not null,
  file_url text not null,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payments_tenant_invoice_idx on payments (tenant_id, invoice_id);
create index if not exists gps_devices_tenant_status_idx on gps_devices (tenant_id, status);
create index if not exists vehicle_documents_tenant_vehicle_idx on vehicle_documents (tenant_id, vehicle_id);
