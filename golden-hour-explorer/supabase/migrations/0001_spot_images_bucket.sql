-- Additive migration applied to the existing "sunspot" Supabase project.
-- It does NOT alter the existing (v1) schema — it only adds a public Storage
-- bucket for spot/comment images plus scoped object policies. Uploads require a
-- verified, authenticated user (mirrors the is_email_verified() write model used
-- across the v1 tables); reads are public.

insert into storage.buckets (id, name, public)
values ('spot-images', 'spot-images', true)
on conflict (id) do nothing;

drop policy if exists "spot_images_public_select" on storage.objects;
create policy "spot_images_public_select" on storage.objects
  for select using (bucket_id = 'spot-images');

drop policy if exists "spot_images_verified_insert" on storage.objects;
create policy "spot_images_verified_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'spot-images' and is_email_verified());

drop policy if exists "spot_images_owner_delete" on storage.objects;
create policy "spot_images_owner_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'spot-images' and owner = auth.uid());
