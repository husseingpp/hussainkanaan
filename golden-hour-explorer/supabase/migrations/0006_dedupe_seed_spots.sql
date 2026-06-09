-- De-duplicate editorial seed spots. The original seed inserted a few Lebanon
-- landmarks under slightly different names and without photos; 0003 added richer
-- versions (photo + description), so the map showed double pins for the same
-- place. Remove only the photo-less editorial originals — precise by name, and
-- guarded on author_id is null + no photos so it never touches user submissions
-- or the richer rows. No-op once they're gone.

delete from public.spots
where author_id is null
  and coalesce(array_length(photo_urls, 1), 0) = 0
  and name in (
    'Raouché Pigeon Rocks',
    'Our Lady of Lebanon, Harissa',
    'The Cedars of God, Bcharré',
    'Batroun Seafront'
  );
