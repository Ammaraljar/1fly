// ============================================================================
//  لوحة إدارة الوجهات — جسور جلوبال  (المرحلة ٢)
//  تخطيط متسلسل: الدول → المدن → (فنادق / جولات / أنشطة)
// ============================================================================
import React, { useState, useEffect } from "react";
import {
  Globe, Building2, Hotel, MapPin, Sparkles, Plus, Pencil, Trash2,
  ChevronDown, BedDouble, Image as ImageIcon,
} from "lucide-react";
import { db } from "../../lib/data.js";
import { useI18n } from "../../lib/i18n.jsx";
import { useAuth } from "../../auth/AuthProvider.jsx";
import { Field, Select, Modal, Spinner, useToast } from "../../components/ui.jsx";
import { ImageUploader } from "../../components/ImageUploader.jsx";
import { fmt, CUR } from "../../lib/format.js";

export default function AdminDestinations() {
  const { t, lang, pick } = useI18n();
  const { perms } = useAuth();
  const { show, node: toast } = useToast();

  const [countries, setCountries] = useState([]);
  const [cities, setCities] = useState([]);
  const [selCountry, setSelCountry] = useState(null);
  const [selCity, setSelCity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // {kind, entity?, ...}

  // تحميل الدول
  const loadCountries = async () => {
    const { data } = await db.countries.list();
    setCountries(data || []);
    setLoading(false);
  };
  useEffect(() => { loadCountries(); }, []);

  // تحميل مدن الدولة المختارة
  useEffect(() => {
    if (!selCountry) { setCities([]); setSelCity(null); return; }
    db.cities.byCountry(selCountry.id).then(({ data }) => setCities(data || []));
    setSelCity(null);
  }, [selCountry]);

  const refreshCities = () =>
    selCountry && db.cities.byCountry(selCountry.id).then(({ data }) => setCities(data || []));

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>{t("dest_title")}</h1>
          <p className="page-desc">{t("dest_desc")}</p>
        </div>
      </header>

      {loading ? <Spinner /> : (
        <div className="admin-cols">
          {/* عمود الدول */}
          <div className="col-card">
            <div className="col-head">
              <h3><Globe size={16} /> {t("countries")}</h3>
            </div>
            <div className="col-list">
              {countries.length === 0 && <div className="col-empty">{t("none")}</div>}
              {countries.map((c) => (
                <div key={c.id}
                  className={"col-item" + (selCountry?.id === c.id ? " on" : "")}
                  onClick={() => setSelCountry(c)} role="button">
                  <span>{pick(c, "name")}{c.iso_code && <span className="ci-sub"> · {c.iso_code}</span>}</span>
                  {perms.edit && (
                    <span className="col-item-actions">
                      <button className="ic" title={t("dest_marketing_images")} onClick={(e) => { e.stopPropagation(); setModal({ kind: "countryImages", entity: c }); }}><ImageIcon size={13} /></button>
                      <button className="ic" onClick={(e) => { e.stopPropagation(); setModal({ kind: "country", entity: c }); }}><Pencil size={13} /></button>
                      {perms.delete && (
                        <button className="ic danger" onClick={async (e) => {
                          e.stopPropagation();
                          if (window.confirm(t("confirm_delete"))) {
                            await db.countries.remove(c.id);
                            if (selCountry?.id === c.id) setSelCountry(null);
                            loadCountries(); show(t("saved"));
                          }
                        }}><Trash2 size={13} /></button>
                      )}
                    </span>
                  )}
                </div>
              ))}
            </div>
            {perms.add && (
              <button className="col-add" onClick={() => setModal({ kind: "country" })}>
                <Plus size={15} /> {t("add_country")}
              </button>
            )}
          </div>

          {/* عمود المدن */}
          <div className="col-card">
            <div className="col-head">
              <h3><Building2 size={16} /> {t("cities")}</h3>
            </div>
            <div className="col-list">
              {!selCountry && <div className="col-empty">{t("select_country")}</div>}
              {selCountry && cities.length === 0 && <div className="col-empty">{t("none")}</div>}
              {cities.map((c) => (
                <div key={c.id}
                  className={"col-item" + (selCity?.id === c.id ? " on" : "")}
                  onClick={() => setSelCity(c)} role="button">
                  <span>{pick(c, "name")}</span>
                  {perms.edit && (
                    <span className="col-item-actions">
                      <button className="ic" onClick={(e) => { e.stopPropagation(); setModal({ kind: "city", entity: c }); }}><Pencil size={13} /></button>
                      {perms.delete && (
                        <button className="ic danger" onClick={async (e) => {
                          e.stopPropagation();
                          if (window.confirm(t("confirm_delete"))) {
                            await db.cities.remove(c.id);
                            if (selCity?.id === c.id) setSelCity(null);
                            refreshCities(); show(t("saved"));
                          }
                        }}><Trash2 size={13} /></button>
                      )}
                    </span>
                  )}
                </div>
              ))}
            </div>
            {perms.add && selCountry && (
              <button className="col-add" onClick={() => setModal({ kind: "city" })}>
                <Plus size={15} /> {t("add_city")}
              </button>
            )}
          </div>

          {/* محتوى المدينة */}
          <div className="col-card city-col">
            <div className="col-head">
              <h3><MapPin size={16} /> {selCity ? pick(selCity, "name") : t("cities")}</h3>
            </div>
            <div style={{ padding: 16 }}>
              {!selCity ? (
                <div className="col-empty">{t("select_city")}</div>
              ) : (
                <CityContent city={selCity} perms={perms} onToast={show} />
              )}
            </div>
          </div>
        </div>
      )}

      {/* نوافذ الإضافة/التعديل */}
      {modal?.kind === "country" && (
        <EntityModal
          title={modal.entity ? t("edit") : t("add_country")}
          fields={[
            { name: "name_ar", label: t("name_ar"), required: true },
            { name: "name_en", label: t("name_en"), required: true },
            { name: "iso_code", label: t("iso") },
          ]}
          entity={modal.entity}
          onClose={() => setModal(null)}
          onSave={async (vals) => {
            if (modal.entity) await db.countries.update(modal.entity.id, vals);
            else await db.countries.add(vals);
            setModal(null); loadCountries(); show(t("saved"));
          }}
        />
      )}
      {modal?.kind === "city" && (
        <EntityModal
          title={modal.entity ? t("edit") : t("add_city")}
          fields={[
            { name: "name_ar", label: t("name_ar"), required: true },
            { name: "name_en", label: t("name_en"), required: true },
          ]}
          entity={modal.entity}
          onClose={() => setModal(null)}
          onSave={async (vals) => {
            if (modal.entity) await db.cities.update(modal.entity.id, vals);
            else await db.cities.add({ ...vals, country_id: selCountry.id });
            setModal(null); refreshCities(); show(t("saved"));
          }}
        />
      )}
      {modal?.kind === "countryImages" && (
        <CountryImagesModal country={modal.entity} onClose={() => setModal(null)} onSaved={() => { setModal(null); loadCountries(); show(t("saved")); }} t={t} />
      )}
      {toast}
    </div>
  );
}

/* ----------------------------- محتوى المدينة: فنادق/جولات/أنشطة ----------------------------- */
function CityContent({ city, perms, onToast }) {
  const { t } = useI18n();
  const [tab, setTab] = useState("hotels");
  return (
    <div className="city-content">
      <div className="subtabs">
        <button className={"subtab" + (tab === "hotels" ? " on" : "")} onClick={() => setTab("hotels")}>{t("hotels")}</button>
        <button className={"subtab" + (tab === "tours" ? " on" : "")} onClick={() => setTab("tours")}>{t("tours")}</button>
        <button className={"subtab" + (tab === "activities" ? " on" : "")} onClick={() => setTab("activities")}>{t("activities")}</button>
      </div>
      {tab === "hotels" && <HotelsTab city={city} perms={perms} onToast={onToast} />}
      {tab === "tours" && <ToursTab city={city} perms={perms} onToast={onToast} />}
      {tab === "activities" && <ActivitiesTab city={city} perms={perms} onToast={onToast} />}
    </div>
  );
}

function HotelsTab({ city, perms, onToast }) {
  const { t, pick } = useI18n();
  const [hotels, setHotels] = useState(null);
  const [modal, setModal] = useState(null);
  const [openId, setOpenId] = useState(null);

  const load = () => db.hotels.byCity(city.id).then(({ data }) => setHotels(data || []));
  useEffect(() => { setHotels(null); load(); }, [city.id]);

  if (hotels === null) return <Spinner />;
  return (
    <>
      {hotels.length === 0 && <div className="col-empty">{t("none")}</div>}
      {hotels.map((h) => (
        <div className="item-card" key={h.id}>
          <div className="item-card-head">
            <div style={{ cursor: "pointer" }} onClick={() => setOpenId(openId === h.id ? null : h.id)}>
              <div className="item-card-title">{pick(h, "name")}</div>
              <div className="item-card-meta">
                {h.stars && <span className="stars">{"★".repeat(h.stars)}</span>}
                <span>{t("images")}</span>
                <span>{(h.room_types?.length || 0)} {t("roomtypes")}</span>
              </div>
            </div>
            <div className="row-actions">
              {perms.edit && <button className="ic" onClick={() => setModal({ entity: h })}><Pencil size={15} /></button>}
              {perms.delete && <button className="ic danger" onClick={async () => { if (window.confirm(t("confirm_delete"))) { await db.hotels.remove(h.id); load(); onToast(t("saved")); } }}><Trash2 size={15} /></button>}
              <button className="ic" onClick={() => setOpenId(openId === h.id ? null : h.id)}><ChevronDown size={16} className={"acc" + (openId === h.id ? " open" : "")} /></button>
            </div>
          </div>
          {openId === h.id && (
            <div style={{ marginTop: 14, borderTop: "1px solid #f1efe8", paddingTop: 14 }}>
              <RoomTypes hotel={h} perms={perms} onChange={load} />
              <div style={{ marginTop: 14 }}>
                <span className="field-label">{t("images")}</span>
                <ImageUploader ownerType="hotel" ownerId={h.id} media={h.media || []}
                  canEdit={perms.edit} onChange={() => load()} />
              </div>
            </div>
          )}
        </div>
      ))}
      {perms.add && (
        <button className="col-add" style={{ margin: 0, marginTop: 6 }} onClick={() => setModal({})}>
          <Plus size={15} /> {t("add_hotel")}
        </button>
      )}
      {modal && (
        <EntityModal
          title={modal.entity ? t("edit") : t("add_hotel")}
          fields={[
            { name: "name_ar", label: t("name_ar"), required: true },
            { name: "name_en", label: t("name_en"), required: true },
            { name: "stars", label: t("stars"), type: "number" },
            { name: "description_ar", label: t("description"), type: "textarea", wide: true },
          ]}
          entity={modal.entity}
          onClose={() => setModal(null)}
          onSave={async (vals) => {
            const payload = { ...vals, stars: vals.stars ? +vals.stars : null };
            if (modal.entity) await db.hotels.update(modal.entity.id, payload);
            else await db.hotels.add({ ...payload, city_id: city.id });
            setModal(null); load(); onToast(t("saved"));
          }}
        />
      )}
    </>
  );
}

function RoomTypes({ hotel, perms, onChange }) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const add = async () => {
    if (!name.trim()) return;
    await db.roomTypes.add({ hotel_id: hotel.id, name: name.trim() });
    setName(""); onChange();
  };
  return (
    <div>
      <span className="field-label"><BedDouble size={13} style={{ verticalAlign: -2 }} /> {t("roomtypes")}</span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 7 }}>
        {(hotel.room_types || []).map((r) => (
          <span key={r.id} style={{ background: "var(--cream)", borderRadius: 8, padding: "5px 10px", fontSize: 12.5, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
            {r.name}
            {perms.delete && <button className="ic" style={{ padding: 2 }} onClick={async () => { await db.roomTypes.remove(r.id); onChange(); }}><Trash2 size={12} /></button>}
          </span>
        ))}
      </div>
      {perms.add && (
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <input className="field" style={{ flex: 1, border: "1.5px solid var(--line)", borderRadius: 9, padding: "8px 11px", fontSize: 13 }}
            value={name} onChange={(e) => setName(e.target.value)} placeholder={t("room_type")} onKeyDown={(e) => e.key === "Enter" && add()} />
          <button className="btn btn-ghost btn-sm" onClick={add}><Plus size={14} /></button>
        </div>
      )}
    </div>
  );
}

function ToursTab({ city, perms, onToast }) {
  const { t, pick } = useI18n();
  const [tours, setTours] = useState(null);
  const [modal, setModal] = useState(null);
  const [openId, setOpenId] = useState(null);
  const load = () => db.tours.byCity(city.id).then(({ data }) => setTours(data || []));
  useEffect(() => { setTours(null); load(); }, [city.id]);
  if (tours === null) return <Spinner />;
  return (
    <>
      {tours.length === 0 && <div className="col-empty">{t("none")}</div>}
      {tours.map((tr) => (
        <div className="item-card" key={tr.id}>
          <div className="item-card-head">
            <div style={{ cursor: "pointer" }} onClick={() => setOpenId(openId === tr.id ? null : tr.id)}>
              <div className="item-card-title">{pick(tr, "title")}</div>
              <div className="item-card-meta">
                {tr.duration_hours && <span>{tr.duration_hours} {t("duration_h")}</span>}
                <span>{t("sale")}: <b>{CUR}{fmt(tr.default_sale)}</b></span>
                <span>{t("images")}</span>
              </div>
            </div>
            <div className="row-actions">
              {perms.edit && <button className="ic" onClick={() => setModal({ entity: tr })}><Pencil size={15} /></button>}
              {perms.delete && <button className="ic danger" onClick={async () => { if (window.confirm(t("confirm_delete"))) { await db.tours.remove(tr.id); load(); onToast(t("saved")); } }}><Trash2 size={15} /></button>}
              <button className="ic" onClick={() => setOpenId(openId === tr.id ? null : tr.id)}><ChevronDown size={16} className={"acc" + (openId === tr.id ? " open" : "")} /></button>
            </div>
          </div>
          {openId === tr.id && (
            <div style={{ marginTop: 14, borderTop: "1px solid #f1efe8", paddingTop: 14 }}>
              <span className="field-label">{t("images")}</span>
              <ImageUploader ownerType="tour" ownerId={tr.id} media={tr.media || []} canEdit={perms.edit} onChange={() => load()} />
            </div>
          )}
        </div>
      ))}
      {perms.add && (
        <button className="col-add" style={{ margin: 0, marginTop: 6 }} onClick={() => setModal({})}>
          <Plus size={15} /> {t("add_tour")}
        </button>
      )}
      {modal && (
        <EntityModal
          title={modal.entity ? t("edit") : t("add_tour")}
          fields={[
            { name: "title_ar", label: t("name_ar"), required: true },
            { name: "title_en", label: t("name_en") },
            { name: "duration_hours", label: t("duration_h"), type: "number" },
            { name: "default_cost", label: t("cost"), type: "number" },
            { name: "default_sale", label: t("sale"), type: "number" },
            { name: "description_ar", label: t("description"), type: "textarea", wide: true },
          ]}
          entity={modal.entity}
          onClose={() => setModal(null)}
          onSave={async (vals) => {
            const payload = { ...vals, duration_hours: vals.duration_hours ? +vals.duration_hours : null, default_cost: +vals.default_cost || 0, default_sale: +vals.default_sale || 0 };
            if (modal.entity) await db.tours.update(modal.entity.id, payload);
            else await db.tours.add({ ...payload, city_id: city.id });
            setModal(null); load(); onToast(t("saved"));
          }}
        />
      )}
    </>
  );
}

function ActivitiesTab({ city, perms, onToast }) {
  const { t, pick } = useI18n();
  const [acts, setActs] = useState(null);
  const [modal, setModal] = useState(null);
  const load = () => db.activities.byCity(city.id).then(({ data }) => setActs(data || []));
  useEffect(() => { setActs(null); load(); }, [city.id]);
  if (acts === null) return <Spinner />;
  return (
    <>
      {acts.length === 0 && <div className="col-empty">{t("none")}</div>}
      {acts.map((a) => (
        <div className="item-card" key={a.id}>
          <div className="item-card-head">
            <div>
              <div className="item-card-title">{pick(a, "title")}</div>
              <div className="item-card-meta">
                <span>{t("sale")}: <b>{CUR}{fmt(a.default_sale)}</b></span>
              </div>
            </div>
            <div className="row-actions">
              {perms.edit && <button className="ic" onClick={() => setModal({ entity: a })}><Pencil size={15} /></button>}
              {perms.delete && <button className="ic danger" onClick={async () => { if (window.confirm(t("confirm_delete"))) { await db.activities.remove(a.id); load(); onToast(t("saved")); } }}><Trash2 size={15} /></button>}
            </div>
          </div>
        </div>
      ))}
      {perms.add && (
        <button className="col-add" style={{ margin: 0, marginTop: 6 }} onClick={() => setModal({})}>
          <Plus size={15} /> {t("add_activity")}
        </button>
      )}
      {modal && (
        <EntityModal
          title={modal.entity ? t("edit") : t("add_activity")}
          fields={[
            { name: "title_ar", label: t("name_ar"), required: true },
            { name: "title_en", label: t("name_en") },
            { name: "default_cost", label: t("cost"), type: "number" },
            { name: "default_sale", label: t("sale"), type: "number" },
            { name: "description_ar", label: t("description"), type: "textarea", wide: true },
          ]}
          entity={modal.entity}
          onClose={() => setModal(null)}
          onSave={async (vals) => {
            const payload = { ...vals, default_cost: +vals.default_cost || 0, default_sale: +vals.default_sale || 0 };
            if (modal.entity) await db.activities.update(modal.entity.id, payload);
            else await db.activities.add({ ...payload, city_id: city.id });
            setModal(null); load(); onToast(t("saved"));
          }}
        />
      )}
    </>
  );
}

/* ----------------------------- نافذة إضافة/تعديل عامة ----------------------------- */
/* ══════════════════════════════════════════════════════════════════════
   نافذة صور العرض التسويقي (غلاف + سكايلاين)
══════════════════════════════════════════════════════════════════════ */
function CountryImagesModal({ country, onClose, onSaved, t }) {
  const [cover, setCover] = useState(country.cover_image_url || "");
  const [skyline, setSkyline] = useState(country.skyline_image_url || "");
  const [busyCover, setBusyCover] = useState(false);
  const [busySkyline, setBusySkyline] = useState(false);

  const upload = async (file, kind) => {
    const setBusy = kind === "cover" ? setBusyCover : setBusySkyline;
    const setUrl = kind === "cover" ? setCover : setSkyline;
    setBusy(true);
    try {
      const url = await db.countries.uploadImage(country.id, file, kind);
      setUrl(url);
    } catch (e) { console.error(e); } finally { setBusy(false); }
  };

  return (
    <Modal title={`${t("dest_marketing_images")} — ${country.name_ar}`} onClose={onClose}
      footer={<button className="btn btn-gold" onClick={onSaved}>{t("close")}</button>}>
      <div className="co-logo-row" style={{ marginBottom: 18 }}>
        <div className="co-logo-box" style={{ width: 110, height: 80 }}>
          {cover ? <img src={cover} alt="" /> : <div className="co-logo-ph"><ImageIcon size={22} /></div>}
        </div>
        <div className="co-logo-actions">
          <div className="co-logo-label">{t("dest_cover_image")}</div>
          <div className="co-logo-hint">{t("dest_cover_hint")}</div>
          <input type="file" accept="image/*" hidden id="cover-up" onChange={(e) => e.target.files[0] && upload(e.target.files[0], "cover")} />
          <button className="btn btn-ghost btn-sm" onClick={() => document.getElementById("cover-up").click()} disabled={busyCover}>
            {busyCover ? "…" : t("co_logo_upload")}
          </button>
        </div>
      </div>
      <div className="co-logo-row">
        <div className="co-logo-box" style={{ width: 110, height: 60 }}>
          {skyline ? <img src={skyline} alt="" /> : <div className="co-logo-ph"><ImageIcon size={22} /></div>}
        </div>
        <div className="co-logo-actions">
          <div className="co-logo-label">{t("dest_skyline_image")}</div>
          <div className="co-logo-hint">{t("dest_skyline_hint")}</div>
          <input type="file" accept="image/*" hidden id="sky-up" onChange={(e) => e.target.files[0] && upload(e.target.files[0], "skyline")} />
          <button className="btn btn-ghost btn-sm" onClick={() => document.getElementById("sky-up").click()} disabled={busySkyline}>
            {busySkyline ? "…" : t("co_logo_upload")}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function EntityModal({ title, fields, entity, onClose, onSave }) {
  const { t } = useI18n();
  const [vals, setVals] = useState(() => {
    const v = {};
    fields.forEach((f) => (v[f.name] = entity?.[f.name] ?? ""));
    return v;
  });
  const [busy, setBusy] = useState(false);

  const set = (name, val) => setVals((p) => ({ ...p, [name]: val }));
  const submit = async () => {
    for (const f of fields) if (f.required && !String(vals[f.name]).trim()) return;
    setBusy(true);
    await onSave(vals);
    setBusy(false);
  };

  return (
    <Modal title={title} onClose={onClose}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose}>{t("cancel")}</button>
        <button className="btn btn-gold" onClick={submit} disabled={busy}>{busy ? t("loading") : t("save")}</button>
      </>}>
      <div className="modal-grid">
        {fields.map((f) => (
          <Field key={f.name} label={f.label} wide={f.wide || f.type === "textarea"}>
            {f.type === "textarea" ? (
              <textarea value={vals[f.name]} onChange={(e) => set(f.name, e.target.value)} dir="rtl" />
            ) : (
              <input type={f.type || "text"} value={vals[f.name]} onChange={(e) => set(f.name, e.target.value)} />
            )}
          </Field>
        ))}
      </div>
    </Modal>
  );
}
