create table if not exists file_objects (
  id text primary key,
  tenant_id text not null references tenants(id) on delete cascade,
  company_id text not null references companies(id) on delete cascade,
  original_name text not null,
  mime_type text not null,
  size_bytes integer not null check (size_bytes >= 0),
  data bytea not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists file_objects_tenant_company_idx on file_objects (tenant_id, company_id, created_at desc);
