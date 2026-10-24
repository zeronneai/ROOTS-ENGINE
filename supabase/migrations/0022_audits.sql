-- Auditorías gratis para prospectos (la "Free Audit" de purpleroots.agency).
-- No son clientes todavía: viven aparte y solo la agencia las ve.
-- El reporte se comparte con el prospecto por un link público con token (/auditoria/<token>).

create table if not exists audits (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,

  -- lo que nos dan
  business_name text not null,
  intro text,                -- a qué se dedica, qué vende, a quién, lo que nos contaron
  category text,             -- giro, para buscar competencia en Google (ej. "med spa", "barbería")
  city text not null default 'El Paso, TX',
  website text,
  google_maps_url text,
  instagram text,
  tiktok text,
  facebook text,
  team_notes text,           -- prueba de contacto, lo que vimos al escribirles, etc.
  language text not null default 'en' check (language in ('en', 'es')),
  contact_name text,
  contact_email text,
  contact_phone text,

  -- lo que junta el motor
  status text not null default 'new',  -- new | running | done | error
  step text,                            -- último paso corrido
  error text,
  research jsonb not null default '{}'::jsonb,  -- google, web, social, competencia
  report jsonb,                                  -- la auditoría escrita
  report_at timestamptz,
  share_token text not null unique default replace(gen_random_uuid()::text, '-', '')
);

create index if not exists audits_created_idx on audits (created_at desc);

alter table audits enable row level security;
drop policy if exists agency_all on audits;
create policy agency_all on audits for all using (is_agency()) with check (is_agency());

drop trigger if exists audits_touch on audits;
create trigger audits_touch before update on audits for each row execute function touch_updated_at();
