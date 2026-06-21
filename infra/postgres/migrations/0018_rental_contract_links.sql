create table if not exists rental_contract_links (
  id text primary key,
  tenant_id text not null references tenants(id) on delete cascade,
  company_id text not null references companies(id) on delete cascade,
  contract_id text not null references rental_contracts(id) on delete cascade,
  rental_id text not null references rentals(id) on delete cascade,
  customer_id text not null references customers(id) on delete cascade,
  channel text not null check (channel in ('email', 'telegram', 'whatsapp', 'manual')),
  public_token_hash text not null unique,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create index if not exists rental_contract_links_contract_idx on rental_contract_links (contract_id, created_at desc);
create index if not exists rental_contract_links_tenant_company_idx on rental_contract_links (tenant_id, company_id, created_at desc);
