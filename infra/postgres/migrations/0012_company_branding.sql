alter table companies
  add column if not exists logo_url text,
  add column if not exists brand_color text not null default '#2346d8',
  add column if not exists billing_email text,
  add column if not exists tax_id text,
  add column if not exists iban text,
  add column if not exists business_address text,
  add column if not exists contract_footer text;
