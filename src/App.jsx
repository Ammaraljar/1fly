// ============================================================================
//  جذر التطبيق — جسور جلوبال
//  مزوّدات (لغة + مصادقة) + بوابة دخول + توجيه بين الصفحات.
// ============================================================================
import React, { useState } from "react";
import { I18nProvider } from "./lib/i18n.jsx";
import { AuthProvider, useAuth } from "./auth/AuthProvider.jsx";
import { Shell, Login } from "./components/Shell.jsx";
import { Spinner } from "./components/ui.jsx";
import Orders from "./pages/Orders.jsx";
import OrderEditor from "./pages/OrderEditor.jsx";
import Customers from "./pages/Customers.jsx";
import Invoices from "./pages/Invoices.jsx";
import ItineraryBuilder from "./pages/ItineraryBuilder.jsx";
import OrderDocuments from "./pages/OrderDocuments.jsx";
import AdminDestinations from "./pages/admin/AdminDestinations.jsx";
import AdminTransport from "./pages/admin/AdminTransport.jsx";
import Reports from "./pages/Reports.jsx";
import Import from "./pages/Import.jsx";
import Settings from "./pages/Settings.jsx";
import Suppliers from "./pages/Suppliers.jsx";
import MarketingQuotes from "./pages/MarketingQuotes.jsx";
import Users from "./pages/Users.jsx";

function Router() {
  const { session, loading } = useAuth();
  const [route, setRoute] = useState({ name: "orders" });

  if (loading) {
    return <div className="boot"><Spinner /></div>;
  }
  if (!session) return <Login />;

  const go = (name, params = {}) => setRoute({ name, ...params });

  let page;
  switch (route.name) {
    case "order":
      page = (
        <OrderEditor
          orderId={route.id}
          onBack={() => go("orders")}
          onOpenItinerary={(id) => go("itinerary", { id })}
          onOpenProgram={(id) => go("program", { id })}
        />
      );
      break;
    case "itinerary":
      page = (
        <ItineraryBuilder
          orderId={route.id}
          onBack={() => go("order", { id: route.id })}
          onOpenProgram={(id) => go("program", { id })}
        />
      );
      break;
    case "program":
      page = <OrderDocuments orderId={route.id} onBack={() => go("order", { id: route.id })} />;
      break;
    case "destinations":
      page = <AdminDestinations />;
      break;
    case "customers":
      page = <Customers />;
      break;
    case "invoices":
      page = <Invoices onOpenOrder={(id) => go("order", { id })} />;
      break;
    case "reports":
      page = <Reports />;
      break;
    case "import":
      page = <Import />;
      break;
    case "settings":
      page = <Settings />;
      break;
    case "suppliers":
      page = <Suppliers />;
      break;
    case "marketing":
      page = <MarketingQuotes />;
      break;
    case "transport":
      page = <AdminTransport />;
      break;
    case "users":
      page = <Users />;
      break;
    case "orders":
    default:
      page = <Orders onOpen={(id) => go("order", { id })} />;
  }

  // المستند الاحترافي يُعرض بملء الصفحة (بدون الشريط الجانبي) لطباعة نظيفة
  if (route.name === "program") return page;

  return <Shell route={route} setRoute={setRoute}>{page}</Shell>;
}

export default function App() {
  return (
    <I18nProvider>
      <AuthProvider>
        <Router />
      </AuthProvider>
    </I18nProvider>
  );
}
