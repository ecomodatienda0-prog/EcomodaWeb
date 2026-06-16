import React, { useState, useEffect } from "react";
import { 
  Building, 
  Database, 
  Lock, 
  RefreshCw, 
  ShoppingBag, 
  TrendingUp, 
  Settings, 
  ShieldCheck, 
  Tag, 
  Info,
  ChevronRight,
  ExternalLink,
  Menu
} from "lucide-react";
import { Product, Order, CompanyInfo, CartItem, Review } from "./types";
import ClientShop from "./components/ClientShop";
import Cart from "./components/Cart";
import AdminDashboard from "./components/AdminDashboard";

export default function App() {
  const [view, setView] = useState<"shop" | "admin">("shop");
  
  // Data State
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo>({
    name: "Fardos Ecomoda",
    phone: "+504 9999-8888",
    address: "Bulevar Morazán, Tegucigalpa, Honduras",
    hours: "Lunes a Sábado: 9:00 AM - 7:00 PM",
    bankDetails: "BAC Credomatic\nCuenta de Ahorros: 742019283\nA nombre de: Ecomoda S. de R. L.",
    cashDiscountPercent: 10,
  });
  const [spreadsheetId, setSpreadsheetId] = useState("");
  const [appsScriptUrl, setAppsScriptUrl] = useState("");
  
  // Cart UI States
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  
  // App Loading state indicators
  const [loading, setLoading] = useState(true);

  // Initial load
  useEffect(() => {
    fetchConfig();
    fetchProducts(true); // Force synchronizing from Google Apps Script Web App or Sheet on every entry/reload
    fetchOrders();
    fetchReviews();
  }, []);

  // API Call: Fetch reviews
  const fetchReviews = async () => {
    try {
      const res = await fetch("/api/reviews");
      const data = await res.json();
      if (data.reviews) setReviews(data.reviews);
    } catch (err) {
      console.error("Reviews load error:", err);
    }
  };

  const handleSubmitReview = async (reviewData: { nombre: string; calificacion: number; comentario: string; producto: string }) => {
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ review: reviewData })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.review) {
          setReviews(prev => [data.review, ...prev]);
        }
        return true;
      }
    } catch (e) {
      console.error("Error submitting review:", e);
    }
    return false;
  };

  // API Call: Fetch Config settings
  const fetchConfig = async () => {
    try {
      const res = await fetch("/api/config");
      const data = await res.json();
      if (data.companyInfo) setCompanyInfo(data.companyInfo);
      if (data.spreadsheetId) setSpreadsheetId(data.spreadsheetId);
      if (data.appsScriptUrl) setAppsScriptUrl(data.appsScriptUrl);
    } catch (err) {
      console.error("Config load error:", err);
    }
  };

  // API Call: Fetch products (Cached or sheet based)
  const fetchProducts = async (forceSync = false) => {
    try {
      setLoading(true);
      const url = forceSync ? "/api/products?sync=true" : "/api/products";
      const res = await fetch(url);
      const data = await res.json();
      if (data.products) setProducts(data.products);
    } catch (err) {
      console.error("Products load error:", err);
    } finally {
      setLoading(false);
    }
  };

  // API Call: Fetch placed order summaries
  const fetchOrders = async () => {
    try {
      const res = await fetch("/api/orders");
      const data = await res.json();
      if (data.orders) setOrders(data.orders);
    } catch (err) {
      console.error("Orders load error:", err);
    }
  };

  // Callback action: reload from Sheets
  const handleRefreshData = async () => {
    await fetchProducts(true);
    await fetchOrders();
  };

  // Callback action: update order status on backend
  const handleUpdateOrderStatus = async (orderId: string, status?: Order["status"], usuarioVendedor?: string) => {
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, usuarioVendedor })
      });
      if (res.ok) {
        // Optimistic / clean local updates
        setOrders(prev => prev.map(o => {
          if (o.id === orderId) {
            const updated = { ...o };
            if (status !== undefined) updated.status = status;
            if (usuarioVendedor !== undefined) updated.usuarioVendedor = usuarioVendedor;
            return updated;
          }
          return o;
        }));
      }
    } catch (err) {
      console.error("Order update error:", err);
    }
  };

  // Callback action: save main configurations
  const handleUpdateConfig = async (configPayload: { spreadsheetId?: string; appsScriptUrl?: string; companyInfo?: Partial<CompanyInfo> }) => {
    try {
      const res = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(configPayload)
      });
      if (res.ok) {
        const result = await res.json();
        if (configPayload.spreadsheetId) setSpreadsheetId(configPayload.spreadsheetId);
        if (configPayload.appsScriptUrl !== undefined) setAppsScriptUrl(configPayload.appsScriptUrl);
        if (configPayload.companyInfo) setCompanyInfo(prev => ({ ...prev, ...configPayload.companyInfo }));
        
        // Refetch products to trigger alignment with spreadsheet if changed
        if (configPayload.spreadsheetId || configPayload.appsScriptUrl) {
          fetchProducts(true);
        }
      }
    } catch (err) {
      console.error("Config update error:", err);
    }
  };

  // Callback action: create overrides (like images uploaded or fields modified)
  const handleUpdateProductOverride = async (productId: string, field: string, value: any) => {
    try {
      const res = await fetch("/api/products/override", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, field, value })
      });
      if (res.ok) {
        setProducts(prev => prev.map(p => p.id === productId ? { ...p, [field]: value } : p));
      }
    } catch (err) {
      console.error("Override update error:", err);
    }
  };

  // Cart operations helpers
  const handleAddToCart = (product: Product) => {
    setCart(prev => {
      const exists = prev.find(item => item.id === product.id);
      if (exists) {
        if (exists.cantidad >= product.stock) {
          alert(`Disculpa, solo quedan ${product.stock} prendas disponibles con este código.`);
          return prev;
        }
        return prev.map(item => item.id === product.id ? { ...item, cantidad: item.cantidad + 1 } : item);
      }
      return [...prev, { ...product, cantidad: 1 }];
    });

    // Item is added dynamically to the cart in the background according to click counts
  };

  const handleUpdateCartQuantity = (id: string, amount: number) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.id === id) {
          const newQty = Math.max(1, item.cantidad + amount);
          return { ...item, cantidad: newQty };
        }
        return item;
      });
    });
  };

  const handleRemoveCartItem = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const handleClearCart = () => {
    setCart([]);
  };

  // After order is done, fetch fresh orders log for admin
  const handleOrderSuccess = (newOrder: Order) => {
    setOrders(prev => [newOrder, ...prev]);
    // Also deduct stock locally for responsive client catalogue mapping
    newOrder.items.forEach(it => {
      setProducts(prev => prev.map(p => p.id === it.id ? { ...p, stock: Math.max(0, p.stock - it.cantidad) } : p));
    });
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 relative">
      
      {/* Upper Navigation Rail Utility */}
      <header className="bg-slate-900 border-b border-slate-800 py-2.5 px-3 sm:py-3.5 sm:px-6 lg:px-8 shadow-md relative z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center cursor-pointer shrink-0" onClick={() => setView("shop")}>
            <img 
              src="https://cdn.postimage.me/2026/06/11/Nuevo-Logo-Ecomoda-2.png" 
              alt="Ecomoda" 
              className="h-8 sm:h-10 w-auto object-contain filter brightness-110"
              referrerPolicy="no-referrer"
            />
          </div>

          <div className="flex items-center gap-1.5 sm:gap-4 shrink-0">
            {/* View selectors */}
            <button
              onClick={() => setView("shop")}
              className={`text-[11px] sm:text-xs font-bold px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-lg sm:rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                view === "shop" 
                  ? "bg-slate-800 text-emerald-300 shadow-3xs" 
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <span className="sm:hidden">Catálogo</span>
              <span className="hidden sm:inline">Tienda / Catálogo</span>
            </button>
            <button
              onClick={() => setView("admin")}
              className={`text-[11px] sm:text-xs font-bold px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-lg sm:rounded-xl transition-all cursor-pointer flex items-center gap-1 sm:gap-1.5 whitespace-nowrap ${
                view === "admin" 
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-900/10" 
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Lock className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
              <span className="sm:hidden">Admin</span>
              <span className="hidden sm:inline">Acceso Admin</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container Work Area */}
      <div className="flex-1 flex flex-col relative">
        {loading && view === "shop" ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-slate-500 min-h-[500px]">
            <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin mb-3" />
            <p className="text-xs font-bold">Cargando inventario de prendas...</p>
            <p className="text-[10px] mt-1 text-slate-400">Sincronizando con base de datos de fardos.</p>
          </div>
        ) : (
          <>
            {view === "shop" ? (
              <ClientShop
                products={products}
                companyInfo={companyInfo}
                onAddToCart={handleAddToCart}
                onOpenCart={() => setIsCartOpen(true)}
                cartCount={cart.reduce((sum, item) => sum + item.cantidad, 0)}
                reviews={reviews}
                onSubmitReview={handleSubmitReview}
                orders={orders}
              />
            ) : (
              <AdminDashboard
                products={products}
                orders={orders}
                companyInfo={companyInfo}
                spreadsheetId={spreadsheetId}
                appsScriptUrl={appsScriptUrl}
                onRefreshData={handleRefreshData}
                onUpdateOrderStatus={handleUpdateOrderStatus}
                onUpdateConfig={handleUpdateConfig}
                onUpdateProductOverride={handleUpdateProductOverride}
              />
            )}
          </>
        )}
      </div>

      {/* Dynamic Slide Drawer Cart */}
      <Cart
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cartItems={cart}
        companyInfo={companyInfo}
        onUpdateQuantity={handleUpdateCartQuantity}
        onRemoveItem={handleRemoveCartItem}
        onClearCart={handleClearCart}
        onOrderSuccess={handleOrderSuccess}
      />

      {/* Footer layout */}
      {view === "shop" && (
        <footer className="bg-slate-900 border-t border-slate-850 py-4 px-4 text-center text-slate-400 text-xs">
          <div className="max-w-5xl mx-auto space-y-1.5">
            <p className="font-bold text-white uppercase text-[10px] tracking-wider">
              {companyInfo.name} — Tegucigalpa, Honduras
            </p>
            <p className="text-slate-550 max-w-md mx-auto text-[10px] leading-relaxed">
              Seguimiento detalle a detalle de tu solicitud
            </p>
            <div className="pt-2 border-t border-slate-800/80 flex flex-wrap justify-center gap-3 text-[10px]">
              <button onClick={() => setView("shop")} className="hover:text-emerald-400 transition-colors">Ver Catálogo</button>
              <span className="text-slate-700">•</span>
              <button onClick={() => setView("admin")} className="hover:text-emerald-400 transition-colors flex items-center gap-1">
                <Lock className="w-2.5 h-2.5" />
                Acceso Administrativo
              </button>
            </div>
            <p className="text-slate-700 text-[9px] pt-1 leading-tight">
              &copy; {new Date().getFullYear()} Ecomoda. Todos los derechos reservados.
            </p>
          </div>
        </footer>
      )}
    </div>
  );
}
