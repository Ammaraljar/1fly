// ============================================================================
//  إدارة المواصلات — جسور جلوبال  (قسم مستقل)
// ============================================================================
import React, { useState, useEffect } from "react";
import { Plane, Car, Pencil, Trash2, Plus } from "lucide-react";
import { db } from "../../lib/data.js";
import { useI18n } from "../../lib/i18n.jsx";
import { useAuth } from "../../auth/AuthProvider.jsx";
import { Field, Select, Modal, Spinner, useToast } from "../../components/ui.jsx";
import { fmt, CUR, MODE_ICON } from "../../lib/format.js";

const MODES = ["flight", "private_car", "bus", "train", "ferry", "van"];

export default function AdminTransport() {
  const { t } = useI18n();
  const { perms } = useAuth();
  const { show, node: toast } = useToast();
  const [routes, setRoutes] = useState(null);
  const [modal, setModal] = useState(null);

  const load = () => db.transport.list().then(({ data }) => setRoutes(data || []));
  useEffect(() => { load(); }, []);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>{t("transport_title")}</h1>
          <p className="page-desc">{t("transport_desc")}</p>
        </div>
        {perms.add && <button className="btn btn-gold" onClick={() => setModal({})}><Plus size={18} /> {t("add_route")}</button>}
      </header>

      {routes === null ? <Spinner /> : routes.length === 0 ? (
        <div className="empty"><div className="empty-ic"><Car size={26} /></div><h3>{t("none")}</h3>
          {perms.add && <button className="btn btn-gold" onClick={() => setModal({})}><Plus size={18} /> {t("add_route")}</button>}
        </div>
      ) : (
        <div className="card tablewrap">
          <table className="tbl">
            <thead><tr>
              <th>{t("mode")}</th><th>{t("from")}</th><th>{t("to")}</th>
              <th className="num">{t("duration_min")}</th><th className="num">{t("cost")}</th><th className="num">{t("sale")}</th><th></th>
            </tr></thead>
            <tbody>
              {routes.map((r) => {
                const Icon = MODE_ICON[r.mode] || Car;
                return (
                  <tr key={r.id}>
                    <td><span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontWeight: 600 }}>
                      <span style={{ width: 28, height: 28, borderRadius: 8, background: "var(--cream)", color: "var(--gold)", display: "grid", placeItems: "center" }}><Icon size={15} /></span>
                      {t("mode_" + r.mode)}</span></td>
                    <td>{r.from_label_ar}</td>
                    <td>{r.to_label_ar}</td>
                    <td className="num">{r.duration_min || "—"}</td>
                    <td className="num">{CUR}{fmt(r.default_cost)}</td>
                    <td className="num gold">{CUR}{fmt(r.default_sale)}</td>
                    <td className="row-actions">
                      {perms.edit && <button className="ic" onClick={() => setModal({ entity: r })}><Pencil size={15} /></button>}
                      {perms.delete && <button className="ic danger" onClick={async () => { if (window.confirm(t("confirm_delete"))) { await db.transport.remove(r.id); load(); show(t("saved")); } }}><Trash2 size={15} /></button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <RouteModal entity={modal.entity} onClose={() => setModal(null)}
          onSave={async (vals) => {
            if (modal.entity) await db.transport.update(modal.entity.id, vals);
            else await db.transport.add(vals);
            setModal(null); load(); show(t("saved"));
          }} />
      )}
      {toast}
    </div>
  );
}

function RouteModal({ entity, onClose, onSave }) {
  const { t } = useI18n();
  const [v, setV] = useState({
    mode: entity?.mode || "private_car",
    from_label_ar: entity?.from_label_ar || "",
    to_label_ar: entity?.to_label_ar || "",
    duration_min: entity?.duration_min || "",
    default_cost: entity?.default_cost || "",
    default_sale: entity?.default_sale || "",
  });
  const [busy, setBusy] = useState(false);
  const set = (k, val) => setV((p) => ({ ...p, [k]: val }));
  const submit = async () => {
    if (!v.from_label_ar.trim() || !v.to_label_ar.trim()) return;
    setBusy(true);
    await onSave({
      ...v,
      duration_min: v.duration_min ? +v.duration_min : null,
      default_cost: +v.default_cost || 0,
      default_sale: +v.default_sale || 0,
    });
    setBusy(false);
  };
  return (
    <Modal title={entity ? t("edit") : t("add_route")} onClose={onClose}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose}>{t("cancel")}</button>
        <button className="btn btn-gold" onClick={submit} disabled={busy}>{busy ? t("loading") : t("save")}</button>
      </>}>
      <div className="modal-grid">
        <Field label={t("mode")} wide>
          <Select value={v.mode} onChange={(val) => set("mode", val)}
            options={MODES.map((m) => ({ v: m, label: t("mode_" + m) }))} />
        </Field>
        <Field label={t("from")}><input value={v.from_label_ar} onChange={(e) => set("from_label_ar", e.target.value)} dir="rtl" /></Field>
        <Field label={t("to")}><input value={v.to_label_ar} onChange={(e) => set("to_label_ar", e.target.value)} dir="rtl" /></Field>
        <Field label={t("duration_min")}><input type="number" value={v.duration_min} onChange={(e) => set("duration_min", e.target.value)} /></Field>
        <Field label={t("cost")}><input type="number" value={v.default_cost} onChange={(e) => set("default_cost", e.target.value)} /></Field>
        <Field label={t("sale")}><input type="number" value={v.default_sale} onChange={(e) => set("default_sale", e.target.value)} /></Field>
      </div>
    </Modal>
  );
}
