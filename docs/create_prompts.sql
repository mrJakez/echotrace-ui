create table if not exists prompts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  prompt text not null,
  context_sources jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists prompts_title_idx on prompts (title);

alter table prompts
  add column if not exists context_sources jsonb not null default '{}'::jsonb;
