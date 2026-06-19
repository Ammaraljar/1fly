-- ============================================================================
--  إنشاء أول مستخدم مدير — جسور جلوبال
--  الخطوات:
--   1) في Supabase ← Authentication ← Users ← Add user
--      أنشئ مستخدمًا بالبريد وكلمة المرور (مثلاً admin@jusoor.global)
--   2) انسخ الـ UID الخاص به
--   3) نفّذ هذا الأمر مع وضع الـ UID مكان <AUTH_UID>
-- ============================================================================
insert into app_users (auth_uid, username, display_name, can_add, can_edit, can_delete, super_edit)
values ('<AUTH_UID>', 'admin', 'مدير النظام', true, true, true, true);

-- لإضافة موظف حجوزات (بدون حذف):
-- insert into app_users (auth_uid, username, display_name, can_add, can_edit, can_delete, super_edit)
-- values ('<AUTH_UID_2>', 'agent', 'موظف الحجوزات', true, true, false, false);
