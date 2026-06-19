alter table users
  add column if not exists email_verified_at timestamptz,
  add column if not exists last_login_at timestamptz;

create table if not exists auth_tokens (
  id text primary key,
  tenant_id text references tenants(id) on delete cascade,
  company_id text references companies(id) on delete cascade,
  user_id text references users(id) on delete cascade,
  type text not null check (type in ('refresh', 'password_reset', 'email_verification')),
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  revoked_at timestamptz,
  user_agent text,
  ip_address text,
  created_at timestamptz not null default now()
);

create index if not exists auth_tokens_user_type_idx on auth_tokens (user_id, type, expires_at);
create index if not exists auth_tokens_tenant_company_idx on auth_tokens (tenant_id, company_id);

create table if not exists audit_log (
  id text primary key,
  tenant_id text references tenants(id) on delete cascade,
  company_id text references companies(id) on delete cascade,
  user_id text references users(id) on delete set null,
  actor_email text,
  action text not null,
  entity_type text,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_tenant_company_created_idx on audit_log (tenant_id, company_id, created_at desc);
create index if not exists audit_log_action_idx on audit_log (action);
