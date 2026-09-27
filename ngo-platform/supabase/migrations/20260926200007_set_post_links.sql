-- Replaces a post's sector links and album (order + captions) atomically.
-- security invoker: runs as the caller, so the post_sectors / post_media RLS
-- policies still decide who may do this (editors and admins).
create function public.set_post_links(p_post_id uuid, p_sector_ids uuid[], p_album jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if jsonb_typeof(p_album) <> 'array' then
    raise exception 'p_album must be a JSON array' using errcode = '22023';
  end if;

  delete from public.post_sectors where post_id = p_post_id;
  insert into public.post_sectors (post_id, sector_id)
  select p_post_id, s from unnest(coalesce(p_sector_ids, '{}')) as s;

  delete from public.post_media where post_id = p_post_id;
  insert into public.post_media (post_id, media_id, sort_order, caption)
  select p_post_id, (a ->> 'media_id')::uuid, (ord - 1)::int, coalesce(a -> 'caption', '{}'::jsonb)
  from jsonb_array_elements(p_album) with ordinality as t(a, ord);
end;
$$;

revoke execute on function public.set_post_links(uuid, uuid[], jsonb) from public, anon;
grant execute on function public.set_post_links(uuid, uuid[], jsonb) to authenticated;
