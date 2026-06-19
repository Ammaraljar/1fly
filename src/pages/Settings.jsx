// ============================================================================
//  الإعدادات: بيانات الشركة + الإشعارات + سجل البريد — جسور جلوبال
//  بيانات الشركة (مع الشعار) تظهر في كل المستندات المطبوعة.
// ============================================================================
import React, { useState, useEffect, useRef } from "react";
import { Settings as Cog, Mail, Save, Building2, Upload, Image as ImageIcon,
  CheckCircle2, Clock, XCircle, Landmark } from "lucide-react";
import { db } from "../lib/data.js";
import { useI18n } from "../lib/i18n.jsx";
import { useAuth } from "../auth/AuthProvider.jsx";
import { Field, Spinner, useToast } from "../components/ui.jsx";
import { formatDate } from "../lib/format.js";

export default function Settings() {
  const { t, lang } = useI18n();
  const { perms } = useAuth();
  const { show, node: toast } = useToast();
  const [map, setMap] = useState(null);
  const [emails, setEmails] = useState([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);
  const canEdit = perms.super_edit;

  useEffect(() => {
    db.settings.map().then(setMap);
    db.email.list().then(({ data }) => setEmails(data || []));
  }, []);

  if (!map) return <div className="page"><Spinner /></div>;

  const set = (k, v) => setMap((m) => ({ ...m, [k]: v }));

  const CO_KEYS = [
    "company_name_ar", "company_name_en", "company_address_ar", "company_address_en",
    "company_email", "company_phone", "company_website",
    "bank_beneficiary", "bank_name", "bank_iban", "bank_swift",
    "notify_on_new_order", "notify_on_payment_due",
  ];
  const save = async () => {
    await Promise.all(CO_KEYS.map((k) => db.settings.set(k, map[k] ?? "")));
    show(t("saved"));
  };

  const onLogo = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await db.settings.uploadLogo(file);
      set("company_logo_url", url);
      show(t("saved"));
    } catch (err) { show(err.message, "err"); } finally { setUploading(false); }
  };

  const ST = {
    queued: { ic: Clock, c: "var(--gold)", k: "email_queued" },
    sent: { ic: CheckCircle2, c: "var(--done)", k: "email_sent" },
    failed: { ic: XCircle, c: "var(--danger)", k: "email_failed" },
  };

  return (
    <div className="page">
      <header className="page-head">
        <div><h1>{t("set_title")}</h1><p className="page-desc">{t("co_title")}</p></div>
        {canEdit && <button className="btn btn-gold" onClick={save}><Save size={16} /> {t("save")}</button>}
      </header>

      {/* بيانات الشركة + الشعار */}
      <div className="card pad">
        <h3 className="sub-h"><Building2 size={16} /> {t("co_title")}</h3>
        <div className="co-logo-row">
          <div className="co-logo-box">
            {map.company_logo_url
              ? <img src={map.company_logo_url} alt="logo" />
              : <div className="co-logo-ph"><ImageIcon size={26} /></div>}
          </div>
          <div className="co-logo-actions">
            <div className="co-logo-label">{t("co_logo")}</div>
            <div className="co-logo-hint">{t("co_logo_hint")}</div>
            {canEdit && (
              <>
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={onLogo} />
                <button className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
                  <Upload size={15} /> {uploading ? t("img_uploading") : t("co_logo_upload")}
                </button>
              </>
            )}
          </div>
        </div>

        <div className="modal-grid" style={{ marginTop: 16 }}>
          <Field label={t("co_name_ar")}><input value={map.company_name_ar || ""} disabled={!canEdit} dir="rtl" onChange={(e) => set("company_name_ar", e.target.value)} /></Field>
          <Field label={t("co_name_en")}><input className="ltr" value={map.company_name_en || ""} disabled={!canEdit} onChange={(e) => set("company_name_en", e.target.value)} /></Field>
          <Field label={t("co_address_ar")}><input value={map.company_address_ar || ""} disabled={!canEdit} dir="rtl" onChange={(e) => set("company_address_ar", e.target.value)} /></Field>
          <Field label={t("co_address_en")}><input className="ltr" value={map.company_address_en || ""} disabled={!canEdit} onChange={(e) => set("company_address_en", e.target.value)} /></Field>
          <Field label={t("co_email")}><input className="ltr" value={map.company_email || ""} disabled={!canEdit} onChange={(e) => set("company_email", e.target.value)} /></Field>
          <Field label={t("co_phone")}><input className="ltr" value={map.company_phone || ""} disabled={!canEdit} onChange={(e) => set("company_phone", e.target.value)} /></Field>
          <Field label={t("co_website")}><input className="ltr" value={map.company_website || ""} disabled={!canEdit} onChange={(e) => set("company_website", e.target.value)} /></Field>
        </div>
      </div>

      {/* بيانات البنك */}
      <div className="card pad rep-section">
        <h3 className="sub-h"><Landmark size={16} /> {t("co_bank")}</h3>
        <div className="modal-grid">
          <Field label={t("co_bank_benef")}><input className="ltr" value={map.bank_beneficiary || ""} disabled={!canEdit} onChange={(e) => set("bank_beneficiary", e.target.value)} /></Field>
          <Field label={t("co_bank_name")}><input className="ltr" value={map.bank_name || ""} disabled={!canEdit} onChange={(e) => set("bank_name", e.target.value)} /></Field>
          <Field label={t("co_bank_iban")}><input className="ltr" value={map.bank_iban || ""} disabled={!canEdit} onChange={(e) => set("bank_iban", e.target.value)} /></Field>
          <Field label={t("co_bank_swift")}><input className="ltr" value={map.bank_swift || ""} disabled={!canEdit} onChange={(e) => set("bank_swift", e.target.value)} /></Field>
        </div>
      </div>

      {/* الإشعارات */}
      <div className="card pad rep-section">
        <h3 className="sub-h"><Mail size={16} /> {t("nav_settings")}</h3>
        <Field label={t("set_owner_email")}><input className="ltr" value={map.owner_email || ""} disabled={!canEdit} onChange={(e) => set("owner_email", e.target.value)} /></Field>
        <div className="set-toggles">
          <label className="set-toggle">
            <input type="checkbox" checked={map.notify_on_new_order === "true"} disabled={!canEdit}
              onChange={(e) => set("notify_on_new_order", e.target.checked ? "true" : "false")} />
            <span>{t("set_notify_order")}</span>
          </label>
          <label className="set-toggle">
            <input type="checkbox" checked={map.notify_on_payment_due === "true"} disabled={!canEdit}
              onChange={(e) => set("notify_on_payment_due", e.target.checked ? "true" : "false")} />
            <span>{t("set_notify_pay")}</span>
          </label>
        </div>
        <p className="dim-note" style={{ marginTop: 14, textAlign: "start" }}><Mail size={13} style={{ verticalAlign: -2 }} /> {t("set_email_note")}</p>
      </div>

      {/* سجل البريد */}
      <div className="card pad rep-section">
        <h3 className="sub-h"><Mail size={16} /> {t("set_email_log")}</h3>
        {emails.length === 0 ? <p className="dim-note">{t("email_none")}</p> : (
          <table className="tbl mini">
            <thead><tr><th>{t("inv_status")}</th><th>{t("set_owner_email")}</th><th>{t("imp_target")}</th><th className="ltr">{t("doc_date")}</th></tr></thead>
            <tbody>
              {emails.map((m) => {
                const s = ST[m.state] || ST.queued; const Ic = s.ic;
                return (
                  <tr key={m.id}>
                    <td><span className="badge" style={{ "--bc": s.c }}><Ic size={12} /> {t(s.k)}</span></td>
                    <td className="ltr">{m.to_email}</td><td>{m.subject}</td>
                    <td className="ltr">{formatDate((m.created_at || "").slice(0, 10), lang)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      {toast}
    </div>
  );
}
