-- Varios clips para un solo video: el worker los une en orden y edita el resultado.
alter table edits add column if not exists extra_paths text[] not null default '{}';
-- archivo unido (si hubo varios clips). Si es null se usa recordings.storage_path
alter table edits add column if not exists source_path text;
