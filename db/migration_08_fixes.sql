-- ============================================================================
--  ترقية ٨ — إصلاح البرنامج اليومي + عدد الأنشطة
--  Jusoor Global · Migration 08
--  نفّذ بعد migration_07_notes.sql
-- ============================================================================

-- ١. إضافة عمود العدد (qty) لجدول الأنشطة
alter table order_activities add column if not exists qty int not null default 1;

-- ٢. حذف القيد الفريد على (order_id, day_number) وإعادته كـ ON CONFLICT DO UPDATE
--    حتى يعمل UPSERT بدل INSERT الذي يفشل عند التكرار
alter table itinerary_days drop constraint if exists itinerary_days_order_id_day_number_key;

-- نعيد القيد كـ unique index فقط (بدون اسم constraint) لدعم ON CONFLICT
create unique index if not exists itinerary_days_unique_idx
  on itinerary_days(order_id, day_number);

-- ٣. تحديث سياسة الحذف في itinerary_days لتسمح لأي مستخدم مصادق
--    (سابقاً كانت تشترط has_perm('delete') مما يمنع التوليد التلقائي)
drop policy if exists itinerary_days_del on itinerary_days;
create policy itinerary_days_del on itinerary_days
  for delete to authenticated using (true);

drop policy if exists itinerary_items_del on itinerary_items;
create policy itinerary_items_del on itinerary_items
  for delete to authenticated using (true);
