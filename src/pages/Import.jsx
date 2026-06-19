// ============================================================================
//  استيراد البيانات (CSV) — جسور جلوبال  (الأولوية ٣)
//  يستورد العملاء/المدن/الفنادق/الجولات دفعة واحدة من ملف CSV.
// ============================================================================
import React, { useState } from "react";
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, Download } from "lucide-react";
import { db } from "../lib/data.js";
import { useI18n } from "../lib/i18n.jsx";
import { useAuth } from "../auth/AuthProvider.jsx";
import { Field, Select, useToast } from "../components/ui.jsx";

// تعريف الأنواع: الأعمدة المتوقّعة + جدول الإدراج
const TARGETS = {
  customers: { cols: ["full_name", "nationality", "phone", "email"], required: ["full_name"], fn: (r) => db.bulk.customers(r) },
  cities:    { cols: ["country_id", "name_ar", "name_en"], required: ["country_id", "name_ar"], num: ["country_id"], fn: (r) => db.bulk.cities(r) },
  hotels:    { cols: ["city_id", "name_ar", "name_en", "stars"], required: ["city_id", "name_ar"], num: ["city_id", "stars"], fn: (r) => db.bulk.hotels(r) },
  tours:     { cols: ["city_id", "title_ar", "title_en", "duration_hours", "default_cost", "default_sale"], required: ["city_id", "title_ar"], num: ["city_id", "duration_hours", "default_cost", "default_sale"], fn: (r) => db.bulk.tours(r) },
};

// محلّل CSV بسيط يدعم الفواصل وعلامات الاقتباس
function parseCSV(text) {
  const rows = [];
  let i = 0, field = "", row = [], inQ = false;
  const pushF = () => { row.push(field); field = ""; };
  const pushR = () => { if (row.length > 1 || row[0] !== "") rows.push(row); row = []; };
  while (i < text.length) {
    const c = text[i];
    if (inQ) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i += 2; continue; }
      if (c === '"') { inQ = false; i++; continue; }
      field += c; i++; continue;
    }
    if (c === '"') { inQ = true; i++; continue; }
    if (c === ",") { pushF(); i++; continue; }
    if (c === "\r") { i++; continue; }
    if (c === "\n") { pushF(); pushR(); i++; continue; }
    field += c; i++;
  }
  if (field !== "" || row.length) { pushF(); pushR(); }
  return rows;
}

export default function Import() {
  const { t } = useI18n();
  const { perms } = useAuth();
  const { show, node: toast } = useToast();
  const [target, setTarget] = useState("customers");
  const [rows, setRows] = useState(null);   // {valid:[], invalid:number, headers:[]}
  const [busy, setBusy] = useState(false);
  const def = TARGETS[target];

  const onFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseCSV(String(reader.result).trim());
      if (parsed.length < 2) { show(t("imp_empty_file"), "err"); setRows(null); return; }
      const headers = parsed[0].map((h) => h.trim());
      const valid = [];
      let invalid = 0;
      for (const line of parsed.slice(1)) {
        const obj = {};
        headers.forEach((h, idx) => { if (def.cols.includes(h)) obj[h] = (line[idx] ?? "").trim(); });
        // الأعمدة الرقمية
        (def.num || []).forEach((n) => { obj[n] = obj[n] ? Number(obj[n]) : null; });
        // التحقق من المطلوب
        const ok = def.required.every((r) => obj[r] !== undefined && obj[r] !== "" && obj[r] !== null);
        if (ok) valid.push(obj); else invalid++;
      }
      setRows({ valid, invalid, headers });
    };
    reader.readAsText(file, "utf-8");
  };

  const doImport = async () => {
    if (!rows?.valid.length) return;
    setBusy(true);
    const { error, data } = await def.fn(rows.valid);
    setBusy(false);
    if (error) { show(error.message, "err"); return; }
    show(`${t("imp_done")}: ${data?.length ?? rows.valid.length} ${t("imp_rows")}`);
    setRows(null);
  };

  const downloadTemplate = () => {
    const csv = def.cols.join(",") + "\n";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `template_${target}.csv`;
    a.click();
  };

  return (
    <div className="page">
      <header className="page-head">
        <div><h1>{t("imp_title")}</h1><p className="page-desc">{t("imp_desc")}</p></div>
      </header>

      <div className="card pad">
        <div className="imp-controls">
          <Field label={t("imp_target")}>
            <Select value={target} onChange={(v) => { setTarget(v); setRows(null); }}
              options={Object.keys(TARGETS).map((k) => ({ v: k, label: t("imp_" + k) }))} />
          </Field>
          <button className="btn btn-ghost btn-sm" onClick={downloadTemplate}><Download size={15} /> {t("imp_template")}</button>
        </div>

        <div className="imp-hint">
          <b>{t("imp_map_hint")}:</b> <code>{def.cols.join("، ")}</code>
          {(target === "cities" || target === "hotels" || target === "tours") && (
            <div className="imp-warn"><AlertTriangle size={13} /> {target === "cities" ? t("imp_need_city") : t("imp_need_city")}</div>
          )}
        </div>

        <label className="imp-drop">
          <input type="file" accept=".csv,text/csv" onChange={onFile} hidden />
          <Upload size={22} />
          <span>{t("imp_pick")}</span>
        </label>
      </div>

      {rows && (
        <div className="card pad imp-preview-card">
          <div className="imp-preview-head">
            <h3 className="sub-h"><FileSpreadsheet size={16} /> {t("imp_preview")}</h3>
            <div className="imp-counts">
              <span className="ok"><CheckCircle2 size={14} /> {rows.valid.length} {t("imp_rows")}</span>
              {rows.invalid > 0 && <span className="warn"><AlertTriangle size={14} /> {rows.invalid} {t("imp_invalid")}</span>}
            </div>
          </div>
          <div className="tablewrap">
            <table className="tbl mini">
              <thead><tr>{def.cols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
              <tbody>
                {rows.valid.slice(0, 8).map((r, i) => (
                  <tr key={i}>{def.cols.map((c) => <td key={c} className={(def.num || []).includes(c) ? "num" : ""}>{r[c] ?? "—"}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
          {perms.add && (
            <button className="btn btn-gold" onClick={doImport} disabled={busy || !rows.valid.length} style={{ marginTop: 14 }}>
              <Upload size={16} /> {busy ? t("imp_importing") : `${t("imp_import")} (${rows.valid.length})`}
            </button>
          )}
        </div>
      )}
      {toast}
    </div>
  );
}
