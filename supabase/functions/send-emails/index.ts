// ============================================================================
//  Supabase Edge Function — إرسال البريد المُجدوَل
//  Jusoor Global · send-emails
//
//  يقرأ الرسائل ذات الحالة 'queued' من email_outbox ويرسلها عبر Resend،
//  ثم يحدّث حالتها إلى 'sent' أو 'failed'.
//
//  النشر:
//    supabase functions deploy send-emails
//    supabase secrets set RESEND_API_KEY=xxxx  EMAIL_FROM="Jusoor <noreply@jusoor.global>"
//  ثم جدوِلها (Cron) كل بضع دقائق من Supabase Dashboard → Edge Functions → Schedules.
// ============================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  const FROM = Deno.env.get("EMAIL_FROM") ?? "Jusoor <noreply@jusoor.global>";

  // اجلب حتى ٢٠ رسالة في الانتظار
  const { data: queued, error } = await supabase
    .from("email_outbox")
    .select("*")
    .eq("state", "queued")
    .order("created_at", { ascending: true })
    .limit(20);

  if (error) return json({ error: error.message }, 500);
  if (!queued?.length) return json({ sent: 0, message: "لا رسائل في الانتظار" });

  let sent = 0, failed = 0;
  for (const msg of queued) {
    try {
      if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY غير مضبوط");
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: FROM, to: msg.to_email, subject: msg.subject, html: msg.body_html }),
      });
      if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
      await supabase.from("email_outbox").update({ state: "sent", sent_at: new Date().toISOString() }).eq("id", msg.id);
      sent++;
    } catch (e) {
      await supabase.from("email_outbox").update({ state: "failed", error: String(e) }).eq("id", msg.id);
      failed++;
    }
  }
  return json({ sent, failed });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
