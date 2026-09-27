-- Public form submission for the requests module, usable from static hosting.
-- One security-definer entry point validates everything against the form's
-- schema and rate-limits by client, so anon never gets INSERT on requests.
-- (On Cloudflare, Turnstile + staff email are added in front of this.)

create table public.request_submit_log (
  id bigint generated always as identity primary key,
  client_key text not null,
  created_at timestamptz not null default now()
);

create index request_submit_log_client_idx on public.request_submit_log (client_key, created_at);

-- Internal bookkeeping: RLS on, no policies.
alter table public.request_submit_log enable row level security;
revoke all on public.request_submit_log from anon, authenticated;

-- form_schema: [{key, type, required, label: i18n, options: [{value, label: i18n}]}]
-- type: text | textarea | number | email | phone | date | select | radio | checkboxes
create function public.submit_request(
  p_type_slug text,
  p_full_name text,
  p_phone text,
  p_answers jsonb,
  p_consent boolean,
  p_locale text
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  headers json := nullif(current_setting('request.headers', true), '')::json;
  client text := coalesce(
    nullif(trim(split_part(headers ->> 'x-forwarded-for', ',', 1)), ''),
    headers ->> 'cf-connecting-ip',
    'unknown'
  );
  form public.request_types;
  field jsonb;
  k text;
  kind text;
  v jsonb;
  s text;
  clean jsonb := '{}';
  allowed text[];
  code text;
  name text := trim(coalesce(p_full_name, ''));
  phone text := trim(coalesce(p_phone, ''));
begin
  if not public.requests_enabled() then
    raise exception 'requests_closed' using errcode = 'P0001';
  end if;

  select * into form from public.request_types t where t.slug = p_type_slug and t.is_open;
  if not found then
    raise exception 'form_closed' using errcode = 'P0001';
  end if;

  -- 5 submissions per 10 minutes per client.
  delete from public.request_submit_log l where l.created_at < now() - interval '1 day';
  if (select count(*) from public.request_submit_log l
      where l.client_key = client and l.created_at > now() - interval '10 minutes') >= 5 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  if length(name) < 2 or length(name) > 120 then
    raise exception 'invalid:full_name' using errcode = 'P0001';
  end if;
  if phone !~ '^\+[1-9][0-9]{6,14}$' then
    raise exception 'invalid:phone' using errcode = 'P0001';
  end if;
  if not coalesce(p_consent, false) then
    raise exception 'consent_required' using errcode = 'P0001';
  end if;
  if p_answers is null or jsonb_typeof(p_answers) <> 'object' then
    p_answers := '{}';
  end if;

  -- Keep only fields the form defines, each checked against its type.
  for field in select * from jsonb_array_elements(form.form_schema) loop
    k := field ->> 'key';
    kind := coalesce(field ->> 'type', 'text');
    v := p_answers -> k;
    if k is null then continue; end if;

    if v is null or v = 'null'::jsonb or v = '""'::jsonb or v = '[]'::jsonb
       or (jsonb_typeof(v) = 'string' and trim(v #>> '{}') = '') then
      if coalesce((field ->> 'required')::boolean, false) then
        raise exception 'missing:%', k using errcode = 'P0001';
      end if;
      continue;
    end if;

    select coalesce(array_agg(o ->> 'value'), '{}') into allowed
    from jsonb_array_elements(coalesce(field -> 'options', '[]')) o;

    if kind = 'checkboxes' then
      if jsonb_typeof(v) <> 'array' or exists (
        select 1 from jsonb_array_elements_text(v) x where not (x = any (allowed))
      ) then
        raise exception 'invalid:%', k using errcode = 'P0001';
      end if;
    elsif kind = 'number' then
      s := v #>> '{}';
      if s !~ '^-?[0-9]+(\.[0-9]+)?$' or length(s) > 20 then
        raise exception 'invalid:%', k using errcode = 'P0001';
      end if;
      v := to_jsonb(s::numeric);
    else
      if jsonb_typeof(v) <> 'string' then
        raise exception 'invalid:%', k using errcode = 'P0001';
      end if;
      s := trim(v #>> '{}');
      if (kind = 'textarea' and length(s) > 5000)
         or (kind not in ('textarea') and length(s) > 500)
         or (kind = 'email' and s !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')
         or (kind = 'phone' and s !~ '^\+?[0-9 ()-]{7,20}$')
         or (kind = 'date' and s !~ '^\d{4}-\d{2}-\d{2}$')
         or (kind in ('select', 'radio') and not (s = any (allowed))) then
        raise exception 'invalid:%', k using errcode = 'P0001';
      end if;
      if kind = 'date' then
        begin
          perform s::date;
        exception when others then
          raise exception 'invalid:%', k using errcode = 'P0001';
        end;
      end if;
      v := to_jsonb(s);
    end if;
    clean := clean || jsonb_build_object(k, v);
  end loop;

  insert into public.request_submit_log (client_key) values (client);

  insert into public.requests (type_id, full_name, phone, answers, consent_given, locale)
  values (form.id, name, phone, clean, true, coalesce(nullif(p_locale, ''), 'ar'))
  returning tracking_code into code;

  return code;
end;
$$;

revoke execute on function public.submit_request(text, text, text, jsonb, boolean, text) from public;
grant execute on function public.submit_request(text, text, text, jsonb, boolean, text) to anon, authenticated;
