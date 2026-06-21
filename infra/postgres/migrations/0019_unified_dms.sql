create table if not exists documents (
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

create table if not exists document_versions (
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

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'documents_current_version_fk'
  ) then
    alter table documents
      add constraint documents_current_version_fk
      foreign key (current_version_id) references document_versions(id) on delete set null;
  end if;
end $$;

create table if not exists document_links (
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

create table if not exists document_tags (
  id text primary key,
  tenant_id text not null references tenants(id) on delete cascade,
  company_id text not null references companies(id) on delete cascade,
  document_id text not null references documents(id) on delete cascade,
  tag text not null,
  created_at timestamptz not null default now()
);

create table if not exists document_events (
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

create table if not exists damages (
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

create table if not exists timeline_events (
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

create index if not exists documents_company_category_status_idx
  on documents (tenant_id, company_id, category, status, created_at desc);

create index if not exists documents_company_expires_idx
  on documents (tenant_id, company_id, expires_at)
  where expires_at is not null and archived_at is null;

create index if not exists documents_search_idx
  on documents using gin (to_tsvector('simple', search_text));

create index if not exists document_links_entity_idx
  on document_links (tenant_id, company_id, entity_type, entity_id, document_id);

create index if not exists document_links_document_idx
  on document_links (tenant_id, company_id, document_id);

create unique index if not exists document_tags_unique_idx
  on document_tags (tenant_id, company_id, document_id, lower(tag));

create index if not exists document_events_document_created_idx
  on document_events (tenant_id, company_id, document_id, created_at desc);

create index if not exists damages_vehicle_status_idx
  on damages (tenant_id, company_id, vehicle_id, status, occurred_at desc);

create index if not exists damages_rental_idx
  on damages (tenant_id, company_id, rental_id)
  where rental_id is not null;

create index if not exists timeline_entity_idx
  on timeline_events (tenant_id, company_id, entity_type, entity_id, occurred_at desc, id desc);

create index if not exists timeline_event_type_idx
  on timeline_events (tenant_id, company_id, event_type, occurred_at desc);

insert into documents (
  id, tenant_id, company_id, title, category, type, status, source, expires_at, search_text, metadata, created_at, updated_at
)
select
  'doc_vehicle_' || id,
  tenant_id,
  company_id,
  title,
  case
    when type in ('insurance', 'registration', 'inspection') then 'vehicle_compliance'
    when type = 'rental_contract' then 'rental_contract'
    else 'other'
  end,
  type,
  case
    when expires_at is not null and expires_at < now() then 'expired'
    else 'valid'
  end,
  'upload',
  expires_at,
  concat_ws(' ', title, type, file_url),
  jsonb_build_object('legacyTable', 'vehicle_documents', 'legacyId', id, 'fileUrl', file_url),
  created_at,
  updated_at
from vehicle_documents
on conflict (id) do nothing;

insert into document_links (id, tenant_id, company_id, document_id, entity_type, entity_id, relation_type, created_at)
select
  'link_vehicle_' || id,
  tenant_id,
  company_id,
  'doc_vehicle_' || id,
  'vehicle',
  vehicle_id,
  'attached',
  created_at
from vehicle_documents
on conflict do nothing;

insert into documents (
  id, tenant_id, company_id, title, category, type, status, source, verified_at, search_text, metadata, created_at, updated_at
)
select
  'doc_customer_' || id,
  tenant_id,
  company_id,
  title,
  'customer_identity',
  type,
  case when verified then 'valid' else 'pending_review' end,
  'upload',
  case when verified then updated_at else null end,
  concat_ws(' ', title, type, file_url),
  jsonb_build_object('legacyTable', 'customer_documents', 'legacyId', id, 'fileUrl', file_url, 'verified', verified),
  created_at,
  updated_at
from customer_documents
on conflict (id) do nothing;

insert into document_links (id, tenant_id, company_id, document_id, entity_type, entity_id, relation_type, created_at)
select
  'link_customer_' || id,
  tenant_id,
  company_id,
  'doc_customer_' || id,
  'customer',
  customer_id,
  'identity',
  created_at
from customer_documents
on conflict do nothing;

insert into documents (
  id, tenant_id, company_id, title, category, type, status, source, verified_at, search_text, metadata, created_at, updated_at
)
select
  'doc_contract_' || id,
  tenant_id,
  company_id,
  'Rental contract ' || id,
  'rental_contract',
  'rental_agreement',
  case
    when status = 'signed' then 'valid'
    when status = 'draft' then 'draft'
    else 'pending_review'
  end,
  'contract_flow',
  signed_at,
  concat_ws(' ', id, status, document_url, sent_via),
  jsonb_build_object('legacyTable', 'rental_contracts', 'legacyId', id, 'fileUrl', document_url, 'sentVia', sent_via),
  created_at,
  updated_at
from rental_contracts
on conflict (id) do nothing;

insert into document_links (id, tenant_id, company_id, document_id, entity_type, entity_id, relation_type, created_at)
select 'link_contract_contract_' || id, tenant_id, company_id, 'doc_contract_' || id, 'contract', id, 'canonical', created_at
from rental_contracts
on conflict do nothing;

insert into document_links (id, tenant_id, company_id, document_id, entity_type, entity_id, relation_type, created_at)
select 'link_contract_rental_' || id, tenant_id, company_id, 'doc_contract_' || id, 'rental', rental_id, 'contract', created_at
from rental_contracts
on conflict do nothing;

insert into document_links (id, tenant_id, company_id, document_id, entity_type, entity_id, relation_type, created_at)
select 'link_contract_customer_' || id, tenant_id, company_id, 'doc_contract_' || id, 'customer', customer_id, 'contract', created_at
from rental_contracts
on conflict do nothing;
