-- Token por cliente para su panel propio (por ejemplo /clinic de DejaVu MedSpa): el panel ve sus videos por aprobar,
-- edita el copy, escoge el texto viral y aprueba, desde su propio servidor con /api/panel/content.
-- No da acceso a las carpetas de Dropbox ni a nada de otros clientes.
alter table clients add column if not exists panel_token text;
update clients set panel_token = replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '') where panel_token is null;
alter table clients alter column panel_token set default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
alter table clients alter column panel_token set not null;
create unique index if not exists clients_panel_token on clients (panel_token);
