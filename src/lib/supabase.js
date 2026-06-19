// ============================================================================
//  Supabase client — جسور جلوبال
//  يقرأ المفاتيح من متغيرات البيئة (.env) — لا تضع المفاتيح في الكود.
// ============================================================================
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.warn(
    "[Jusoor] مفاتيح Supabase غير موجودة. انسخ .env.example إلى .env واملأ القيم."
  );
}

export const supabase = createClient(url || "", anonKey || "");

// مساعد: رفع صورة إلى bucket التخزين وإرجاع الرابط العام
export async function uploadMedia(file, ownerType, ownerId) {
  const ext = file.name.split(".").pop();
  const path = `${ownerType}/${ownerId}/${crypto.randomUUID()}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from("media")
    .upload(path, file, { cacheControl: "3600", upsert: false });
  if (upErr) throw upErr;

  const { data: pub } = supabase.storage.from("media").getPublicUrl(path);

  const { data, error } = await supabase
    .from("media")
    .insert({
      owner_type: ownerType,
      owner_id: ownerId,
      storage_path: path,
      public_url: pub.publicUrl,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}
