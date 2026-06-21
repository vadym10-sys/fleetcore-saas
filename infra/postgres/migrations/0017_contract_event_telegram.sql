alter table rental_contract_events
  drop constraint if exists rental_contract_events_channel_check;

alter table rental_contract_events
  add constraint rental_contract_events_channel_check check (channel in ('email', 'telegram', 'whatsapp', 'manual', 'public_link'));
