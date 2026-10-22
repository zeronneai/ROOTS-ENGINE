-- Aprobar videos: si el editor vuelve a subir un video con el mismo nombre (corregido),
-- se reemplaza en la misma tarjeta y se marca como versión nueva.
alter table queue_items add column if not exists version int not null default 1;
alter table queue_items add column if not exists replaced_at timestamptz;
