create unique index if not exists users_email_global_unique_idx on users (lower(email));

