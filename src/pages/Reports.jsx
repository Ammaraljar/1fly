// ============================================================================
//  التقارير المالية — جسور جلوبال  (الأولوية ٢)
//  الأرباح حسب نوع الخدمة + الأداء الشهري ضمن فترة.
// ============================================================================
import React, { useState, useEffect, useCallback } from "react";
import { BarChart3, TrendingUp, Wallet, Coins } from "lucide-react";
import { db } from "../lib/data.js";
import { useI18n } from "../lib/i18n.jsx";
import { Field, Spinner, Empty } from "../components/ui.jsx";
import { fmt, CUR } from "../lib/format.js";

const SERVICE_KEY = { hotels: "rep_share_hotels", tours: "rep_share_tours", activities: "rep_share_activities", transport: "rep_share_transport" };
const SERVICE_COLOR = { hotels: "#3b6ea5", tours: "#be9a30", activities: "#2f7d5b", transport: "#8a5a9e" };

const firstOfYear = () => new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);
const todayISO = () => new Date().toISOString().slice(0, 10);

export default function Reports() {
  const { t } = useI18n();
  const [from, setFrom] = useState(firstOfYear());
  const [to, setTo] = useState(todayISO());
  const [summary, setSummary] = useState(null);
  const [monthly, setMonthly] = useState([]);
  const [loading, setLoading] = useState(false);

  const run = useCallback(async () => {
    setLoading(true);
    const [{ data: sum }, { data: orders }] = await Promise.all([
      db.reports.summary(from, to),
      db.reports.ordersInRange(from, to),
    ]);
    setSummary(sum || []);
    const byMonth = {};
    (orders || []).forEach((o) => {
      const m = (o.created_at || "").slice(0, 7);
      if (!m) return;
      byMonth[m] = byMonth[m] || { month: m, sale: 0, margin: 0, count: 0 };
      byMonth[m].sale += +(o.order_totals?.total_sale || 0);
      byMonth[m].margin += +(o.order_totals?.total_margin || 0);
      byMonth[m].count += 1;
    });
    setMonthly(Object.values(byMonth).sort((a, b) => a.month.localeCompare(b.month)));
    setLoading(false);
  }, [from, to]);

  useEffect(() => { run(); }, []);

  const totals = (summary || []).reduce(
    (acc, r) => ({ cost: acc.cost + +r.total_cost, sale: acc.sale + +r.total_sale, margin: acc.margin + +r.total_margin }),
    { cost: 0, sale: 0, margin: 0 }
  );
  const marginPct = totals.sale > 0 ? (totals.margin / totals.sale) * 100 : 0;
  const maxMonth = Math.max(1, ...monthly.map((m) => m.sale));
  const hasData = summary && summary.some((r) => +r.total_sale > 0);

  return (
    <div className="page">
      <header className="page-head">
        <div><h1>{t("rep_title")}</h1><p className="page-desc">{t("rep_desc")}</p></div>
      </header>

      <div className="card pad rep-filter">
        <Field label={t("rep_from")}><input type="date" className="ltr" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label={t("rep_to")}><input type="date" className="ltr" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
        <button className="btn btn-gold" onClick={run}><BarChart3 size={16} /> {t("rep_apply")}</button>
      </div>

      {loading ? <Spinner /> : !hasData ? (
        <Empty icon={BarChart3} title={t("rep_empty")} />
      ) : (
        <>
          <div className="rep-cards">
            <div className="rep-card"><div className="rep-ic" style={{ background: "rgba(59,110,165,.13)", color: "#3b6ea5" }}><Coins size={20} /></div>
              <div><span>{t("rep_total_cost")}</span><b>{CUR}{fmt(totals.cost)}</b></div></div>
            <div className="rep-card"><div className="rep-ic" style={{ background: "rgba(190,154,48,.15)", color: "var(--gold)" }}><Wallet size={20} /></div>
              <div><span>{t("rep_total_sale")}</span><b>{CUR}{fmt(totals.sale)}</b></div></div>
            <div className="rep-card hl"><div className="rep-ic" style={{ background: "rgba(47,125,91,.15)", color: "var(--done)" }}><TrendingUp size={20} /></div>
              <div><span>{t("rep_total_margin")}</span><b>{CUR}{fmt(totals.margin)}</b><i>{t("rep_margin_pct")} {marginPct.toFixed(1)}%</i></div></div>
          </div>

          <div className="card pad rep-section">
            <h3 className="sub-h"><BarChart3 size={16} /> {t("rep_by_service")}</h3>
            <table className="tbl">
              <thead><tr>
                <th>{t("rep_service")}</th><th className="num">{t("rep_orders")}</th>
                <th className="num">{t("rep_total_cost")}</th><th className="num">{t("rep_total_sale")}</th>
                <th className="num">{t("rep_total_margin")}</th><th style={{ width: "22%" }}></th>
              </tr></thead>
              <tbody>
                {summary.filter((r) => +r.total_sale > 0).map((r) => {
                  const pct = totals.margin > 0 ? (+r.total_margin / totals.margin) * 100 : 0;
                  return (
                    <tr key={r.service_type}>
                      <td className="strong"><span className="rep-dot" style={{ background: SERVICE_COLOR[r.service_type] }} /> {t(SERVICE_KEY[r.service_type])}</td>
                      <td className="num">{r.orders_count}</td>
                      <td className="num">{CUR}{fmt(r.total_cost)}</td>
                      <td className="num">{CUR}{fmt(r.total_sale)}</td>
                      <td className="num gold">{CUR}{fmt(r.total_margin)}</td>
                      <td><div className="rep-bar"><div style={{ width: pct + "%", background: SERVICE_COLOR[r.service_type] }} /></div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {monthly.length > 0 && (
            <div className="card pad rep-section">
              <h3 className="sub-h"><TrendingUp size={16} /> {t("rep_by_month")}</h3>
              <div className="rep-months">
                {monthly.map((m) => (
                  <div className="rep-month" key={m.month}>
                    <div className="rep-month-bar-wrap">
                      <div className="rep-month-bar" style={{ height: Math.max(4, (m.sale / maxMonth) * 130) + "px" }} title={CUR + fmt(m.sale)} />
                    </div>
                    <div className="rep-month-val">{CUR}{fmt(m.sale)}</div>
                    <div className="rep-month-lbl ltr">{m.month}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
