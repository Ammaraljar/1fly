-- ============================================================================
--  ترقية ٦ — الطيران كخدمة مستقلة
--  Jusoor Global · Migration 06 — Independent flights service
--  نفّذ بعد migration_05_company.sql
-- ============================================================================

-- جدول رحلات الطيران المرتبطة بالطلب
create table order_flights (
  id              bigint generated always as identity primary key,
  order_id        bigint not null references orders(id) on delete cascade,

  -- بيانات الرحلة
  airline         text,                     -- شركة الطيران
  flight_number   text,                     -- رقم الرحلة
  flight_class    text,                     -- درجة السفر (اقتصادية/أعمال/أولى)
  baggage_kg      int,                      -- الوزن المسموح (كجم)

  -- المسار
  from_city       text,                     -- مدينة المغادرة
  to_city         text,                     -- مدينة الوصول

  -- التوقيت
  flight_date     date,
  departure_time  text,                     -- وقت الإقلاع (HH:MM)
  arrival_time    text,                     -- وقت الوصول
  duration_min    int,                      -- مدة الرحلة بالدقائق

  -- المزوّد والتكلفة
  supplier        text,                     -- اسم المزوّد
  notes           text,                     -- ملاحظات

  cost            numeric(12,2) not null default 0,
  sale            numeric(12,2) not null default 0,
  margin          numeric(12,2) generated always as (sale - cost) stored
);

create index order_flights_order_idx on order_flights (order_id);

-- سياسات الأمان
alter table order_flights enable row level security;
create policy order_flights_read on order_flights for select to authenticated using (true);
create policy order_flights_ins  on order_flights for insert to authenticated with check (has_perm('add'));
create policy order_flights_upd  on order_flights for update to authenticated using (has_perm('edit'));
create policy order_flights_del  on order_flights for delete to authenticated using (has_perm('delete'));

-- تحديث منظور التقارير ليشمل الطيران
drop view if exists report_margins;
create view report_margins as
select o.id as order_id, o.created_at::date as order_date, o.status, 'hotels'::text as service_type,
       coalesce(sum(h.cost),0) as cost, coalesce(sum(h.sale),0) as sale, coalesce(sum(h.sale),0)-coalesce(sum(h.cost),0) as margin
from orders o left join order_hotels h on h.order_id=o.id group by o.id
union all
select o.id, o.created_at::date, o.status, 'flights',
       coalesce(sum(f.cost),0), coalesce(sum(f.sale),0), coalesce(sum(f.sale),0)-coalesce(sum(f.cost),0)
from orders o left join order_flights f on f.order_id=o.id group by o.id
union all
select o.id, o.created_at::date, o.status, 'tours',
       coalesce(sum(t.cost),0), coalesce(sum(t.sale),0), coalesce(sum(t.sale),0)-coalesce(sum(t.cost),0)
from orders o left join order_tours t on t.order_id=o.id group by o.id
union all
select o.id, o.created_at::date, o.status, 'activities',
       coalesce(sum(a.cost),0), coalesce(sum(a.sale),0), coalesce(sum(a.sale),0)-coalesce(sum(a.cost),0)
from orders o left join order_activities a on a.order_id=o.id group by o.id
union all
select o.id, o.created_at::date, o.status, 'transport',
       coalesce(sum(tr.cost),0), coalesce(sum(tr.sale),0), coalesce(sum(tr.sale),0)-coalesce(sum(tr.cost),0)
from orders o left join order_transport tr on tr.order_id=o.id group by o.id;

-- تحديث دالة ملخص التقارير لتشمل الطيران
create or replace function report_summary(p_from date, p_to date)
returns table (service_type text, total_cost numeric, total_sale numeric, total_margin numeric, orders_count bigint)
language sql stable as $$
  select service_type,
         sum(cost)   as total_cost,
         sum(sale)   as total_sale,
         sum(margin) as total_margin,
         count(distinct order_id) filter (where sale>0) as orders_count
  from report_margins
  where order_date between p_from and p_to
  group by service_type
  order by sum(margin) desc;
$$;
