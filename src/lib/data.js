// ============================================================================
//  طبقة الوصول للبيانات — جسور جلوبال
//  كل استدعاءات قاعدة البيانات في مكان واحد (تسهّل الصيانة والاختبار).
// ============================================================================
import { supabase } from "./supabase";

// حساب إجماليات الطلب من البنود (بدل منظور order_totals غير القابل للدمج في PostgREST)
const LINE_EMBED =
  "order_hotels(cost,sale), order_flights(cost,sale), order_tours(cost,sale), order_activities(cost,sale,qty), order_transport(cost,sale)";

function attachTotals(row) {
  const all = [
    ...(row.order_hotels || []), ...(row.order_flights || []),
    ...(row.order_tours || []), ...(row.order_activities || []),
    ...(row.order_transport || []),
  ];
  const total_cost = all.reduce((s, r) => s + (+r.cost || 0), 0);
  const total_sale = all.reduce((s, r) => s + (+r.sale || 0), 0);
  return { ...row, order_totals: { total_cost, total_sale, total_margin: total_sale - total_cost } };
}

/* ----------------------------- الهيكل الهرمي ----------------------------- */
export const db = {
  // الدول
  countries: {
    list: () => supabase.from("countries").select("*").order("name_ar"),
    add: (row) => supabase.from("countries").insert(row).select().single(),
    update: (id, row) => supabase.from("countries").update(row).eq("id", id),
    remove: (id) => supabase.from("countries").delete().eq("id", id),
    // رفع صورة الغلاف أو السكايلاين للعرض التسويقي
    uploadImage: async (countryId, file, kind) => {
      // kind: "cover" | "skyline"
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `countries/${kind}_${countryId}_${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("media").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("media").getPublicUrl(path);
      const col = kind === "cover" ? "cover_image_url" : "skyline_image_url";
      await supabase.from("countries").update({ [col]: pub.publicUrl }).eq("id", countryId);
      return pub.publicUrl;
    },
  },

  // المدن (مفلترة بالدولة — القائمة المتسلسلة)
  cities: {
    all: () =>
      supabase.from("cities").select("*, countries(name_ar, name_en)").order("name_ar"),
    byCountry: (countryId) =>
      supabase.from("cities").select("*").eq("country_id", countryId).order("name_ar"),
    add: (row) => supabase.from("cities").insert(row).select().single(),
    update: (id, row) => supabase.from("cities").update(row).eq("id", id),
    remove: (id) => supabase.from("cities").delete().eq("id", id),
  },

  // الفنادق (مفلترة بالمدينة) — مع الصور وأنواع الغرف
  hotels: {
    byCity: (cityId) =>
      supabase
        .from("hotels")
        .select("*, room_types(*)")
        .eq("city_id", cityId)
        .order("name_ar"),
    add: (row) => supabase.from("hotels").insert(row).select().single(),
    update: (id, row) => supabase.from("hotels").update(row).eq("id", id),
    remove: (id) => supabase.from("hotels").delete().eq("id", id),
  },

  roomTypes: {
    add: (row) => supabase.from("room_types").insert(row).select().single(),
    remove: (id) => supabase.from("room_types").delete().eq("id", id),
  },

  // الجولات (مفلترة بالمدينة) — مع الصور
  tours: {
    byCity: (cityId) =>
      supabase.from("tours").select("*").eq("city_id", cityId).order("title_ar"),
    add: (row) => supabase.from("tours").insert(row).select().single(),
    update: (id, row) => supabase.from("tours").update(row).eq("id", id),
    remove: (id) => supabase.from("tours").delete().eq("id", id),
  },

  // الأنشطة (مفلترة بالمدينة)
  activities: {
    byCity: (cityId) =>
      supabase.from("activities").select("*").eq("city_id", cityId).order("title_ar"),
    add: (row) => supabase.from("activities").insert(row).select().single(),
    update: (id, row) => supabase.from("activities").update(row).eq("id", id),
    remove: (id) => supabase.from("activities").delete().eq("id", id),
  },

  // المواصلات (قسم مستقل)
  transport: {
    list: () => supabase.from("transport_routes").select("*").order("from_label_ar"),
    add: (row) => supabase.from("transport_routes").insert(row).select().single(),
    update: (id, row) => supabase.from("transport_routes").update(row).eq("id", id),
    remove: (id) => supabase.from("transport_routes").delete().eq("id", id),
  },

  // الوسائط
  media: {
    byOwner: (ownerType, ownerId) =>
      supabase.from("media").select("*").eq("owner_type", ownerType).eq("owner_id", ownerId).order("sort_order"),
    setCover: async (ownerType, ownerId, mediaId) => {
      await supabase
        .from("media")
        .update({ is_cover: false })
        .eq("owner_type", ownerType)
        .eq("owner_id", ownerId);
      return supabase.from("media").update({ is_cover: true }).eq("id", mediaId);
    },
    remove: (id) => supabase.from("media").delete().eq("id", id),
  },

  /* ----------------------------- الطلبات ----------------------------- */
  orders: {
    list: async (status) => {
      let q = supabase.from("orders").select(`*, ${LINE_EMBED}`).order("created_at", { ascending: false });
      if (status) q = q.eq("status", status);
      const { data, error } = await q;
      return { data: (data || []).map(attachTotals), error };
    },
    get: (id) =>
      supabase
        .from("orders")
        .select(
          "*, order_hotels(*, suppliers(name_ar,name_en)), " +
          "order_flights(*, details_ar, details_en), " +
          "order_tours(*, suppliers(name_ar,name_en)), " +
          "order_activities(*, suppliers(name_ar,name_en)), " +
          "order_transport(*, suppliers(name_ar,name_en)), " +
          "itinerary_days(*, itinerary_items(*))"
        )
        .eq("id", id)
        .single(),
    add: (row) => supabase.from("orders").insert(row).select().single(),
    // update: لا نُعيد بيانات (نتجنّب استبدال الكائن المفصّل بنسخة ناقصة)
    update: (id, row) => supabase.from("orders").update(row).eq("id", id),
    remove: (id) => supabase.from("orders").delete().eq("id", id),
  },

  /* ----------------------------- العملاء ----------------------------- */
  customers: {
    list: (search) => {
      let q = supabase.from("customers").select("*").order("created_at", { ascending: false });
      if (search) q = q.or(`full_name.ilike.%${search}%,phone.ilike.%${search}%,nationality.ilike.%${search}%`);
      return q;
    },
    get: (id) => supabase.from("customers").select("*").eq("id", id).single(),
    ordersOf: async (id) => {
      const { data, error } = await supabase.from("orders").select(`*, ${LINE_EMBED}`).eq("customer_id", id).order("created_at", { ascending: false });
      return { data: (data || []).map(attachTotals), error };
    },
    add: (row) => supabase.from("customers").insert(row).select().single(),
    update: (id, row) => supabase.from("customers").update(row).eq("id", id).select().single(),
    remove: (id) => supabase.from("customers").delete().eq("id", id),
  },

  /* ----------------------------- الفواتير ----------------------------- */
  invoices: {
    list: (status) => {
      let q = supabase
        .from("invoices")
        .select("*, customers(full_name), orders(customer_name)")
        .order("issue_date", { ascending: false });
      if (status) q = q.eq("status", status);
      return q;
    },
    get: (id) =>
      supabase
        .from("invoices")
        .select("*, customers(*), orders(*), payments(*)")
        .eq("id", id)
        .single(),
    byOrder: (orderId) => supabase.from("invoices").select("*, payments(*)").eq("order_id", orderId).maybeSingle(),
    // إنشاء فاتورة من طلب عبر دالة قاعدة البيانات (ترقيم تسلسلي + إجمالي تلقائي)
    createForOrder: (orderId) => supabase.rpc("create_invoice_for_order", { p_order_id: orderId }),
    update: (id, row) => supabase.from("invoices").update(row).eq("id", id).select().single(),
    remove: (id) => supabase.from("invoices").delete().eq("id", id),
  },

  /* ----------------------------- المزودون ----------------------------- */
  suppliers: {
    list: () => supabase.from("suppliers").select("*").order("name_ar"),
    get: (id) => supabase.from("suppliers").select("*, supplier_payments(*)").eq("id", id).single(),
    add: (row) => supabase.from("suppliers").insert(row).select().single(),
    update: (id, row) => supabase.from("suppliers").update(row).eq("id", id),
    remove: (id) => supabase.from("suppliers").delete().eq("id", id),
    balances: () => supabase.from("supplier_balances").select("*").order("balance_due", { ascending: false }),
    // كل الخدمات المرتبطة بمزوّد معين
    services: (supplierId) => Promise.all([
      supabase.from("order_hotels").select("*, orders(customer_name, arrival_date, status)").eq("supplier_id", supplierId),
      supabase.from("order_tours").select("*, orders(customer_name, arrival_date, status)").eq("supplier_id", supplierId),
      supabase.from("order_activities").select("*, orders(customer_name, arrival_date, status)").eq("supplier_id", supplierId),
      supabase.from("order_transport").select("*, orders(customer_name, arrival_date, status)").eq("supplier_id", supplierId),
    ]).then(([h, t, a, tr]) => ({
      hotels: h.data || [], tours: t.data || [], activities: a.data || [], transport: tr.data || [],
    })),
  },

  supplierPayments: {
    add: (row) => supabase.from("supplier_payments").insert(row).select().single(),
    remove: (id) => supabase.from("supplier_payments").delete().eq("id", id),
  },

  /* ----------------------------- العروض التسويقية ----------------------------- */
  marketingQuotes: {
    list: () => supabase.from("marketing_quotes").select("*, countries(name_ar,name_en,cover_image_url,skyline_image_url)").order("created_at", { ascending: false }),
    get: async (id) => {
      const { data: quote, error } = await supabase
        .from("marketing_quotes")
        .select("*, countries(name_ar,name_en,cover_image_url,skyline_image_url)")
        .eq("id", id).single();
      if (error || !quote) return { data: null, error };
      const [hotels, flights, cities, includes] = await Promise.all([
        supabase.from("marketing_quote_hotels").select("*").eq("quote_id", id).order("sort_order"),
        supabase.from("marketing_quote_flights").select("*").eq("quote_id", id).order("sort_order"),
        supabase.from("marketing_quote_cities").select("*, marketing_quote_tours(*)").eq("quote_id", id).order("sort_order"),
        supabase.from("marketing_quote_includes").select("*").eq("quote_id", id).order("sort_order"),
      ]);
      return {
        data: {
          ...quote,
          hotels: hotels.data || [],
          flights: flights.data || [],
          cities: (cities.data || []).map((c) => ({
            ...c,
            tours: (c.marketing_quote_tours || []).slice().sort((a, b) => a.sort_order - b.sort_order),
          })),
          includes: includes.data || [],
        },
        error: null,
      };
    },
    add: (row) => supabase.from("marketing_quotes").insert(row).select().single(),
    update: (id, row) => supabase.from("marketing_quotes").update({ ...row, updated_at: new Date().toISOString() }).eq("id", id),
    remove: (id) => supabase.from("marketing_quotes").delete().eq("id", id),
    // حفظ كامل البنود المتداخلة (يستبدل القديم بالكامل، أبسط وأضمن للتعديل الحر)
    saveAll: async (id, { hotels, flights, cities, includes }) => {
      await Promise.all([
        supabase.from("marketing_quote_hotels").delete().eq("quote_id", id),
        supabase.from("marketing_quote_flights").delete().eq("quote_id", id),
        supabase.from("marketing_quote_cities").delete().eq("quote_id", id), // يحذف tours تلقائياً (cascade)
        supabase.from("marketing_quote_includes").delete().eq("quote_id", id),
      ]);
      if (hotels?.length) await supabase.from("marketing_quote_hotels").insert(hotels.map((h, i) => ({ ...h, quote_id: id, sort_order: i })));
      if (flights?.length) await supabase.from("marketing_quote_flights").insert(flights.map((f, i) => ({ ...f, quote_id: id, sort_order: i })));
      if (includes?.length) await supabase.from("marketing_quote_includes").insert(includes.map((inc, i) => ({ ...inc, quote_id: id, sort_order: i })));
      if (cities?.length) {
        for (let i = 0; i < cities.length; i++) {
          const c = cities[i];
          const { data: cityRow } = await supabase.from("marketing_quote_cities").insert({
            quote_id: id, city_label_ar: c.city_label_ar, city_label_en: c.city_label_en,
            color_key: c.color_key || (i % 2 === 0 ? "navy" : "red"), sort_order: i,
          }).select().single();
          if (cityRow && c.tours?.length) {
            await supabase.from("marketing_quote_tours").insert(
              c.tours.map((t, j) => ({ ...t, city_row_id: cityRow.id, sort_order: j }))
            );
          }
        }
      }
    },
  },

  /* ----------------------------- الدفعات ----------------------------- */
  payments: {
    byInvoice: (invoiceId) => supabase.from("payments").select("*").eq("invoice_id", invoiceId).order("paid_at"),
    add: (row) => supabase.from("payments").insert(row).select().single(),
    remove: (id) => supabase.from("payments").delete().eq("id", id),
  },

  /* ----------------------------- التقارير ----------------------------- */
  reports: {
    summary: (from, to) => supabase.rpc("report_summary", { p_from: from, p_to: to }),
    ordersInRange: async (from, to) => {
      const { data, error } = await supabase.from("orders").select(`*, customers(full_name), ${LINE_EMBED}`)
        .gte("created_at", from).lte("created_at", to + "T23:59:59")
        .order("created_at", { ascending: false });
      return { data: (data || []).map(attachTotals), error };
    },
  },

  /* ----------------------------- البريد والإعدادات ----------------------------- */
  settings: {
    all: () => supabase.from("app_settings").select("*"),
    set: (key, value) => supabase.from("app_settings").update({ value }).eq("key", key),
    // تحميل كل الإعدادات ككائن {key: value}
    map: async () => {
      const { data } = await supabase.from("app_settings").select("*");
      const m = {}; (data || []).forEach((r) => (m[r.key] = r.value)); return m;
    },
    // رفع شعار الشركة إلى bucket التخزين وإرجاع الرابط
    uploadLogo: async (file) => {
      const ext = (file.name.split(".").pop() || "png").toLowerCase();
      const path = `company/logo_${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("media").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("media").getPublicUrl(path);
      await supabase.from("app_settings").update({ value: pub.publicUrl }).eq("key", "company_logo_url");
      return pub.publicUrl;
    },
  },
  email: {
    queue: (row) => supabase.from("email_outbox").insert(row).select().single(),
    list: () => supabase.from("email_outbox").select("*").order("created_at", { ascending: false }).limit(50),
  },

  /* ----------------------------- استيراد دفعي (CSV) ----------------------------- */
  bulk: {
    customers: (rows) => supabase.from("customers").insert(rows).select(),
    hotels: (rows) => supabase.from("hotels").insert(rows).select(),
    tours: (rows) => supabase.from("tours").insert(rows).select(),
    cities: (rows) => supabase.from("cities").insert(rows).select(),
  },

  /* ----------------------------- المزودون ----------------------------- */
  suppliers: {
    list: () => supabase.from("supplier_balances").select("*").order("name_ar"),
    all: () => supabase.from("suppliers").select("*").order("name_ar"),
    get: (id) => supabase.from("suppliers").select("*").eq("id", id).single(),
    add: (row) => supabase.from("suppliers").insert(row).select().single(),
    update: (id, row) => supabase.from("suppliers").update(row).eq("id", id),
    remove: (id) => supabase.from("suppliers").delete().eq("id", id),
    payments: {
      list: (supplierId) => supabase.from("supplier_payments").select("*").eq("supplier_id", supplierId).order("paid_at", { ascending: false }),
      add: (row) => supabase.from("supplier_payments").insert(row).select().single(),
      remove: (id) => supabase.from("supplier_payments").delete().eq("id", id),
    },
  },
};

/* ============================================================================
   توليد البرنامج اليومي تلقائيًا من التواريخ والبنود
   المنطق: لكل يوم بين الوصول والمغادرة، اربط الفندق النشط في ذلك اليوم،
   ووزّع الجولات والأنشطة والتنقلات حسب تواريخها.
============================================================================ */
export function buildItineraryFromOrder(order) {
  const start = new Date(order.arrival_date);
  const end = new Date(order.depart_date);
  const dayCount = Math.max(1, Math.round((end - start) / 86400000) + 1);

  const days = [];
  for (let i = 0; i < dayCount; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    const iso = date.toISOString().slice(0, 10);

    // الفندق النشط في هذا اليوم
    const hotel = (order.order_hotels || []).find(
      (h) => h.checkin && h.checkout && iso >= h.checkin && iso < h.checkout
    );

    const items = [];

    // الطيران
    (order.order_flights || [])
      .filter((f) => f.flight_date === iso)
      .forEach((f) => items.push({
        item_type: "transport",
        title_ar: `✈ ${f.airline || ""} ${f.flight_number || ""} · ${f.from_city} → ${f.to_city}`,
        title_en: `✈ ${f.airline || ""} ${f.flight_number || ""} · ${f.from_city} → ${f.to_city}`,
        detail_ar: [
          f.departure_time ? `${f.departure_time} → ${f.arrival_time || ""}` : "",
          f.flight_class || "",
          f.details_ar || "",
        ].filter(Boolean).join(" · "),
        detail_en: [
          f.departure_time ? `${f.departure_time} → ${f.arrival_time || ""}` : "",
          f.flight_class || "",
          f.details_en || f.details_ar || "",
        ].filter(Boolean).join(" · "),
        ref_id: null,
      }));

    // الجولات
    (order.order_tours || [])
      .filter((t) => t.tour_date === iso)
      .forEach((t) => items.push({
        item_type: "tour",
        title_ar: t.title || "",
        title_en: t.title_en || t.title || "",
        detail_ar: [t.city_name, t.details_ar].filter(Boolean).join(" · "),
        detail_en: [t.city_name_en || t.city_name, t.details_en || t.details_ar].filter(Boolean).join(" · "),
        ref_id: t.tour_id,
      }));

    // الأنشطة
    (order.order_activities || [])
      .filter((a) => a.activity_date === iso)
      .forEach((a) => items.push({
        item_type: "activity",
        title_ar: a.title || "",
        title_en: a.title_en || a.title || "",
        detail_ar: [
          a.city_name,
          a.qty > 1 ? `${a.qty} أشخاص` : "",
          a.details_ar,
        ].filter(Boolean).join(" · "),
        detail_en: [
          a.city_name_en || a.city_name,
          a.qty > 1 ? `${a.qty} persons` : "",
          a.details_en || a.details_ar,
        ].filter(Boolean).join(" · "),
        ref_id: a.activity_id,
      }));

    // المواصلات
    (order.order_transport || [])
      .filter((tr) => tr.transport_date === iso)
      .forEach((tr) => items.push({
        item_type: "transport",
        title_ar: `${tr.from_label} → ${tr.to_label}`,
        title_en: `${tr.from_label_en || tr.from_label} → ${tr.to_label_en || tr.to_label}`,
        detail_ar: tr.details_ar || tr.mode || "",
        detail_en: tr.details_en || tr.details_ar || tr.mode || "",
        ref_id: null,
      }));

    // وسم الوصول والمغادرة
    if (i === 0) items.unshift({
      item_type: "checkin",
      title_ar: "الوصول وتسجيل الدخول",
      title_en: "Arrival & Check-in",
      detail_ar: hotel?.hotel_name || "",
      detail_en: hotel?.hotel_name_en || hotel?.hotel_name || "",
      ref_id: null,
    });
    if (i === dayCount - 1) items.push({
      item_type: "checkout",
      title_ar: "تسجيل الخروج والمغادرة",
      title_en: "Check-out & Departure",
      detail_ar: hotel?.hotel_name || "",
      detail_en: hotel?.hotel_name_en || hotel?.hotel_name || "",
      ref_id: null,
    });

    days.push({
      day_number: i + 1,
      day_date: iso,
      city_name: hotel?.city_name || "",
      city_name_en: hotel?.city_name_en || hotel?.city_name || "",
      hotel_name: hotel?.hotel_name || "",
      hotel_name_en: hotel?.hotel_name_en || hotel?.hotel_name || "",
      meals: i === 0 ? "" : "فطور / Breakfast",
      notes_ar: "",
      sort_order: i,
      items: items.map((it, j) => ({ ...it, sort_order: j })),
    });
  }
  return days;
}

// حفظ البرنامج المولّد في قاعدة البيانات (يستبدل القديم)
export async function saveItinerary(orderId, days) {
  // حذف الأيام القديمة (itinerary_items تُحذف تلقائياً بـ cascade)
  const { error: delErr } = await supabase
    .from("itinerary_days")
    .delete()
    .eq("order_id", orderId);
  if (delErr) {
    console.warn("[Jusoor] itinerary delete warning:", delErr);
    // إن فشل الحذف (مثلاً بسبب RLS)، نحاول upsert مباشرة
  }
  for (const d of days) {
    const { data: day, error } = await supabase
      .from("itinerary_days")
      .upsert(
        {
          order_id: orderId,
          day_number: d.day_number,
          day_date: d.day_date,
          city_name: d.city_name,
          city_name_en: d.city_name_en || d.city_name,
          hotel_name: d.hotel_name,
          hotel_name_en: d.hotel_name_en || d.hotel_name,
          meals: d.meals,
          notes_ar: d.notes_ar,
          sort_order: d.sort_order,
        },
        { onConflict: "order_id,day_number", ignoreDuplicates: false }
      )
      .select()
      .single();
    if (error) throw error;
    if (d.items?.length) {
      await supabase.from("itinerary_items").insert(
        d.items.map((it) => ({
          item_type: it.item_type,
          time_label: it.time_label || null,
          title_ar: it.title_ar,
          title_en: it.title_en || it.title_ar,
          detail_ar: it.detail_ar || null,
          detail_en: it.detail_en || it.detail_ar || null,
          ref_id: it.ref_id || null,
          sort_order: it.sort_order,
          day_id: day.id,
        }))
      );
    }
  }
}
