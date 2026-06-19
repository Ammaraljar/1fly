-- ============================================================================
--  ترقية ٧ — إضافة عمود الملاحظات لجداول بنود الطلب
--  Jusoor Global · Migration 07 — Add notes column to order line tables
--
--  السبب: الكود يُرسل حقل notes لكل بند، لكن الجداول لا تحتوي العمود
--         مما يسبب خطأ 400 Bad Request عند كل إضافة فندق/جولة/نشاط/مواصلات.
--
--  نفّذ بعد migration_06_flights.sql
-- ============================================================================

alter table order_hotels     add column if not exists notes text;
alter table order_tours      add column if not exists notes text;
alter table order_activities add column if not exists notes text;
alter table order_transport  add column if not exists notes text;

-- order_flights أُنشئ في migration_06 وتضمّن notes مسبقاً — لا حاجة لتعديله.

comment on column order_hotels.notes     is 'ملاحظات الفندق — تظهر في البرنامج السياحي';
comment on column order_tours.notes      is 'ملاحظات الجولة — تظهر في البرنامج السياحي';
comment on column order_activities.notes is 'ملاحظات النشاط — تظهر في البرنامج السياحي';
comment on column order_transport.notes  is 'ملاحظات المواصلات — تظهر في البرنامج السياحي';
