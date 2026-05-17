create table if not exists auth_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  display_name text not null,
  created_at timestamptz not null default now()
);

create table if not exists auth_passkeys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth_users(id) on delete cascade,
  credential_id text not null unique,
  public_key text not null,
  counter integer not null default 0,
  device_type text not null,
  backed_up boolean not null default false,
  transports text null,
  created_at timestamptz not null default now()
);

create index if not exists idx_auth_passkeys_user_id
on auth_passkeys (user_id);
