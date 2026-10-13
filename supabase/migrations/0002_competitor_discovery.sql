-- Competidores encontrados automáticamente por el motor
alter table competitors add column if not exists origin text not null default 'manual'; -- manual | auto
alter table competitors add column if not exists kind text not null default 'competitor'; -- competitor | reference
alter table competitors add column if not exists note text; -- por qué vale la pena vigilarla
