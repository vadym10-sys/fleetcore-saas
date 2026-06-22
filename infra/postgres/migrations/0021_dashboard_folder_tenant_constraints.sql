alter table dashboard_folders
  add constraint dashboard_folders_tenant_company_id_unique unique (tenant_id, company_id, id);

alter table file_objects
  add constraint file_objects_tenant_company_id_unique unique (tenant_id, company_id, id);

alter table dashboard_folder_files
  add constraint dashboard_folder_files_folder_scope_fk
    foreign key (tenant_id, company_id, folder_id)
    references dashboard_folders (tenant_id, company_id, id)
    on delete cascade;

alter table dashboard_folder_files
  add constraint dashboard_folder_files_file_scope_fk
    foreign key (tenant_id, company_id, file_id)
    references file_objects (tenant_id, company_id, id)
    on delete cascade;

alter table dashboard_folder_notes
  add constraint dashboard_folder_notes_folder_scope_fk
    foreign key (tenant_id, company_id, folder_id)
    references dashboard_folders (tenant_id, company_id, id)
    on delete cascade;
