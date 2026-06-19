// ============================================================================
//  إدارة المزودين — جسور جلوبال
//  قائمة المزودين + أرصدتهم + تفاصيل كل مزوّد + تسجيل دفعات + تقارير
// ============================================================================
import React, { useState, useEffect, useCallback } from "react";
import {
  Building2, Plus, Trash2, Pencil, ArrowRight, ArrowLeft, Printer,
  Wallet, TrendingDown, Check, X, CreditCard,
} from "lucide-react";
import { db } from "../lib/data.js";
import { useI18n } from "../lib/i18n.jsx";
import { useAuth } from "../auth/AuthProvider.jsx";
import { Field, Select, Modal, Spinner, Empty, useToast } from "../components/ui.jsx";
import { fmt, CUR, formatDate } from "../lib/format.js";

const todayISO = () => new Date().toISOString().slice(0,10);
const firstOfYear = () => new Date(new Date().getFullYear(),0,1).toISOString().slice(0,10);

export default function Suppliers() {
  const { t, lang } = useI18n();
  const { perms } = useAuth();
  const { show, node: toast } = useToast();
  const [balances, setBalances] = useState(null);
  const [edit, setEdit] = useState(null);
  const [detail, setDetail] = useState(null);

  const load = useCallback(() =>
    db.suppliers.balances().then(({ data }) => setBalances(data || [])), []);
  useEffect(() => { load(); }, [load]);

  const save = async (s) => {
    if (!s.name_ar?.trim()) { show(t("required"), "err"); return; }
    if (s.id) await db.suppliers.update(s.id, strip(s));
    else await db.suppliers.add(strip(s));
    setEdit(null); show(t("saved")); load();
  };
  const remove = async (id) => {
    await db.suppliers.remove(id); show(t("saved")); load();
  };

  const L = (row) => lang === "ar" ? (row.name_ar || row.name_en) : (row.name_en || row.name_ar);

  const totalDue = (balances || []).reduce((s, r) => s + (+r.balance_due || 0), 0);
  const totalCost = (balances || []).reduce((s, r) => s + (+r.total_cost || 0), 0);
  const totalPaid = (balances || []).reduce((s, r) => s + (+r.total_paid || 0), 0);

  return (
    <div className="page">
      <header className="page-head">
        <div><h1>{t("sup_title")}</h1><p className="page-desc">{t("sup_desc")}</p></div>
        <div className="head-right">
          {perms.add && <button className="btn btn-gold" onClick={() => setEdit({})}><Plus size={18}/> {t("sup_new")}</button>}
          <button className="btn btn-navy" onClick={() => window.print()}><Printer size={16}/> {t("sup_print_report")}</button>
        </div>
      </header>

      {/* ملخّص الأرصدة */}
      <div className="rep-cards" style={{ marginBottom: 18 }}>
        <div className="rep-card"><div className="rep-ic" style={{background:"rgba(59,110,165,.13)",color:"#3b6ea5"}}><CreditCard size={20}/></div>
          <div><span>{t("sup_total_cost")}</span><b>{CUR}{fmt(totalCost)}</b></div></div>
        <div className="rep-card"><div className="rep-ic" style={{background:"rgba(47,125,91,.13)",color:"var(--done)"}}><Wallet size={20}/></div>
          <div><span>{t("sup_total_paid")}</span><b>{CUR}{fmt(totalPaid)}</b></div></div>
        <div className="rep-card hl"><div className="rep-ic"><TrendingDown size={20}/></div>
          <div><span>{t("sup_balance")}</span><b>{CUR}{fmt(totalDue)}</b></div></div>
      </div>

      {balances === null ? <Spinner/> : balances.length === 0 ? (
        <Empty icon={Building2} title={t("sup_empty")}/>
      ) : (
        <div className="card tablewrap">
          <table className="tbl">
            <thead><tr>
              <th>{t("sup_name_ar")}</th><th>{t("sup_name_en")}</th>
              <th className="num">{t("sup_total_cost")}</th>
              <th className="num">{t("sup_total_paid")}</th>
              <th className="num">{t("sup_balance")}</th><th></th>
            </tr></thead>
            <tbody>
              {balances.map(s => {
                const due = +s.balance_due;
                return (
                  <tr key={s.id} onClick={() => setDetail(s.id)}>
                    <td className="strong">{s.name_ar}</td>
                    <td className="ltr">{s.name_en}</td>
                    <td className="num">{CUR}{fmt(s.total_cost)}</td>
                    <td className="num">{CUR}{fmt(s.total_paid)}</td>
                    <td className="num" style={{color: due > 0 ? "var(--danger)" : "var(--done)", fontWeight:700}}>{CUR}{fmt(Math.abs(due))}{due < 0 ? "+" : ""}</td>
                    <td className="row-actions" onClick={e => e.stopPropagation()}>
                      {perms.edit && <button className="ic" onClick={() => setEdit(s)}><Pencil size={15}/></button>}
                      {perms.delete && <button className="ic danger" onClick={() => remove(s.id)}><Trash2 size={15}/></button>}
                      {lang === "ar" ? <ArrowRight size={16} className="chev"/> : <ArrowLeft size={16} className="chev"/>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {edit && <SupplierModal sup={edit} onClose={() => setEdit(null)} onSave={save} t={t}/>}
      {detail && <SupplierDetail supId={detail} onClose={() => { setDetail(null); load(); }} t={t} lang={lang} perms={perms} show={show}/>}
      {toast}
    </div>
  );
}

function SupplierModal({ sup, onClose, onSave, t }) {
  const [s, setS] = useState({ name_ar:"", name_en:"", contact_name:"", phone:"", email:"", notes:"", ...sup });
  const set = (k, v) => setS(p => ({ ...p, [k]: v }));
  return (
    <Modal title={s.id ? t("edit") : t("sup_new")} onClose={onClose}
      footer={<><button className="btn btn-ghost" onClick={onClose}>{t("cancel")}</button>
        <button className="btn btn-gold" onClick={() => onSave(s)}><Check size={15}/> {t("save")}</button></>}>
      <div className="modal-grid">
        <Field label={t("sup_name_ar")} required><input value={s.name_ar} dir="rtl" onChange={e => set("name_ar", e.target.value)}/></Field>
        <Field label={t("sup_name_en")} required><input className="ltr" value={s.name_en} onChange={e => set("name_en", e.target.value)}/></Field>
        <Field label={t("sup_contact")}><input value={s.contact_name||""} onChange={e => set("contact_name", e.target.value)}/></Field>
        <Field label={t("sup_phone")}><input className="ltr" value={s.phone||""} onChange={e => set("phone", e.target.value)}/></Field>
        <Field label={t("sup_email")}><input className="ltr" value={s.email||""} onChange={e => set("email", e.target.value)}/></Field>
        <Field label={t("notes")} wide><input value={s.notes||""} onChange={e => set("notes", e.target.value)}/></Field>
      </div>
    </Modal>
  );
}

function SupplierDetail({ supId, onClose, t, lang, perms, show }) {
  const [sup, setSup] = useState(null);
  const [services, setServices] = useState(null);
  const [payForm, setPayForm] = useState(null);
  const [period, setPeriod] = useState({ from: firstOfYear(), to: todayISO() });

  useEffect(() => {
    db.suppliers.get(supId).then(({ data }) => setSup(data));
    db.suppliers.services(supId).then(setServices);
  }, [supId]);

  const addPayment = async (p) => {
    await db.supplierPayments.add({ supplier_id: supId, ...p });
    const { data } = await db.suppliers.get(supId);
    setSup(data); setPayForm(null);
    show(t("saved"));
  };

  const delPayment = async (id) => {
    await db.supplierPayments.remove(id);
    const { data } = await db.suppliers.get(supId);
    setSup(data);
  };

  if (!sup) return <Modal title="..." onClose={onClose}><Spinner/></Modal>;

  const allServices = services ? [
    ...(services.hotels || []).map(r => ({ ...r, _cat: "hotels", _name: r.hotel_name })),
    ...(services.tours || []).map(r => ({ ...r, _cat: "tours", _name: r.title })),
    ...(services.activities || []).map(r => ({ ...r, _cat: "activities", _name: r.title })),
    ...(services.transport || []).map(r => ({ ...r, _cat: "transport", _name: `${r.from_label} → ${r.to_label}` })),
  ] : [];
  const totalCost = allServices.reduce((s, r) => s + (+r.cost || 0), 0);
  const totalPaid = (sup.supplier_payments || []).reduce((s, p) => s + (+p.amount || 0), 0);

  const L = lang === "ar" ? sup.name_ar : (sup.name_en || sup.name_ar);

  return (
    <Modal title={L} onClose={onClose} wide>
      {/* الأرصدة */}
      <div className="inv-summary">
        <div className="inv-sum-card"><span>{t("sup_total_cost")}</span><b>{CUR}{fmt(totalCost)}</b></div>
        <div className="inv-sum-card"><span>{t("sup_total_paid")}</span><b className="ok">{CUR}{fmt(totalPaid)}</b></div>
        <div className="inv-sum-card"><span>{t("sup_balance")}</span><b className={totalCost-totalPaid>0?"due":"ok"}>{CUR}{fmt(Math.max(0,totalCost-totalPaid))}</b></div>
      </div>

      {/* الخدمات المرتبطة */}
      <h4 className="sub-h"><Building2 size={15}/> {t("sup_services")} ({allServices.length})</h4>
      {allServices.length === 0 ? <p className="dim-note">{t("none")}</p> : (
        <table className="tbl mini">
          <thead><tr><th>{t("cat.hotels")}</th><th>{t("customer")}</th><th>{t("arrival")}</th><th className="num">{t("cost")}</th></tr></thead>
          <tbody>
            {allServices.map((r, i) => (
              <tr key={i}>
                <td><b>{r._name}</b><div style={{fontSize:11,color:"var(--muted)"}}>{t("cat."+r._cat)}</div></td>
                <td>{r.orders?.customer_name || "—"}</td>
                <td className="ltr">{formatDate(r.orders?.arrival_date, lang)}</td>
                <td className="num">{CUR}{fmt(r.cost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* الدفعات */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:16}}>
        <h4 className="sub-h" style={{margin:0}}><Wallet size={15}/> {t("sup_payments")}</h4>
        {perms.add && <button className="btn btn-navy btn-sm" onClick={() => setPayForm({ amount:0, method:"bank_transfer", paid_at:todayISO(), notes:"" })}><Plus size={15}/> {t("sup_pay_add")}</button>}
      </div>
      {(sup.supplier_payments || []).length === 0 ? <p className="dim-note">{t("pay_empty")}</p> : (
        <table className="tbl mini">
          <thead><tr><th>{t("pay_date")}</th><th>{t("pay_amount")}</th><th>{t("pay_method")}</th><th>{t("pay_ref")}</th><th></th></tr></thead>
          <tbody>
            {(sup.supplier_payments || []).slice().sort((a,b)=>a.paid_at.localeCompare(b.paid_at)).map(p => (
              <tr key={p.id}>
                <td className="ltr">{formatDate(p.paid_at, lang)}</td>
                <td className="num strong">{CUR}{fmt(p.amount)}</td>
                <td>{p.method}</td><td className="ltr">{p.reference || "—"}</td>
                <td>{perms.delete && <button className="ic danger" onClick={() => delPayment(p.id)}><Trash2 size={14}/></button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {payForm && (
        <div className="quick-new card pad" style={{marginTop:12}}>
          <div className="modal-grid">
            <Field label={t("pay_amount")} required><input type="number" min="0" value={payForm.amount} onChange={e => setPayForm(p=>({...p,amount:+e.target.value}))}/></Field>
            <Field label={t("pay_method")}>
              <Select value={payForm.method} onChange={v=>setPayForm(p=>({...p,method:v}))}
                options={[{v:"bank_transfer",label:t("pm_bank")},{v:"cash",label:t("pm_cash")},{v:"card",label:t("pm_card")}]}/>
            </Field>
            <Field label={t("pay_date")}><input type="date" className="ltr" value={payForm.paid_at} onChange={e=>setPayForm(p=>({...p,paid_at:e.target.value}))}/></Field>
            <Field label={t("pay_ref")}><input value={payForm.reference||""} onChange={e=>setPayForm(p=>({...p,reference:e.target.value}))}/></Field>
          </div>
          <div className="quick-actions">
            <button className="btn btn-ghost btn-sm" onClick={() => setPayForm(null)}>{t("cancel")}</button>
            <button className="btn btn-gold btn-sm" onClick={() => addPayment(payForm)} disabled={!payForm.amount}>{t("save")}</button>
          </div>
        </div>
      )}
    </Modal>
  );
}

const strip = ({ id, created_at, total_cost, total_paid, balance_due, supplier_payments, ...rest }) => rest;
