// ============================================================================
//  الفواتير والدفعات — جسور جلوبال  (الأولوية ١)
//  قائمة فواتير + نافذة تفاصيل تشمل الدفعات وتسجيل دفعة جديدة.
//  InvoiceModal يُعاد استخدامها من محرّر الطلب (تمرير orderId).
// ============================================================================
import React, { useState, useEffect, useCallback } from "react";
import {
  Receipt, Plus, Trash2, FileText, CreditCard, Wallet, X, CheckCircle2,
} from "lucide-react";
import { db } from "../lib/data.js";
import { useI18n } from "../lib/i18n.jsx";
import { useAuth } from "../auth/AuthProvider.jsx";
import { Field, Select, Modal, Spinner, Empty, useToast } from "../components/ui.jsx";
import { fmt, CUR, formatDate, todayISO } from "../lib/format.js";

const ST_COLOR = { unpaid: "var(--danger)", partial: "var(--gold)", paid: "var(--done)" };
const ST_KEY = { unpaid: "st_unpaid", partial: "st_partial", paid: "st_paid" };

export function InvoiceStatusBadge({ status }) {
  const { t } = useI18n();
  return (
    <span className="badge" style={{ "--bc": ST_COLOR[status] }}>
      <span className="badge-dot" style={{ background: ST_COLOR[status] }} /> {t(ST_KEY[status])}
    </span>
  );
}

/* ============================ صفحة قائمة الفواتير ============================ */
export default function Invoices({ onOpenOrder }) {
  const { t, lang } = useI18n();
  const [rows, setRows] = useState(null);
  const [status, setStatus] = useState("");
  const [openId, setOpenId] = useState(null);

  const load = useCallback(() => {
    db.invoices.list(status || undefined).then(({ data }) => setRows(data || []));
  }, [status]);
  useEffect(() => { load(); }, [load]);

  const filters = [["", t("all") || "الكل"], ["unpaid", t("st_unpaid")], ["partial", t("st_partial")], ["paid", t("st_paid")]];

  return (
    <div className="page">
      <header className="page-head">
        <div><h1>{t("inv_title")}</h1><p className="page-desc">{t("inv_desc")}</p></div>
      </header>

      <div className="tabs">
        {filters.map(([v, label]) => (
          <button key={v} className={"tab" + (status === v ? " on" : "")} onClick={() => setStatus(v)}
            style={status === v ? { "--tc": v ? ST_COLOR[v] : "var(--navy)" } : {}}>{label}</button>
        ))}
      </div>

      {rows === null ? <Spinner /> : rows.length === 0 ? (
        <Empty icon={Receipt} title={t("inv_empty")} />
      ) : (
        <div className="card tablewrap">
          <table className="tbl">
            <thead><tr>
              <th>{t("inv_number")}</th><th>{t("customer")}</th><th>{t("inv_issue")}</th>
              <th className="num">{t("inv_total")}</th><th className="num">{t("inv_paid")}</th>
              <th className="num">{t("inv_balance")}</th><th>{t("inv_status")}</th>
            </tr></thead>
            <tbody>
              {rows.map((inv) => {
                const bal = Math.max(0, (+inv.total_amount) - (+inv.paid_amount));
                return (
                  <tr key={inv.id} onClick={() => setOpenId(inv.id)}>
                    <td className="strong">#{String(inv.invoice_number).padStart(4, "0")}</td>
                    <td>{inv.customers?.full_name || inv.orders?.customer_name || "—"}</td>
                    <td className="ltr">{formatDate(inv.issue_date, lang)}</td>
                    <td className="num">{CUR}{fmt(inv.total_amount)}</td>
                    <td className="num">{CUR}{fmt(inv.paid_amount)}</td>
                    <td className="num" style={{ color: bal > 0 ? "var(--danger)" : "var(--done)" }}>{CUR}{fmt(bal)}</td>
                    <td><InvoiceStatusBadge status={inv.status} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {openId && <InvoiceModal invoiceId={openId} onClose={() => { setOpenId(null); load(); }} />}
    </div>
  );
}

/* ============================ نافذة الفاتورة + الدفعات ============================ */
export function InvoiceModal({ invoiceId, orderId, onClose }) {
  const { t, lang } = useI18n();
  const { perms } = useAuth();
  const { show, node: toast } = useToast();
  const [inv, setInv] = useState(null);
  const [loading, setLoading] = useState(true);
  const [noInvoice, setNoInvoice] = useState(false);
  const [payOpen, setPayOpen] = useState(false);

  const loadById = useCallback(async (id) => {
    const { data } = await db.invoices.get(id);
    setInv(data); setLoading(false);
  }, []);

  const loadByOrder = useCallback(async (oid) => {
    const { data } = await db.invoices.byOrder(oid);
    if (data) { await loadById(data.id); }
    else { setNoInvoice(true); setLoading(false); }
  }, [loadById]);

  useEffect(() => {
    if (invoiceId) loadById(invoiceId);
    else if (orderId) loadByOrder(orderId);
  }, [invoiceId, orderId, loadById, loadByOrder]);

  const createInvoice = async () => {
    setLoading(true);
    const { data, error } = await db.invoices.createForOrder(orderId);
    if (error) { show(error.message, "err"); setLoading(false); return; }
    setNoInvoice(false);
    await loadById(data);
    show(t("saved"));
  };

  const addPayment = async (p) => {
    const { error } = await db.payments.add({ invoice_id: inv.id, ...p });
    if (error) { show(error.message, "err"); return; }
    setPayOpen(false);
    await loadById(inv.id);  // الـ trigger يعيد حساب الحالة
    show(t("saved"));
  };
  const delPayment = async (id) => { await db.payments.remove(id); await loadById(inv.id); show(t("saved")); };

  const title = inv ? `${t("inv_number")} #${String(inv.invoice_number).padStart(4, "0")}` : t("inv_title");

  return (
    <Modal title={title} onClose={onClose} wide>
      {loading ? <Spinner /> : noInvoice ? (
        <div className="inv-empty-create">
          <Receipt size={30} />
          <p>{t("inv_none_order")}</p>
          {perms.add && <button className="btn btn-gold" onClick={createInvoice}><Plus size={16} /> {t("inv_create")}</button>}
        </div>
      ) : inv ? (
        <>
          <div className="inv-summary">
            <div className="inv-sum-card">
              <span>{t("inv_total")}</span><b>{CUR}{fmt(inv.total_amount)}</b>
            </div>
            <div className="inv-sum-card">
              <span>{t("inv_paid")}</span><b className="ok">{CUR}{fmt(inv.paid_amount)}</b>
            </div>
            <div className="inv-sum-card">
              <span>{t("inv_balance")}</span>
              <b className={inv.total_amount - inv.paid_amount > 0 ? "due" : "ok"}>
                {CUR}{fmt(Math.max(0, inv.total_amount - inv.paid_amount))}
              </b>
            </div>
            <div className="inv-sum-card status"><span>{t("inv_status")}</span><InvoiceStatusBadge status={inv.status} /></div>
          </div>

          <div className="inv-meta-row">
            <span>{t("customer")}: <b>{inv.customers?.full_name || inv.orders?.customer_name || "—"}</b></span>
            <span className="ltr">{t("inv_issue")}: {formatDate(inv.issue_date, lang)}</span>
          </div>

          <div className="pay-head">
            <h4 className="sub-h"><Wallet size={16} /> {t("pay_title")}</h4>
            {perms.edit && inv.status !== "paid" && (
              <button className="btn btn-navy btn-sm" onClick={() => setPayOpen(true)}><Plus size={15} /> {t("pay_add")}</button>
            )}
          </div>

          {(inv.payments || []).length === 0 ? (
            <p className="dim-note">{t("pay_empty")}</p>
          ) : (
            <table className="tbl mini">
              <thead><tr>
                <th>{t("pay_date")}</th><th>{t("pay_amount")}</th><th>{t("pay_method")}</th><th>{t("pay_ref")}</th><th></th>
              </tr></thead>
              <tbody>
                {inv.payments.slice().sort((a, b) => a.paid_at.localeCompare(b.paid_at)).map((p) => (
                  <tr key={p.id}>
                    <td className="ltr">{formatDate(p.paid_at, lang)}</td>
                    <td className="num strong">{CUR}{fmt(p.amount)}</td>
                    <td>{t("pm_" + (p.method === "bank_transfer" ? "bank" : p.method))}</td>
                    <td className="ltr">{p.reference || "—"}</td>
                    <td className="row-actions">
                      {perms.delete && <button className="ic danger" onClick={() => delPayment(p.id)}><Trash2 size={14} /></button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      ) : null}

      {payOpen && <PaymentModal max={inv.total_amount - inv.paid_amount} onClose={() => setPayOpen(false)} onSave={addPayment} t={t} />}
      {toast}
    </Modal>
  );
}

function PaymentModal({ max, onClose, onSave, t }) {
  const [p, setP] = useState({ amount: max > 0 ? max : 0, method: "bank_transfer", paid_at: todayISO(), reference: "" });
  const set = (k, v) => setP((x) => ({ ...x, [k]: v }));
  const valid = +p.amount > 0;
  return (
    <Modal title={t("pay_add")} onClose={onClose}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose}>{t("cancel")}</button>
        <button className="btn btn-gold" onClick={() => onSave(p)} disabled={!valid}>{t("save")}</button>
      </>}>
      <div className="modal-grid">
        <Field label={t("pay_amount")} required>
          <input type="number" min="0" step="0.01" value={p.amount} onChange={(e) => set("amount", +e.target.value)} />
        </Field>
        <Field label={t("pay_method")}>
          <Select value={p.method} onChange={(v) => set("method", v)}
            options={[["bank_transfer", "pm_bank"], ["cash", "pm_cash"], ["card", "pm_card"], ["other", "pm_other"]]
              .map(([v, k]) => ({ v, label: t(k) }))} />
        </Field>
        <Field label={t("pay_date")}><input type="date" className="ltr" value={p.paid_at} onChange={(e) => set("paid_at", e.target.value)} /></Field>
        <Field label={t("pay_ref")}><input value={p.reference} onChange={(e) => set("reference", e.target.value)} /></Field>
      </div>
    </Modal>
  );
}
