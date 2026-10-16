-- Campañas: ideas de contenido para fechas y eventos específicos (no solo el plan semanal)
alter table content_plans add column if not exists kind text not null default 'week';
alter table content_plans add column if not exists title text;
alter table content_plans add column if not exists brief jsonb;
alter table content_plans add column if not exists strategy jsonb;
alter table content_plans add column if not exists date_to date;
do $$ begin
  alter table content_plans add constraint content_plans_kind_check check (kind in ('week', 'campaign'));
exception when duplicate_object then null; end $$;
alter table content_ideas add column if not exists tone text;
alter table content_ideas add column if not exists event text;
