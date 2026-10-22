-- Aprobar videos: la agencia conecta una carpeta de Dropbox, el motor baja los videos nuevos,
-- prepara copy y textos virales, el cliente aprueba y los aprobados quedan en fila para el calendario fijo.

create table if not exists content_folders (
  id                   uuid primary key default gen_random_uuid(),
  client_id            uuid not null references clients(id) on delete cascade,
  name                 text not null default 'Carpeta',
  dropbox_url          text not null,
  auto_check           boolean not null default true,     -- revisar sola cada hora
  refresh_requested_at timestamptz,                       -- alguien le dio "buscar videos nuevos"
  last_checked_at      timestamptz,
  last_result          text,
  created_at           timestamptz not null default now()
);
create index if not exists content_folders_client on content_folders (client_id);

create table if not exists queue_items (
  id                uuid primary key default gen_random_uuid(),
  client_id         uuid not null references clients(id) on delete cascade,
  folder_id         uuid references content_folders(id) on delete set null,
  file_name         text not null,
  file_hash         text not null,
  file_size         bigint,
  kind              text not null default 'video' check (kind in ('video', 'image')),
  media_path        text,                                  -- en el bucket recordings
  status            text not null default 'processing' check (status in ('processing', 'pending', 'approved', 'rejected', 'scheduled', 'failed')),
  caption           text not null default '',
  hooks             jsonb not null default '[]'::jsonb,    -- 3 textos virales sugeridos
  overlay_text      text,                                  -- el que se quemó en el video, si escogieron uno
  approved_at       timestamptz,
  approved_by       text,
  scheduled_post_id uuid references scheduled_posts(id) on delete set null,
  error             text,
  created_at        timestamptz not null default now()
);
create unique index if not exists queue_items_hash on queue_items (client_id, file_hash);
create index if not exists queue_items_status on queue_items (client_id, status, approved_at);

-- avisos por correo
alter table clients add column if not exists approval_notified_at timestamptz;

-- el calendario fijo puede tomar de la fila de aprobados en vez de una carpeta
alter table posting_slots add column if not exists source text not null default 'dropbox';
alter table posting_slots drop constraint if exists posting_slots_source_check;
alter table posting_slots add constraint posting_slots_source_check check (source in ('dropbox', 'queue'));
alter table posting_slots alter column dropbox_url drop not null;

alter table scheduled_posts drop constraint if exists scheduled_posts_media_source_check;
alter table scheduled_posts add constraint scheduled_posts_media_source_check
  check (media_source in ('edit', 'upload', 'dropbox_file', 'dropbox_folder', 'queue', 'none'));
alter table scheduled_posts add column if not exists queue_item_id uuid references queue_items(id) on delete set null;

alter table content_folders enable row level security;
alter table queue_items enable row level security;
drop policy if exists agency_all on content_folders;
create policy agency_all on content_folders for all using (is_agency()) with check (is_agency());
drop policy if exists client_read on content_folders;
create policy client_read on content_folders for select using (client_id = my_client_id());
drop policy if exists agency_all on queue_items;
create policy agency_all on queue_items for all using (is_agency()) with check (is_agency());
drop policy if exists client_read on queue_items;
create policy client_read on queue_items for select using (client_id = my_client_id());
