// ============================================================================
//  العملاء — جسور جلوبال  (الأولوية ١)
//  قائمة بحث + إضافة/تعديل/حذف + سجل طلبات كل عميل.
// ============================================================================
import React, { useState, useEffect, useCallback } from "react";
import {
  UserPlus, Search, Trash2, Pencil, Phone, Mail, Globe, ChevronLeft, ChevronRight, X,
} from "lucide-react";
import { db } from "../lib/data.js";
import { useI18n } from "../lib/i18n.jsx";
import { useAuth } from "../auth/AuthProvider.jsx";
import { Field, Modal, Spinner, Empty, useToast } from "../components/ui.jsx";
import { fmt, CUR, formatDate } from "../lib/format.js";

export default function Customers() {
  const { t, lang } = useI18n();
  const { perms } = useAuth();
  const { show, node: toast } = useToast();
  const [rows, setRows] = useState(null);
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState(null);      // كائن العميل أو {} لجديد
  const [detail, setDetail] = useState(null);  // عرض طلبات عميل

  const load = useCallback(() => {
    db.customers.list(q.trim()).then(({ data }) => setRows(data || []));
  }, [q]);
  useEffect(() => { const id = setTimeout(load, 250); return () => clearTimeout(id); }, [load]);

  const save = async (c) => {
    if (!c.full_name?.trim()) { show(t("required"), "err"); return; }
    if (c.id) await db.customers.update(c.id, stripId(c));
    else await db.customers.add(stripId(c));
    setEdit(null); show(t("saved")); load();
  };
  const remove = async (id) => { await db.customers.remove(id); show(t("saved")); load(); };

  return (
    <div className="page">
      <header className="page-head">
        <div><h1>{t("cust_title")}</h1><p className="page-desc">{t("cust_desc")}</p></div>
        {perms.add && <button className="btn btn-gold" onClick={() => setEdit({})}><UserPlus size={18} /> {t("cust_new")}</button>}
      </header>

      <div className="toolbar">
        <div className="search-box">
          <Search size={16} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("cust_search")} />
          {q && <button className="ic" onClick={() => setQ("")}><X size={15} /></button>}
        </div>
      </div>

      {rows === null ? <Spinner /> : rows.length === 0 ? (
        <Empty icon={UserPlus} title={t("cust_empty")} />
      ) : (
        <div className="card tablewrap">
          <table className="tbl">
            <thead><tr>
              <th>{t("cust_name")}</th><th>{t("nationality")}</th>
              <th>{t("cust_phone")}</th><th>{t("cust_email")}</th><th></th>
            </tr></thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} onClick={() => setDetail(c)}>
                  <td className="strong">{c.full_name}</td>
                  <td>{c.nationality || "—"}</td>
                  <td className="ltr">{c.phone || "—"}</td>
                  <td className="ltr">{c.email || "—"}</td>
                  <td className="row-actions" onClick={(e) => e.stopPropagation()}>
                    {perms.edit && <button className="ic" onClick={() => setEdit(c)}><Pencil size={15} /></button>}
                    {perms.delete && <DeleteBtn onConfirm={() => remove(c.id)} t={t} />}
                    {lang === "ar" ? <ChevronLeft size={16} className="chev" /> : <ChevronRight size={16} className="chev" />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {edit && <CustomerModal customer={edit} onClose={() => setEdit(null)} onSave={save} t={t} />}
      {detail && <CustomerDetail customer={detail} onClose={() => setDetail(null)} t={t} lang={lang} />}
      {toast}
    </div>
  );
}

function CustomerModal({ customer, onClose, onSave, t }) {
  const [c, setC] = useState({ full_name: "", nationality: "", phone: "", email: "", notes: "", ...customer });
  const set = (k, v) => setC((p) => ({ ...p, [k]: v }));
  return (
    <Modal title={c.id ? t("edit") : t("cust_new")} onClose={onClose}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose}>{t("cancel")}</button>
        <button className="btn btn-gold" onClick={() => onSave(c)}>{t("save")}</button>
      </>}>
      <div className="modal-grid">
        <Field label={t("cust_name")} required><input value={c.full_name} onChange={(e) => set("full_name", e.target.value)} /></Field>
        <Field label={t("nationality")}><input value={c.nationality || ""} onChange={(e) => set("nationality", e.target.value)} /></Field>
        <Field label={t("cust_phone")}><input className="ltr" value={c.phone || ""} onChange={(e) => set("phone", e.target.value)} /></Field>
        <Field label={t("cust_email")}><input className="ltr" value={c.email || ""} onChange={(e) => set("email", e.target.value)} /></Field>
        <Field label={t("notes")} wide><input value={c.notes || ""} onChange={(e) => set("notes", e.target.value)} /></Field>
      </div>
    </Modal>
  );
}

function CustomerDetail({ customer, onClose, t, lang }) {
  const [orders, setOrders] = useState(null);
  useEffect(() => { db.customers.ordersOf(customer.id).then(({ data }) => setOrders(data || [])); }, [customer.id]);
  return (
    <Modal title={customer.full_name} onClose={onClose} wide>
      <div className="cust-meta">
        {customer.nationality && <span><Globe size={14} /> {customer.nationality}</span>}
        {customer.phone && <span className="ltr"><Phone size={14} /> {customer.phone}</span>}
        {customer.email && <span className="ltr"><Mail size={14} /> {customer.email}</span>}
      </div>
      <h4 className="sub-h">{t("cust_orders")}</h4>
      {orders === null ? <Spinner /> : orders.length === 0 ? (
        <p className="dim-note">{t("cust_none_orders")}</p>
      ) : (
        <table className="tbl mini">
          <thead><tr><th>{t("package")}</th><th>{t("arrival")}</th><th className="num">{t("inv_total")}</th></tr></thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td>{o.package_label || "—"}</td>
                <td className="ltr">{formatDate(o.arrival_date, lang)}</td>
                <td className="num">{CUR}{fmt(o.order_totals?.total_sale || 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Modal>
  );
}

function DeleteBtn({ onConfirm, t }) {
  const [ask, setAsk] = useState(false);
  if (ask) return (
    <span className="inline-confirm" onClick={(e) => e.stopPropagation()}>
      <button className="ic danger" onClick={onConfirm}><Trash2 size={14} /></button>
      <button className="ic" onClick={() => setAsk(false)}><X size={14} /></button>
    </span>
  );
  return <button className="ic danger" title={t("delete")} onClick={() => setAsk(true)}><Trash2 size={15} /></button>;
}

const stripId = ({ id, created_at, updated_at, ...rest }) => rest;
