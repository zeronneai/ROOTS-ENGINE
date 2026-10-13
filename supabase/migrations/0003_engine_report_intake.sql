-- Reporte estratégico generado por el motor
create table if not exists reports (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references clients(id) on delete cascade,
  data       jsonb not null,
  created_at timestamptz not null default now()
);
alter table reports enable row level security;
drop policy if exists agency_all on reports;
create policy agency_all on reports for all using (is_agency()) with check (is_agency());
drop policy if exists client_read on reports;
create policy client_read on reports for select using (client_id = my_client_id());

-- Link público para que el cliente llene su formulario sin cuenta
alter table clients add column if not exists intake_token uuid not null default gen_random_uuid();
create unique index if not exists clients_intake_token on clients (intake_token);
