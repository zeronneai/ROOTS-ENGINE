-- Rebranding: análisis de marca y del segmento, direcciones creativas (nombre, paleta, tipografía, logo) y las imágenes generadas.
create table if not exists rebrands (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references clients(id) on delete cascade,
  title       text not null,
  brief       jsonb not null default '{}'::jsonb,
  data        jsonb,
  images      jsonb not null default '[]'::jsonb,
  status      text not null default 'generating' check (status in ('generating', 'done', 'failed')),
  error       text,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists rebrands_client on rebrands (client_id, created_at desc);

alter table rebrands enable row level security;
drop policy if exists agency_all on rebrands;
create policy agency_all on rebrands for all using (is_agency()) with check (is_agency());
drop policy if exists client_read on rebrands;
create policy client_read on rebrands for select using (client_id = my_client_id());
