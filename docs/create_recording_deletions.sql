create table if not exists recording_deletions (
  id uuid primary key,
  recording_id uuid not null,
  title text,
  filename text not null,
  source text,
  duration_ms integer,
  deleted_by text,
  deleted_at timestamptz not null default now()
);

create index if not exists recording_deletions_deleted_at_idx
  on recording_deletions (deleted_at desc);
