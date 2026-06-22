alter table file_objects
  alter column data drop not null;

alter table file_objects
  add constraint file_objects_storage_data_check
  check (
    (storage_provider = 'database' and data is not null)
    or
    (storage_provider = 's3' and storage_key is not null)
  );

create index if not exists file_objects_tenant_company_storage_idx
  on file_objects (tenant_id, company_id, storage_provider, created_at desc);
