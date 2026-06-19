// ============================================================================
//  المصادقة والصلاحيات — جسور جلوبال
//  تسجيل دخول فعلي عبر Supabase Auth + تحميل صلاحيات المستخدم من app_users.
// ============================================================================
import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null); // صف app_users (الصلاحيات)
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // الجلسة الحالية (تُحفظ تلقائيًا بين الزيارات)
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session) loadProfile(data.session.user.id);
      else setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_e, sess) => {
      setSession(sess);
      if (sess) loadProfile(sess.user.id);
      else {
        setProfile(null);
        setLoading(false);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function loadProfile(authUid) {
    const { data } = await supabase
      .from("app_users")
      .select("*")
      .eq("auth_uid", authUid)
      .single();
    setProfile(data);
    setLoading(false);
  }

  const login = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error;
  };

  const logout = () => supabase.auth.signOut();

  // صلاحيات افتراضية آمنة إن لم يُربط ملف المستخدم بعد
  const perms = profile
    ? {
        add: profile.can_add,
        edit: profile.can_edit || profile.super_edit,
        delete: profile.can_delete,
        super_edit: profile.super_edit,
      }
    : { add: false, edit: false, delete: false, super_edit: false };

  return (
    <AuthCtx.Provider
      value={{ session, profile, perms, loading, login, logout, user: profile }}
    >
      {children}
    </AuthCtx.Provider>
  );
}
