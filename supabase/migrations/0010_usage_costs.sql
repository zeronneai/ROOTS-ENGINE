-- Registro de costos (solo agencia): cada llamada a Claude, Apify, Google y cada render.
create table if not exists usage_events (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid references clients(id) on delete set null,
  kind       text not null check (kind in ('claude', 'apify', 'gemini', 'render')),
  detail     text not null,
  units      jsonb not null default '{}'::jsonb,
  cost_usd   numeric(12, 5) not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists usage_events_month on usage_events (created_at desc);
create index if not exists usage_events_client on usage_events (client_id, created_at desc);

alter table usage_events enable row level security;
drop policy if exists agency_all on usage_events;
create policy agency_all on usage_events for all using (is_agency()) with check (is_agency());

-- Espacio usado por cliente y por bucket (la carpeta raíz de cada archivo es el client_id).
create or replace function storage_usage_by_client()
returns table (client_folder text, bucket text, bytes bigint, files bigint)
language sql security definer set search_path = public, storage as $$
  select (storage.foldername(name))[1] as client_folder,
         bucket_id as bucket,
         coalesce(sum((metadata->>'size')::bigint), 0)::bigint as bytes,
         count(*)::bigint as files
  from storage.objects
  where bucket_id in ('recordings', 'renders', 'brand')
  group by 1, 2;
$$;
revoke all on function storage_usage_by_client() from public, anon, authenticated;
grant execute on function storage_usage_by_client() to service_role;
