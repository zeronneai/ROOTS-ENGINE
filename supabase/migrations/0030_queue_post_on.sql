-- Día que el cliente escoge para publicar un video aprobado (desde su panel propio). Solo es la fecha deseada:
-- la agencia lo programa ese día (o lo publica a mano) y lo ve en Aprobar > En fila para publicar.
alter table queue_items add column if not exists post_on date;

-- Portada sugerida: el worker escoge el mejor cuadro del video (IA) y lo guarda como imagen; el cliente la puede cambiar.
alter table queue_items add column if not exists cover_path text;   -- en el bucket recordings
alter table queue_items add column if not exists cover_time numeric; -- segundo del video
