// ============================================================================
//  تسجيل الدخول + الهيكل العام — جسور جلوبال
// ============================================================================
import React, { useState } from "react";
import {
  CircleUser, Lock, ArrowRight, LogOut, LayoutGrid, MapPinned, Car, Users, AlertTriangle, UserSquare2, Receipt, BarChart3, Upload, Settings as Cog, Handshake, Megaphone,
} from "lucide-react";
import { useI18n } from "../lib/i18n.jsx";
import { useAuth } from "../auth/AuthProvider.jsx";
import { LangToggle } from "./ui.jsx";

const HAS_KEYS = !!import.meta.env.VITE_SUPABASE_URL;

export function Wordmark({ large }) {
  const { t } = useI18n();
  return (
    <div className={"wm" + (large ? " lg" : "")}>
      <span className="wm-g">JUSOOR</span>
      <span className="wm-w">global</span>
      <span className="wm-sub">{t("appName")}</span>
    </div>
  );
}

export function Login() {
  const { t } = useI18n();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setErr("");
    setBusy(true);
    const error = await login(email.trim(), pass);
    setBusy(false);
    if (error) setErr(t("login_err"));
  };

  return (
    <div className="login-wrap">
      <div className="login-aura" />
      <LangToggle className="login-lang" />
      <div className="login-card">
        <Wordmark large />
        <div className="login-sub">{t("appSub")}</div>

        {!HAS_KEYS && (
          <div className="login-warn">
            <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{t("login_nokeys")}</span>
          </div>
        )}

        <label className="field" style={{ marginBottom: 14 }}>
          <span className="field-label">{t("login_user")}</span>
          <div className="fld-icon">
            <CircleUser size={18} />
            <input value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@jusoor.global" onKeyDown={(e) => e.key === "Enter" && submit()} />
          </div>
        </label>
        <label className="field" style={{ marginBottom: 14 }}>
          <span className="field-label">{t("login_pass")}</span>
          <div className="fld-icon">
            <Lock size={18} />
            <input type="password" value={pass} onChange={(e) => setPass(e.target.value)}
              placeholder="••••••" onKeyDown={(e) => e.key === "Enter" && submit()} />
          </div>
        </label>

        {err && <div className="login-err">{err}</div>}
        <button className="btn btn-gold btn-lg" onClick={submit} disabled={busy}>
          {busy ? t("loading") : t("login_btn")} <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
}

export function Shell({ route, setRoute, children }) {
  const { t } = useI18n();
  const { user, logout } = useAuth();
  const nav = [
    { key: "orders", icon: LayoutGrid, label: "nav_orders" },
    { key: "customers", icon: UserSquare2, label: "nav_customers" },
    { key: "invoices", icon: Receipt, label: "nav_invoices" },
    { key: "reports", icon: BarChart3, label: "nav_reports" },
    { key: "destinations", icon: MapPinned, label: "nav_destinations" },
    { key: "transport", icon: Car, label: "nav_transport" },
    { key: "import", icon: Upload, label: "nav_import" },
    { key: "settings", icon: Cog, label: "nav_settings" },
    { key: "suppliers", icon: Handshake, label: "nav_suppliers" },
    { key: "marketing", icon: Megaphone, label: "nav_marketing" },
    { key: "users", icon: Users, label: "nav_users" },
  ];
  const name = user?.display_name || user?.username || "";
  return (
    <div className="shell">
      <aside className="side">
        <div className="side-brand">
          <Wordmark />
          <LangToggle />
        </div>
        <nav className="side-nav">
          {nav.map((n) => (
            <button key={n.key}
              className={"side-link" + (route.name === n.key ? " on" : "")}
              onClick={() => setRoute({ name: n.key })}>
              <n.icon size={19} /> <span>{t(n.label)}</span>
            </button>
          ))}
        </nav>
        <div className="side-foot">
          <div className="side-user">
            <div className="avatar">{name.slice(0, 1).toUpperCase()}</div>
            <div>
              <div className="side-user-name">{name}</div>
              <div className="side-user-role">@{user?.username}</div>
            </div>
          </div>
          <button className="side-logout" onClick={logout}>
            <LogOut size={16} /> {t("logout")}
          </button>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
