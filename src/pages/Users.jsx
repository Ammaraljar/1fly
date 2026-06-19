// ============================================================================
//  المستخدمون والصلاحيات — جسور جلوبال
// ============================================================================
import React, { useState, useEffect } from "react";
import { Check, X, Users as UsersIcon, ShieldAlert, Lock } from "lucide-react";
import { supabase } from "../lib/supabase.js";
import { useI18n } from "../lib/i18n.jsx";
import { Spinner } from "../components/ui.jsx";

const PERMS = [
  ["can_add", "add"], ["can_edit", "edit"], ["can_delete", "delete"], ["super_edit", "actions"],
];

export default function Users() {
  const { t } = useI18n();
  const [rows, setRows] = useState(null);

  useEffect(() => {
    supabase.from("app_users").select("*").order("username").then(({ data }) => setRows(data || []));
  }, []);

  return (
    <div className="page">
      <header className="page-head">
        <div><h1>{t("nav_users")}</h1><p className="page-desc">{t("dest_desc") && "نظام صلاحيات مبني على الأدوار — Role-based access"}</p></div>
      </header>

      {rows === null ? <Spinner /> : (
        <div className="card tablewrap">
          <table className="tbl">
            <thead><tr>
              <th>{t("login_user")}</th><th>{t("name_ar")}</th>
              <th className="ctr">{t("add")}</th><th className="ctr">{t("edit")}</th>
              <th className="ctr">{t("delete")}</th><th className="ctr">Super</th>
            </tr></thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan="6" style={{ textAlign: "center", color: "var(--muted)", padding: 28 }}>
                  <UsersIcon size={22} style={{ opacity: .4 }} /><br />{t("none")}
                </td></tr>
              ) : rows.map((u) => (
                <tr key={u.id}>
                  <td className="strong">@{u.username}</td>
                  <td>{u.display_name || "—"}</td>
                  {["can_add", "can_edit", "can_delete", "super_edit"].map((k) => (
                    <td key={k} className="ctr">
                      {u[k] ? <span className="perm-y"><Check size={14} /></span>
                            : <span className="perm-n"><X size={13} /></span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="sec-card">
        <h3><Lock size={16} /> {t("login_pass")}</h3>
        <p style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.8 }}>
          تُدار حسابات الدخول عبر Supabase Authentication (كلمات مرور مجزّأة bcrypt)، وتُربط الصلاحيات
          بكل مستخدم في جدول app_users. لإضافة مستخدم: أنشئه في Authentication ثم أضف صفه في app_users.
          <br />Login is managed by Supabase Auth; permissions live in the app_users table.
        </p>
      </div>
    </div>
  );
}
