-- Links de registro de un solo uso para clientes nuevos
create table if not exists signup_invites (
  token      uuid primary key default gen_random_uuid(),
  label      text,
  plan_tier  text not null default 'plan',
  client_id  uuid references clients(id) on delete set null,
  used_at    timestamptz,
  created_at timestamptz not null default now()
);
alter table signup_invites enable row level security;
drop policy if exists agency_all on signup_invites;
create policy agency_all on signup_invites for all using (is_agency()) with check (is_agency());
