// ============================================================================
//  عناصر واجهة مشتركة — جسور جلوبال
// ============================================================================
import React, { useState, useEffect, useCallback } from "react";
import { ChevronDown, X, Check, Package } from "lucide-react";
import { useI18n } from "../lib/i18n.jsx";

export function Field({ label, children, wide }) {
  return (
    <label className={"field" + (wide ? " wide" : "")}>
      {label && <span className="field-label">{label}</span>}
      {children}
    </label>
  );
}

export function Select({ value, onChange, options, placeholder = "—", disabled }) {
  return (
    <div className="select-wrap">
      <select value={value ?? ""} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.v} value={o.v}>{o.label}</option>
        ))}
      </select>
      <ChevronDown size={15} className="select-ic" />
    </div>
  );
}

export function Spinner() {
  return <div className="spinner" />;
}

export function Empty({ icon: Icon = Package, title, desc, action }) {
  return (
    <div className="empty">
      <div className="empty-ic"><Icon size={28} /></div>
      <h3>{title}</h3>
      {desc && <p>{desc}</p>}
      {action}
    </div>
  );
}

export function Modal({ title, onClose, children, footer }) {
  useEffect(() => {
    const h = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="ic" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

// Toast hook
export function useToast() {
  const [msg, setMsg] = useState("");
  const show = useCallback((m) => {
    setMsg(m);
    setTimeout(() => setMsg(""), 2200);
  }, []);
  const node = msg ? (
    <div className="toast"><Check size={15} /> {msg}</div>
  ) : null;
  return { show, node };
}

// زر تبديل اللغة
export function LangToggle({ className = "side-lang" }) {
  const { t, toggle } = useI18n();
  return (
    <button className={className} onClick={toggle} title="Language">
      {t("lang_btn")}
    </button>
  );
}
