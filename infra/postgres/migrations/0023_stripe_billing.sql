create table if not exists stripe_checkout_sessions (
  id text primary key,
  tenant_id text not null references tenants(id) on delete cascade,
  company_id text not null references companies(id) on delete cascade,
  subscription_id text not null references subscriptions(id) on delete cascade,
  plan text not null check (plan in ('starter', 'growth', 'enterprise')),
  stripe_session_id text unique,
  idempotency_key text not null unique,
  status text not null check (status in ('created', 'completed', 'expired', 'failed')) default 'created',
  checkout_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists stripe_checkout_sessions_company_idx
  on stripe_checkout_sessions (tenant_id, company_id, created_at desc);

create table if not exists stripe_webhook_events (
  id text primary key,
  type text not null,
  status text not null check (status in ('processing', 'processed', 'ignored', 'failed')) default 'processing',
  payload jsonb not null,
  error text,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists stripe_webhook_events_status_idx
  on stripe_webhook_events (status, created_at desc);
