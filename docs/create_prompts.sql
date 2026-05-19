create table if not exists prompts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  prompt text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists prompts_title_idx on prompts (title);
