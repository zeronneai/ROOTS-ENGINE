-- Token de solo lectura por sitio: deja que el panel propio de un cliente
-- (por ejemplo el /admin de Tippin' Cowgirl) lea sus visitas desde su servidor
-- con GET /api/sites/stats, sin entrar a Roots Engine. No permite escribir nada.
alter table sites add column if not exists read_token text;
update sites set read_token = replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '') where read_token is null;
alter table sites alter column read_token set default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
alter table sites alter column read_token set not null;
create unique index if not exists sites_read_token on sites (read_token);
