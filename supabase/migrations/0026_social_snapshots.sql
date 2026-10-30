-- Foto diaria de las redes públicas de cada cliente del panel (Instagram y TikTok vía Apify, sin conectar nada)
create table if not exists social_snapshots (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  platform text not null check (platform in ('instagram', 'tiktok')),
  handle text not null,
  day date not null default current_date,
  followers int,
  following int,
  posts int,
  stats jsonb not null default '{}'::jsonb,   -- vistas medianas, likes promedio, engagement, posts en 30 días
  recent jsonb not null default '[]'::jsonb,  -- últimas publicaciones con sus números
  profile jsonb not null default '{}'::jsonb, -- bio, link, destacadas, nombre
  created_at timestamptz not null default now(),
  unique (client_id, platform, day)
);
create index if not exists social_snapshots_client_idx on social_snapshots (client_id, day desc);

alter table social_snapshots enable row level security;
drop policy if exists agency_all on social_snapshots;
create policy agency_all on social_snapshots for all using (is_agency()) with check (is_agency());
