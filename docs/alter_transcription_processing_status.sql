-- Assumption:
-- The shared enum type currently used by `recordings.transcription_status`
-- is named `processing_status`.
--
-- If your enum type has a different name, replace `processing_status`
-- below with the real type name from your database.

alter type processing_status add value if not exists 'open';

alter table recordings
  alter column transcription_status set default 'open';

update recordings
set transcription_status = 'open'
where transcription_status = 'processing';
