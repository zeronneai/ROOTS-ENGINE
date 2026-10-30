-- Números del negocio del cliente (su propia app: ventas, leads, miembros) para el panel de métricas
alter table clients add column if not exists business_api_url text;
update clients set business_api_url = 'https://app.torquebaseball.us/api/admin' where name ~* 'torque' and business_api_url is null;
