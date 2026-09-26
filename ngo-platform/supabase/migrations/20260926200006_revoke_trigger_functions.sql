-- Trigger functions are never meant to be called through the API (/rest/v1/rpc).
-- Postgres checks EXECUTE on a trigger function only when the trigger is
-- created, so revoking it doesn't affect the triggers themselves.
revoke execute on function public.log_request_event() from public, anon, authenticated;
revoke execute on function public.block_request_event_update() from public, anon, authenticated;
revoke execute on function public.guard_site_modules() from public, anon, authenticated;
revoke execute on function public.check_nav_depth() from public, anon, authenticated;
revoke execute on function public.set_published_at() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;
