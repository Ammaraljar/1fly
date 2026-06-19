// ============================================================================
//  محرر الطلب — جسور جلوبال  (النسخة الكاملة المُعاد كتابتها)
//  إصلاح حفظ آمن + أنواع غرف + طيران مستقل + إضافة فورية
// ============================================================================
import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  ArrowRight, ArrowLeft, Check, Hotel, MapPin, Sparkles, Car, Plane,
  Plus, Trash2, TrendingUp, CalendarDays, FileText, ChevronDown,
  CircleUser, Receipt, PlusCircle, AlertCircle,
} from "lucide-react";
import { supabase } from "../lib/supabase.js";
import { db, buildItineraryFromOrder, saveItinerary } from "../lib/data.js";
import { useI18n } from "../lib/i18n.jsx";
import { useAuth } from "../auth/AuthProvider.jsx";
import { Field, Select, Modal, Spinner, useToast } from "../components/ui.jsx";
import { fmt, CUR, STATUS, nightsBetween } from "../lib/format.js";
import { InvoiceModal } from "./Invoices.jsx";

const CATS = [
  { key:"order_hotels",    kind:"hotel",    icon:Hotel,    label:"hotels" },
  { key:"order_flights",   kind:"flight",   icon:Plane,    label:"flights_label" },
  { key:"order_tours",     kind:"tour",     icon:MapPin,   label:"tours" },
  { key:"order_activities",kind:"activity", icon:Sparkles, label:"activities" },
  { key:"order_transport", kind:"transport",icon:Car,      label:"transport_title" },
];

function computeTotals(order) {
  const per = {}; let totalCost=0,totalSale=0;
  for(const c of CATS){
    const rows=order[c.key]||[];
    const cost=rows.reduce((s,r)=>s+(+r.cost||0),0);
    const sale=rows.reduce((s,r)=>s+(+r.sale||0),0);
    per[c.key]={cost,sale,margin:sale-cost};
    totalCost+=cost; totalSale+=sale;
  }
  return {per,cost:totalCost,sale:totalSale,margin:totalSale-totalCost};
}

function writableOrder(order) {
  const {id,created_at,updated_at,order_hotels,order_flights,order_tours,
    order_activities,order_transport,itinerary_days,order_totals,customers,...rest}=order;
  return rest;
}

export default function OrderEditor({orderId,onBack,onOpenItinerary,onOpenProgram}){
  const {t,lang}=useI18n(); const {perms}=useAuth();
  const {show,node:toast}=useToast(); const canEdit=perms.edit;
  const [order,setOrder]=useState(null);
  const [customers,setCustomers]=useState([]);
  const [cities,setCities]=useState([]);
  const [addModal,setAddModal]=useState(null);
  const [showInvoice,setShowInvoice]=useState(false);
  const [saving,setSaving]=useState(false);

  const load=useCallback(()=>db.orders.get(orderId).then(({data})=>setOrder(data)),[orderId]);

  useEffect(()=>{
    load();
    db.customers.list().then(({data})=>setCustomers(data||[]));
    db.countries.list().then(async({data:countries})=>{
      const all=[];
      for(const co of countries||[]){
        const {data}=await db.cities.byCountry(co.id);
        all.push(...(data||[]));
      }
      setCities(all);
    });
  },[load]);

  const t_=useMemo(()=>order?computeTotals(order):null,[order]);
  if(!order)return <div className="page"><Spinner/></div>;

  const setHeader=(patch)=>setOrder(o=>({...o,...patch}));

  const saveHeader=async()=>{
    setSaving(true);
    const {error}=await db.orders.update(orderId,writableOrder(order));
    setSaving(false);
    if(error){
      // عرض رسالة الخطأ الحقيقية من Supabase — لا نمسح البيانات
      const msg=error.message||error.details||JSON.stringify(error);
      console.error("[Jusoor] save error:",error);
      show(msg,"err");
      return;
    }
    show(t("saved"));
    // توليد البرنامج اليومي تلقائياً بعد الحفظ
    if(order.arrival_date&&order.depart_date&&order.depart_date>order.arrival_date){
      try{
        const {data:fresh}=await db.orders.get(orderId);
        if(fresh){const days=buildItineraryFromOrder(fresh);await saveItinerary(orderId,days);}
      }catch(e){console.warn("[Jusoor] auto-itinerary:",e);}
    }
  };

  const changeStatus=async(status)=>{
    const {error}=await db.orders.update(orderId,{status});
    if(error){show(error.message||t("error"),"err");return;}
    setOrder(o=>({...o,status}));
    show(t("saved"));
  };

  const TABLE={hotel:"order_hotels",flight:"order_flights",tour:"order_tours",
    activity:"order_activities",transport:"order_transport"};
  const deleteRow=async(kind,id)=>{
    await supabase.from(TABLE[kind]).delete().eq("id",id); load();
  };

  const Back=lang==="ar"?ArrowRight:ArrowLeft;
  const cityName=(c)=>lang==="ar"?(c.name_ar||c.name_en):(c.name_en||c.name_ar);

  return(
    <div className="page editor">
      <header className="page-head sticky">
        <div className="head-left">
          <button className="btn btn-ghost btn-sm" onClick={onBack}><Back size={16}/> {t("back")}</button>
          <div>
            <h1>{order.customer_name||t("new_order")}</h1>
            <p className="page-desc">{order.invoice_id?`#${String(order.invoice_id).padStart(4,"0")}`:t("st_offer")}</p>
          </div>
        </div>
        <div className="head-right">
          <StatusSwitcher value={order.status} onChange={changeStatus} disabled={!canEdit} t={t}/>
          <button className="btn btn-navy btn-sm" onClick={async()=>{await saveHeader();onOpenItinerary(orderId);}}>
            <CalendarDays size={16}/> {t("itinerary")}</button>
          <button className="btn btn-navy btn-sm" onClick={async()=>{await saveHeader();onOpenProgram(orderId);}}>
            <FileText size={16}/> {t("view_program")}</button>
          <button className="btn btn-navy btn-sm" onClick={()=>setShowInvoice(true)}><Receipt size={16}/> {t("inv_title")}</button>
          {canEdit&&<button className="btn btn-gold btn-sm" onClick={saveHeader} disabled={saving}><Check size={16}/>{saving?"…":t("save")}</button>}
        </div>
      </header>

      <div className="editor-grid">
        <div className="editor-main">
          <section className="card pad">
            <h2 className="sec-title"><CircleUser size={18}/> {t("cust_info")}</h2>
            <div className="form-grid">
              <Field label={t("pick_customer")} wide>
                <Select value={order.customer_id?String(order.customer_id):""} disabled={!canEdit}
                  placeholder={t("pick_customer_none")}
                  onChange={(v)=>{const c=customers.find(x=>String(x.id)===v);
                    setHeader(c?{customer_id:c.id,customer_name:c.full_name,nationality:c.nationality||order.nationality}:{customer_id:null});}}
                  options={customers.map(c=>({v:String(c.id),label:c.full_name}))}/>
              </Field>
              <Field label={t("customer")} wide>
                <input value={order.customer_name||""} disabled={!canEdit} onChange={(e)=>setHeader({customer_name:e.target.value})}/>
              </Field>
              <Field label={t("nationality")}>
                <input value={order.nationality||""} disabled={!canEdit} onChange={(e)=>setHeader({nationality:e.target.value})}/>
              </Field>
              <Field label={t("package")}>
                <input value={order.package_label||""} disabled={!canEdit} onChange={(e)=>setHeader({package_label:e.target.value})}/>
              </Field>
              <Field label={t("arrival")}>
                <input type="date" className="ltr" value={order.arrival_date||""} disabled={!canEdit}
                  onChange={(e)=>setHeader({arrival_date:e.target.value})}/>
              </Field>
              <Field label={t("departure")}>
                <input type="date" className="ltr" value={order.depart_date||""} disabled={!canEdit}
                  onChange={(e)=>setHeader({depart_date:e.target.value})}/>
              </Field>
              <Field label={t("adults")}>
                <input type="number" min="0" value={order.adults??1} disabled={!canEdit}
                  onChange={(e)=>setHeader({adults:+e.target.value})}/>
              </Field>
              <Field label={t("kids")}>
                <input type="number" min="0" value={order.kids??0} disabled={!canEdit}
                  onChange={(e)=>setHeader({kids:+e.target.value})}/>
              </Field>
            </div>
          </section>

          {CATS.map(c=>(
            <LineSection key={c.key} cat={c} rows={order[c.key]||[]} totals={t_.per[c.key]}
              canEdit={canEdit} t={t} lang={lang}
              onAdd={()=>setAddModal({kind:c.kind})}
              onDelete={(row)=>deleteRow(c.kind,row.id)}/>
          ))}
        </div>

        <PricingLedger order={order} t_={t_} canEdit={canEdit} t={t}
          onReceived={(v)=>setHeader({received_amount:v})} onBlur={saveHeader}/>
      </div>

      {addModal&&<AddItemModal kind={addModal.kind} orderId={orderId} cities={cities}
        onClose={()=>setAddModal(null)} onAdded={()=>{setAddModal(null);load();show(t("saved"));}}
        t={t} lang={lang} cityName={cityName}/>}
      {showInvoice&&<InvoiceModal orderId={orderId} onClose={()=>setShowInvoice(false)}/>}
      {toast}
    </div>
  );
}

function StatusSwitcher({value,onChange,disabled,t}){
  return(
    <div className="status-switch">
      {Object.keys(STATUS).map(s=>(
        <button key={s} disabled={disabled} className={"ss-btn"+(value===s?" on":"")}
          style={value===s?{background:STATUS[s].color,borderColor:STATUS[s].color}:{}}
          onClick={()=>onChange(s)}>{t(STATUS[s].key)}</button>
      ))}
    </div>
  );
}

function LineSection({cat,rows,totals,canEdit,t,lang,onAdd,onDelete}){
  const [open,setOpen]=useState(rows.length>0);
  const Icon=cat.icon;
  return(
    <section className="card linesec">
      <header className="linesec-head" style={{cursor:"pointer"}} onClick={()=>setOpen(v=>!v)}>
        <div className="linesec-title">
          <span className="linesec-ic"><Icon size={17}/></span>
          {t(cat.label)}{rows.length>0&&<span className="pill">{rows.length}</span>}
        </div>
        <div className="linesec-right">
          {rows.length>0&&<span className="linesec-sum">{t("profit")} <b className="gold">{CUR}{fmt(totals.margin)}</b></span>}
          <ChevronDown size={18} className={"acc"+(open?" open":"")}/>
        </div>
      </header>
      {open&&(
        <div className="linesec-body">
          {rows.length===0&&<div className="line-empty">{t("none")}</div>}
          {rows.map(row=><LineRow key={row.id} kind={cat.kind} row={row} t={t} canEdit={canEdit} onDelete={()=>onDelete(row)}/>)}
          {canEdit&&<button className="add-line" onClick={onAdd}><Plus size={15}/> {t("add_item")}</button>}
        </div>
      )}
    </section>
  );
}

function LineRow({kind,row,t,canEdit,onDelete}){
  const margin=(+row.sale||0)-(+row.cost||0);
  const Money=()=>(
    <div className="line-money">
      <span>{t("cost")}: <b>{CUR}{fmt(row.cost)}</b></span>
      <span>{t("sale")}: <b>{CUR}{fmt(row.sale)}</b></span>
      <span className={margin>=0?"gold":"neg"}>{t("profit")}: <b>{CUR}{fmt(margin)}</b></span>
    </div>
  );
  const Del=()=>canEdit?<button className="line-del" onClick={onDelete}><Trash2 size={15}/></button>:null;
  if(kind==="hotel")return(
    <div className="line-row">
      <div className="line-info">
        <b>{row.hotel_name}</b>
        <span>{row.city_name}{row.room_type?` · ${row.room_type}`:""}</span>
        {row.checkin&&<span className="ltr">{row.checkin} → {row.checkout} ({nightsBetween(row.checkin,row.checkout)} {t("nights_label")})</span>}
        {row.notes&&<span className="line-note">{row.notes}</span>}
      </div><Money/><Del/>
    </div>
  );
  if(kind==="flight")return(
    <div className="line-row">
      <div className="line-info">
        <b>{row.airline}{row.flight_number?` · ${row.flight_number}`:""}</b>
        <span>{row.from_city} → {row.to_city}</span>
        {row.flight_date&&<span className="ltr">{row.flight_date}{row.departure_time?` ${row.departure_time}→${row.arrival_time||""}`:""}</span>}
        {row.flight_class&&<span>{row.flight_class}{row.baggage_kg?` · ${row.baggage_kg}kg`:""}</span>}
        {row.notes&&<span className="line-note">{row.notes}</span>}
      </div><Money/><Del/>
    </div>
  );
  if(kind==="tour"||kind==="activity")return(
    <div className="line-row">
      <div className="line-info">
        <b>{row.title}</b>
        {row.city_name&&<span>{row.city_name}</span>}
        {(row.tour_date||row.activity_date)&&<span className="ltr">{row.tour_date||row.activity_date}</span>}
        {row.notes&&<span className="line-note">{row.notes}</span>}
      </div><Money/><Del/>
    </div>
  );
  return(
    <div className="line-row">
      <div className="line-info">
        <b>{row.from_label} → {row.to_label}</b>
        {row.transport_date&&<span className="ltr">{row.transport_date}</span>}
        {row.notes&&<span className="line-note">{row.notes}</span>}
      </div><Money/><Del/>
    </div>
  );
}

function PricingLedger({order,t_,t,canEdit,onReceived,onBlur}){
  const pct=t_.sale>0?(t_.margin/t_.sale*100):0;
  const bal=t_.sale-(+order.received_amount||0);
  return(
    <aside className="ledger">
      <div className="ledger-head"><TrendingUp size={18}/> <span>{t("pricing")}</span></div>
      <div className="ledger-rows">
        {CATS.map(c=>{
          const p=t_.per[c.key];
          if(!p.sale&&!p.cost)return null;
          return(<div className="lg-row" key={c.key}>
            <span className="lg-name"><c.icon size={13}/> {t(c.label)}</span>
            <span className="num dim">{fmt(p.cost)}</span>
            <span className="num">{fmt(p.sale)}</span>
            <span className="num gold">{fmt(p.margin)}</span>
          </div>);
        })}
      </div>
      <div className="ledger-totals">
        <div className="lg-total"><span>{t("total_cost")}</span><b>{CUR}{fmt(t_.cost)}</b></div>
        <div className="lg-total big"><span>{t("total_sale")}</span><b>{CUR}{fmt(t_.sale)}</b></div>
        <div className="lg-margin">
          <div className="lg-margin-top"><span>{t("net_margin")}</span><b className="gold">{CUR}{fmt(t_.margin)}</b></div>
          <div className="lg-bar"><div className="lg-bar-fill" style={{width:`${Math.min(100,Math.max(0,pct))}%`}}/></div>
          <div className="lg-margin-pct">{t("margin_pct")} {pct.toFixed(1)}%</div>
        </div>
      </div>
      <div className="ledger-pay">
        <Field label={t("received")}>
          <div className="pay-in"><span>{CUR}</span>
            <input type="number" min="0" value={order.received_amount??0} disabled={!canEdit}
              onChange={(e)=>onReceived(+e.target.value)} onBlur={onBlur}/>
          </div>
        </Field>
        <div className={"balance"+(bal<=0?" paid":"")}>
          <span>{bal<=0?t("fully_paid"):t("balance_due")}</span>
          <b>{CUR}{fmt(Math.max(0,bal))}</b>
        </div>
      </div>
    </aside>
  );
}

function AddItemModal({kind,orderId,cities,onClose,onAdded,t,lang,cityName}){
  const [cityId,setCityId]=useState("");
  const [items,setItems]=useState([]);
  const [routes,setRoutes]=useState([]);
  const [suppliers,setSuppliers]=useState([]);
  const [sel,setSel]=useState("");
  const [selectedItem,setSelectedItem]=useState(null);
  const [selectedRoute,setSelectedRoute]=useState(null);
  const [form,setForm]=useState({checkin:"",checkout:"",date:"",rooms:1,cost:0,sale:0,
    notes:"",room_type:"",qty:1,airline:"",flight_number:"",flight_class:"Economy",
    baggage_kg:23,from_city:"",to_city:"",departure_time:"",arrival_time:"",
    duration_min:"",supplier_text:"",supplier_id:"",
    details_ar:"",details_en:"",
    trans_from:"",trans_to:"",trans_mode:"private_car"});
  const [busy,setBusy]=useState(false);
  const [quickNew,setQuickNew]=useState(null);
  const [quickBusy,setQuickBusy]=useState(false);
  const f=(k,v)=>setForm(p=>({...p,[k]:v}));

  // جلب المزودين
  useEffect(()=>{ db.suppliers.list().then(({data})=>setSuppliers(data||[])); },[]);

  useEffect(()=>{
    if(!cityId||kind==="transport"||kind==="flight")return;
    const loaders={
      hotel:()=>db.hotels.byCity(cityId).then(({data})=>setItems(data||[])),
      tour:()=>db.tours.byCity(cityId).then(({data})=>setItems(data||[])),
      activity:()=>db.activities.byCity(cityId).then(({data})=>setItems(data||[])),
    };
    loaders[kind]?.();
    setSel("");setSelectedItem(null);
  },[cityId,kind]);

  useEffect(()=>{
    if(kind==="transport")db.transport.list().then(({data})=>setRoutes(data||[]));
  },[kind]);

  const pick=(row,base)=>lang==="ar"?(row[`${base}_ar`]||row[`${base}_en`]||""):(row[`${base}_en`]||row[`${base}_ar`]||"");

  const onSelectItem=(id)=>{setSel(id);const item=items.find(i=>String(i.id)===id);setSelectedItem(item||null);
    if(item){f("cost",item.default_cost||0);f("sale",item.default_sale||0);}};
  const onSelectRoute=(id)=>{setSel(id);const r=routes.find(x=>String(x.id)===id);setSelectedRoute(r||null);
    if(r){f("cost",r.default_cost||0);f("sale",r.default_sale||0);}};
  const onSelectRoom=(name)=>{const rt=selectedItem?.room_types?.find(r=>r.name===name);f("room_type",name);
    if(rt){f("cost",rt.default_cost||0);f("sale",rt.default_sale||0);}};

  const doQuickNew=async()=>{
    if(!quickNew?.name_ar?.trim())return;
    setQuickBusy(true);
    try{
      let data;
      if(quickNew.type==="hotel"){({data}=await db.hotels.add({city_id:+cityId,name_ar:quickNew.name_ar,name_en:quickNew.name_en||quickNew.name_ar,stars:4}));}
      else if(quickNew.type==="tour"){({data}=await db.tours.add({city_id:+cityId,title_ar:quickNew.name_ar,title_en:quickNew.name_en||quickNew.name_ar}));}
      else if(quickNew.type==="activity"){({data}=await db.activities.add({city_id:+cityId,title_ar:quickNew.name_ar,title_en:quickNew.name_en||quickNew.name_ar}));}
      else if(quickNew.type==="transport"){({data}=await db.transport.add({
        mode:form.trans_mode||"private_car",
        from_label_ar:quickNew.name_ar,from_label_en:quickNew.name_en||quickNew.name_ar,
        to_label_ar:quickNew.name_en||"",to_label_en:quickNew.name_en||""}));}
      if(kind==="transport"){const {data:r}=await db.transport.list();setRoutes(r||[]);if(data){setSelectedRoute(data);setSel(String(data.id));}}
      else{const loaders={hotel:db.hotels.byCity,tour:db.tours.byCity,activity:db.activities.byCity};
        const {data:nl}=await loaders[kind](+cityId);setItems(nl||[]);if(data){setSelectedItem(data);setSel(String(data.id));}}
      setQuickNew(null);
    }catch(e){console.error(e);}finally{setQuickBusy(false);}
  };

  const TABLE2={hotel:"order_hotels",flight:"order_flights",tour:"order_tours",activity:"order_activities",transport:"order_transport"};

  const save=async()=>{
    setBusy(true);
    try{
      const city=cities.find(c=>String(c.id)===String(cityId));
      const cn=city?cityName(city):"";
      let result;
      if(kind==="hotel"&&selectedItem){
        result=await supabase.from(TABLE2.hotel).insert({order_id:orderId,hotel_id:selectedItem.id,
          hotel_name:lang==="ar"?(selectedItem.name_ar||selectedItem.name_en):selectedItem.name_ar||"",
          hotel_name_en:selectedItem.name_en||selectedItem.name_ar||"",
          city_name:lang==="ar"?cn:"",city_name_en:lang==="en"?cn:"",
          room_type:form.room_type||null,
          checkin:form.checkin||null,checkout:form.checkout||null,rooms:+form.rooms||1,
          cost:+form.cost||0,sale:+form.sale||0,notes:form.notes||null,
          details_ar:form.details_ar||null,details_en:form.details_en||null,
          supplier_id:form.supplier_id?+form.supplier_id:null});
      }else if(kind==="flight"){
        result=await supabase.from(TABLE2.flight).insert({order_id:orderId,airline:form.airline||null,
          flight_number:form.flight_number||null,flight_class:form.flight_class||null,
          baggage_kg:form.baggage_kg?+form.baggage_kg:null,
          from_city:form.from_city||null,to_city:form.to_city||null,flight_date:form.date||null,
          departure_time:form.departure_time||null,arrival_time:form.arrival_time||null,
          duration_min:form.duration_min?+form.duration_min:null,supplier:form.supplier||null,
          notes:form.notes||null,cost:+form.cost||0,sale:+form.sale||0});
      }else if(kind==="tour"&&selectedItem){
        result=await supabase.from(TABLE2.tour).insert({order_id:orderId,tour_id:selectedItem.id,
          title:selectedItem.title_ar||"",title_en:selectedItem.title_en||selectedItem.title_ar||"",
          city_name:lang==="ar"?cn:"",city_name_en:lang==="en"?cn:"",
          tour_date:form.date||null,cost:+form.cost||0,sale:+form.sale||0,notes:form.notes||null,
          details_ar:form.details_ar||null,details_en:form.details_en||null,
          supplier_id:form.supplier_id?+form.supplier_id:null});
      }else if(kind==="activity"&&selectedItem){
        result=await supabase.from(TABLE2.activity).insert({order_id:orderId,activity_id:selectedItem.id,
          title:selectedItem.title_ar||"",title_en:selectedItem.title_en||selectedItem.title_ar||"",
          city_name:lang==="ar"?cn:"",city_name_en:lang==="en"?cn:"",
          activity_date:form.date||null,qty:+form.qty||1,cost:+form.cost||0,sale:+form.sale||0,
          notes:form.notes||null,details_ar:form.details_ar||null,details_en:form.details_en||null,
          supplier_id:form.supplier_id?+form.supplier_id:null});
      }else if(kind==="transport"&&selectedRoute){
        result=await supabase.from(TABLE2.transport).insert({order_id:orderId,route_id:selectedRoute.id,
          mode:selectedRoute.mode,
          from_label:selectedRoute.from_label_ar,to_label:selectedRoute.to_label_ar,
          from_label_en:selectedRoute.from_label_en||selectedRoute.from_label_ar,
          to_label_en:selectedRoute.to_label_en||selectedRoute.to_label_ar,
          transport_date:form.date||null,duration_min:selectedRoute.duration_min||null,
          cost:+form.cost||0,sale:+form.sale||0,notes:form.notes||null,
          details_ar:form.details_ar||null,details_en:form.details_en||null,
          supplier_id:form.supplier_id?+form.supplier_id:null});
      }else{setBusy(false);return;}
      // التحقق من خطأ Supabase الحقيقي وعرضه
      if(result?.error){
        const msg=result.error.message||result.error.details||JSON.stringify(result.error);
        console.error("[Jusoor] insert error:",result.error);
        alert(`خطأ في الحفظ:\n${msg}`);
        setBusy(false);
        return; // لا نُغلق النافذة — نحتفظ ببيانات المستخدم
      }
      onAdded();
    }catch(e){
      // عرض الخطأ الحقيقي من Supabase — لا نعيد تعيين النموذج
      const msg=e?.message||e?.details||JSON.stringify(e);
      console.error("[Jusoor] insert error:",e);
      alert(`خطأ في الحفظ:\n${msg}`);
    }finally{setBusy(false);}
  };

  const canSave=kind==="flight"?(form.from_city&&form.to_city):kind==="transport"?!!selectedRoute:!!selectedItem;
  const itemLabel=kind==="hotel"?t("hotels"):kind==="tour"?t("tours"):t("activities");

  return(
    <Modal title={t("add_item")} onClose={onClose} wide
      footer={<><button className="btn btn-ghost" onClick={onClose}>{t("cancel")}</button>
        <button className="btn btn-gold" onClick={save} disabled={!canSave||busy}>{busy?t("loading"):t("add")}</button></>}>
      <div className="modal-grid">
        {kind==="flight"&&<>
          <Field label={t("airline")} wide><input value={form.airline} onChange={e=>f("airline",e.target.value)}/></Field>
          <Field label={t("flight_number")}><input value={form.flight_number} onChange={e=>f("flight_number",e.target.value)}/></Field>
          <Field label={t("flight_class")}>
            <Select value={form.flight_class} onChange={v=>f("flight_class",v)} options={[
              {v:"Economy",label:lang==="ar"?"اقتصادية":"Economy"},
              {v:"Business",label:lang==="ar"?"أعمال":"Business"},
              {v:"First",label:lang==="ar"?"أولى":"First Class"}]}/>
          </Field>
          <Field label={t("from_city")}><input value={form.from_city} onChange={e=>f("from_city",e.target.value)}/></Field>
          <Field label={t("to_city")}><input value={form.to_city} onChange={e=>f("to_city",e.target.value)}/></Field>
          <Field label={t("date")}><input type="date" className="ltr" value={form.date} onChange={e=>f("date",e.target.value)}/></Field>
          <Field label={t("dep_time")}><input type="time" className="ltr" value={form.departure_time} onChange={e=>f("departure_time",e.target.value)}/></Field>
          <Field label={t("arr_time")}><input type="time" className="ltr" value={form.arrival_time} onChange={e=>f("arrival_time",e.target.value)}/></Field>
          <Field label={t("baggage_kg")}><input type="number" min="0" value={form.baggage_kg} onChange={e=>f("baggage_kg",e.target.value)}/></Field>
          <Field label={t("duration_min")}><input type="number" min="0" value={form.duration_min} onChange={e=>f("duration_min",e.target.value)}/></Field>
          <Field label={t("supplier")}><input value={form.supplier} onChange={e=>f("supplier",e.target.value)}/></Field>
        </>}
        {kind==="transport"&&<>
          <Field label={t("transport_title")} wide>
            <div className="quick-row">
              <Select value={sel} onChange={onSelectRoute} placeholder="—"
                options={routes.map(r=>({v:String(r.id),label:`${r.from_label_ar} → ${r.to_label_ar}`}))}/>
              <button className="btn btn-ghost btn-sm" title={t("add_new_quick")}
                onClick={()=>setQuickNew({type:"transport",name_ar:"",name_en:""})}><PlusCircle size={17}/></button>
            </div>
          </Field>
          <Field label={t("date")} wide><input type="date" className="ltr" value={form.date} onChange={e=>f("date",e.target.value)}/></Field>
        </>}
        {kind!=="flight"&&kind!=="transport"&&<>
          <Field label={t("cities")} wide>
            <Select value={cityId} onChange={setCityId} placeholder={t("select_city")}
              options={cities.map(c=>({v:String(c.id),label:cityName(c)}))}/>
          </Field>
          {cityId&&<>
            <Field label={itemLabel} wide>
              <div className="quick-row">
                <Select value={sel} onChange={onSelectItem} placeholder="—" disabled={!cityId}
                  options={items.map(i=>({v:String(i.id),label:pick(i,kind==="hotel"?"name":"title")}))}/>
                <button className="btn btn-ghost btn-sm" title={t("add_new_quick")}
                  onClick={()=>setQuickNew({type:kind,name_ar:"",name_en:""})}><PlusCircle size={17}/></button>
              </div>
            </Field>
            {quickNew&&quickNew.type!=="room"&&(
              <div className="quick-new card pad" style={{gridColumn:"span 2"}}>
                <div className="quick-new-h"><AlertCircle size={14}/> {t("add_new_quick")}</div>
                <div className="form-grid">
                  <Field label={t("name_ar")}><input value={quickNew.name_ar} onChange={e=>setQuickNew(q=>({...q,name_ar:e.target.value}))}/></Field>
                  <Field label={t("name_en")}><input className="ltr" value={quickNew.name_en} onChange={e=>setQuickNew(q=>({...q,name_en:e.target.value}))}/></Field>
                </div>
                <div className="quick-actions">
                  <button className="btn btn-ghost btn-sm" onClick={()=>setQuickNew(null)}>{t("cancel")}</button>
                  <button className="btn btn-gold btn-sm" onClick={doQuickNew} disabled={quickBusy||!quickNew.name_ar?.trim()}>
                    {quickBusy?"…":t("save_and_select")}</button>
                </div>
              </div>
            )}
          </>}
          {kind==="hotel"&&selectedItem&&<>
            <Field label={t("room_type")} wide>
              <div className="quick-row">
                <Select value={form.room_type} onChange={onSelectRoom} placeholder="—"
                  options={(selectedItem.room_types||[]).map(r=>({v:r.name,label:r.name}))}/>
                <button className="btn btn-ghost btn-sm" title={t("add_room_type")}
                  onClick={()=>setQuickNew({type:"room",name_ar:"",hotel_id:selectedItem.id})}><PlusCircle size={17}/></button>
              </div>
            </Field>
            {quickNew?.type==="room"&&(
              <div className="quick-new card pad" style={{gridColumn:"span 2"}}>
                <div className="quick-new-h"><AlertCircle size={14}/> {t("add_room_type")}</div>
                <Field label={t("room_type_name")}><input value={quickNew.name_ar} onChange={e=>setQuickNew(q=>({...q,name_ar:e.target.value}))}/></Field>
                <div className="quick-actions" style={{marginTop:8}}>
                  <button className="btn btn-ghost btn-sm" onClick={()=>setQuickNew(null)}>{t("cancel")}</button>
                  <button className="btn btn-gold btn-sm" disabled={quickBusy||!quickNew.name_ar?.trim()} onClick={async()=>{
                    setQuickBusy(true);
                    await supabase.from("room_types").insert({hotel_id:selectedItem.id,name:quickNew.name_ar});
                    const {data}=await db.hotels.byCity(cityId);
                    const upd=(data||[]).find(h=>h.id===selectedItem.id);
                    if(upd)setSelectedItem(upd);setItems(data||[]);
                    f("room_type",quickNew.name_ar);setQuickNew(null);setQuickBusy(false);
                  }}>{quickBusy?"…":t("save_and_select")}</button>
                </div>
              </div>
            )}
            <Field label={t("checkin")}><input type="date" className="ltr" value={form.checkin} onChange={e=>f("checkin",e.target.value)}/></Field>
            <Field label={t("checkout")}><input type="date" className="ltr" value={form.checkout} onChange={e=>f("checkout",e.target.value)}/></Field>
            <Field label={t("rooms")}><input type="number" min="1" value={form.rooms} onChange={e=>f("rooms",e.target.value)}/></Field>
          </>}
          {(kind==="tour"||kind==="activity")&&selectedItem&&(
            <Field label={t("date")} wide><input type="date" className="ltr" value={form.date} onChange={e=>f("date",e.target.value)}/></Field>
          )}
          {kind==="activity"&&selectedItem&&(
            <Field label={t("qty_persons")}><input type="number" min="1" value={form.qty} onChange={e=>f("qty",e.target.value)}/></Field>
          )}
          {/* المواصلات: نافذة إضافة فورية مع المسار */}
          {kind==="transport"&&quickNew?.type==="transport"&&(
            <div className="quick-new card pad" style={{gridColumn:"span 2"}}>
              <div className="quick-new-h"><AlertCircle size={14}/> {t("add_new_quick")}</div>
              <div className="form-grid">
                <Field label={t("trans_from")}><input value={quickNew.name_ar} onChange={e=>setQuickNew(q=>({...q,name_ar:e.target.value}))}/></Field>
                <Field label={t("trans_to")}><input value={quickNew.name_en} onChange={e=>setQuickNew(q=>({...q,name_en:e.target.value}))}/></Field>
              </div>
              <div className="quick-actions">
                <button className="btn btn-ghost btn-sm" onClick={()=>setQuickNew(null)}>{t("cancel")}</button>
                <button className="btn btn-gold btn-sm" onClick={doQuickNew} disabled={quickBusy||!quickNew.name_ar?.trim()}>
                  {quickBusy?"…":t("save_and_select")}</button>
              </div>
            </div>
          )}
        </>}
        {(selectedItem||selectedRoute||kind==="flight")&&<>
          <Field label={t("cost")}><input type="number" min="0" value={form.cost} onChange={e=>f("cost",e.target.value)}/></Field>
          <Field label={t("sale")}><input type="number" min="0" value={form.sale} onChange={e=>f("sale",e.target.value)}/></Field>
          <Field label={t("notes")} wide><input value={form.notes} onChange={e=>f("notes",e.target.value)}/></Field>
          <Field label={t("details_ar")} wide><input value={form.details_ar} dir="rtl" placeholder={t("details_ar")} onChange={e=>f("details_ar",e.target.value)}/></Field>
          <Field label={t("details_en")} wide><input className="ltr" value={form.details_en} placeholder={t("details_en")} onChange={e=>f("details_en",e.target.value)}/></Field>
          {suppliers.length>0&&<Field label={t("choose_supplier")} wide>
            <Select value={form.supplier_id} onChange={v=>f("supplier_id",v)} placeholder={t("no_supplier")}
              options={suppliers.map(s=>({v:String(s.id),label:s.name_ar+" / "+s.name_en}))}/>
          </Field>}
        </>}
      </div>
    </Modal>
  );
}
