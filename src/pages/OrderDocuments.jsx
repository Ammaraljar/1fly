// ============================================================================
//  مستندات الطلب — جسور جلوبال  (النسخة الكاملة مع ثنائية اللغة)
//  البيانات تُعرض بلغة الطباعة المختارة (عربي/إنجليزي) مع RTL/LTR
//  الصور تظهر في البرنامج السياحي فقط
// ============================================================================
import React, { useState, useEffect, useMemo } from "react";
import {
  ArrowRight, ArrowLeft, Printer, Building2, MapPin, CalendarDays, Users,
  Plane, Car, Ticket, Languages, Moon,
} from "lucide-react";
import { db } from "../lib/data.js";
import { supabase } from "../lib/supabase.js";
import { useI18n } from "../lib/i18n.jsx";
import { Spinner } from "../components/ui.jsx";
import { fmt, CUR, nightsBetween } from "../lib/format.js";

const D = {
  ar: {
    quote:"عرض سعر سياحي", itinerary:"البرنامج السياحي", invoice:"فاتورة",
    no:"رقم", date:"التاريخ", to:"إلى", summary:"ملخّص الباقة",
    desc:"الوصف", amount:"المبلغ", total:"الإجمالي", paid:"المدفوع", balance:"المتبقّي",
    travelers:"المسافرون", nights:"ليلة", day:"اليوم",
    validFor:"هذا العرض ساري ٧ أيام من تاريخه",
    thanks:"شكرًا لاختياركم", bank:"تفاصيل التحويل البنكي",
    benef:"المستفيد", bankName:"البنك", iban:"IBAN", swift:"SWIFT",
    hotels:"الفنادق", flights:"الطيران", tours:"الجولات",
    activities:"الأنشطة", transport:"المواصلات",
    destinations:"الوجهات", accommodation:"الإقامة",
    adults:"بالغ", kids:"طفل",
    checkin:"تسجيل الدخول", checkout:"تسجيل الخروج",
    roomType:"نوع الغرفة", rooms:"غرف", night:"ليلة",
    airline:"شركة الطيران", flightNo:"رقم الرحلة", cls:"الدرجة",
    baggage:"الوزن", from:"من", to2:"إلى",
    city:"المدينة", persons:"أشخاص", notes:"ملاحظات",
    details:"التفاصيل", supplier:"المزوّد", overview:"نظرة عامة",
    duration:"المدة", minutes:"دقيقة",
  },
  en: {
    quote:"Tourism Quotation", itinerary:"Tourism Program", invoice:"Invoice",
    no:"No.", date:"Date", to:"To", summary:"Package summary",
    desc:"Description", amount:"Amount", total:"Total", paid:"Paid", balance:"Balance",
    travelers:"Travelers", nights:"nights", day:"Day",
    validFor:"This quotation is valid for 7 days",
    thanks:"Thank you for choosing", bank:"Bank transfer details",
    benef:"Beneficiary", bankName:"Bank", iban:"IBAN", swift:"SWIFT",
    hotels:"Hotels", flights:"Flights", tours:"Tours",
    activities:"Activities", transport:"Transport",
    destinations:"Destinations", accommodation:"Accommodation",
    adults:"adults", kids:"children",
    checkin:"Check-in", checkout:"Check-out",
    roomType:"Room type", rooms:"rooms", night:"night",
    airline:"Airline", flightNo:"Flight no.", cls:"Class",
    baggage:"Baggage", from:"From", to2:"To",
    city:"City", persons:"persons", notes:"Notes",
    details:"Details", supplier:"Supplier", overview:"Overview",
    duration:"Duration", minutes:"min",
  },
};

const coverMap = (rows) => {
  const m = {};
  for (const r of rows||[]) if (!m[r.owner_id] || r.is_cover) m[r.owner_id] = r.public_url;
  return m;
};

const fdate = (iso, lang) => {
  if (!iso) return "";
  try { return new Date(iso).toLocaleDateString(
    lang==="ar" ? "ar-EG" : "en-GB",
    {day:"numeric", month:"short", year:"numeric"}
  ); } catch { return iso; }
};

// اختيار النص بلغة الطباعة
const L = (row, baseAr, baseEn, lang) => {
  if (!row) return "";
  if (lang === "en") return row[baseEn] || row[baseAr] || "";
  return row[baseAr] || row[baseEn] || "";
};

export default function OrderDocuments({ orderId, onBack }) {
  const { lang: uiLang } = useI18n();
  const [order, setOrder] = useState(null);
  const [co, setCo] = useState({});
  const [invoice, setInvoice] = useState(null);
  const [hotelImg, setHotelImg] = useState({});
  const [tourImg, setTourImg] = useState({});
  const [tab, setTab] = useState("quote");
  const [plang, setPlang] = useState(uiLang);
  const d = D[plang];
  const dir = plang === "ar" ? "rtl" : "ltr";

  useEffect(() => {
    (async () => {
      const { data } = await db.orders.get(orderId);
      setOrder(data);
      setCo(await db.settings.map());
      const { data: inv } = await db.invoices.byOrder(orderId);
      setInvoice(inv);
      if (data) {
        const hIds = [...new Set((data.order_hotels||[]).map(h=>h.hotel_id).filter(Boolean))];
        const tIds = [...new Set((data.order_tours||[]).map(t=>t.tour_id).filter(Boolean))];
        if (hIds.length) { const {data:hm}=await supabase.from("media").select("*").eq("owner_type","hotel").in("owner_id",hIds); setHotelImg(coverMap(hm)); }
        if (tIds.length) { const {data:tm}=await supabase.from("media").select("*").eq("owner_type","tour").in("owner_id",tIds); setTourImg(coverMap(tm)); }
      }
    })();
  }, [orderId]);

  const days = useMemo(() =>
    (order?.itinerary_days||[]).slice().sort((a,b)=>a.day_number-b.day_number), [order]);

  if (!order) return <div className="page"><Spinner/></div>;

  const Back = uiLang==="ar" ? ArrowRight : ArrowLeft;
  const coName = (plang==="ar" ? co.company_name_ar : co.company_name_en) || "Jusoor Global";
  const coAddr = (plang==="ar" ? co.company_address_ar : co.company_address_en) || "";

  // حساب الإجمالي
  const grand = [...(order.order_hotels||[]),...(order.order_flights||[]),...(order.order_tours||[]),...(order.order_activities||[]),...(order.order_transport||[])].reduce((s,r)=>s+(+r.sale||0),0);
  const paid = +(invoice?.paid_amount||0);

  // دالة لعرض اسم الخدمة بلغة الطباعة
  const hotelName = (h) => plang==="en" ? (h.hotel_name_en||h.hotel_name||"") : (h.hotel_name||"");
  const tourTitle = (t) => plang==="en" ? (t.title_en||t.title||"") : (t.title||"");
  const actTitle  = (a) => plang==="en" ? (a.title_en||a.title||"") : (a.title||"");
  const fromLabel = (tr) => plang==="en" ? (tr.from_label_en||tr.from_label||"") : (tr.from_label||"");
  const toLabel   = (tr) => plang==="en" ? (tr.to_label_en||tr.to_label||"") : (tr.to_label||"");
  const cityName  = (r) => plang==="en" ? (r.city_name_en||r.city_name||"") : (r.city_name||"");
  const detailOf  = (r) => plang==="en" ? (r.details_en||r.details_ar||"") : (r.details_ar||r.details_en||"");
  const supName   = (r) => r.suppliers ? (plang==="en" ? (r.suppliers.name_en||r.suppliers.name_ar) : (r.suppliers.name_ar||r.suppliers.name_en)) : "";

  const DocHeader = ({title, num}) => (
    <div className="d-head">
      <div className="d-brand">
        {co.company_logo_url
          ? <img className="d-logo" src={co.company_logo_url} alt=""/>
          : <div className="d-wm"><span className="wm-g">JUSOOR</span><span className="wm-w">global</span></div>}
        <div className="d-co">
          <div className="d-co-name">{coName}</div>
          {coAddr && <div className="d-co-line">{coAddr}</div>}
          <div className="d-co-line ltr">{[co.company_phone,co.company_email,co.company_website].filter(Boolean).join("  ·  ")}</div>
        </div>
      </div>
      <div className="d-meta">
        <div className="d-title">{title}</div>
        <div>{d.no} <b>#{String(num||orderId).padStart(4,"0")}</b></div>
        <div>{d.date}: <span className="ltr">{fdate(new Date().toISOString(),plang)}</span></div>
      </div>
    </div>
  );

  const ClientInfo = () => (
    <div className="d-client">
      <div><span>{d.to}</span><b>{order.customer_name||"—"}</b></div>
      <div><span>{d.travelers}</span><b>{order.adults} {d.adults}{order.kids ? ` + ${order.kids} ${d.kids}` : ""}</b></div>
      <div><span>{d.date}</span><b className="ltr">{fdate(order.arrival_date,plang)} — {fdate(order.depart_date,plang)}</b></div>
    </div>
  );

  return (
    <div className="page program-page">
      <header className="page-head sticky no-print">
        <div className="head-left">
          <button className="btn btn-ghost btn-sm" onClick={onBack}><Back size={16}/></button>
          <div className="doc-tabs">
            {[["quote",d.quote],["itinerary",d.itinerary],["invoice",d.invoice]].map(([k,label])=>(
              <button key={k} className={"doc-tab"+(tab===k?" on":"")} onClick={()=>setTab(k)}>{label}</button>
            ))}
          </div>
        </div>
        <div className="head-right">
          <div className="plang">
            <Languages size={15}/>
            <button className={plang==="ar"?"on":""} onClick={()=>setPlang("ar")}>عربي</button>
            <button className={plang==="en"?"on":""} onClick={()=>setPlang("en")}>EN</button>
          </div>
          <button className="btn btn-gold" onClick={()=>window.print()}><Printer size={16}/> {plang==="ar"?"طباعة":"Print"}</button>
        </div>
      </header>

      <div className="program" dir={dir}>

        {/* ══════════ عرض السعر ══════════ */}
        {tab==="quote" && (
          <div className="paper-doc">
            <DocHeader title={d.quote} num={orderId}/>
            <ClientInfo/>
            <div className="d-sec-title">{d.summary}</div>
            <table className="d-tbl">
              <thead><tr><th>{d.desc}</th><th className="num">{d.amount}</th></tr></thead>
              <tbody>
                {(order.order_hotels||[]).map((h,i)=>(
                  <tr key={i}>
                    <td>
                      <b>{hotelName(h)}</b>
                      {cityName(h)&&<span className="d-sub"> · {cityName(h)}</span>}
                      {h.room_type&&<span className="d-sub"> · {d.roomType}: {h.room_type}</span>}
                      {h.checkin&&<span className="d-sub"> · {fdate(h.checkin,plang)} → {fdate(h.checkout,plang)} ({nightsBetween(h.checkin,h.checkout)} {d.nights})</span>}
                      {detailOf(h)&&<div className="d-detail">{detailOf(h)}</div>}
                    </td>
                    <td className="num">{CUR}{fmt(h.sale)}</td>
                  </tr>
                ))}
                {(order.order_flights||[]).map((f,i)=>(
                  <tr key={"f"+i}>
                    <td>
                      <b>{f.airline||"—"} {f.flight_number&&`(${f.flight_number})`}</b>
                      <span className="d-sub"> · {f.from_city} → {f.to_city}</span>
                      {f.flight_date&&<span className="d-sub"> · {fdate(f.flight_date,plang)}{f.departure_time&&` ${f.departure_time}→${f.arrival_time||""}`}</span>}
                      {f.flight_class&&<span className="d-sub"> · {d.cls}: {f.flight_class}</span>}
                    </td>
                    <td className="num">{CUR}{fmt(f.sale)}</td>
                  </tr>
                ))}
                {(order.order_tours||[]).map((t,i)=>(
                  <tr key={"t"+i}>
                    <td>
                      <b>{tourTitle(t)}</b>
                      {cityName(t)&&<span className="d-sub"> · {cityName(t)}</span>}
                      {t.tour_date&&<span className="d-sub"> · {fdate(t.tour_date,plang)}</span>}
                      {detailOf(t)&&<div className="d-detail">{detailOf(t)}</div>}
                    </td>
                    <td className="num">{CUR}{fmt(t.sale)}</td>
                  </tr>
                ))}
                {(order.order_activities||[]).map((a,i)=>(
                  <tr key={"a"+i}>
                    <td>
                      <b>{actTitle(a)}</b>
                      {cityName(a)&&<span className="d-sub"> · {cityName(a)}</span>}
                      {a.qty>1&&<span className="d-sub"> · {a.qty} {d.persons}</span>}
                      {detailOf(a)&&<div className="d-detail">{detailOf(a)}</div>}
                    </td>
                    <td className="num">{CUR}{fmt(a.sale)}</td>
                  </tr>
                ))}
                {(order.order_transport||[]).map((tr,i)=>(
                  <tr key={"tr"+i}>
                    <td>
                      <b>{fromLabel(tr)} → {toLabel(tr)}</b>
                      {tr.transport_date&&<span className="d-sub"> · {fdate(tr.transport_date,plang)}</span>}
                      {detailOf(tr)&&<div className="d-detail">{detailOf(tr)}</div>}
                    </td>
                    <td className="num">{CUR}{fmt(tr.sale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="d-grand"><span>{d.total}</span><b>{CUR}{fmt(grand)}</b></div>
            <div className="d-foot">{coName} · {co.company_website||"jusoor.global"} · {d.validFor}</div>
          </div>
        )}

        {/* ══════════ البرنامج السياحي المفصّل ══════════ */}
        {tab==="itinerary" && (
          <div className="paper-doc wide-doc">
            <DocHeader title={d.itinerary} num={orderId}/>
            <div className="prog-cover">
              {Object.values(hotelImg)[0]&&<img className="prog-cover-bg" src={Object.values(hotelImg)[0]} alt=""/>}
              <div className="prog-cover-veil"/>
              <div className="prog-cover-content">
                <div className="prog-customer">{d.to}: <b>{order.customer_name}</b></div>
                <div className="prog-cover-meta">
                  <span><CalendarDays size={15}/> {fdate(order.arrival_date,plang)} — {fdate(order.depart_date,plang)}</span>
                  <span><Users size={15}/> {order.adults} {d.adults}</span>
                </div>
              </div>
            </div>

            <div className="prog-overview">
              <div className="prog-ov-block">
                <h3><MapPin size={16}/> {d.destinations}</h3>
                <div className="prog-chips">
                  {[...new Set((order.order_hotels||[]).map(h=>cityName(h)).filter(Boolean))].map((c,i)=>(
                    <span className="prog-chip" key={i}>{c}</span>
                  ))}
                </div>
              </div>
              <div className="prog-ov-block">
                <h3><Building2 size={16}/> {d.accommodation}</h3>
                <div className="prog-hotels">
                  {(order.order_hotels||[]).map((h,i)=>(
                    <div className="prog-hotel" key={i}>
                      {hotelImg[h.hotel_id]?<img src={hotelImg[h.hotel_id]} alt=""/>:<div className="prog-hotel-ph"><Building2 size={20}/></div>}
                      <div className="prog-hotel-info">
                        <b>{hotelName(h)}</b>
                        <span>{cityName(h)}</span>
                        {h.room_type&&<span>{d.roomType}: {h.room_type}</span>}
                        <span>{nightsBetween(h.checkin,h.checkout)} {d.nights}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="prog-days">
              {days.length===0 ? (
                <div className="dim-note" style={{textAlign:"center",padding:"2rem"}}>
                  {plang==="ar"?"احفظ الطلب أولاً لتوليد البرنامج اليومي تلقائياً":"Save the order first to auto-generate the daily program"}
                </div>
              ) : days.map(day=>{
                const hotelOfDay=(order.order_hotels||[]).find(h=>day.day_date&&h.checkin&&h.checkout&&day.day_date>=h.checkin&&day.day_date<h.checkout);
                const flightsOfDay=(order.order_flights||[]).filter(f=>f.flight_date===day.day_date);
                const toursOfDay=(order.order_tours||[]).filter(t=>t.tour_date===day.day_date);
                const actsOfDay=(order.order_activities||[]).filter(a=>a.activity_date===day.day_date);
                const transOfDay=(order.order_transport||[]).filter(tr=>tr.transport_date===day.day_date);

                return(
                  <article className="prog-day" key={day.id||day.day_number}>
                    <div className="prog-day-head">
                      <div className="prog-day-badge">
                        <span className="prog-day-n">{day.day_number}</span>
                        <span className="prog-day-lbl">{d.day}</span>
                      </div>
                      <div className="prog-day-meta">
                        <div className="prog-day-date ltr">{fdate(day.day_date,plang)}</div>
                        <div className="prog-day-city">
                          {plang==="en" ? (day.city_name_en||hotelOfDay?.city_name_en||day.city_name||hotelOfDay?.city_name||"")
                                        : (day.city_name||hotelOfDay?.city_name||"")}
                          {hotelOfDay&&<> · <span className="prog-day-hotel"><Building2 size={13}/>
                            {plang==="en"?(hotelOfDay.hotel_name_en||hotelOfDay.hotel_name):hotelOfDay.hotel_name}
                          </span></>}
                        </div>
                      </div>
                      {day.meals&&<div className="prog-day-meals">{day.meals}</div>}
                    </div>

                    <div className="prog-timeline">
                      {/* الفندق */}
                      {hotelOfDay&&(
                        <div className="prog-tl-item">
                          <div className="prog-tl-icon" style={{background:"var(--gold)",color:"var(--navy)"}}><Building2 size={16}/></div>
                          <div className="prog-tl-body">
                            <div className="prog-tl-title">{hotelName(hotelOfDay)}</div>
                            <div className="prog-tl-detail">
                              {hotelOfDay.room_type&&`${d.roomType}: ${hotelOfDay.room_type}`}
                              {hotelOfDay.checkin&&` · ${d.checkin}: ${fdate(hotelOfDay.checkin,plang)}`}
                              {hotelOfDay.checkout&&` · ${d.checkout}: ${fdate(hotelOfDay.checkout,plang)}`}
                              {` · ${nightsBetween(hotelOfDay.checkin,hotelOfDay.checkout)} ${d.nights}`}
                            </div>
                            {detailOf(hotelOfDay)&&<div className="prog-tl-detail">{detailOf(hotelOfDay)}</div>}
                          </div>
                          {hotelImg[hotelOfDay.hotel_id]&&<img className="prog-tl-img" src={hotelImg[hotelOfDay.hotel_id]} alt=""/>}
                        </div>
                      )}
                      {/* الطيران */}
                      {flightsOfDay.map((f,i)=>(
                        <div className="prog-tl-item" key={"f"+i}>
                          <div className="prog-tl-icon"><Plane size={16}/></div>
                          <div className="prog-tl-body">
                            {f.departure_time&&<span className="prog-tl-time ltr">{f.departure_time}</span>}
                            <div className="prog-tl-title">{f.airline||""} {f.flight_number&&`(${f.flight_number})`} · {f.from_city} → {f.to_city}</div>
                            <div className="prog-tl-detail">
                              {f.flight_class&&`${d.cls}: ${f.flight_class}`}
                              {f.baggage_kg&&` · ${d.baggage}: ${f.baggage_kg}kg`}
                              {f.arrival_time&&` · ${d.to2}: ${f.arrival_time}`}
                            </div>
                            {detailOf(f)&&<div className="prog-tl-detail">{detailOf(f)}</div>}
                          </div>
                        </div>
                      ))}
                      {/* المواصلات */}
                      {transOfDay.map((tr,i)=>(
                        <div className="prog-tl-item" key={"tr"+i}>
                          <div className="prog-tl-icon"><Car size={16}/></div>
                          <div className="prog-tl-body">
                            <div className="prog-tl-title">{fromLabel(tr)} → {toLabel(tr)}</div>
                            {tr.duration_min&&<div className="prog-tl-detail">{d.duration}: {tr.duration_min} {d.minutes}</div>}
                            {detailOf(tr)&&<div className="prog-tl-detail">{detailOf(tr)}</div>}
                          </div>
                        </div>
                      ))}
                      {/* الجولات */}
                      {toursOfDay.map((t,i)=>(
                        <div className="prog-tl-item" key={"t"+i}>
                          <div className="prog-tl-icon"><MapPin size={16}/></div>
                          <div className="prog-tl-body">
                            <div className="prog-tl-title">{tourTitle(t)}</div>
                            {cityName(t)&&<div className="prog-tl-detail">{cityName(t)}</div>}
                            {detailOf(t)&&<div className="prog-tl-detail">{detailOf(t)}</div>}
                          </div>
                          {tourImg[t.tour_id]&&<img className="prog-tl-img" src={tourImg[t.tour_id]} alt=""/>}
                        </div>
                      ))}
                      {/* الأنشطة */}
                      {actsOfDay.map((a,i)=>(
                        <div className="prog-tl-item" key={"a"+i}>
                          <div className="prog-tl-icon"><Ticket size={16}/></div>
                          <div className="prog-tl-body">
                            <div className="prog-tl-title">{actTitle(a)}{a.qty>1&&` (${a.qty} ${d.persons})`}</div>
                            {cityName(a)&&<div className="prog-tl-detail">{cityName(a)}</div>}
                            {detailOf(a)&&<div className="prog-tl-detail">{detailOf(a)}</div>}
                          </div>
                        </div>
                      ))}
                      {/* عناصر اليوم — ثنائية اللغة */}
                      {(day.itinerary_items||[]).slice().sort((a,b)=>a.sort_order-b.sort_order).map(it=>{
                        const Icon=it.item_type==="checkin"||it.item_type==="checkout"?Building2:it.item_type==="transport"?Car:MapPin;
                        const itemTitle = plang==="en" ? (it.title_en||it.title_ar||"") : (it.title_ar||"");
                        const itemDetail = plang==="en" ? (it.detail_en||it.detail_ar||"") : (it.detail_ar||"");
                        return(
                          <div className="prog-tl-item" key={it.id}>
                            <div className="prog-tl-icon"><Icon size={16}/></div>
                            <div className="prog-tl-body">
                              {it.time_label&&<span className="prog-tl-time ltr">{it.time_label}</span>}
                              <div className="prog-tl-title">{itemTitle}</div>
                              {itemDetail&&<div className="prog-tl-detail">{itemDetail}</div>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {day.notes_ar&&<div className="prog-day-notes">{day.notes_ar}</div>}
                  </article>
                );
              })}
            </div>

            <div className="d-grand"><span>{d.total}</span><b>{CUR}{fmt(grand)}</b></div>
            <div className="d-foot">{coName} · {co.company_website||"jusoor.global"} · {d.thanks} {coName}</div>
          </div>
        )}

        {/* ══════════ الفاتورة المفصّلة ══════════ */}
        {tab==="invoice" && (
          <div className="paper-doc">
            <DocHeader title={d.invoice} num={invoice?.invoice_number||orderId}/>
            <ClientInfo/>

            {(order.order_hotels||[]).length>0&&<>
              <div className="d-sec-title"><Building2 size={13}/> {d.hotels}</div>
              <table className="d-tbl">
                <thead><tr><th>{d.accommodation}</th><th>{d.roomType}</th><th>{d.checkin}</th><th>{d.checkout}</th><th className="num">{d.nights}</th><th className="num">{d.amount}</th></tr></thead>
                <tbody>{(order.order_hotels||[]).map((h,i)=>(
                  <tr key={i}>
                    <td>
                      <b>{hotelName(h)}</b>
                      {cityName(h)&&<div style={{fontSize:11,color:"var(--muted)"}}>{cityName(h)}</div>}
                      {supName(h)&&<div style={{fontSize:11,color:"var(--muted)"}}>{d.supplier}: {supName(h)}</div>}
                      {detailOf(h)&&<div style={{fontSize:11,color:"var(--navy)"}}>{detailOf(h)}</div>}
                    </td>
                    <td>{h.room_type||"—"}</td>
                    <td className="ltr">{fdate(h.checkin,plang)||"—"}</td>
                    <td className="ltr">{fdate(h.checkout,plang)||"—"}</td>
                    <td className="num">{nightsBetween(h.checkin,h.checkout)}</td>
                    <td className="num">{CUR}{fmt(h.sale)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </>}

            {(order.order_flights||[]).length>0&&<>
              <div className="d-sec-title"><Plane size={13}/> {d.flights}</div>
              <table className="d-tbl">
                <thead><tr><th>{d.airline}</th><th>{d.flightNo}</th><th>{d.from}/{d.to2}</th><th>{d.date}</th><th>{d.cls}</th><th className="num">{d.amount}</th></tr></thead>
                <tbody>{(order.order_flights||[]).map((f,i)=>(
                  <tr key={i}>
                    <td><b>{f.airline||"—"}</b></td>
                    <td>{f.flight_number||"—"}</td>
                    <td className="ltr">{f.from_city} → {f.to_city}</td>
                    <td className="ltr">{fdate(f.flight_date,plang)||"—"}{f.departure_time?` ${f.departure_time}→${f.arrival_time||""}`:""}</td>
                    <td>{f.flight_class||"—"}{f.baggage_kg?` · ${f.baggage_kg}kg`:""}</td>
                    <td className="num">{CUR}{fmt(f.sale)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </>}

            {(order.order_tours||[]).length>0&&<>
              <div className="d-sec-title"><MapPin size={13}/> {d.tours}</div>
              <table className="d-tbl">
                <thead><tr><th>{d.desc}</th><th>{d.city}</th><th>{d.date}</th><th className="num">{d.amount}</th></tr></thead>
                <tbody>{(order.order_tours||[]).map((t,i)=>(
                  <tr key={i}>
                    <td>
                      <b>{tourTitle(t)}</b>
                      {supName(t)&&<div style={{fontSize:11,color:"var(--muted)"}}>{d.supplier}: {supName(t)}</div>}
                      {detailOf(t)&&<div style={{fontSize:11,color:"var(--navy)"}}>{detailOf(t)}</div>}
                    </td>
                    <td>{cityName(t)||"—"}</td>
                    <td className="ltr">{fdate(t.tour_date,plang)||"—"}</td>
                    <td className="num">{CUR}{fmt(t.sale)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </>}

            {(order.order_activities||[]).length>0&&<>
              <div className="d-sec-title"><Ticket size={13}/> {d.activities}</div>
              <table className="d-tbl">
                <thead><tr><th>{d.desc}</th><th>{d.city}</th><th>{d.date}</th><th>{d.persons}</th><th className="num">{d.amount}</th></tr></thead>
                <tbody>{(order.order_activities||[]).map((a,i)=>(
                  <tr key={i}>
                    <td>
                      <b>{actTitle(a)}</b>
                      {supName(a)&&<div style={{fontSize:11,color:"var(--muted)"}}>{d.supplier}: {supName(a)}</div>}
                      {detailOf(a)&&<div style={{fontSize:11,color:"var(--navy)"}}>{detailOf(a)}</div>}
                    </td>
                    <td>{cityName(a)||"—"}</td>
                    <td className="ltr">{fdate(a.activity_date,plang)||"—"}</td>
                    <td>{a.qty||1}</td>
                    <td className="num">{CUR}{fmt(a.sale)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </>}

            {(order.order_transport||[]).length>0&&<>
              <div className="d-sec-title"><Car size={13}/> {d.transport}</div>
              <table className="d-tbl">
                <thead><tr><th>{d.from}/{d.to2}</th><th>{d.date}</th><th className="num">{d.amount}</th></tr></thead>
                <tbody>{(order.order_transport||[]).map((tr,i)=>(
                  <tr key={i}>
                    <td>
                      <b>{fromLabel(tr)} → {toLabel(tr)}</b>
                      {supName(tr)&&<div style={{fontSize:11,color:"var(--muted)"}}>{d.supplier}: {supName(tr)}</div>}
                      {detailOf(tr)&&<div style={{fontSize:11,color:"var(--navy)"}}>{detailOf(tr)}</div>}
                    </td>
                    <td className="ltr">{fdate(tr.transport_date,plang)||"—"}</td>
                    <td className="num">{CUR}{fmt(tr.sale)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </>}

            <div className="d-invoice-tot">
              <div><span>{d.total}</span><b>{CUR}{fmt(grand)}</b></div>
              <div><span>{d.paid}</span><b>{CUR}{fmt(paid)}</b></div>
              <div className="grand"><span>{d.balance}</span><b>{CUR}{fmt(Math.max(0,grand-paid))}</b></div>
            </div>
            {(co.bank_iban||co.bank_name||co.bank_beneficiary)&&(
              <div className="d-bank">
                <div className="d-sec-title">{d.bank}</div>
                <div className="d-bank-grid">
                  <div><span>{d.benef}</span><b className="ltr">{co.bank_beneficiary||coName}</b></div>
                  <div><span>{d.bankName}</span><b className="ltr">{co.bank_name||"—"}</b></div>
                  <div><span>{d.iban}</span><b className="ltr">{co.bank_iban||"—"}</b></div>
                  <div><span>{d.swift}</span><b className="ltr">{co.bank_swift||"—"}</b></div>
                </div>
              </div>
            )}
            <div className="d-foot">{coName} · {co.company_website||"jusoor.global"} · {d.thanks} {coName}</div>
          </div>
        )}
      </div>
    </div>
  );
}
