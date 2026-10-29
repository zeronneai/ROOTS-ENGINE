-- Panel de métricas (/metrics): qué clientes salen ahí y qué cuenta de anuncios se lee de cada conexión
alter table clients add column if not exists metrics_enabled boolean not null default false;
-- cuenta publicitaria elegida por conexión de anuncios: { "<zernio account id>": "act_123" }
alter table clients add column if not exists ad_accounts jsonb not null default '{}'::jsonb;

-- Para empezar: El Toro (Mario Yague) y DejaVu
update clients set metrics_enabled = true where name ~* 'yague|el toro|deja ?vu';
