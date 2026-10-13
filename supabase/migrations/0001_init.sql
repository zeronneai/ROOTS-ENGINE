-- ROOTS ENGINE by Purple Roots Agency
-- Esquema inicial. Correr en Supabase: SQL Editor > pegar > Run
-- (o `supabase db push` si usan la CLI).

create extension if not exists "pgcrypto";

do $$ begin
  create type user_role as enum ('agency', 'client');
exception when duplicate_object then null; end $$;

-- ───────────────────────────── Clientes ─────────────────────────────

create table if not exists clients (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  slug          text unique,
  niche         text,                       -- id de nicho, ver src/lib/styles/presets.ts
  city          text,
  language      text not null default 'es', -- es | en | bilingual
  instagram     text,
  tiktok        text,
  website       text,
  plan_tier     text not null default 'plan' check (plan_tier in ('plan', 'edit', 'auto', 'full')),
  edit_style_id text,                       -- preset base de edición
  status        text not null default 'onboarding' check (status in ('onboarding', 'active', 'paused')),
  created_at    timestamptz not null default now()
);

-- Quién puede entrar. La agencia agrega correos aquí (rol agency o client + client_id).
create table if not exists members (
  email      text primary key,
  role       user_role not null default 'client',
  client_id  uuid references clients(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text,
  full_name  text,
  role       user_role not null default 'client',
  client_id  uuid references clients(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ─────────────────────────── Brand Brain ────────────────────────────
-- data: perfil sintetizado (ver BrandBrain en src/lib/types.ts)
-- style_overrides: ajustes de edición propios del cliente encima del preset

create table if not exists brand_profiles (
  client_id       uuid primary key references clients(id) on delete cascade,
  data            jsonb not null default '{}'::jsonb,
  style_overrides jsonb not null default '{}'::jsonb,
  active_mood_id  uuid,
  synthesized_at  timestamptz,
  updated_at      timestamptz not null default now()
);

-- Moods: variantes que el cliente o la agencia pueden activar (ej. "Promo", "Navidad", "Más serio")
create table if not exists moods (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references clients(id) on delete cascade,
  name            text not null,
  description     text,
  style_overrides jsonb not null default '{}'::jsonb,
  tone_notes      text,
  created_by_role user_role not null default 'agency',
  created_at      timestamptz not null default now()
);

-- Insumos crudos: lo que sube la agencia o el cliente. Claude los sintetiza al Brand Brain.
create table if not exists brand_inputs (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references clients(id) on delete cascade,
  kind          text not null check (kind in ('note', 'link', 'file', 'reference_video', 'voice_sample')),
  title         text,
  content       text,
  url           text,
  storage_path  text,
  mood_id       uuid references moods(id) on delete set null,
  added_by      uuid references auth.users(id) on delete set null,
  added_by_role user_role not null default 'agency',
  synthesized   boolean not null default false,
  created_at    timestamptz not null default now()
);

-- ─────────────────────── Competencia y análisis ─────────────────────

create table if not exists competitors (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references clients(id) on delete cascade,
  platform        text not null check (platform in ('instagram', 'tiktok')),
  handle          text not null,
  display_name    text,
  followers       bigint,
  median_views    numeric,
  is_own_account  boolean not null default false,
  last_scanned_at timestamptz,
  created_at      timestamptz not null default now(),
  unique (client_id, platform, handle)
);

create table if not exists competitor_posts (
  id            uuid primary key default gen_random_uuid(),
  competitor_id uuid not null references competitors(id) on delete cascade,
  client_id     uuid not null references clients(id) on delete cascade,
  platform      text not null,
  external_id   text not null,
  url           text,
  video_url     text,
  thumbnail_url text,
  caption       text,
  transcript    text,
  views         bigint,
  likes         bigint,
  comments      bigint,
  duration      numeric,
  posted_at     timestamptz,
  outlier_score numeric,
  analysis      jsonb,
  analyzed_at   timestamptz,
  created_at    timestamptz not null default now(),
  unique (competitor_id, external_id)
);
create index if not exists competitor_posts_client_outlier on competitor_posts (client_id, outlier_score desc);

-- ───────────────────────── Plan de contenido ────────────────────────

create table if not exists content_plans (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references clients(id) on delete cascade,
  week_start date not null,
  summary    text,
  status     text not null default 'draft' check (status in ('draft', 'approved')),
  created_at timestamptz not null default now()
);

create table if not exists content_ideas (
  id           uuid primary key default gen_random_uuid(),
  plan_id      uuid not null references content_plans(id) on delete cascade,
  client_id    uuid not null references clients(id) on delete cascade,
  position     int not null default 0,
  title        text not null,
  format       text,
  hooks        jsonb not null default '[]'::jsonb,
  script       jsonb not null default '[]'::jsonb,
  shot_list    jsonb not null default '[]'::jsonb,
  cta          text,
  caption      text,
  hashtags     text[] not null default '{}',
  score        int,
  reasoning    text,
  based_on     uuid[] not null default '{}',
  publish_date date,
  status       text not null default 'idea' check (status in ('idea', 'approved', 'recorded', 'edited', 'posted', 'skipped')),
  created_at   timestamptz not null default now()
);

-- ────────────────────── Grabaciones y ediciones ─────────────────────

create table if not exists recordings (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references clients(id) on delete cascade,
  idea_id       uuid references content_ideas(id) on delete set null,
  storage_path  text not null,
  original_name text,
  duration      numeric,
  uploaded_by   uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now()
);

-- mode: 'auto' = lo edita el motor; 'agency' = lo edita el equipo de PRA
create table if not exists edits (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references clients(id) on delete cascade,
  recording_id    uuid not null references recordings(id) on delete cascade,
  idea_id         uuid references content_ideas(id) on delete set null,
  mode            text not null default 'auto' check (mode in ('auto', 'agency')),
  style_id        text,
  style_overrides jsonb not null default '{}'::jsonb,
  mood_id         uuid references moods(id) on delete set null,
  status          text not null default 'queued' check (status in (
                    'queued', 'transcribing', 'directing', 'directing_claimed', 'review',
                    'render_queued', 'rendering', 'done', 'failed', 'agency_editing')),
  transcript      jsonb,
  edl             jsonb,
  output_path     text,
  notes           text,
  error           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists edits_status on edits (status, created_at);

-- ─────────────────────────────── Helpers ────────────────────────────

create or replace function is_agency() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'agency');
$$;

create or replace function my_client_id() returns uuid
language sql stable security definer set search_path = public as $$
  select client_id from profiles where id = auth.uid();
$$;

create or replace function can_access_client(cid text) returns boolean
language sql stable security definer set search_path = public as $$
  select is_agency() or my_client_id()::text = cid;
$$;

-- Al registrarse: crea profile con el rol/cliente que la agencia dio de alta en members.
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare m members%rowtype;
begin
  select * into m from members where lower(email) = lower(new.email);
  insert into profiles (id, email, role, client_id)
  values (new.id, new.email, coalesce(m.role, 'client'), m.client_id)
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists edits_touch on edits;
create trigger edits_touch before update on edits for each row execute function touch_updated_at();

-- ──────────────────────────────── RLS ───────────────────────────────

alter table clients          enable row level security;
alter table members          enable row level security;
alter table profiles         enable row level security;
alter table brand_profiles   enable row level security;
alter table moods            enable row level security;
alter table brand_inputs     enable row level security;
alter table competitors      enable row level security;
alter table competitor_posts enable row level security;
alter table content_plans    enable row level security;
alter table content_ideas    enable row level security;
alter table recordings       enable row level security;
alter table edits            enable row level security;

-- Agencia: todo
do $$
declare t text;
begin
  foreach t in array array['clients','members','brand_profiles','moods','brand_inputs','competitors',
                           'competitor_posts','content_plans','content_ideas','recordings','edits'] loop
    execute format('drop policy if exists agency_all on %I', t);
    execute format('create policy agency_all on %I for all using (is_agency()) with check (is_agency())', t);
  end loop;
end $$;

drop policy if exists own_profile on profiles;
create policy own_profile on profiles for select using (id = auth.uid() or is_agency());

-- Cliente: lee lo suyo
drop policy if exists client_read on clients;
create policy client_read on clients for select using (id = my_client_id());

do $$
declare t text;
begin
  foreach t in array array['brand_profiles','moods','brand_inputs','competitors','competitor_posts',
                           'content_plans','content_ideas','recordings','edits'] loop
    execute format('drop policy if exists client_read on %I', t);
    execute format('create policy client_read on %I for select using (client_id = my_client_id())', t);
  end loop;
end $$;

-- Cliente: puede subir insumos, crear moods, subir grabaciones y pedir ediciones
drop policy if exists client_insert on brand_inputs;
create policy client_insert on brand_inputs for insert with check (client_id = my_client_id() and added_by_role = 'client');
drop policy if exists client_insert on moods;
create policy client_insert on moods for insert with check (client_id = my_client_id() and created_by_role = 'client');
drop policy if exists client_insert on recordings;
create policy client_insert on recordings for insert with check (client_id = my_client_id());
drop policy if exists client_insert on edits;
create policy client_insert on edits for insert with check (client_id = my_client_id() and status = 'queued');

-- Cliente: puede cambiar su mood activo y aprobar ideas
drop policy if exists client_update on brand_profiles;
create policy client_update on brand_profiles for update using (client_id = my_client_id()) with check (client_id = my_client_id());
drop policy if exists client_update on content_ideas;
create policy client_update on content_ideas for update using (client_id = my_client_id()) with check (client_id = my_client_id());

-- ────────────────────────────── Storage ─────────────────────────────
-- Buckets privados. La ruta siempre empieza con el client_id: <client_id>/archivo.mp4

insert into storage.buckets (id, name, public) values
  ('recordings', 'recordings', false),
  ('renders', 'renders', false),
  ('brand', 'brand', false)
on conflict (id) do nothing;

drop policy if exists roots_storage_rw on storage.objects;
create policy roots_storage_rw on storage.objects for all
  using (
    bucket_id in ('recordings', 'renders', 'brand')
    and can_access_client((storage.foldername(name))[1])
  )
  with check (
    bucket_id in ('recordings', 'brand')
    and can_access_client((storage.foldername(name))[1])
  );

-- Si a alguien que YA tiene cuenta lo agregan a members, se actualiza su profile.
create or replace function sync_member_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update profiles set role = new.role, client_id = new.client_id where lower(email) = lower(new.email);
  return new;
end $$;

drop trigger if exists members_sync on members;
create trigger members_sync after insert or update on members
  for each row execute function sync_member_profile();

-- ─────────────────────────── Primer admin ───────────────────────────
-- Antes de entrar por primera vez, da de alta a la agencia:
-- insert into members (email, role) values ('tu-correo@ejemplo.com', 'agency');
