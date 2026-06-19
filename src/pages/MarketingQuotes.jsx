// ============================================================================
//  العروض التسويقية — جسور جلوبال
//  قائمة + محرر متكامل (بيانات أساسية، فنادق، طيران، جولات، يشمل)
// ============================================================================
import React, { useState, useEffect, useCallback } from "react";
import {
  Megaphone, Plus, Trash2, Pencil, Star, ArrowRight, ArrowLeft, Printer,
  Hotel, Plane, MapPin, Gift, Save, ChevronDown, X,
} from "lucide-react";
import { db } from "../lib/data.js";
import { useI18n } from "../lib/i18n.jsx";
import { useAuth } from "../auth/AuthProvider.jsx";
import { Field, Select, Modal, Spinner, Empty, useToast } from "../components/ui.jsx";
import { fmt, CUR } from "../lib/format.js";

const ICONS = [
  ["users", "إستقبال وتوديع"], ["car", "سائق خاص"], ["edit", "إمكانية التعديل"],
  ["plane", "طيران داخلي"], ["tax", "خدمة وضريبة"], ["building", "الفنادق والإفطار"],
  ["sim", "شرائح نت وإتصال"], ["flower", "إستقبال بالورد"], ["boat", "التوصيل بالقارب السريع"],
  ["bus", "باص النوم"], ["star", "تزيين شهر عسل"],
];

export default function MarketingQuotes({ onOpenOrder }) {
  const { t, lang } = useI18n();
  const { perms } = useAuth();
  const { show, node: toast } = useToast();
  const [rows, setRows] = useState(null);
  const [editId, setEditId] = useState(null); // null=list, "new"=new, id=edit
  const [countries, setCountries] = useState([]);

  const load = useCallback(() => db.marketingQuotes.list().then(({ data }) => setRows(data || [])), []);
  useEffect(() => { load(); db.countries.list().then(({ data }) => setCountries(data || [])); }, [load]);

  const createNew = async () => {
    const { data, error } = await db.marketingQuotes.add({
      ref_no: String(Date.now()).slice(-6), title_ar: "وجهة جديدة", nights: 4,
    });
    if (error) { show(error.message, "err"); return; }
    setEditId(data.id);
  };

  const remove = async (id) => { await db.marketingQuotes.remove(id); show(t("saved")); load(); };

  if (editId) return <QuoteEditor quoteId={editId} countries={countries} onBack={() => { setEditId(null); load(); }} t={t} lang={lang} />;

  return (
    <div className="page">
      <header className="page-head">
        <div><h1>{t("mkt_title")}</h1><p className="page-desc">{t("mkt_desc")}</p></div>
        {perms.add && <button className="btn btn-gold" onClick={createNew}><Plus size={18} /> {t("mkt_new")}</button>}
      </header>

      {rows === null ? <Spinner /> : rows.length === 0 ? (
        <Empty icon={Megaphone} title={t("mkt_empty")} />
      ) : (
        <div className="mkt-grid">
          {rows.map((q) => {
            const countryName = lang === "ar" ? q.countries?.name_ar : (q.countries?.name_en || q.countries?.name_ar);
            return (
              <div className="mkt-card" key={q.id} onClick={() => setEditId(q.id)}>
                <div className="mkt-card-img" style={q.countries?.cover_image_url ? { backgroundImage: `url(${q.countries.cover_image_url})` } : {}}>
                  <span className="mkt-card-stars"><Star size={11} fill="currentColor" /> {q.stars}</span>
                  <span className="mkt-card-ref">#{q.ref_no}</span>
                </div>
                <div className="mkt-card-body">
                  <b>{q.title_ar}</b>
                  <span>{countryName} · {q.nights} {t("nights_word")}</span>
                  <span className="mkt-card-price">{q.price_per_person ? `${CUR}${fmt(q.price_per_person)}` : "—"}</span>
                </div>
                <div className="mkt-card-actions" onClick={(e) => e.stopPropagation()}>
                  {perms.edit && <button className="ic" onClick={() => setEditId(q.id)}><Pencil size={14} /></button>}
                  {perms.delete && <button className="ic danger" onClick={() => remove(q.id)}><Trash2 size={14} /></button>}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {toast}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   محرر العرض التسويقي
══════════════════════════════════════════════════════════════════════ */
function QuoteEditor({ quoteId, countries, onBack, t, lang }) {
  const { perms } = useAuth();
  const { show, node: toast } = useToast();
  const [q, setQ] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => { db.marketingQuotes.get(quoteId).then(({ data }) => setQ(data)); }, [quoteId]);

  if (!q) return <div className="page"><Spinner /></div>;

  const set = (k, v) => setQ((p) => ({ ...p, [k]: v }));
  const Back = lang === "ar" ? ArrowRight : ArrowLeft;

  const save = async () => {
    setSaving(true);
    const { id, countries: _c, hotels, flights, cities, includes, created_at, updated_at, order_id, status, ...basic } = q;
    await db.marketingQuotes.update(quoteId, basic);
    await db.marketingQuotes.saveAll(quoteId, { hotels, flights, cities, includes });
    setSaving(false);
    show(t("saved"));
  };

  /* ---- بطاقات الفنادق ---- */
  const addHotel = () => set("hotels", [...(q.hotels || []), { city_label_ar: "", city_label_en: "", hotel_name_ar: "", hotel_name_en: "", room_type_ar: "", room_type_en: "", nights: 1, meal_label_ar: "شامل الإفطار", meal_label_en: "Breakfast included" }]);
  const updHotel = (i, patch) => set("hotels", q.hotels.map((h, j) => j === i ? { ...h, ...patch } : h));
  const delHotel = (i) => set("hotels", q.hotels.filter((_, j) => j !== i));

  /* ---- رحلات الطيران ---- */
  const addFlight = () => set("flights", [...(q.flights || []), { from_label_ar: "", from_label_en: "", to_label_ar: "", to_label_en: "", baggage_kg: 20 }]);
  const updFlight = (i, patch) => set("flights", q.flights.map((f, j) => j === i ? { ...f, ...patch } : f));
  const delFlight = (i) => set("flights", q.flights.filter((_, j) => j !== i));

  /* ---- مدن الجولات ---- */
  const addCity = () => set("cities", [...(q.cities || []), { city_label_ar: "", city_label_en: "", color_key: (q.cities||[]).length % 2 === 0 ? "navy" : "red", tours: [] }]);
  const updCity = (i, patch) => set("cities", q.cities.map((c, j) => j === i ? { ...c, ...patch } : c));
  const delCity = (i) => set("cities", q.cities.filter((_, j) => j !== i));
  const addTour = (ci) => set("cities", q.cities.map((c, j) => j === ci ? { ...c, tours: [...(c.tours||[]), { label_ar: "جولة سياحية", label_en: "Tour", items_ar: "", items_en: "" }] } : c));
  const updTour = (ci, ti, patch) => set("cities", q.cities.map((c, j) => j === ci ? { ...c, tours: c.tours.map((tr, k) => k === ti ? { ...tr, ...patch } : tr) } : c));
  const delTour = (ci, ti) => set("cities", q.cities.map((c, j) => j === ci ? { ...c, tours: c.tours.filter((_, k) => k !== ti) } : c));

  /* ---- يشمل / هدايا ---- */
  const addInclude = () => set("includes", [...(q.includes || []), { icon_key: "tax", label_ar: "", label_en: "", is_gift: false }]);
  const updInclude = (i, patch) => set("includes", q.includes.map((inc, j) => j === i ? { ...inc, ...patch } : inc));
  const delInclude = (i) => set("includes", q.includes.filter((_, j) => j !== i));

  if (showPreview) return <QuotePrintView quote={q} onBack={() => setShowPreview(false)} t={t} />;

  return (
    <div className="page editor">
      <header className="page-head sticky">
        <div className="head-left">
          <button className="btn btn-ghost btn-sm" onClick={onBack}><Back size={16} /> {t("back")}</button>
          <div><h1>{q.title_ar}</h1><p className="page-desc">#{q.ref_no}</p></div>
        </div>
        <div className="head-right">
          <button className="btn btn-navy btn-sm" onClick={() => setShowPreview(true)}><Printer size={16} /> {t("mkt_preview")}</button>
          {perms.edit && <button className="btn btn-gold btn-sm" onClick={save} disabled={saving}><Save size={16} /> {saving ? "…" : t("mkt_save")}</button>}
        </div>
      </header>

      {/* البيانات الأساسية */}
      <section className="card pad">
        <h2 className="sec-title">{t("mkt_basic_info")}</h2>
        <div className="form-grid">
          <Field label={t("mkt_ref")}><input className="ltr" value={q.ref_no} onChange={(e) => set("ref_no", e.target.value)} /></Field>
          <Field label={t("mkt_country")}>
            <Select value={q.country_id ? String(q.country_id) : ""} onChange={(v) => set("country_id", v ? +v : null)}
              options={countries.map((c) => ({ v: String(c.id), label: c.name_ar }))} />
          </Field>
          <Field label={t("mkt_title_field")}><input value={q.title_ar} onChange={(e) => set("title_ar", e.target.value)} /></Field>
          <Field label={t("mkt_title_field") + " EN"}><input className="ltr" value={q.title_en || ""} onChange={(e) => set("title_en", e.target.value)} /></Field>
          <Field label={t("mkt_stars")}><input type="number" min="1" max="7" value={q.stars} onChange={(e) => set("stars", +e.target.value)} /></Field>
          <Field label={t("mkt_nights")}><input type="number" min="1" value={q.nights} onChange={(e) => set("nights", +e.target.value)} /></Field>
          <Field label={t("mkt_trip_type")}><input value={q.trip_type_ar || ""} onChange={(e) => set("trip_type_ar", e.target.value)} /></Field>
          <Field label={t("mkt_badge")}><input value={q.badge_ar || ""} onChange={(e) => set("badge_ar", e.target.value)} /></Field>
          <Field label={t("mkt_season")}><input value={q.season_label_ar || ""} onChange={(e) => set("season_label_ar", e.target.value)} /></Field>
          <Field label={t("mkt_price")}><input type="number" min="0" value={q.price_per_person || ""} onChange={(e) => set("price_per_person", +e.target.value)} /></Field>
          <Field label={t("mkt_currency")}><input value={q.currency || ""} onChange={(e) => set("currency", e.target.value)} /></Field>
        </div>
      </section>

      {/* بطاقات الفنادق */}
      <section className="card pad">
        <div className="mkt-sec-head"><h2 className="sec-title"><Hotel size={16} /> {t("mkt_hotels_section")}</h2>
          <button className="btn btn-ghost btn-sm" onClick={addHotel}><Plus size={14} /> {t("mkt_add_hotel")}</button></div>
        {(q.hotels || []).map((h, i) => (
          <div className="mkt-row-card" key={i}>
            <div className="form-grid">
              <Field label={t("mkt_city_label")}><input value={h.city_label_ar} onChange={(e) => updHotel(i, { city_label_ar: e.target.value })} /></Field>
              <Field label={t("mkt_city_label") + " EN"}><input className="ltr" value={h.city_label_en || ""} onChange={(e) => updHotel(i, { city_label_en: e.target.value })} /></Field>
              <Field label={t("mkt_hotel_name")} wide><input value={h.hotel_name_ar} onChange={(e) => updHotel(i, { hotel_name_ar: e.target.value })} /></Field>
              <Field label={t("mkt_room_type")}><input value={h.room_type_ar || ""} onChange={(e) => updHotel(i, { room_type_ar: e.target.value })} /></Field>
              <Field label={t("mkt_nights")}><input type="number" min="1" value={h.nights} onChange={(e) => updHotel(i, { nights: +e.target.value })} /></Field>
            </div>
            <button className="ic danger mkt-row-del" onClick={() => delHotel(i)}><Trash2 size={14} /></button>
          </div>
        ))}
      </section>

      {/* رحلات الطيران */}
      <section className="card pad">
        <div className="mkt-sec-head"><h2 className="sec-title"><Plane size={16} /> {t("mkt_flights_section")}</h2>
          <button className="btn btn-ghost btn-sm" onClick={addFlight}><Plus size={14} /> {t("mkt_add_flight")}</button></div>
        {(q.flights || []).map((f, i) => (
          <div className="mkt-row-card" key={i}>
            <div className="form-grid">
              <Field label={t("mkt_from")}><input value={f.from_label_ar} onChange={(e) => updFlight(i, { from_label_ar: e.target.value })} /></Field>
              <Field label={t("mkt_to")}><input value={f.to_label_ar} onChange={(e) => updFlight(i, { to_label_ar: e.target.value })} /></Field>
              <Field label={t("mkt_baggage")}><input type="number" value={f.baggage_kg} onChange={(e) => updFlight(i, { baggage_kg: +e.target.value })} /></Field>
            </div>
            <button className="ic danger mkt-row-del" onClick={() => delFlight(i)}><Trash2 size={14} /></button>
          </div>
        ))}
      </section>

      {/* المواصلات والجولات */}
      <section className="card pad">
        <div className="mkt-sec-head"><h2 className="sec-title"><MapPin size={16} /> {t("mkt_cities_section")}</h2>
          <button className="btn btn-ghost btn-sm" onClick={addCity}><Plus size={14} /> {t("mkt_add_city")}</button></div>
        {(q.cities || []).map((c, ci) => (
          <div className="mkt-city-block" key={ci}>
            <div className="mkt-row-card">
              <div className="form-grid">
                <Field label={t("mkt_city_label")}><input value={c.city_label_ar} onChange={(e) => updCity(ci, { city_label_ar: e.target.value })} /></Field>
                <Field label={t("mkt_city_label") + " EN"}><input className="ltr" value={c.city_label_en || ""} onChange={(e) => updCity(ci, { city_label_en: e.target.value })} /></Field>
              </div>
              <button className="ic danger mkt-row-del" onClick={() => delCity(ci)}><Trash2 size={14} /></button>
            </div>
            {(c.tours || []).map((tr, ti) => (
              <div className="mkt-tour-card" key={ti}>
                <Field label={t("mkt_tour_label")}><input value={tr.label_ar} onChange={(e) => updTour(ci, ti, { label_ar: e.target.value })} /></Field>
                <Field label={t("mkt_tour_items")} wide>
                  <textarea rows={3} value={tr.items_ar} onChange={(e) => updTour(ci, ti, { items_ar: e.target.value })} />
                </Field>
                <button className="ic danger" onClick={() => delTour(ci, ti)}><Trash2 size={14} /></button>
              </div>
            ))}
            <button className="add-line" onClick={() => addTour(ci)}><Plus size={14} /> {t("mkt_add_tour")}</button>
          </div>
        ))}
      </section>

      {/* يشمل / هدايا */}
      <section className="card pad">
        <div className="mkt-sec-head"><h2 className="sec-title"><Gift size={16} /> {t("mkt_includes_section")}</h2>
          <button className="btn btn-ghost btn-sm" onClick={addInclude}><Plus size={14} /> {t("mkt_add_include")}</button></div>
        {(q.includes || []).map((inc, i) => (
          <div className="mkt-row-card" key={i}>
            <div className="form-grid">
              <Field label={t("mkt_icon")}>
                <Select value={inc.icon_key} onChange={(v) => updInclude(i, { icon_key: v })} options={ICONS.map(([v]) => ({ v, label: v }))} />
              </Field>
              <Field label={t("mkt_tour_label")} wide><input value={inc.label_ar} onChange={(e) => updInclude(i, { label_ar: e.target.value })} /></Field>
              <label className="set-toggle" style={{ alignSelf: "center" }}>
                <input type="checkbox" checked={inc.is_gift} onChange={(e) => updInclude(i, { is_gift: e.target.checked })} />
                <span>{t("mkt_is_gift")}</span>
              </label>
            </div>
            <button className="ic danger mkt-row-del" onClick={() => delInclude(i)}><Trash2 size={14} /></button>
          </div>
        ))}
      </section>
      {toast}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   عرض الطباعة (٦ صفحات) — مطابق للنموذج المرفق
══════════════════════════════════════════════════════════════════════ */
function QuotePrintView({ quote, onBack, t }) {
  const q = quote;
  const co = q.countries || {};
  const COLORS = { navy: "var(--navy)", red: "#d33b3b" };

  return (
    <div className="page program-page">
      <header className="page-head sticky no-print">
        <button className="btn btn-ghost btn-sm" onClick={onBack}><X size={16} /> {t("close")}</button>
        <button className="btn btn-gold" onClick={() => window.print()}><Printer size={16} /> {t("mkt_print")}</button>
      </header>

      <div className="mkt-doc" dir="rtl">

        {/* ===== صفحة ١: الغلاف ===== */}
        <section className="mkt-page mkt-cover">
          <div className="mkt-cover-bg" style={co.cover_image_url ? { backgroundImage: `url(${co.cover_image_url})` } : {}} />
          <div className="mkt-cover-top">
            <span className="mkt-stars-badge"><Star size={13} fill="currentColor" /> {q.stars}</span>
            <span className="mkt-ref-badge">Ref No {q.ref_no}</span>
          </div>
          {q.badge_ar && <div className="mkt-offer-badge">{q.badge_ar}</div>}
          <div className="mkt-cover-mid">
            <div className="mkt-season-chip">{q.season_label_ar}</div>
            <h1 className="mkt-country-title">{q.title_ar}</h1>
            {q.title_en && <div className="mkt-country-title-en">{q.title_en}</div>}
            <div className="mkt-tripinfo">
              <span className="mkt-triptype">{q.trip_type_ar}</span>
              <span className="mkt-nights-badge"><b>{q.nights}</b> {t("nights_word")}</span>
            </div>
          </div>
          <div className="mkt-hotelcards">
            {(q.hotels || []).map((h, i) => (
              <div className="mkt-hotelcard" key={i}>
                <div className="mkt-hc-city">{h.city_label_ar}<span className="mkt-hc-nights">{h.nights}/{t("nights_word")}</span></div>
                <div className="mkt-hc-body">
                  <b>{h.hotel_name_ar}</b>
                  <div className="mkt-hc-meta">
                    {h.room_type_ar && <span className="mkt-hc-room">{h.room_type_ar}</span>}
                    <span className="mkt-hc-meal">{h.meal_label_ar}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {(q.includes || []).length > 0 && (
            <div className="mkt-includes-strip">
              <div className="mkt-includes-title">يشمـــــــــــــــل</div>
              <div className="mkt-includes-icons">
                {(q.includes || []).filter(i => !i.is_gift).map((inc, i) => (
                  <div className="mkt-inc-ic" key={i}><div className="mkt-inc-circle"><Gift size={16}/></div><span>{inc.label_ar}</span></div>
                ))}
              </div>
            </div>
          )}
          {co.skyline_image_url && <img className="mkt-skyline" src={co.skyline_image_url} alt="" />}
        </section>

        {/* ===== صفحة ٢: رحلات الطيران ===== */}
        {(q.flights || []).length > 0 && (
          <section className="mkt-page mkt-flights-page">
            <div className="mkt-section-title"><Plane size={18}/> رحلات الطيران</div>
            {(q.flights || []).map((f, i) => (
              <div className="mkt-flight-card" key={i}>
                <div className="mkt-flight-route"><ArrowLeft size={16}/> <b>{f.from_label_ar}</b> <span className="mkt-flight-line"/> <b>{f.to_label_ar}</b></div>
                <div className="mkt-flight-bag">الأمتعة: {f.baggage_kg} كيلو للشخص</div>
              </div>
            ))}
            {co.skyline_image_url && <img className="mkt-skyline" src={co.skyline_image_url} alt="" />}
          </section>
        )}

        {/* ===== صفحة ٣: المواصلات والجولات ===== */}
        {(q.cities || []).length > 0 && (
          <section className="mkt-page mkt-tours-page">
            <div className="mkt-section-title"><MapPin size={18}/> المواصلات والجولات</div>
            <div className="mkt-pickup-row">الإستقبال من المطار <ArrowLeft size={14}/> إلى الفندق</div>
            <div className="mkt-cities-flow">
              {q.cities.map((c, i) => (
                <div className="mkt-city-card" key={i} style={{ "--cc": COLORS[c.color_key] || COLORS.navy }}>
                  <div className="mkt-city-head">{c.city_label_ar}</div>
                  <div className="mkt-city-pickup">الإستقبال من المطار والتوصيل الي الفندق</div>
                  {(c.tours || []).map((tr, j) => (
                    <div key={j}>
                      <div className="mkt-tour-label">{tr.label_ar}</div>
                      <ul className="mkt-tour-list">
                        {(tr.items_ar || "").split("\n").filter(Boolean).map((line, k) => <li key={k}>{line}</li>)}
                      </ul>
                    </div>
                  ))}
                  <div className="mkt-city-foot">التحرك الى المطار</div>
                </div>
              ))}
            </div>
            {co.skyline_image_url && <img className="mkt-skyline" src={co.skyline_image_url} alt="" />}
          </section>
        )}

        {/* ===== صفحة ٤: يشمل + هدايا ===== */}
        <section className="mkt-page mkt-includes-page">
          {(q.includes || []).some(i => i.is_gift) && (
            <div className="mkt-gifts-box">
              <div className="mkt-gifts-title"><Gift size={15}/> هدايا وخدمات إضافية</div>
              {(q.includes || []).filter(i => i.is_gift).map((inc, i) => (
                <div className="mkt-gift-item" key={i}><Star size={13} fill="currentColor"/> {inc.label_ar}</div>
              ))}
            </div>
          )}
          <div className="mkt-section-title-bar">العرض يشمل</div>
          <div className="mkt-includes-list">
            {(q.includes || []).filter(i => !i.is_gift).map((inc, i) => (
              <div className="mkt-include-row" key={i}><span>{inc.label_ar}</span><div className="mkt-include-ic"><Plane size={15}/></div></div>
            ))}
          </div>
          {co.skyline_image_url && <img className="mkt-skyline" src={co.skyline_image_url} alt="" />}
        </section>

        {/* ===== صفحة ٥: ملاحظات هامة (ثابتة) ===== */}
        <section className="mkt-page mkt-notes-page">
          <div className="mkt-section-title-bar">ملاحظات هامة</div>
          <ul className="mkt-notes-list">
            <li>اذا كان حجم السيارة لا يتناسب مع عددكم و الامتعه يرجى ابلاغنا مسبقا مع ملاحظة اختلاف الأسعار ع حسب حجمها</li>
            <li>يتم دفع ضريبة المدينة من قبل العميل مباشرة للفندق، 10 رنجت لكل غرفة لكل ليلة</li>
            <li>الغرفة الواحده تتسع ل 2 كبار مع الافطار</li>
            <li>الالغاء او الاسترجاع في الفنادق يعتمد على سياسية الفندق حال الطلب ولا تضمن الشركه استرجاع او تعديل الفندق في حالة الرفض من قبل الفندق</li>
            <li>تذاكر الطيران الداخلي غير قابلة للاستراجاع بعد تأكيد الحجز</li>
            <li>دخول الفنادق الساعة 2 عصرا والخروج الساعه 12 ظهرا</li>
            <li>مدة اليوم السياحي 8 ساعات فقط ولا تشمل تذاكر الدخول للاماكن السياحية</li>
            <li>جميع الجولات تشمل البنزين ومصاريف السواق</li>
          </ul>
          {co.skyline_image_url && <img className="mkt-skyline" src={co.skyline_image_url} alt="" />}
        </section>

        {/* ===== صفحة ٦: السعر ===== */}
        <section className="mkt-page mkt-price-page">
          <div className="mkt-price-ticket">
            <div className="mkt-price-label">السعر للشخص</div>
            <div className="mkt-price-value">{fmt(q.price_per_person || 0)}</div>
            <div className="mkt-price-currency">{q.currency}</div>
          </div>
          {co.skyline_image_url && <img className="mkt-skyline" src={co.skyline_image_url} alt="" />}
        </section>
      </div>
    </div>
  );
}
