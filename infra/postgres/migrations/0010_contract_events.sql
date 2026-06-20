create table if not exists rental_contract_events (
  id text primary key,
  tenant_id text not null references tenants(id) on delete cascade,
  company_id text not null references companies(id) on delete cascade,
  contract_id text not null references rental_contracts(id) on delete cascade,
  rental_id text not null references rentals(id) on delete cascade,
  customer_id text not null references customers(id) on delete cascade,
  event_type text not null check (event_type in ('created', 'sent', 'viewed', 'signed')),
  channel text not null check (channel in ('email', 'whatsapp', 'manual', 'public_link')),
  actor_label text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists rental_contract_events_contract_idx on rental_contract_events (contract_id, created_at desc);
create index if not exists rental_contract_events_tenant_company_idx on rental_contract_events (tenant_id, company_id, created_at desc);
