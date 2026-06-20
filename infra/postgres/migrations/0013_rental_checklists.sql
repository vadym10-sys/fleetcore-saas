create table if not exists rental_checklists (
  id text primary key,
  tenant_id text not null references tenants(id) on delete cascade,
  company_id text not null references companies(id) on delete cascade,
  rental_id text not null references rentals(id) on delete cascade,
  vehicle_id text not null references vehicles(id) on delete cascade,
  customer_id text not null references customers(id) on delete cascade,
  phase text not null check (phase in ('pickup', 'return')),
  odometer_km integer not null default 0,
  fuel_level integer not null default 100 check (fuel_level >= 0 and fuel_level <= 100),
  exterior_ok boolean not null default true,
  interior_ok boolean not null default true,
  documents_ok boolean not null default true,
  deposit_confirmed boolean not null default true,
  notes text not null default '',
  photo_urls jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, company_id, rental_id, phase)
);

create index if not exists rental_checklists_tenant_company_idx on rental_checklists (tenant_id, company_id, created_at desc);
