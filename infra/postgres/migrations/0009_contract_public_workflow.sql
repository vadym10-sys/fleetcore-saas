alter table rental_contracts
  drop constraint if exists rental_contracts_status_check;

alter table rental_contracts
  add constraint rental_contracts_status_check check (status in ('draft', 'sent', 'viewed', 'signed'));

alter table rental_contracts
  add column if not exists public_token_hash text unique,
  add column if not exists sent_at timestamptz,
  add column if not exists viewed_at timestamptz;

create index if not exists rental_contracts_public_token_idx on rental_contracts (public_token_hash);
