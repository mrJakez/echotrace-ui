create table if not exists recording_logs (
  id uuid primary key default gen_random_uuid(),
  recording_id uuid not null references recordings(id) on delete cascade,
  logger text not null,
  level text null default 'info',
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_recording_logs_recording_id_created_at
on recording_logs (recording_id, created_at desc);
