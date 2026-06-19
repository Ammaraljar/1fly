// ============================================================================
//  منشئ البرنامج اليومي — جسور جلوبال  (المرحلة ٤)
//  يولّد البرنامج تلقائيًا من تواريخ الحجوزات ثم يسمح بالتحرير الكامل.
// ============================================================================
import React, { useState, useEffect } from "react";
import {
  ArrowRight, ArrowLeft, Wand2, Save, FileText, Plus, Trash2, CalendarDays,
  Hotel as HotelIcon, Utensils, StickyNote, GripVertical,
} from "lucide-react";
import { db, buildItineraryFromOrder, saveItinerary } from "../lib/data.js";
import { useI18n } from "../lib/i18n.jsx";
import { useAuth } from "../auth/AuthProvider.jsx";
import { Spinner, Select, useToast } from "../components/ui.jsx";
import { formatDate, ITEM_ICON } from "../lib/format.js";

const ITEM_TYPES = ["checkin", "tour", "activity", "transport", "note", "checkout"];

// تحويل صفوف قاعدة البيانات إلى نسخة عمل قابلة للتحرير
function toWorking(order) {
  const days = (order.itinerary_days || [])
    .slice()
    .sort((a, b) => a.day_number - b.day_number)
    .map((d) => ({
      day_number: d.day_number,
      day_date: d.day_date,
      city_name: d.city_name || "",
      hotel_name: d.hotel_name || "",
      meals: d.meals || "",
      notes_ar: d.notes_ar || "",
      sort_order: d.sort_order ?? d.day_number,
      items: (d.itinerary_items || [])
        .slice()
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((it) => ({
          item_type: it.item_type,
          time_label: it.time_label || "",
          title_ar: it.title_ar || "",
          detail_ar: it.detail_ar || "",
          ref_id: it.ref_id || null,
        })),
    }));
  return days;
}

export default function ItineraryBuilder({ orderId, onBack, onOpenProgram }) {
  const { t, lang, dir } = useI18n();
  const { perms } = useAuth();
  const { show, node: toast } = useToast();
  const canEdit = perms.edit;

  const [order, setOrder] = useState(null);
  const [days, setDays] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    db.orders.get(orderId).then(({ data }) => {
      setOrder(data);
      setDays(toWorking(data));
    });
  }, [orderId]);

  if (!order) return <div className="page"><Spinner /></div>;

  const Back = lang === "ar" ? ArrowRight : ArrowLeft;
  const hasDates = order.arrival_date && order.depart_date && order.depart_date > order.arrival_date;

  const generate = () => {
    if (!hasDates) { show(t("warn_dates")); return; }
    setDays(buildItineraryFromOrder(order));
  };

  const save = async () => {
    setBusy(true);
    try {
      await saveItinerary(orderId, days);
      show(t("saved"));
    } catch (e) { console.error(e); } finally { setBusy(false); }
  };

  const setDay = (i, patch) => setDays((d) => d.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const setItem = (di, ii, patch) =>
    setDays((d) => d.map((x, j) => (j === di
      ? { ...x, items: x.items.map((it, k) => (k === ii ? { ...it, ...patch } : it)) } : x)));
  const addItem = (di) =>
    setDays((d) => d.map((x, j) => (j === di
      ? { ...x, items: [...x.items, { item_type: "note", time_label: "", title_ar: "", detail_ar: "", ref_id: null }] } : x)));
  const delItem = (di, ii) =>
    setDays((d) => d.map((x, j) => (j === di ? { ...x, items: x.items.filter((_, k) => k !== ii) } : x)));

  return (
    <div className="page editor">
      <header className="page-head sticky">
        <div className="head-left">
          <button className="btn btn-ghost btn-sm" onClick={onBack}><Back size={16} /> {t("back")}</button>
          <div>
            <h1><CalendarDays size={20} style={{ verticalAlign: -3, marginInlineEnd: 6, color: "var(--gold)" }} />{t("itinerary")}</h1>
            <p className="page-desc">{order.customer_name} · {t("it_desc")}</p>
          </div>
        </div>
        <div className="head-right">
          {canEdit && <button className="btn btn-navy btn-sm" onClick={generate}><Wand2 size={16} /> {days.length ? t("regenerate") : t("generate_program")}</button>}
          {canEdit && days.length > 0 && <button className="btn btn-gold btn-sm" onClick={save} disabled={busy}><Save size={16} /> {busy ? t("saving") : t("save_program")}</button>}
          <button className="btn btn-navy btn-sm" onClick={() => onOpenProgram(orderId)}><FileText size={16} /> {t("view_program")}</button>
        </div>
      </header>

      {days.length === 0 ? (
        <div className="empty">
          <div className="empty-ic"><CalendarDays size={26} /></div>
          <h3>{t("no_program")}</h3>
          {canEdit && <button className="btn btn-gold" onClick={generate}><Wand2 size={16} /> {t("generate_program")}</button>}
        </div>
      ) : (
        <div className="itin-days">
          {days.map((d, di) => (
            <div className="itin-day" key={di}>
              <div className="itin-day-side">
                <div className="itin-day-num">{t("day")} {d.day_number}</div>
                <div className="itin-day-date ltr">{formatDate(d.day_date, lang)}</div>
              </div>
              <div className="itin-day-main">
                <div className="itin-day-head">
                  <label className="itin-f">
                    <span><HotelIcon size={13} /> {t("city")}</span>
                    <input value={d.city_name} disabled={!canEdit} onChange={(e) => setDay(di, { city_name: e.target.value })} />
                  </label>
                  <label className="itin-f">
                    <span><HotelIcon size={13} /> {t("hotels")}</span>
                    <input value={d.hotel_name} disabled={!canEdit} onChange={(e) => setDay(di, { hotel_name: e.target.value })} />
                  </label>
                  <label className="itin-f sm">
                    <span><Utensils size={13} /> {t("meals")}</span>
                    <input value={d.meals} disabled={!canEdit} onChange={(e) => setDay(di, { meals: e.target.value })} />
                  </label>
                </div>

                <div className="itin-items">
                  {d.items.map((it, ii) => {
                    const Icon = ITEM_ICON[it.item_type] || StickyNote;
                    return (
                      <div className="itin-item" key={ii}>
                        <span className="itin-item-ic"><Icon size={15} /></span>
                        <input className="itin-time ltr" placeholder={t("time")} value={it.time_label} disabled={!canEdit}
                          onChange={(e) => setItem(di, ii, { time_label: e.target.value })} />
                        <Select value={it.item_type} disabled={!canEdit}
                          onChange={(v) => setItem(di, ii, { item_type: v })}
                          options={ITEM_TYPES.map((k) => ({ v: k, label: t("it_" + k) }))} />
                        <input className="itin-item-title" placeholder={t("item_title")} value={it.title_ar} disabled={!canEdit}
                          onChange={(e) => setItem(di, ii, { title_ar: e.target.value })} />
                        <input className="itin-item-detail" placeholder={t("item_detail")} value={it.detail_ar} disabled={!canEdit}
                          onChange={(e) => setItem(di, ii, { detail_ar: e.target.value })} />
                        {canEdit && <button className="ic danger" onClick={() => delItem(di, ii)}><Trash2 size={14} /></button>}
                      </div>
                    );
                  })}
                  {canEdit && <button className="itin-add-item" onClick={() => addItem(di)}><Plus size={14} /> {t("add_day_item")}</button>}
                </div>

                <label className="itin-notes">
                  <span><StickyNote size={13} /> {t("day_notes")}</span>
                  <input value={d.notes_ar} disabled={!canEdit} dir={dir}
                    onChange={(e) => setDay(di, { notes_ar: e.target.value })} />
                </label>
              </div>
            </div>
          ))}
        </div>
      )}
      {toast}
    </div>
  );
}
