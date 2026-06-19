-- ============================================================================
--  ترقية ٣ — العملاء + الفواتير + الدفعات
--  Jusoor Global · Migration 03 — Customers, Invoices, Payments
--
--  نفّذ هذا الملف في Supabase SQL Editor بعد schema_v2.sql.
--  يضيف:
--   • كيان العملاء المستقل (مع بحث) وربط الطلبات به
--   • جدول فواتير كامل (حالة: مدفوع/جزئي/غير مدفوع — محسوبة)
--   • جدول دفعات (سجل كل دفعة) + تحديث تلقائي لرصيد الفاتورة
-- ============================================================================

-- ===========================================================================
--  ١. العملاء  (كيان مستقل قابل لإعادة الاستخدام عبر عدة طلبات)
-- ===========================================================================
create table customers (
  id           bigint generated always as identity primary key,
  full_name    text not null,
  nationality  text,
  phone        text,
  email        text,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- بحث سريع بالاسم/الهاتف/الجنسية
create index customers_search_idx on customers
  using gin (to_tsvector('simple', coalesce(full_name,'') || ' ' || coalesce(phone,'') || ' ' || coalesce(nationality,'')));
create index customers_name_idx on customers (full_name);

-- اربط الطلبات بالعميل (نُبقي customer_name للتوافق مع الطلبات القديمة)
alter table orders add column customer_id bigint references customers(id) on delete set null;
create index orders_customer_idx on orders (customer_id);

-- ===========================================================================
--  ٢. الفواتير
--     status محسوبة تلقائيًا من (الإجمالي مقابل المدفوع).
-- ===========================================================================
create type invoice_status as enum ('unpaid', 'partial', 'paid');

create table invoices (
  id              bigint generated always as identity primary key,
  invoice_number  int unique not null,
  order_id        bigint not null references orders(id) on delete cascade,
  customer_id     bigint references customers(id) on delete set null,
  issue_date      date not null default current_date,
  due_date        date,
  total_amount    numeric(12,2) not null default 0,
  paid_amount     numeric(12,2) not null default 0,
  status          invoice_status not null default 'unpaid',
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index invoices_order_idx on invoices (order_id);
create index invoices_status_idx on invoices (status);

-- الرصيد المتبقّي كحقل محسوب
create or replace function invoice_balance(inv invoices)
returns numeric language sql immutable as $$
  select greatest(0, inv.total_amount - inv.paid_amount);
$$;

-- ===========================================================================
--  ٣. الدفعات  (سجل كل دفعة على الفاتورة)
-- ===========================================================================
create type payment_method as enum ('cash', 'bank_transfer', 'card', 'other');

create table payments (
  id           bigint generated always as identity primary key,
  invoice_id   bigint not null references invoices(id) on delete cascade,
  amount       numeric(12,2) not null check (amount > 0),
  method       payment_method not null default 'bank_transfer',
  paid_at      date not null default current_date,
  reference    text,
  notes        text,
  created_by   uuid references app_users(id),
  created_at   timestamptz not null default now()
);
create index payments_invoice_idx on payments (invoice_id);

-- ===========================================================================
--  ٤. تحديث الفاتورة تلقائيًا عند أي تغيير في الدفعات
--     يعيد حساب paid_amount والحالة (unpaid/partial/paid).
-- ===========================================================================
create or replace function recalc_invoice(p_invoice_id bigint)
returns void language plpgsql as $$
declare
  v_paid numeric(12,2);
  v_total numeric(12,2);
begin
  select coalesce(sum(amount), 0) into v_paid from payments where invoice_id = p_invoice_id;
  select total_amount into v_total from invoices where id = p_invoice_id;

  update invoices set
    paid_amount = v_paid,
    status = case
      when v_paid <= 0 then 'unpaid'::invoice_status
      when v_paid >= v_total then 'paid'::invoice_status
      else 'partial'::invoice_status
    end,
    updated_at = now()
  where id = p_invoice_id;
end $$;

create or replace function trg_payment_changed()
returns trigger language plpgsql as $$
begin
  perform recalc_invoice(coalesce(new.invoice_id, old.invoice_id));
  return null;
end $$;

create trigger payments_after_change
  after insert or update or delete on payments
  for each row execute function trg_payment_changed();

-- ===========================================================================
--  ٥. إنشاء فاتورة من طلب  (يولّد رقمًا تسلسليًا ويأخذ الإجمالي من order_totals)
-- ===========================================================================
create or replace function create_invoice_for_order(p_order_id bigint)
returns bigint language plpgsql as $$
declare
  v_num int;
  v_total numeric(12,2);
  v_customer bigint;
  v_id bigint;
begin
  -- لا تُنشئ فاتورة مكررة لنفس الطلب
  select id into v_id from invoices where order_id = p_order_id limit 1;
  if v_id is not null then return v_id; end if;

  select coalesce(max(invoice_number), 0) + 1 into v_num from invoices;
  select total_sale into v_total from order_totals where order_id = p_order_id;
  select customer_id into v_customer from orders where id = p_order_id;

  insert into invoices (invoice_number, order_id, customer_id, total_amount)
  values (v_num, p_order_id, v_customer, coalesce(v_total, 0))
  returning id into v_id;

  return v_id;
end $$;

-- ===========================================================================
--  ٦. أمان مستوى الصف (RLS)
-- ===========================================================================
do $$
declare t text;
begin
  foreach t in array array['customers','invoices','payments'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I on %I for select to authenticated using (true)', t||'_read', t);
    execute format('create policy %I on %I for insert to authenticated with check (has_perm(''add''))', t||'_ins', t);
    execute format('create policy %I on %I for update to authenticated using (has_perm(''edit''))', t||'_upd', t);
    execute format('create policy %I on %I for delete to authenticated using (has_perm(''delete''))', t||'_del', t);
  end loop;
end $$;

-- ===========================================================================
--  تم. الخطوة التالية في التطبيق: صفحات العملاء والفواتير والدفعات.
-- ===========================================================================
