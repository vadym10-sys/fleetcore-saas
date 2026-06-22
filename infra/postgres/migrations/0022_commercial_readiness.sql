create table if not exists subscriptions (
  id text primary key,
  tenant_id text not null references tenants(id) on delete cascade,
  company_id text not null references companies(id) on delete cascade,
  provider text not null check (provider in ('manual', 'stripe')) default 'manual',
  plan text not null check (plan in ('starter', 'growth', 'enterprise')),
  status text not null check (status in ('trialing', 'active', 'past_due', 'canceled', 'incomplete')) default 'trialing',
  external_customer_id text,
  external_subscription_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, company_id)
);

create index if not exists subscriptions_company_status_idx
  on subscriptions (tenant_id, company_id, status);

create table if not exists delivery_messages (
  id text primary key,
  tenant_id text not null references tenants(id) on delete cascade,
  company_id text not null references companies(id) on delete cascade,
  user_id text references users(id) on delete set null,
  channel text not null check (channel in ('email', 'telegram', 'whatsapp')),
  recipient text not null,
  subject text,
  body text not null,
  entity_type text not null check (entity_type in ('rental', 'contract', 'client_intake', 'system')) default 'system',
  entity_id text,
  status text not null check (status in ('queued', 'sent', 'failed')) default 'queued',
  provider_message_id text,
  error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists delivery_messages_company_idx
  on delivery_messages (tenant_id, company_id, created_at desc);

create index if not exists delivery_messages_entity_idx
  on delivery_messages (tenant_id, company_id, entity_type, entity_id);
