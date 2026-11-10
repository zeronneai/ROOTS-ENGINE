-- Reporte completo de métricas por cliente (botón "Reporte completo" en /metrics/<id>).
-- Guarda los números del periodo tal cual se leyeron (facts) y lo que escribió la IA (report),
-- para que el PDF siempre muestre lo mismo aunque después cambien los datos.

create table if not exists metrics_reports (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  days int not null,
  range_from date not null,
  range_to date not null,
  facts jsonb not null default '{}'::jsonb,
  report jsonb not null default '{}'::jsonb
);

create index if not exists metrics_reports_client_idx on metrics_reports (client_id, created_at desc);

alter table metrics_reports enable row level security;
drop policy if exists agency_all on metrics_reports;
create policy agency_all on metrics_reports for all using (is_agency()) with check (is_agency());
