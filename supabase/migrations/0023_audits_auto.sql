-- Auditorías que llegan solas desde el formulario de purpleroots.agency/audit
alter table audits add column if not exists source text not null default 'manual'; -- manual | web
alter table audits add column if not exists notified_at timestamptz;
create index if not exists audits_contact_idx on audits (contact_email, created_at desc);
