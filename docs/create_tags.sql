create table if not exists tags (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text null,
  parent_id uuid null references tags(id) on delete set null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_tags_parent_id on tags(parent_id);
create unique index if not exists idx_tags_name_parent_id on tags (lower(name), parent_id);

create table if not exists recording_tags (
  id uuid primary key default gen_random_uuid(),
  recording_id uuid not null references recordings(id) on delete cascade,
  tag_id uuid not null references tags(id) on delete cascade,
  assignment_source text not null check (assignment_source in ('manual', 'automatic')),
  assignment_state text not null check (assignment_state in ('assigned', 'very_likely', 'proposal')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_recording_tags_recording_tag_unique
on recording_tags (recording_id, tag_id);

create index if not exists idx_recording_tags_recording_id
on recording_tags (recording_id);

create index if not exists idx_recording_tags_tag_id
on recording_tags (tag_id);
