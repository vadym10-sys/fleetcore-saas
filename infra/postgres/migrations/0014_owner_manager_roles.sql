alter table users drop constraint if exists users_role_check;

update users
set role = 'manager'
where role in ('admin', 'fleet_manager', 'finance_manager', 'support');

alter table users
  add constraint users_role_check
  check (role in ('owner', 'manager'));
