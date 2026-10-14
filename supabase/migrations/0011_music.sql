-- Música para el auto-editor.
-- client_id null = biblioteca de la agencia (para todos los clientes); con client_id = canción propia del cliente.
create table if not exists music_tracks (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid references clients(id) on delete cascade,
  title       text not null,
  moods       text[] not null default '{}',
  energy      int not null default 0 check (energy between -2 and 2),
  path        text not null,
  duration    numeric,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists music_tracks_client on music_tracks (client_id);

alter table music_tracks enable row level security;
drop policy if exists agency_all on music_tracks;
create policy agency_all on music_tracks for all using (is_agency()) with check (is_agency());
drop policy if exists client_read on music_tracks;
create policy client_read on music_tracks for select using (client_id is null or client_id = my_client_id());

-- por video: 'auto' (la IA escoge), 'none' (sin música) o 'track' (la que eligieron)
alter table edits add column if not exists music_mode text not null default 'auto' check (music_mode in ('auto', 'none', 'track'));
alter table edits add column if not exists music_id uuid references music_tracks(id) on delete set null;

-- Tipo de video: 'talk' = alguien hablando (corta por la voz), 'tour' = recorrido con música (corta al ritmo)
alter table edits add column if not exists kind text not null default 'talk' check (kind in ('talk', 'tour'));
-- Datos de la propiedad (inmobiliarias): precio, recámaras, baños, m², ubicación, asesor...
alter table edits add column if not exists property jsonb;
