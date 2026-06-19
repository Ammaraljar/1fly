// ============================================================================
//  قائمة الطلبات — جسور جلوبال
// ============================================================================
import React, { useState, useEffect, useMemo } from "react";
import { Plus, Search, Trash2, FileText, ChevronLeft, ChevronRight, Package } from "lucide-react";
import { db } from "../lib/data.js";
import { useI18n } from "../lib/i18n.jsx";
import { useAuth } from "../auth/AuthProvider.jsx";
import { Spinner, useToast } from "../components/ui.jsx";
import { fmt, CUR, STATUS } from "../lib/format.js";

export default function Orders({ onOpen }) {
  const { t, lang } = useI18n();
  const { perms } = useAuth();
  const { show, node: toast } = useToast();
  const [orders, setOrders] = useState(null);
  const [tab, setTab] = useState("in_progress");
  const [q, setQ] = useState("");

  const load = () => db.orders.list().then(({ data }) => setOrders(data || []));
  useEffect(() => { load(); }, []);

  const counts = useMemo(() => {
    const c = { offer: 0, in_progress: 0, done: 0 };
    (orders || []).forEach((o) => (c[o.status] = (c[o.status] || 0) + 1));
    return c;
  }, [orders]);

  const Chevron = lang === "ar" ? ChevronLeft : ChevronRight;

  const rows = (orders || [])
    .filter((o) => o.status === tab)
    .filter((o) => !q || [o.customer_name, o.nationality, o.package_label].join(" ").toLowerCase().includes(q.toLowerCase()));

  const newOrder = async () => {
    const today = new Date().toISOString().slice(0, 10);
    const { data } = await db.orders.add({
      customer_name: "", arrival_date: today, depart_date: today, status: "offer", adults: 2,
    });
    if (data) onOpen(data.id);
  };

  return (
    <div className="page">
      <header className="page-head">
        <div><h1>{t("orders_title")}</h1><p className="page-desc">{t("orders_desc")}</p></div>
        {perms.add && <button className="btn btn-gold" onClick={newOrder}><Plus size={18} /> {t("new_order")}</button>}
      </header>

      <div className="tabs">
        {Object.keys(STATUS).map((s) => (
          <button key={s} className={"tab" + (tab === s ? " on" : "")} onClick={() => setTab(s)}
            style={tab === s ? { "--tc": STATUS[s].color } : {}}>
            <span className="dot" style={{ background: STATUS[s].color }} />
            {t(STATUS[s].key)}<span className="tab-count">{counts[s] || 0}</span>
          </button>
        ))}
        <div className="tabs-search">
          <Search size={16} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search")} />
        </div>
      </div>

      {orders === null ? <Spinner /> : rows.length === 0 ? (
        <div className="empty"><div className="empty-ic"><Package size={26} /></div>
          <h3>{t("empty_orders")}</h3>
          {perms.add && <button className="btn btn-gold" onClick={newOrder}><Plus size={18} /> {t("new_order")}</button>}
        </div>
      ) : (
        <div className="card tablewrap">
          <table className="tbl">
            <thead><tr>
              <th>{t("customer")}</th><th>{t("nationality")}</th><th>{t("package")}</th><th>{t("arrival")}</th>
              <th className="num">{t("total")}</th><th className="num">{t("profit")}</th><th>{t("invoice")}</th><th></th>
            </tr></thead>
            <tbody>
              {rows.map((o) => {
                const tot = o.order_totals?.[0] || o.order_totals || {};
                return (
                  <tr key={o.id} className="click" onClick={() => onOpen(o.id)}>
                    <td className="strong">{o.customer_name || "—"}</td>
                    <td>{o.nationality || "—"}</td>
                    <td>{o.package_label || "—"}</td>
                    <td className="ltr">{o.arrival_date}</td>
                    <td className="num">{CUR}{fmt(tot.total_sale)}</td>
                    <td className="num gold">{CUR}{fmt(tot.total_margin)}</td>
                    <td>{o.invoice_id ? <span className="inv">#{String(o.invoice_id).padStart(4, "0")}</span> : "—"}</td>
                    <td className="row-actions" onClick={(e) => e.stopPropagation()}>
                      {perms.delete && <button className="ic danger" onClick={async () => { if (window.confirm(t("confirm_delete"))) { await db.orders.remove(o.id); load(); show(t("saved")); } }}><Trash2 size={16} /></button>}
                      <Chevron size={16} style={{ color: "#cfccc0" }} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {toast}
    </div>
  );
}
