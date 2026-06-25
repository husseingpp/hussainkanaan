-- PharmaPOS cloud demo seed (mirrors src/data/seed.ts).
-- Applied once to a fresh project so the cloud UI shows the same demo as offline mode.

-- Fixed ids so settings can reference the active branch/user.
-- branch  00000000-0000-0000-0000-000000000001
-- user    00000000-0000-0000-0000-000000000002
-- category 00000000-0000-0000-0000-000000000003

insert into branches (id, name, address, phone, created_at, updated_at, last_modified_by, sync_version)
values ('00000000-0000-0000-0000-000000000001', 'Main Branch', 'Hamra St, Beirut', '+961 1 000 000',
        now(), now(), '00000000-0000-0000-0000-000000000002', 0);

insert into users (id, branch_id, name, role, active, created_at, updated_at, last_modified_by, sync_version)
values ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001',
        'Demo Cashier', 'cashier', true, now(), now(), '00000000-0000-0000-0000-000000000002', 0);

insert into categories (id, name, created_at, updated_at, last_modified_by, sync_version)
values ('00000000-0000-0000-0000-000000000003', 'General', now(), now(),
        '00000000-0000-0000-0000-000000000002', 0);

insert into products
  (id, barcode, name, generic_name, brand, form, strength, category_id,
   price_usd_cents, cost_usd_cents, vat_rate, is_controlled, active,
   created_at, updated_at, last_modified_by, sync_version)
select gen_random_uuid(), v.barcode, v.name, v.generic, v.brand, v.form, v.strength,
       '00000000-0000-0000-0000-000000000003',
       v.price, v.cost, 0.11, false, true, now(), now(),
       '00000000-0000-0000-0000-000000000002', 0
from (values
  ('5000158103368','Panadol','Paracetamol','GSK','Tablet','500mg',250,150),
  ('5099231003684','Augmentin','Amoxicillin/Clavulanate','GSK','Tablet','1g',1200,800),
  ('5000283662013','Brufen','Ibuprofen','Abbott','Tablet','400mg',350,200),
  ('4015630026531','Concor','Bisoprolol','Merck','Tablet','5mg',900,600),
  ('5012894032012','Nexium','Esomeprazole','AstraZeneca','Capsule','40mg',1500,1000),
  ('7613103651031','Voltaren Emulgel','Diclofenac','Novartis','Gel','1%',700,450),
  ('5000158009769','Ventolin Inhaler','Salbutamol','GSK','Inhaler','100mcg',1100,750),
  ('3582910086017','Lantus SoloStar','Insulin Glargine','Sanofi','Pen','100U/ml',2500,1900)
) as v(barcode, name, generic, brand, form, strength, price, cost);

-- One main batch per product.
insert into batches
  (id, product_id, branch_id, batch_no, expiry_date, qty_on_hand, cost_usd_cents,
   created_at, updated_at, last_modified_by, sync_version)
select gen_random_uuid(), p.id, '00000000-0000-0000-0000-000000000001',
       v.batch_no, v.expiry::date, v.qty, v.cost, now(), now(),
       '00000000-0000-0000-0000-000000000002', 0
from products p
join (values
  ('Panadol','B-03368','2027-03-31',40,150),
  ('Augmentin','B-03684','2026-11-30',25,800),
  ('Brufen','B-62013','2027-08-31',60,200),
  ('Concor','B-26531','2026-09-30',30,600),
  ('Nexium','B-32012','2026-07-31',18,1000),
  ('Voltaren Emulgel','B-51031','2027-01-31',22,450),
  ('Ventolin Inhaler','B-09769','2026-12-31',15,750),
  ('Lantus SoloStar','B-86017','2026-08-31',6,1900)
) as v(name, batch_no, expiry, qty, cost) on p.name = v.name;

-- Extra batches: an earlier-expiry Panadol batch (FEFO must pick it) and an expired Brufen batch.
insert into batches
  (id, product_id, branch_id, batch_no, expiry_date, qty_on_hand, cost_usd_cents,
   created_at, updated_at, last_modified_by, sync_version)
select gen_random_uuid(), p.id, '00000000-0000-0000-0000-000000000001',
       v.batch_no, v.expiry::date, v.qty, v.cost, now(), now(),
       '00000000-0000-0000-0000-000000000002', 0
from products p
join (values
  ('Panadol','B-EARLY','2026-09-15',5,150),
  ('Brufen','B-EXPIRED','2025-11-30',8,200)
) as v(name, batch_no, expiry, qty, cost) on p.name = v.name;

insert into exchange_rates (id, usd_to_lbp, effective_from, created_by, created_at, updated_at, last_modified_by, sync_version)
values (gen_random_uuid(), 89000, now(), '00000000-0000-0000-0000-000000000002', now(), now(),
        '00000000-0000-0000-0000-000000000002', 0);

insert into settings (key, value) values
  ('store_name', 'PharmaPOS Demo Pharmacy'),
  ('ll_rounding_step', '1000'),
  ('default_currency', 'LBP'),
  ('near_expiry_days', '90'),
  ('low_stock_threshold', '10'),
  ('current_branch_id', '00000000-0000-0000-0000-000000000001'),
  ('current_user_id', '00000000-0000-0000-0000-000000000002');
