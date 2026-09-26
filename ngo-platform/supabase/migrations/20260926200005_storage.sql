-- Storage: one public bucket for compressed site images (WebP, ≤1600px).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'public-images', 'public-images', true, 5242880,
  array['image/webp', 'image/jpeg', 'image/png', 'image/svg+xml', 'image/x-icon']
)
on conflict (id) do nothing;

create policy "public-images: public read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'public-images');

create policy "public-images: editor insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'public-images' and public.is_editor());

create policy "public-images: editor update" on storage.objects
  for update to authenticated
  using (bucket_id = 'public-images' and public.is_editor())
  with check (bucket_id = 'public-images' and public.is_editor());

create policy "public-images: editor delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'public-images' and public.is_editor());
