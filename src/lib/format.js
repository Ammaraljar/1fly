// ============================================================================
//  أدوات مساعدة مشتركة — جسور جلوبال
// ============================================================================
import { Plane, Car, Bus, TrainFront, Ship, Hotel, MapPin, Sparkles, LogIn, LogOut } from "lucide-react";

export const CUR = "$";

export const fmt = (n) =>
  (Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export const todayISO = () => new Date().toISOString().slice(0, 10);

export const addDays = (iso, n) => {
  const d = new Date(iso);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

export const nightsBetween = (a, b) => {
  if (!a || !b) return 0;
  const d = (new Date(b) - new Date(a)) / 86400000;
  return d > 0 ? Math.round(d) : 0;
};

export const daysBetween = (a, b) =>
  a && b ? Math.max(1, Math.round((new Date(b) - new Date(a)) / 86400000) + 1) : 1;

// تنسيق التاريخ حسب اللغة
export const formatDate = (iso, lang = "ar") => {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString(lang === "ar" ? "ar-EG" : "en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
};

// حالات الطلب (مفاتيح الترجمة + الألوان)
export const STATUS = {
  offer: { key: "st_offer", color: "var(--offer)" },
  in_progress: { key: "st_in_progress", color: "var(--progress)" },
  done: { key: "st_done", color: "var(--done)" },
};

// أيقونات أنواع النقل
export const MODE_ICON = {
  flight: Plane,
  private_car: Car,
  bus: Bus,
  train: TrainFront,
  ferry: Ship,
  van: Car,
};

// أيقونات عناصر البرنامج اليومي
export const ITEM_ICON = {
  tour: MapPin,
  activity: Sparkles,
  transport: Car,
  checkin: LogIn,
  checkout: LogOut,
  hotel: Hotel,
  note: MapPin,
};
