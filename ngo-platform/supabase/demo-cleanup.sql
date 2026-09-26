-- Removes everything scripts/demo-sql.mjs added to a preview database.
begin;
delete from public.posts where slug like 'demo-%';
delete from public.hero_slides where image_url like '%/demo/%.webp';
delete from public.media where storage_path like '[demo]/%';
delete from public.pages where slug = 'about' and body::text like '%placeholder%';
update public.page_sections set settings = '{"items": []}' where page_key = 'home' and section_type = 'stats';
commit;
