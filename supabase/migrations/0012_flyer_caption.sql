-- Copy para publicar cada flyer (texto del post y hashtags).
alter table flyers add column if not exists caption text;
