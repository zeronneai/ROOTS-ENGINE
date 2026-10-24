-- Reintentos de las auditorías automáticas (las retoma el "tick" que llama el Apps Script cada minuto)
alter table audits add column if not exists attempts int not null default 0;
create index if not exists audits_pending_idx on audits (source, status, updated_at) where report is null;
