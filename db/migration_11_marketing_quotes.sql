-- ============================================================================
--  ترقية ١١ — العرض التسويقي (Marketing Quotation)
--  Jusoor Global · Migration 11
--  نفّذ بعد migration_10_itinerary_bilingual.sql
--
--  يضيف:
--   • صور الغلاف والسكايلاين لكل دولة (يرفعها المستخدم من لوحة الوجهات)
--   • جدول مستقل للعروض التسويقية (لا يرتبط بطلب حجز مؤكد، عرض تسويقي قائم بذاته)
-- ============================================================================

-- ===========================================================================
--  ١. صور الدولة التسويقية (غلاف + سكايلاين شفاف للتذييل)
-- ===========================================================================
alter table countries
  add column if not exists cover_image_url    text,  -- صورة خلفية الغلاف
  add column if not exists skyline_image_url   text;  -- صورة السكايلاين (شفافة، تذييل كل صفحة)

-- ===========================================================================
--  ٢. العروض التسويقية (مستقلة عن جدول orders)
-- ===========================================================================
create table marketing_quotes (
  id              bigint generated always as identity primary key,
  ref_no          text not null,                 -- رقم مرجعي (Ref No) يظهر للعميل
  country_id      bigint references countries(id) on delete set null,
  title_ar        text not null,                 -- اسم الوجهة كما يظهر بالعنوان (مثل "ماليزيا")
  title_en        text,
  stars           int default 4,                 -- شارة النجوم
  nights          int not null default 1,
  trip_type_ar    text default 'عائلي 4 بالغين', -- نوع الرحلة (عائلي / شهر عسل / اقتصادي...)
  trip_type_en    text,
  badge_ar        text,                           -- شارة إضافية مثل "اقتصادي" (اختياري)
  badge_en        text,
  season_label_ar text default 'عروض الصيف يوليو',
  season_label_en text,
  price_per_person numeric(10,2),
  currency        text default 'رنجت',
  status          text not null default 'draft',  -- draft | sent | converted
  order_id        bigint references orders(id) on delete set null, -- إن حُوّل لطلب فعلي
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index marketing_quotes_country_idx on marketing_quotes (country_id);

-- بطاقات الفنادق الظاهرة في الغلاف (مدينة + فندق + نوع غرفة + ليالي + إفطار)
create table marketing_quote_hotels (
  id              bigint generated always as identity primary key,
  quote_id        bigint not null references marketing_quotes(id) on delete cascade,
  city_label_ar   text not null,                 -- اسم المدينة كما يظهر (مثل "سيلانجور")
  city_label_en   text,
  hotel_name_ar   text not null,
  hotel_name_en   text,
  room_type_ar    text,                           -- مثل "ديلكس" أو "Two Bedroom Suite"
  room_type_en    text,
  nights          int not null default 1,
  meal_label_ar   text default 'شامل الإفطار',
  meal_label_en   text default 'Breakfast included',
  sort_order      int not null default 0
);
create index mqh_quote_idx on marketing_quote_hotels (quote_id);

-- رحلات الطيران الداخلي الظاهرة في صفحة "رحلات الطيران"
create table marketing_quote_flights (
  id              bigint generated always as identity primary key,
  quote_id        bigint not null references marketing_quotes(id) on delete cascade,
  from_label_ar   text not null,
  from_label_en   text,
  to_label_ar     text not null,
  to_label_en     text,
  baggage_kg      int default 20,
  sort_order      int not null default 0
);
create index mqf_quote_idx on marketing_quote_flights (quote_id);

-- مدن الجولات (كل مدينة فيها استقبال + جولة سياحية ١/٢/٣ كنص حر)
create table marketing_quote_cities (
  id              bigint generated always as identity primary key,
  quote_id        bigint not null references marketing_quotes(id) on delete cascade,
  city_label_ar   text not null,
  city_label_en   text,
  color_key       text default 'navy',           -- navy | red (للتلوين بالتبادل كما بالنموذج)
  sort_order      int not null default 0
);
create index mqc_quote_idx on marketing_quote_cities (quote_id);

-- جولة سياحية واحدة (مرتبطة بمدينة)، تحوي قائمة نقطية كنص حر (سطر بكل عنصر)
create table marketing_quote_tours (
  id              bigint generated always as identity primary key,
  city_row_id     bigint not null references marketing_quote_cities(id) on delete cascade,
  label_ar        text not null,                 -- مثل "جولة سياحية 1" أو "جولة تسوق"
  label_en        text,
  items_ar        text not null,                 -- كل سطر = عنصر في القائمة النقطية
  items_en        text,
  sort_order      int not null default 0
);
create index mqt_city_idx on marketing_quote_tours (city_row_id);

-- "العرض يشمل" — قائمة بنود قابلة للتخصيص لكل عرض (تأخذ افتراضياً من قالب ثابت)
create table marketing_quote_includes (
  id              bigint generated always as identity primary key,
  quote_id        bigint not null references marketing_quotes(id) on delete cascade,
  icon_key        text not null,                  -- مفتاح الأيقونة (انظر القائمة في الواجهة)
  label_ar        text not null,
  label_en        text,
  is_gift         boolean not null default false, -- true = يظهر في صندوق "هدايا وخدمات إضافية"
  sort_order      int not null default 0
);
create index mqi_quote_idx on marketing_quote_includes (quote_id);

-- ===========================================================================
--  ٣. أمان مستوى الصف
-- ===========================================================================
do $$
declare t text;
begin
  foreach t in array array[
    'marketing_quotes','marketing_quote_hotels','marketing_quote_flights',
    'marketing_quote_cities','marketing_quote_tours','marketing_quote_includes'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I on %I for select to authenticated using (true)', t||'_read', t);
    execute format('create policy %I on %I for insert to authenticated with check (has_perm(''add''))', t||'_ins', t);
    execute format('create policy %I on %I for update to authenticated using (has_perm(''edit''))', t||'_upd', t);
    execute format('create policy %I on %I for delete to authenticated using (has_perm(''delete''))', t||'_del', t);
  end loop;
end $$;
