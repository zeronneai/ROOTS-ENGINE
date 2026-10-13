-- Flyers con IA: biblioteca de marca (estilo + imágenes fijas) y flyers generados.

-- kind 'style'   = referencias de estilo (inspiración de colores, tipografía, composición)
-- kind 'library' = imágenes de uso frecuente: logo, lugar, personas, productos
-- pinned = se incluye siempre en cada flyer (ej. el logo)
create table if not exists brand_assets (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references clients(id) on delete cascade,
  kind        text not null check (kind in ('style', 'library')),
  category    text not null default 'otro' check (category in ('logo', 'lugar', 'persona', 'producto', 'otro')),
  label       text,
  path        text not null,
  pinned      boolean not null default false,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists brand_assets_client on brand_assets (client_id, kind);

create table if not exists flyers (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references clients(id) on delete cascade,
  brief        text not null,
  format       text not null default 'post' check (format in ('post', 'story', 'square')),
  asset_ids    uuid[] not null default '{}',
  extra_paths  text[] not null default '{}',
  parent_id    uuid references flyers(id) on delete set null,
  adjust       text,
  prompt       text,
  output_path  text,
  status       text not null default 'generating' check (status in ('generating', 'done', 'failed')),
  error        text,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists flyers_client on flyers (client_id, created_at desc);

alter table brand_assets enable row level security;
alter table flyers enable row level security;

drop policy if exists agency_all on brand_assets;
create policy agency_all on brand_assets for all using (is_agency()) with check (is_agency());
drop policy if exists agency_all on flyers;
create policy agency_all on flyers for all using (is_agency()) with check (is_agency());
drop policy if exists client_read on brand_assets;
create policy client_read on brand_assets for select using (client_id = my_client_id());
drop policy if exists client_read on flyers;
create policy client_read on flyers for select using (client_id = my_client_id());
