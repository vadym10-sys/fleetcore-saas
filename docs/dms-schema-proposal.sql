-- FleetCore DMS target schema proposal.
-- This file is documentation, not an active migration.
-- Convert it into an infra/postgres/migrations/00xx_*.sql migration only after
-- repositories, API contracts, and backfill scripts are ready.

create table documents (
  id text primary key,
  tenant_id text not null references tenants(id) on delete cascade,
  company_id text not null references companies(id) on delete cascade,
  document_number text,
  title text not null,
  category text not null check (category in (
    'customer_identity',
    'vehicle_compliance',
    'rental_contract',
    'rental_handover',
    'payment',
    'damage',
    'service',
    'company',
    'other'
  )),
  type text not null,
  status text not null check (status in (
    'draft',
    'pending_review',
    'valid',
    'expired',
    'rejected',
    'archived'
  )),
  source text not null default 'upload' check (source in (
    'upload',
    'generated',
    'client_intake',
    'contract_flow',
    'system'
  )),
  owner_user_id text references users(id) on delete set null,
  current_version_id text,
  issued_at timestamptz,
  expires_at timestamptz,
  verified_at timestamptz,
  archived_at timestamptz,
  search_text text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table document_versions (
  id text primary key,
  tenant_id text not null references tenants(id) on delete cascade,
  company_id text not null references companies(id) on delete cascade,
  document_id text not null references documents(id) on delete cascade,
  file_object_id text not null references file_objects(id) on delete restrict,
  version_number integer not null check (version_number > 0),
  sha256 text not null,
  mime_type text not null,
  size_bytes integer not null check (size_bytes >= 0),
  created_by_user_id text references users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (tenant_id, company_id, document_id, version_number)
);

alter table documents
  add constraint documents_current_version_fk
  foreign key (current_version_id) references document_versions(id) on delete set null;

create table document_links (
  id text primary key,
  tenant_id text not null references tenants(id) on delete cascade,
  company_id text not null references companies(id) on delete cascade,
  document_id text not null references documents(id) on delete cascade,
  entity_type text not null check (entity_type in (
    'customer',
    'vehicle',
    'rental',
    'contract',
    'invoice',
    'payment',
    'damage',
    'service_record',
    'company'
  )),
  entity_id text not null,
  relation_type text not null default 'attached',
  created_at timestamptz not null default now(),
  unique (tenant_id, company_id, document_id, entity_type, entity_id, relation_type)
);

create table document_tags (
  id text primary key,
  tenant_id text not null references tenants(id) on delete cascade,
  company_id text not null references companies(id) on delete cascade,
  document_id text not null references documents(id) on delete cascade,
  tag text not null,
  created_at timestamptz not null default now()
);

create table document_events (
  id text primary key,
  tenant_id text not null references tenants(id) on delete cascade,
  company_id text not null references companies(id) on delete cascade,
  document_id text not null references documents(id) on delete cascade,
  actor_user_id text references users(id) on delete set null,
  event_type text not null,
  channel text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table damages (
  id text primary key,
  tenant_id text not null references tenants(id) on delete cascade,
  company_id text not null references companies(id) on delete cascade,
  vehicle_id text not null references vehicles(id) on delete cascade,
  rental_id text references rentals(id) on delete set null,
  customer_id text references customers(id) on delete set null,
  severity text not null check (severity in ('minor', 'medium', 'major', 'total_loss')),
  status text not null check (status in ('reported', 'reviewing', 'charged', 'repaired', 'closed')),
  description text not null,
  estimated_cost numeric(12, 2) not null default 0 check (estimated_cost >= 0),
  charged_amount numeric(12, 2) not null default 0 check (charged_amount >= 0),
  occurred_at timestamptz not null,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table timeline_events (
  id text primary key,
  tenant_id text not null references tenants(id) on delete cascade,
  company_id text not null references companies(id) on delete cascade,
  entity_type text not null check (entity_type in (
    'customer',
    'vehicle',
    'rental',
    'document',
    'contract',
    'invoice',
    'payment',
    'damage',
    'service_record',
    'company'
  )),
  entity_id text not null,
  actor_user_id text references users(id) on delete set null,
  event_type text not null,
  title text not null,
  description text,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index documents_company_category_status_idx
  on documents (tenant_id, company_id, category, status, created_at desc);

create index documents_company_expires_idx
  on documents (tenant_id, company_id, expires_at)
  where expires_at is not null and archived_at is null;

create index documents_search_idx
  on documents using gin (to_tsvector('simple', search_text));

create index document_links_entity_idx
  on document_links (tenant_id, company_id, entity_type, entity_id, document_id);

create index document_links_document_idx
  on document_links (tenant_id, company_id, document_id);

create unique index document_tags_unique_idx
  on document_tags (tenant_id, company_id, document_id, lower(tag));

create index document_events_document_created_idx
  on document_events (tenant_id, company_id, document_id, created_at desc);

create index damages_vehicle_status_idx
  on damages (tenant_id, company_id, vehicle_id, status, occurred_at desc);

create index damages_rental_idx
  on damages (tenant_id, company_id, rental_id)
  where rental_id is not null;

create index timeline_entity_idx
  on timeline_events (tenant_id, company_id, entity_type, entity_id, occurred_at desc, id desc);

create index timeline_event_type_idx
  on timeline_events (tenant_id, company_id, event_type, occurred_at desc);
