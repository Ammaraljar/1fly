-- ============================================================================
--  ترقية ١٠ — ثنائية اللغة في جداول البرنامج اليومي
--  Jusoor Global · Migration 10
--  نفّذ بعد migration_09_suppliers.sql
-- ============================================================================

-- itinerary_days: اسم المدينة بالإنجليزي + اسم الفندق بالإنجليزي
alter table itinerary_days
  add column if not exists city_name_en  text,
  add column if not exists hotel_name_en text;

-- itinerary_items: عنوان ثنائي + تفاصيل ثنائية
alter table itinerary_items
  add column if not exists title_en  text,
  add column if not exists detail_en text;
