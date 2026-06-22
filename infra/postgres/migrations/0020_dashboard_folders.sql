create table if not exists dashboard_folders (
  id text primary key,
  tenant_id text not null references tenants(id) on delete cascade,
  company_id text not null references companies(id) on delete cascade,
  name text not null,
  created_by text references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists dashboard_folders_company_idx
  on dashboard_folders (tenant_id, company_id, updated_at desc);

create table if not exists dashboard_folder_files (
  id text primary key,
  tenant_id text not null references tenants(id) on delete cascade,
  company_id text not null references companies(id) on delete cascade,
  folder_id text not null references dashboard_folders(id) on delete cascade,
  file_id text not null references file_objects(id) on delete cascade,
  created_by text references users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (tenant_id, company_id, folder_id, file_id)
);

create index if not exists dashboard_folder_files_folder_idx
  on dashboard_folder_files (tenant_id, company_id, folder_id, created_at desc);

create table if not exists dashboard_folder_notes (
  id text primary key,
  tenant_id text not null references tenants(id) on delete cascade,
  company_id text not null references companies(id) on delete cascade,
  folder_id text not null references dashboard_folders(id) on delete cascade,
  text text not null,
  created_by text references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists dashboard_folder_notes_folder_idx
  on dashboard_folder_notes (tenant_id, company_id, folder_id, created_at desc);
