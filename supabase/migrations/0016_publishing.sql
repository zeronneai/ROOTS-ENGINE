-- Publicación programada (vía Zernio): cuentas conectadas por cliente y posts programados.
alter table clients add column if not exists zernio_profile_id text;

create table if not exists scheduled_posts (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references clients(id) on delete cascade,
  caption         text not null default '',
  title           text,
  accounts        jsonb not null default '[]'::jsonb,   -- [{ platform, accountId, label }]
  scheduled_for   timestamptz not null,
  timezone        text not null default 'America/Denver',
  -- de dónde sale el video: edit = video del motor, upload = archivo subido,
  -- dropbox_file = link a un archivo, dropbox_folder = lo más nuevo de una carpeta (se resuelve antes de publicar)
  media_source    text not null check (media_source in ('edit', 'upload', 'dropbox_file', 'dropbox_folder', 'none')),
  edit_id         uuid references edits(id) on delete set null,
  media_path      text,
  dropbox_url     text,
  media_name      text,
  idea_id         uuid references content_ideas(id) on delete set null,
  status          text not null default 'waiting_media' check (status in ('waiting_media', 'scheduled', 'published', 'partial', 'failed', 'canceled')),
  zernio_post_id  text,
  results         jsonb not null default '[]'::jsonb,   -- [{ platform, status, url, error }]
  error           text,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now()
);
create index if not exists scheduled_posts_client on scheduled_posts (client_id, scheduled_for desc);
create index if not exists scheduled_posts_waiting on scheduled_posts (status, scheduled_for);

alter table scheduled_posts enable row level security;
drop policy if exists agency_all on scheduled_posts;
create policy agency_all on scheduled_posts for all using (is_agency()) with check (is_agency());
drop policy if exists client_read on scheduled_posts;
create policy client_read on scheduled_posts for select using (client_id = my_client_id());
