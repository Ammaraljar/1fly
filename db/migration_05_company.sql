-- ============================================================================
--  ترقية ٥ — بيانات الشركة (لكل المستندات المطبوعة)
--  Jusoor Global · Migration 05 — Company profile settings
--
--  نفّذ بعد migration_04_reports_email.sql.
--  app_settings جدول مفتاح/قيمة، فنضيف مفاتيح الشركة فقط.
-- ============================================================================

insert into app_settings (key, value) values
  ('company_name_ar',   'جسور جلوبال'),
  ('company_name_en',   'Jusoor Global'),
  ('company_address_ar',''),
  ('company_address_en',''),
  ('company_email',     ''),
  ('company_phone',     ''),
  ('company_website',   'jusoor.global'),
  ('company_logo_url',  ''),
  ('bank_beneficiary',  'Jusoor Global'),
  ('bank_name',         ''),
  ('bank_iban',         ''),
  ('bank_swift',        '')
on conflict (key) do nothing;

-- شعار الشركة يُخزَّن في bucket التخزين media تحت المسار company/ — لا حاجة لجدول.
