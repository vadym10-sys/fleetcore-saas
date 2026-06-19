alter table file_objects
  add column if not exists storage_provider text not null default 'database',
  add column if not exists storage_key text,
  add column if not exists sha256 text,
  add column if not exists uploaded_by_user_id text references users(id) on delete set null;

update file_objects
set storage_key = coalesce(storage_key, id)
where storage_key is null;

create index if not exists file_objects_storage_key_idx on file_objects (storage_provider, storage_key);
create index if not exists file_objects_uploaded_by_idx on file_objects (uploaded_by_user_id);
