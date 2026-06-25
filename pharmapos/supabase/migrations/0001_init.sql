-- PharmaPOS — Postgres schema (Phase 3, cloud mode).
-- Mirrors the canonical SQLite schema (../../migrations/0001_init.sql), translated to Postgres:
--   * ids / foreign keys      -> uuid (client-generated UUIDs)
--   * timestamps              -> timestamptz   (expiry_date -> date)
--   * money / qty / amounts   -> bigint        (integer minor units; never floats)
--   * vat_rate                -> numeric
--   * flags                   -> boolean
--   * enums                   -> text + CHECK
-- Same conventions as CLAUDE.md: money is integer minor units; qty_on_hand is a derived cache,
-- the truth is stock_movements.

create table if not exists branches (
  id               uuid primary key,
  name             text not null,
  address          text,
  phone            text,
  created_at       timestamptz not null,
  updated_at       timestamptz not null,
  deleted_at       timestamptz,
  last_modified_by uuid,
  sync_version     integer not null default 0
);

create table if not exists categories (
  id               uuid primary key,
  name             text not null,
  created_at       timestamptz not null,
  updated_at       timestamptz not null,
  deleted_at       timestamptz,
  last_modified_by uuid,
  sync_version     integer not null default 0
);

create table if not exists suppliers (
  id               uuid primary key,
  name             text not null,
  phone            text,
  notes            text,
  created_at       timestamptz not null,
  updated_at       timestamptz not null,
  deleted_at       timestamptz,
  last_modified_by uuid,
  sync_version     integer not null default 0
);

create table if not exists users (
  id                uuid primary key,
  branch_id         uuid references branches(id),
  name              text not null,
  role              text not null check (role in ('admin', 'pharmacist', 'cashier')),
  pin_hash          text,
  supabase_user_id  uuid,
  active            boolean not null default true,
  created_at        timestamptz not null,
  updated_at        timestamptz not null,
  deleted_at        timestamptz,
  last_modified_by  uuid,
  sync_version      integer not null default 0
);

create table if not exists products (
  id               uuid primary key,
  sku              text,
  barcode          text,
  name             text not null,
  generic_name     text,
  brand            text,
  form             text,
  strength         text,
  category_id      uuid references categories(id),
  supplier_id      uuid references suppliers(id),
  price_usd_cents  bigint not null default 0,   -- canonical price (VAT-inclusive)
  cost_usd_cents   bigint not null default 0,
  vat_rate         numeric not null default 0,
  is_controlled    boolean not null default false,
  active           boolean not null default true,
  created_at       timestamptz not null,
  updated_at       timestamptz not null,
  deleted_at       timestamptz,
  last_modified_by uuid,
  sync_version     integer not null default 0
);

create table if not exists batches (
  id               uuid primary key,
  product_id       uuid not null references products(id),
  branch_id        uuid not null references branches(id),
  batch_no         text,
  expiry_date      date,
  qty_on_hand      bigint not null default 0,   -- derived cache; truth = stock_movements
  cost_usd_cents   bigint not null default 0,
  created_at       timestamptz not null,
  updated_at       timestamptz not null,
  deleted_at       timestamptz,
  last_modified_by uuid,
  sync_version     integer not null default 0
);

create table if not exists customers (
  id                     uuid primary key,
  name                   text not null,
  phone                  text,
  store_credit_usd_cents bigint not null default 0,
  created_at             timestamptz not null,
  updated_at             timestamptz not null,
  deleted_at             timestamptz,
  last_modified_by       uuid,
  sync_version           integer not null default 0
);

create table if not exists exchange_rates (
  id               uuid primary key,
  usd_to_lbp       bigint not null,             -- whole LBP per 1 USD
  effective_from   timestamptz not null,
  created_by       uuid,
  created_at       timestamptz not null,
  updated_at       timestamptz not null,
  deleted_at       timestamptz,
  last_modified_by uuid,
  sync_version     integer not null default 0
);

create table if not exists sales (
  id                 uuid primary key,
  branch_id          uuid not null references branches(id),
  user_id            uuid not null references users(id),
  customer_id        uuid references customers(id),
  status             text not null check (status in ('completed', 'held', 'voided', 'refunded')),
  subtotal_usd_cents bigint not null default 0,
  discount_usd_cents bigint not null default 0,
  vat_usd_cents      bigint not null default 0,
  total_usd_cents    bigint not null default 0,
  exchange_rate      bigint not null,            -- rate snapshot at sale time
  ll_rounding_cents  bigint not null default 0,
  prescription_ref   text,
  created_at         timestamptz not null,
  updated_at         timestamptz not null,
  deleted_at         timestamptz,
  last_modified_by   uuid,
  sync_version       integer not null default 0
);

create table if not exists sale_lines (
  id                      uuid primary key,
  sale_id                 uuid not null references sales(id),
  product_id              uuid not null references products(id),
  batch_id                uuid references batches(id),
  qty                     bigint not null,
  unit_price_usd_cents    bigint not null,
  line_discount_usd_cents bigint not null default 0,
  line_total_usd_cents    bigint not null,
  created_at              timestamptz not null,
  updated_at              timestamptz not null,
  deleted_at              timestamptz,
  last_modified_by        uuid,
  sync_version            integer not null default 0
);

create table if not exists payments (
  id               uuid primary key,
  sale_id          uuid not null references sales(id),
  currency         text not null check (currency in ('USD', 'LBP')),
  amount_minor     bigint not null,
  method           text not null check (method in ('cash', 'card', 'credit')),
  created_at       timestamptz not null,
  updated_at       timestamptz not null,
  deleted_at       timestamptz,
  last_modified_by uuid,
  sync_version     integer not null default 0
);

create table if not exists stock_movements (
  id               uuid primary key,
  product_id       uuid not null references products(id),
  batch_id         uuid references batches(id),
  branch_id        uuid not null references branches(id),
  type             text not null check (type in ('sale', 'purchase', 'adjustment', 'return')),
  qty_delta        bigint not null,
  ref_id           uuid,
  created_at       timestamptz not null,
  updated_at       timestamptz not null,
  deleted_at       timestamptz,
  last_modified_by uuid,
  sync_version     integer not null default 0
);

create table if not exists settings (
  key   text primary key,
  value text not null
);

create index if not exists idx_products_barcode   on products (barcode);
create index if not exists idx_products_name       on products (name);
create index if not exists idx_batches_product     on batches (product_id);
create index if not exists idx_sale_lines_sale     on sale_lines (sale_id);
create index if not exists idx_payments_sale       on payments (sale_id);
create index if not exists idx_movements_product   on stock_movements (product_id);
create index if not exists idx_movements_batch     on stock_movements (batch_id);
create index if not exists idx_sales_created_at    on sales (created_at);
create index if not exists idx_sales_branch        on sales (branch_id);
create index if not exists idx_exchange_rates_eff  on exchange_rates (effective_from);

-- Derived per-product on-hand (sum of live batches) — backs inventory.lowStock.
create or replace view product_stock as
select p.id as product_id,
       coalesce(sum(case when b.deleted_at is null then b.qty_on_hand else 0 end), 0)::bigint as on_hand
from products p
left join batches b on b.product_id = p.id
where p.deleted_at is null
group by p.id;

-- Atomic sale writer. Money is assembled client-side (money.ts / saleAssembly); this function is
-- a dumb transactional writer that inserts the rows and decrements the batch cache. A completed
-- sale is immutable and must never be partially written.
create or replace function create_sale(
  p_sale jsonb,
  p_lines jsonb,
  p_payments jsonb,
  p_movements jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into sales select * from jsonb_populate_record(null::sales, p_sale);
  insert into sale_lines select * from jsonb_populate_recordset(null::sale_lines, p_lines);
  insert into payments select * from jsonb_populate_recordset(null::payments, p_payments);
  insert into stock_movements select * from jsonb_populate_recordset(null::stock_movements, p_movements);

  update batches b
  set qty_on_hand = b.qty_on_hand - x.qty,
      updated_at  = now(),
      sync_version = b.sync_version + 1
  from (
    select (l->>'batch_id')::uuid as batch_id, sum((l->>'qty')::bigint) as qty
    from jsonb_array_elements(p_lines) l
    where l->>'batch_id' is not null
    group by 1
  ) x
  where b.id = x.batch_id;
end;
$$;

-- Permissive MVP access: RLS on every table with an allow-all policy for anon + authenticated.
-- TODO (hardening): replace allow_all with auth- and branch-scoped policies + a login screen.
do $$
declare t text;
begin
  foreach t in array array[
    'branches','categories','suppliers','users','products','batches','customers',
    'exchange_rates','sales','sale_lines','payments','stock_movements','settings'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists allow_all on public.%I', t);
    execute format(
      'create policy allow_all on public.%I for all to anon, authenticated using (true) with check (true)',
      t
    );
  end loop;
end $$;

grant usage on schema public to anon, authenticated;
grant all on all tables in schema public to anon, authenticated;
grant all on all sequences in schema public to anon, authenticated;
grant execute on all functions in schema public to anon, authenticated;
