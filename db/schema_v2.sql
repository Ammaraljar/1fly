-- ============================================================================
--  جسور جلوبال — منصة البرامج السياحية  (المخطط الكامل الجديد)
--  Jusoor Global — Tourism Platform · Hierarchical schema v2
--
--  الهيكل:  دولة → مدينة → (فنادق / جولات / أنشطة)
--           المواصلات قسم مستقل (انتقال بين موقعين)
--           وسائط (صور) مرتبطة بالفنادق والجولات
--           طلبات → برنامج يومي (itinerary) يُولَّد من التواريخ
--
--  نفّذ هذا الملف في:  Supabase ← SQL Editor ← New query
-- ============================================================================

create extension if not exists "pgcrypto";

-- ===========================================================================
--  ١. الهيكل الهرمي للوجهات
-- ===========================================================================

-- الدول
create table countries (
  id          bigint generated always as identity primary key,
  name_ar     text not null,
  name_en     text not null,
  iso_code    text,                         -- مثل MY, TH, ID
  created_at  timestamptz not null default now()
);

-- المدن (مرتبطة بدولة)
create table cities (
  id          bigint generated always as identity primary key,
  country_id  bigint not null references countries(id) on delete cascade,
  name_ar     text not null,
  name_en     text not null,
  created_at  timestamptz not null default now()
);

-- الفنادق (مرتبطة بمدينة)
create table hotels (
  id          bigint generated always as identity primary key,
  city_id     bigint not null references cities(id) on delete cascade,
  name_ar     text not null,
  name_en     text not null,
  stars       int check (stars between 1 and 7),
  description_ar text,
  created_at  timestamptz not null default now()
);

-- أنواع الغرف (مرتبطة بفندق)
create table room_types (
  id          bigint generated always as identity primary key,
  hotel_id    bigint not null references hotels(id) on delete cascade,
  name        text not null,
  default_cost numeric(12,2) default 0,
  default_sale numeric(12,2) default 0
);

-- الجولات السياحية (مرتبطة بمدينة)
create table tours (
  id          bigint generated always as identity primary key,
  city_id     bigint not null references cities(id) on delete cascade,
  title_ar    text not null,
  title_en    text,
  description_ar text,
  duration_hours numeric(4,1),              -- مدة الجولة بالساعات
  default_cost numeric(12,2) default 0,
  default_sale numeric(12,2) default 0,
  created_at  timestamptz not null default now()
);

-- الأنشطة والخدمات السياحية (مرتبطة بمدينة)
create table activities (
  id          bigint generated always as identity primary key,
  city_id     bigint not null references cities(id) on delete cascade,
  title_ar    text not null,
  title_en    text,
  description_ar text,
  default_cost numeric(12,2) default 0,
  default_sale numeric(12,2) default 0,
  created_at  timestamptz not null default now()
);

-- ===========================================================================
--  ٢. الوسائط (صور متعددة لكل فندق/جولة/نشاط)
--     الصور نفسها في Supabase Storage؛ هذا الجدول يحفظ الروابط والربط.
-- ===========================================================================
create type media_owner as enum ('hotel', 'tour', 'activity');

create table media (
  id          bigint generated always as identity primary key,
  owner_type  media_owner not null,
  owner_id    bigint not null,              -- id الفندق/الجولة/النشاط
  storage_path text not null,               -- المسار داخل bucket التخزين
  public_url  text not null,                -- الرابط العام للصورة
  is_cover    boolean not null default false, -- الصورة الرئيسية
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);
create index on media(owner_type, owner_id);

-- ===========================================================================
--  ٣. المواصلات (قسم مستقل — انتقال بين موقعين)
-- ===========================================================================
create type transport_mode as enum ('flight', 'private_car', 'bus', 'train', 'ferry', 'van');

-- كتالوج خطوط النقل القابلة لإعادة الاستخدام
create table transport_routes (
  id            bigint generated always as identity primary key,
  mode          transport_mode not null,
  from_label_ar text not null,              -- نقطة الانطلاق (مدينة/مطار/فندق)
  to_label_ar   text not null,              -- نقطة الوصول
  from_city_id  bigint references cities(id) on delete set null,
  to_city_id    bigint references cities(id) on delete set null,
  duration_min  int,                        -- مدة الرحلة بالدقائق
  default_cost  numeric(12,2) default 0,
  default_sale  numeric(12,2) default 0,
  created_at    timestamptz not null default now()
);

-- ===========================================================================
--  ٤. المستخدمون والصلاحيات  (المصادقة عبر Supabase Auth)
-- ===========================================================================
create table app_users (
  id           uuid primary key default gen_random_uuid(),
  auth_uid     uuid unique,                 -- يربط مع auth.users
  username     text unique not null,
  display_name text,
  can_add      boolean not null default false,
  can_edit     boolean not null default false,
  can_delete   boolean not null default false,
  super_edit   boolean not null default false,
  created_at   timestamptz not null default now()
);

-- دالة مساعدة: هل المستخدم الحالي يملك صلاحية معينة؟
create or replace function has_perm(perm text)
returns boolean language sql stable as $$
  select exists (
    select 1 from app_users u
    where u.auth_uid = auth.uid()
      and case perm
        when 'add'        then u.can_add
        when 'edit'       then u.can_edit or u.super_edit
        when 'delete'     then u.can_delete
        when 'super_edit' then u.super_edit
        else false end
  );
$$;

-- ===========================================================================
--  ٥. الطلبات  (رأس الطلب)
-- ===========================================================================
create type order_status as enum ('offer', 'in_progress', 'done');

create table orders (
  id              bigint generated always as identity primary key,
  customer_name   text not null,
  nationality     text,
  package_label   text,
  arrival_date    date not null,
  depart_date     date not null,
  adults          int not null default 1 check (adults >= 0),
  kids            int not null default 0 check (kids >= 0),
  infants         int not null default 0 check (infants >= 0),
  status          order_status not null default 'offer',
  received_amount numeric(12,2) not null default 0,
  invoice_id      int,
  created_by      uuid references app_users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ===========================================================================
--  ٦. بنود الطلب  (تشير إلى الكتالوج لكن تحفظ القيم لحظة الحجز)
-- ===========================================================================
create table order_hotels (
  id          bigint generated always as identity primary key,
  order_id    bigint not null references orders(id) on delete cascade,
  hotel_id    bigint references hotels(id) on delete set null,
  hotel_name  text not null,                -- snapshot للاسم وقت الحجز
  city_name   text,
  room_type   text,
  checkin     date,
  checkout    date,
  nights      int generated always as (greatest(0, checkout - checkin)) stored,
  rooms       int not null default 1,
  cost        numeric(12,2) not null default 0,
  sale        numeric(12,2) not null default 0,
  margin      numeric(12,2) generated always as (sale - cost) stored
);

create table order_tours (
  id          bigint generated always as identity primary key,
  order_id    bigint not null references orders(id) on delete cascade,
  tour_id     bigint references tours(id) on delete set null,
  title       text not null,
  city_name   text,
  tour_date   date,
  cost        numeric(12,2) not null default 0,
  sale        numeric(12,2) not null default 0,
  margin      numeric(12,2) generated always as (sale - cost) stored
);

create table order_activities (
  id          bigint generated always as identity primary key,
  order_id    bigint not null references orders(id) on delete cascade,
  activity_id bigint references activities(id) on delete set null,
  title       text not null,
  city_name   text,
  activity_date date,
  cost        numeric(12,2) not null default 0,
  sale        numeric(12,2) not null default 0,
  margin      numeric(12,2) generated always as (sale - cost) stored
);

create table order_transport (
  id            bigint generated always as identity primary key,
  order_id      bigint not null references orders(id) on delete cascade,
  route_id      bigint references transport_routes(id) on delete set null,
  mode          transport_mode not null,
  from_label    text,
  to_label      text,
  transport_date date,
  duration_min  int,
  cost          numeric(12,2) not null default 0,
  sale          numeric(12,2) not null default 0,
  margin        numeric(12,2) generated always as (sale - cost) stored
);

-- ===========================================================================
--  ٧. البرنامج اليومي (Itinerary) — يُولَّد من التواريخ ثم يُحرَّر
--     كل يوم يجمع: المدينة + الفندق + الوجبات + الجولات + التنقلات + ملاحظات
-- ===========================================================================
create table itinerary_days (
  id          bigint generated always as identity primary key,
  order_id    bigint not null references orders(id) on delete cascade,
  day_number  int not null,                 -- اليوم ١، ٢، ٣...
  day_date    date,
  city_name   text,
  hotel_name  text,
  meals       text,                         -- مثل: فطور، عشاء
  notes_ar    text,
  sort_order  int not null default 0,
  unique (order_id, day_number)
);

-- عناصر اليوم (جولات/تنقلات/أنشطة مرتبة داخل اليوم الواحد)
create type day_item_type as enum ('tour', 'transport', 'activity', 'note', 'checkin', 'checkout');

create table itinerary_items (
  id          bigint generated always as identity primary key,
  day_id      bigint not null references itinerary_days(id) on delete cascade,
  item_type   day_item_type not null,
  time_label  text,                         -- مثل: 09:00 صباحًا
  title_ar    text not null,
  detail_ar   text,
  ref_id      bigint,                       -- id الجولة/النشاط المرتبط (لجلب الصور)
  sort_order  int not null default 0
);
create index on itinerary_days(order_id);
create index on itinerary_items(day_id);

-- ===========================================================================
--  ٨. إجماليات الطلب (محسوبة لحظيًا)
-- ===========================================================================
create view order_totals as
select o.id as order_id,
  coalesce(h.c,0)+coalesce(t.c,0)+coalesce(a.c,0)+coalesce(tr.c,0) as total_cost,
  coalesce(h.s,0)+coalesce(t.s,0)+coalesce(a.s,0)+coalesce(tr.s,0) as total_sale,
  (coalesce(h.s,0)+coalesce(t.s,0)+coalesce(a.s,0)+coalesce(tr.s,0))
   - (coalesce(h.c,0)+coalesce(t.c,0)+coalesce(a.c,0)+coalesce(tr.c,0)) as total_margin
from orders o
left join (select order_id, sum(cost) c, sum(sale) s from order_hotels     group by order_id) h  on h.order_id=o.id
left join (select order_id, sum(cost) c, sum(sale) s from order_tours      group by order_id) t  on t.order_id=o.id
left join (select order_id, sum(cost) c, sum(sale) s from order_activities group by order_id) a  on a.order_id=o.id
left join (select order_id, sum(cost) c, sum(sale) s from order_transport  group by order_id) tr on tr.order_id=o.id;

-- ===========================================================================
--  ٩. ترقيم الفاتورة الآلي عند الإنجاز
-- ===========================================================================
create or replace function assign_invoice_id()
returns trigger language plpgsql as $$
begin
  if new.status = 'done' and new.invoice_id is null then
    select coalesce(max(invoice_id), 0) + 1 into new.invoice_id from orders;
  end if;
  new.updated_at := now();
  return new;
end $$;

create trigger trg_assign_invoice
  before update on orders
  for each row execute function assign_invoice_id();

-- ===========================================================================
--  ١٠. أمان مستوى الصف (RLS)
-- ===========================================================================
do $$
declare t text;
begin
  foreach t in array array[
    'countries','cities','hotels','room_types','tours','activities','media',
    'transport_routes','orders','order_hotels','order_tours','order_activities',
    'order_transport','itinerary_days','itinerary_items'
  ] loop
    execute format('alter table %I enable row level security', t);
    -- القراءة لأي مستخدم مسجَّل
    execute format('create policy %I on %I for select to authenticated using (true)', t||'_read', t);
    -- الإضافة/التعديل/الحذف حسب الصلاحيات
    execute format('create policy %I on %I for insert to authenticated with check (has_perm(''add''))', t||'_ins', t);
    execute format('create policy %I on %I for update to authenticated using (has_perm(''edit''))', t||'_upd', t);
    execute format('create policy %I on %I for delete to authenticated using (has_perm(''delete''))', t||'_del', t);
  end loop;
end $$;

-- ===========================================================================
--  ١١. التخزين (Storage) — bucket عام لصور الفنادق والجولات
--     (يُنشأ من واجهة Supabase Storage، أو عبر الأمر التالي إن توفّر)
-- ===========================================================================
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

-- سياسة رفع للصور (للمستخدمين المسجَّلين)
create policy "media_upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'media');
create policy "media_read" on storage.objects for select to public
  using (bucket_id = 'media');
create policy "media_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'media' and has_perm('delete'));

-- ===========================================================================
--  تم. الخطوة التالية: شغّل seed_admin.sql لإنشاء أول مستخدم مدير.
-- ===========================================================================
