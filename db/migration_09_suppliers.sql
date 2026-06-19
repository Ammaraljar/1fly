-- ============================================================================
--  ترقية ٩ — اللغتان + التفاصيل + المزودون
--  Jusoor Global · Migration 09
--  نفّذ بعد migration_08_fixes.sql
-- ============================================================================

-- ===========================================================================
--  ١. إضافة حقول ثنائية اللغة لجداول البنود (snapshot وقت الحجز)
-- ===========================================================================

-- order_hotels: اسم ثنائي + تفاصيل
alter table order_hotels
  add column if not exists hotel_name_en text,
  add column if not exists city_name_en  text,
  add column if not exists details_ar    text,
  add column if not exists details_en    text,
  add column if not exists supplier_id   bigint;

-- order_tours: عنوان ثنائي + تفاصيل
alter table order_tours
  add column if not exists title_en      text,
  add column if not exists city_name_en  text,
  add column if not exists details_ar    text,
  add column if not exists details_en    text,
  add column if not exists supplier_id   bigint;

-- order_activities: عنوان ثنائي + تفاصيل
alter table order_activities
  add column if not exists title_en      text,
  add column if not exists city_name_en  text,
  add column if not exists details_ar    text,
  add column if not exists details_en    text,
  add column if not exists supplier_id   bigint;

-- order_transport: تفاصيل ثنائية + تسميات إنجليزية
alter table order_transport
  add column if not exists from_label_en text,
  add column if not exists to_label_en   text,
  add column if not exists details_ar    text,
  add column if not exists details_en    text,
  add column if not exists supplier_id   bigint;

-- order_flights: تفاصيل ثنائية (supplier موجود كنص، نضيف FK لاحقاً)
alter table order_flights
  add column if not exists details_ar    text,
  add column if not exists details_en    text;

-- ===========================================================================
--  ٢. تحديث transport_routes بإضافة التسميات الإنجليزية
-- ===========================================================================
alter table transport_routes
  add column if not exists from_label_en text,
  add column if not exists to_label_en   text,
  add column if not exists description_ar text,
  add column if not exists description_en text;

-- ===========================================================================
--  ٣. نظام المزودين الكامل
-- ===========================================================================
create table if not exists suppliers (
  id           bigint generated always as identity primary key,
  name_ar      text not null,
  name_en      text not null,
  contact_name text,
  phone        text,
  email        text,
  address_ar   text,
  address_en   text,
  notes        text,
  created_at   timestamptz not null default now()
);

-- مستحقات المزودين: كل دفعة نُسدّدها لمزوّد
create table if not exists supplier_payments (
  id           bigint generated always as identity primary key,
  supplier_id  bigint not null references suppliers(id) on delete cascade,
  order_id     bigint references orders(id) on delete set null,
  amount       numeric(12,2) not null check (amount > 0),
  paid_at      date not null default current_date,
  method       text not null default 'bank_transfer',
  reference    text,
  notes        text,
  created_at   timestamptz not null default now()
);
create index if not exists supplier_payments_sup_idx on supplier_payments(supplier_id);
create index if not exists supplier_payments_ord_idx on supplier_payments(order_id);

-- إضافة FK للمزوّد في جداول البنود (بعد إنشاء الجدول)
do $$ begin
  if not exists (select 1 from pg_constraint where conname='fk_oh_supplier')  then alter table order_hotels     add constraint fk_oh_supplier  foreign key (supplier_id) references suppliers(id) on delete set null; end if;
  if not exists (select 1 from pg_constraint where conname='fk_ot_supplier')  then alter table order_tours      add constraint fk_ot_supplier  foreign key (supplier_id) references suppliers(id) on delete set null; end if;
  if not exists (select 1 from pg_constraint where conname='fk_oa_supplier')  then alter table order_activities add constraint fk_oa_supplier  foreign key (supplier_id) references suppliers(id) on delete set null; end if;
  if not exists (select 1 from pg_constraint where conname='fk_otr_supplier') then alter table order_transport  add constraint fk_otr_supplier foreign key (supplier_id) references suppliers(id) on delete set null; end if;
end $$;

-- ===========================================================================
--  ٤. منظور: إجماليات المزود (التكلفة الإجمالية - المدفوع = المستحق)
-- ===========================================================================
create or replace view supplier_balances as
with costs as (
  -- مجموع التكلفة لكل مزود عبر كل الطلبات
  select supplier_id, sum(cost) as total_cost from order_hotels     where supplier_id is not null group by supplier_id
  union all
  select supplier_id, sum(cost) from order_tours      where supplier_id is not null group by supplier_id
  union all
  select supplier_id, sum(cost) from order_activities where supplier_id is not null group by supplier_id
  union all
  select supplier_id, sum(cost) from order_transport  where supplier_id is not null group by supplier_id
),
total_costs as (select supplier_id, sum(total_cost) as total_cost from costs group by supplier_id),
total_paid  as (select supplier_id, sum(amount) as total_paid from supplier_payments group by supplier_id)
select
  s.id,
  s.name_ar,
  s.name_en,
  coalesce(tc.total_cost, 0) as total_cost,
  coalesce(tp.total_paid, 0) as total_paid,
  coalesce(tc.total_cost, 0) - coalesce(tp.total_paid, 0) as balance_due
from suppliers s
left join total_costs tc on tc.supplier_id = s.id
left join total_paid  tp on tp.supplier_id = s.id;

-- ===========================================================================
--  ٥. أمان مستوى الصف
-- ===========================================================================
alter table suppliers         enable row level security;
alter table supplier_payments enable row level security;

create policy sup_read   on suppliers         for select to authenticated using (true);
create policy sup_ins    on suppliers         for insert to authenticated with check (has_perm('add'));
create policy sup_upd    on suppliers         for update to authenticated using (has_perm('edit'));
create policy sup_del    on suppliers         for delete to authenticated using (has_perm('delete'));

create policy sup_pay_read on supplier_payments for select to authenticated using (true);
create policy sup_pay_ins  on supplier_payments for insert to authenticated with check (has_perm('add'));
create policy sup_pay_del  on supplier_payments for delete to authenticated using (has_perm('delete'));
