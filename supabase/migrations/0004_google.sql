-- Google Maps: perfil del negocio y mercado local
alter table clients add column if not exists google_maps_url text;
alter table clients add column if not exists google_profile jsonb;
alter table clients add column if not exists local_market jsonb;
