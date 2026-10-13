-- Tiempo real: el portal se entera al instante cuando el worker cambia el estado de un video.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'edits'
  ) then
    alter publication supabase_realtime add table edits;
  end if;
end $$;
