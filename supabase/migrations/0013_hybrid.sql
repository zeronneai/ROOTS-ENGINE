-- Video híbrido: qué es cada clip. 'auto' (se detecta por la voz), 'talk' (alguien habla) o 'broll' (toma sin voz).
alter table edits add column if not exists clip_modes text[] not null default '{}';
