alter table rental_contracts
  drop constraint if exists rental_contracts_sent_via_check;

alter table rental_contracts
  add constraint rental_contracts_sent_via_check check (sent_via in ('email', 'telegram', 'whatsapp', 'manual'));
