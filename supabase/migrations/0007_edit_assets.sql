-- Imágenes que el cliente sube con su video: [{ path, note, use: 'show' | 'reference' }]
-- show = aparece en el video donde la IA decida; reference = solo para que la IA entienda qué quiere.
alter table edits add column if not exists assets jsonb not null default '[]'::jsonb;
