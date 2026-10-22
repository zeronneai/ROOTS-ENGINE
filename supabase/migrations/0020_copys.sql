-- Aprobar videos: 3 opciones de copy por video (largo, corto, sin pedir comentarios) y la transcripción
-- para poder pedir otras 3 sin volver a escuchar el video.
alter table queue_items add column if not exists captions jsonb not null default '[]'::jsonb;
alter table queue_items add column if not exists transcript text;
