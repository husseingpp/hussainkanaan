-- Bootstrap the site owner as an admin.
--
-- The schema already ships the admin authorization plumbing:
--   * is_admin()  ->  EXISTS (SELECT 1 FROM public.admins WHERE id = auth.uid())
--                     (STABLE SECURITY DEFINER; EXECUTE granted to anon+authenticated,
--                      so the client can call it directly via supabase.rpc('is_admin'))
--   * spots policy "spots_owner_or_admin_update"  USING (author_id = auth.uid() OR is_admin())
--   * spots policy "spots_admin_delete"           USING (is_admin())
-- so an admin can already approve/reject spots and edit photo_urls. The only thing
-- missing was an actual admin row. This seed adds one (idempotent).

insert into public.admins (id, email, role)
select id, email, 'admin'
from auth.users
where email = 'kanaanbh@gmail.com'
on conflict (id) do nothing;

-- Keep the denormalized profiles.is_admin hint in sync (best-effort; the RLS
-- source of truth remains the admins table via is_admin()).
update public.profiles
set is_admin = true
where user_id = (select id from auth.users where email = 'kanaanbh@gmail.com');
