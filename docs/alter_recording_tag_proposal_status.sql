alter table recordings
  add column if not exists tag_proposal_status processing_status default 'pending';

alter table recordings
  alter column tag_proposal_status type processing_status
  using coalesce(tag_proposal_status::text, 'pending')::processing_status;

alter table recordings
  alter column tag_proposal_status set default 'pending';

alter table recordings
  drop column if exists calendar_match_status;

-- Rollback / old shape:
-- alter table recordings
--   add column if not exists calendar_match_status processing_status default 'pending';
--
-- alter table recordings
--   drop column if exists tag_proposal_status;
