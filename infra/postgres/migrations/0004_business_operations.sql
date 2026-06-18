create table if not exists expenses (
  id text primary key,
  tenant_id text not null references tenants(id) on delete cascade,
  company_id text not null references companies(id) on delete cascade,
  vehicle_id text references vehicles(id) on delete set null,
  category text not null check (category in ('maintenance', 'insurance', 'fuel', 'cleaning', 'parking', 'other')),
  amount numeric(12, 2) not null check (amount >= 0),
  currency char(3) not null,
  spent_at timestamptz not null,
  note text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists service_records (
  id text primary key,
  tenant_id text not null references tenants(id) on delete cascade,
  company_id text not null references companies(id) on delete cascade,
  vehicle_id text not null references vehicles(id) on delete cascade,
  type text not null check (type in ('inspection', 'oil', 'repair', 'tires', 'other')),
  odometer_km integer not null check (odometer_km >= 0),
  status text not null check (status in ('planned', 'completed')),
  service_at timestamptz not null,
  cost numeric(12, 2) not null check (cost >= 0),
  note text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists customer_documents (
  id text primary key,
  tenant_id text not null references tenants(id) on delete cascade,
  company_id text not null references companies(id) on delete cascade,
  customer_id text not null references customers(id) on delete cascade,
  type text not null check (type in ('passport', 'id_card', 'driver_license', 'other')),
  title text not null,
  file_url text not null,
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists rental_contracts (
  id text primary key,
  tenant_id text not null references tenants(id) on delete cascade,
  company_id text not null references companies(id) on delete cascade,
  rental_id text not null references rentals(id) on delete cascade,
  customer_id text not null references customers(id) on delete cascade,
  status text not null check (status in ('draft', 'sent', 'signed')),
  document_url text not null,
  sent_via text not null check (sent_via in ('email', 'whatsapp', 'manual')),
  signed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, company_id, rental_id)
);

create index if not exists expenses_tenant_company_vehicle_idx on expenses (tenant_id, company_id, vehicle_id);
create index if not exists service_records_tenant_company_vehicle_idx on service_records (tenant_id, company_id, vehicle_id);
create index if not exists customer_documents_tenant_company_customer_idx on customer_documents (tenant_id, company_id, customer_id);
create index if not exists rental_contracts_tenant_company_status_idx on rental_contracts (tenant_id, company_id, status);

