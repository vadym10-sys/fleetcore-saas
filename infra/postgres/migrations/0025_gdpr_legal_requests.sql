create table if not exists legal_consents (
  id text primary key,
  tenant_id text references tenants(id) on delete cascade,
  company_id text references companies(id) on delete cascade,
  user_id text references users(id) on delete set null,
  email text not null,
  policy_version text not null,
  privacy_accepted boolean not null default false,
  terms_accepted boolean not null default false,
  cookie_acknowledged boolean not null default false,
  marketing_opt_in boolean not null default false,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists legal_consents_company_created_idx
  on legal_consents (tenant_id, company_id, created_at desc);

create index if not exists legal_consents_email_idx
  on legal_consents (lower(email), created_at desc);

create table if not exists data_subject_requests (
  id text primary key,
  tenant_id text references tenants(id) on delete cascade,
  company_id text references companies(id) on delete cascade,
  user_id text references users(id) on delete set null,
  email text not null,
  request_type text not null check (request_type in ('export', 'delete')),
  status text not null check (status in ('received', 'in_review', 'completed', 'rejected')) default 'received',
  message text,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists data_subject_requests_company_created_idx
  on data_subject_requests (tenant_id, company_id, created_at desc);

create index if not exists data_subject_requests_email_idx
  on data_subject_requests (lower(email), created_at desc);
