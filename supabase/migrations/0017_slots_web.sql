-- Reseñas de los competidores locales (para el audit del negocio)
alter table clients add column if not exists local_reviews jsonb;

-- Calendario fijo: "todos los martes y jueves a las 10 am, publica lo más nuevo de esta carpeta"
create table if not exists posting_slots (
  id             uuid primary key default gen_random_uuid(),
  client_id      uuid not null references clients(id) on delete cascade,
  name           text not null,
  weekdays       int[] not null,                 -- 0 = domingo ... 6 = sábado
  time           text not null,                  -- 'HH:MM'
  timezone       text not null default 'America/Denver',
  accounts       jsonb not null default '[]'::jsonb,
  dropbox_url    text not null,
  caption        text not null default '',
  deadline_hours int not null default 3,         -- horas antes en que ya debe haber video en la carpeta
  active         boolean not null default true,
  created_at     timestamptz not null default now()
);
create index if not exists posting_slots_client on posting_slots (client_id);

alter table scheduled_posts add column if not exists slot_id uuid references posting_slots(id) on delete set null;
alter table scheduled_posts add column if not exists missing_alerted boolean not null default false;
create unique index if not exists scheduled_posts_slot_time on scheduled_posts (slot_id, scheduled_for) where slot_id is not null;

alter table posting_slots enable row level security;
drop policy if exists agency_all on posting_slots;
create policy agency_all on posting_slots for all using (is_agency()) with check (is_agency());
drop policy if exists client_read on posting_slots;
create policy client_read on posting_slots for select using (client_id = my_client_id());

-- Analítica web propia: un código en cada sitio manda las visitas aquí
create table if not exists sites (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references clients(id) on delete cascade,
  domain       text not null,
  key          text not null unique default replace(gen_random_uuid()::text, '-', ''),
  analysis     jsonb,
  analyzed_at  timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists sites_client on sites (client_id);

create table if not exists web_events (
  id         bigserial primary key,
  site_id    uuid not null references sites(id) on delete cascade,
  ts         timestamptz not null default now(),
  type       text not null check (type in ('pageview', 'leave', 'click')),
  visitor    text not null,
  session    text not null,
  path       text not null,
  title      text,
  referrer   text,
  ref_domain text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  device     text,
  browser    text,
  os         text,
  country    text,
  city       text,
  duration_ms int,
  scroll     int,
  label      text
);
create index if not exists web_events_site_ts on web_events (site_id, ts desc);

alter table sites enable row level security;
alter table web_events enable row level security;
drop policy if exists agency_all on sites;
create policy agency_all on sites for all using (is_agency()) with check (is_agency());
drop policy if exists client_read on sites;
create policy client_read on sites for select using (client_id = my_client_id());
drop policy if exists agency_all on web_events;
create policy agency_all on web_events for all using (is_agency()) with check (is_agency());
