-- ============================================================================
--  ترقية ٤ — التقارير + استيراد CSV + إشعارات البريد
--  Jusoor Global · Migration 04 — Reports view, Email settings/queue
--
--  نفّذ بعد migration_03_customers_invoices.sql.
-- ============================================================================

-- ===========================================================================
--  ١. منظور تقارير الأرباح حسب نوع الخدمة (مجمّع لكل طلب وفئة)
--     يستخدمه تقرير "الربح حسب النوع/الفترة" في الواجهة.
-- ===========================================================================
create or replace view report_margins as
select o.id as order_id, o.created_at::date as order_date, o.status,
       'hotels'::text as service_type,
       coalesce(sum(h.cost),0) as cost, coalesce(sum(h.sale),0) as sale,
       coalesce(sum(h.sale),0) - coalesce(sum(h.cost),0) as margin
from orders o left join order_hotels h on h.order_id = o.id group by o.id
union all
select o.id, o.created_at::date, o.status, 'tours',
       coalesce(sum(t.cost),0), coalesce(sum(t.sale),0),
       coalesce(sum(t.sale),0) - coalesce(sum(t.cost),0)
from orders o left join order_tours t on t.order_id = o.id group by o.id
union all
select o.id, o.created_at::date, o.status, 'activities',
       coalesce(sum(a.cost),0), coalesce(sum(a.sale),0),
       coalesce(sum(a.sale),0) - coalesce(sum(a.cost),0)
from orders o left join order_activities a on a.order_id = o.id group by o.id
union all
select o.id, o.created_at::date, o.status, 'transport',
       coalesce(sum(tr.cost),0), coalesce(sum(tr.sale),0),
       coalesce(sum(tr.sale),0) - coalesce(sum(tr.cost),0)
from orders o left join order_transport tr on tr.order_id = o.id group by o.id;

-- دالة ملخّص ضمن فترة (تُستدعى من الواجهة عبر RPC)
create or replace function report_summary(p_from date, p_to date)
returns table (service_type text, total_cost numeric, total_sale numeric, total_margin numeric, orders_count bigint)
language sql stable as $$
  select service_type,
         sum(cost) as total_cost,
         sum(sale) as total_sale,
         sum(margin) as total_margin,
         count(distinct order_id) filter (where sale > 0) as orders_count
  from report_margins
  where order_date between p_from and p_to
  group by service_type
  order by total_margin desc;
$$;

-- ===========================================================================
--  ٢. صندوق إشعارات البريد (Outbox)
--     تكتب الواجهة هنا، وتقرأ Edge Function وترسل عبر مزوّد (Resend/SMTP).
-- ===========================================================================
create type email_kind as enum ('booking_confirm', 'status_change', 'payment_reminder', 'owner_alert');
create type email_state as enum ('queued', 'sent', 'failed');

create table email_outbox (
  id           bigint generated always as identity primary key,
  kind         email_kind not null,
  to_email     text not null,
  subject      text not null,
  body_html    text not null,
  order_id     bigint references orders(id) on delete set null,
  state        email_state not null default 'queued',
  error        text,
  created_at   timestamptz not null default now(),
  sent_at      timestamptz
);
create index email_outbox_state_idx on email_outbox (state);

-- إعدادات البريد (مفتاح/قيمة) — لتخزين بريد المالك وتفضيلات الإرسال
create table app_settings (
  key   text primary key,
  value text
);
insert into app_settings (key, value) values
  ('owner_email', ''),
  ('notify_on_new_order', 'true'),
  ('notify_on_payment_due', 'true'),
  ('company_name', 'Jusoor Global')
on conflict (key) do nothing;

-- ===========================================================================
--  ٣. أمان مستوى الصف
-- ===========================================================================
alter table email_outbox enable row level security;
alter table app_settings enable row level security;

create policy email_read on email_outbox for select to authenticated using (true);
create policy email_ins  on email_outbox for insert to authenticated with check (has_perm('edit'));
create policy settings_read on app_settings for select to authenticated using (true);
create policy settings_upd  on app_settings for update to authenticated using (has_perm('super_edit'));

-- ===========================================================================
--  تم. إشعارات الإرسال الفعلي تتم عبر Supabase Edge Function (supabase/functions).
-- ===========================================================================
