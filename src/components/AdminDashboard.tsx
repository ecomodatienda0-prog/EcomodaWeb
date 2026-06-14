import React, { useState, useEffect } from "react";
import { 
  Building, 
  Database, 
  FileText, 
  Lock, 
  RefreshCw, 
  ShoppingBag, 
  SlidersHorizontal, 
  Upload, 
  X, 
  Menu,
  CheckCircle,
  AlertTriangle,
  Send,
  Phone,
  Settings,
  ShieldCheck,
  TrendingUp,
  Coins,
  Inbox,
  Sparkles,
  Search,
  Users,
  Star,
  Plus,
  Trash2,
  Edit
} from "lucide-react";
import { Product, Order, CompanyInfo, User, Customer, Review } from "../types";

interface AdminDashboardProps {
  products: Product[];
  orders: Order[];
  companyInfo: CompanyInfo;
  spreadsheetId: string;
  appsScriptUrl: string;
  onRefreshData: () => Promise<void>;
  onUpdateOrderStatus: (orderId: string, status?: Order["status"], usuarioVendedor?: string) => Promise<void>;
  onUpdateConfig: (config: { spreadsheetId?: string; appsScriptUrl?: string; companyInfo?: Partial<CompanyInfo> }) => Promise<void>;
  onUpdateProductOverride: (productId: string, field: string, value: any) => Promise<void>;
}

export default function AdminDashboard({
  products,
  orders,
  companyInfo,
  spreadsheetId,
  appsScriptUrl,
  onRefreshData,
  onUpdateOrderStatus,
  onUpdateConfig,
  onUpdateProductOverride
}: AdminDashboardProps) {
  // Login credentials state
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  
  // Dynamic user lists synced from Sheets
  const [syncedUsers, setSyncedUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [syncedCustomers, setSyncedCustomers] = useState<Customer[]>([]);
  const [syncedReviews, setSyncedReviews] = useState<Review[]>([]);

  // Safe Confirm & Alert states for iframe/sandboxed environments
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
  } | null>(null);

  const [feedbackAlert, setFeedbackAlert] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
  } | null>(null);

  // Custom alert & confirm functions to replace window blocking popups
  const confirm = (message: string): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmDialog({
        isOpen: true,
        title: "Confirmar Acción",
        message,
        onConfirm: () => {
          setConfirmDialog(null);
          resolve(true);
        },
        onCancel: () => {
          setConfirmDialog(null);
          resolve(false);
        }
      });
    });
  };

  const alert = (message: string) => {
    setFeedbackAlert({
      isOpen: true,
      title: "Consola de Mensajes",
      message
    });
  };

  // Nav tab state
  const [activeTab, setActiveTab] = useState<"summary" | "orders" | "inventory" | "settings" | "users" | "customers" | "reviews">("summary");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Admin Actions loading states
  const [syncing, setSyncing] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [uploadingProductId, setUploadingProductId] = useState<string | null>(null);

  // Connection tester state
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string; sheets?: string[] } | null>(null);

  // Form states matching props
  const [editedSheetId, setEditedSheetId] = useState(spreadsheetId);
  const [editedAppsScriptUrl, setEditedAppsScriptUrl] = useState(appsScriptUrl);
  const [editedName, setEditedName] = useState(companyInfo.name);
  const [editedPhone, setEditedPhone] = useState(companyInfo.phone);
  const [editedAddress, setEditedAddress] = useState(companyInfo.address);
  const [editedHours, setEditedHours] = useState(companyInfo.hours);
  const [editedBank, setEditedBank] = useState(companyInfo.bankDetails);
  const [editedDiscount, setEditedDiscount] = useState(companyInfo.cashDiscountPercent);

  // Search/Filters inside tabs
  const [orderQuery, setOrderQuery] = useState("");
  const [inventoryQuery, setInventoryQuery] = useState("");
  const [customerQuery, setCustomerQuery] = useState("");
  const [reviewQuery, setReviewQuery] = useState("");
  const [selectedProductForUploader, setSelectedProductForUploader] = useState<Product | null>(null);

  // Synchronize component form values with incoming props
  useEffect(() => {
    setEditedSheetId(spreadsheetId);
  }, [spreadsheetId]);

  useEffect(() => {
    setEditedAppsScriptUrl(appsScriptUrl);
  }, [appsScriptUrl]);

  useEffect(() => {
    setEditedName(companyInfo.name);
    setEditedPhone(companyInfo.phone);
    setEditedAddress(companyInfo.address);
    setEditedHours(companyInfo.hours);
    setEditedBank(companyInfo.bankDetails);
    setEditedDiscount(companyInfo.cashDiscountPercent);
  }, [companyInfo]);

  // Google Sheets token integration
  const [googleTokenActive, setGoogleTokenActive] = useState(false);
  const [tokenInput, setTokenInput] = useState("");
  const [savingToken, setSavingToken] = useState(false);

  const fetchTokenStatus = async () => {
    try {
      const res = await fetch("/api/config");
      const data = await res.json();
      if (data.googleTokenActive !== undefined) {
        setGoogleTokenActive(data.googleTokenActive);
      }
    } catch (e) {
      console.error("Error fetching token status:", e);
    }
  };

  useEffect(() => {
    if (activeTab === "settings") {
      fetchTokenStatus();
    }
  }, [activeTab]);

  const handleSaveToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim()) return;
    setSavingToken(true);
    try {
      const res = await fetch("/api/config/google-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: tokenInput.trim() })
      });
      if (res.ok) {
        alert("🔑 Token de acceso de Google guardado correctamente. Ahora tus llamadas se integrarán de forma bidireccional.");
        setTokenInput("");
        fetchTokenStatus();
        onRefreshData(); // Trigger synchronizer immediately
      } else {
        alert("Error al guardar el token de acceso.");
      }
    } catch (err: any) {
      alert(`Error al guardar: ${err.message || err}`);
    } finally {
      setSavingToken(false);
    }
  };

  const handleRevokeToken = async () => {
    if (!await confirm("¿Estás seguro de que deseas revocar la conexión de Google API? Volverá al modo de lectura pública CSV.")) return;
    try {
      const res = await fetch("/api/config/google-token/revoke", { method: "POST" });
      if (res.ok) {
        alert("Conexión de Google API revocada.");
        fetchTokenStatus();
      }
    } catch (e: any) {
      alert(`Error: ${e.message || e}`);
    }
  };

  // Fetch users list
  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/users");
      const data = await res.json();
      if (data.users) {
        setSyncedUsers(data.users);
      }
    } catch (e) {
      console.error("Error loading users list:", e);
    }
  };

  // Fetch synced customer profiles
  const fetchCustomers = async () => {
    try {
      const res = await fetch("/api/customers");
      const data = await res.json();
      if (data.customers) {
        setSyncedCustomers(data.customers);
      }
    } catch (e) {
      console.error("Error loading customers list:", e);
    }
  };

  // Fetch reviews
  const fetchReviews = async () => {
    try {
      const res = await fetch("/api/reviews");
      const data = await res.json();
      if (data.reviews) {
        setSyncedReviews(data.reviews);
      }
    } catch (e) {
      console.error("Error loading reviews list:", e);
    }
  };

  // ==========================================
  // UNIFIED ADMIN CRUD HANDLERS
  // ==========================================
  const [activeModal, setActiveModal] = useState<"product" | "user" | "customer" | "review" | "order" | null>(null);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [formData, setFormData] = useState<any>({});
  const [formSubmitting, setFormSubmitting] = useState(false);

  const openAddModal = (type: "product" | "user" | "customer" | "review" | "order") => {
    setModalMode("add");
    setActiveModal(type);
    if (type === "product") {
      setFormData({
        id: "",
        nombre: "",
        precioEfectivo: 0,
        stock: 5,
        precioNormal: 0,
        codigoSimple: "",
        descuento: 0,
        fechaHasta: "",
        cantPiezas: 0,
        imagen: "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=500&q=80",
        categoria: "Fardos",
        visible: true
      });
    } else if (type === "user") {
      setFormData({
        idUsuario: "",
        nombre: "",
        prefijoPais: "+504",
        contacto: "",
        correo: "",
        password: "",
        foto: "",
        rol: "Vendedor",
        estadoPerfil: "Activo"
      });
    } else if (type === "customer") {
      setFormData({
        id: "CLI-" + Math.floor(1000 + Math.random() * 9000),
        nombre: "",
        prefijoPais: "+504",
        contacto: "",
        correo: "",
        municipio: "",
        direccionExacta: ""
      });
    } else if (type === "review") {
      setFormData({
        id: "REV-" + Math.floor(1000 + Math.random() * 9000),
        nombre: "",
        calificacion: 5,
        comentario: "",
        producto: "General",
        fecha: new Date().toISOString()
      });
    } else if (type === "order") {
      setFormData({
        id: "ORD-" + Math.floor(1000 + Math.random() * 9000),
        clienteNombre: "",
        clienteTelefono: "",
        clienteDireccion: "",
        municipio: "",
        clienteNotas: "",
        status: "Pendiente",
        paymentMethod: "Efectivo",
        fecha: Date.now(),
        items: [],
        totalNormal: 0,
        totalEfectivo: 0,
        totalDescuento: 0,
        usuarioVendedor: currentUser?.nombre || ""
      });
    }
  };

  const openEditModal = (type: "product" | "user" | "customer" | "review" | "order", item: any) => {
    setModalMode("edit");
    setActiveModal(type);
    setFormData({ ...item });
  };

  const handleModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitting(true);
    
    let url = "";
    let method = "POST";
    
    if (activeModal === "product") {
      url = modalMode === "add" ? "/api/products" : `/api/products/${formData.id}`;
      method = modalMode === "add" ? "POST" : "PUT";
    } else if (activeModal === "user") {
      url = modalMode === "add" ? "/api/users" : `/api/users/${formData.idUsuario}`;
      method = modalMode === "add" ? "POST" : "PUT";
    } else if (activeModal === "customer") {
      url = modalMode === "add" ? "/api/customers" : `/api/customers/${formData.id}`;
      method = modalMode === "add" ? "POST" : "PUT";
    } else if (activeModal === "review") {
      url = modalMode === "add" ? "/api/reviews" : `/api/reviews/${formData.id}`;
      method = modalMode === "add" ? "POST" : "PUT";
    } else if (activeModal === "order") {
      url = modalMode === "add" ? "/api/admin/orders" : `/api/orders/${formData.id}`;
      method = modalMode === "add" ? "POST" : "PUT";
    }

    try {
      const res = await fetch(url, {
        method: method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Error al procesar la solicitud.");
      }
      
      if (data.syncError) {
        alert(`⚠️ ¡Cambios guardados localmente pero NO se sincronizaron con Google Sheets!\n\nDetalle del error: ${data.syncError}\n\n👉 SOLUCIÓN: Ve a la pestaña "Configuración" abajo en este panel, copia el código del script actualizado, pégalo en "Extensiones > Apps Script" de tu hoja de cálculo de Google, haz clic en el disquete para guardar y presiona "Implementar > Nueva implementación" para generar una nueva URL.`);
      } else {
        alert(`¡${activeModal === "product" ? "Prenda" : activeModal === "user" ? "Usuario" : activeModal === "customer" ? "Cliente" : activeModal === "review" ? "Reseña" : "Pedido"} guardado y sincronizado con éxito!`);
      }
      
      await onRefreshData();
      await fetchUsers();
      await fetchCustomers();
      await fetchReviews();
      
      setActiveModal(null);
    } catch (err: any) {
      alert(`Error: ${err.message || err}`);
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDeleteItem = async (type: "product" | "user" | "customer" | "review" | "order", id: string) => {
    if (!await confirm(`¿Está seguro de que desea eliminar este ${type === "product" ? "producto" : type === "user" ? "usuario" : type === "customer" ? "cliente" : type === "review" ? "comentario" : "pedido"}? Esta acción se sincronizará inmediatamente en Google Sheets.`)) {
      return;
    }
    
    let url = "";
    if (type === "product") url = `/api/products/${id}`;
    else if (type === "user") url = `/api/users/${id}`;
    else if (type === "customer") url = `/api/customers/${id}`;
    else if (type === "review") url = `/api/reviews/${id}`;
    else if (type === "order") url = `/api/orders/${id}`;

    try {
      const res = await fetch(url, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Error al eliminar");
      }
      if (data.syncError) {
        alert(`⚠️ ¡Eliminado en la base de datos local pero NO se pudo actualizar en Google Sheets!\n\nDetalle: ${data.syncError}\n\n👉 SOLUCIÓN: Copia y actualiza tu Google Apps Script con la nueva versión provista en la sección de Configuración.`);
      } else {
        alert("¡Eliminado exitosamente de la base de datos y Google Sheets!");
      }
      await onRefreshData();
      await fetchUsers();
      await fetchCustomers();
      await fetchReviews();
    } catch (err: any) {
      alert(`Error: ${err.message || err}`);
    }
  };

  useEffect(() => {
    if (isAuthorized) {
      fetchUsers();
      fetchCustomers();
      fetchReviews();
    }
  }, [isAuthorized]);

  // Auth verifier
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setIsAuthorized(true);
        setCurrentUser(data.user);
        setLoginError("");
      } else {
        setLoginError(data.error || "Usuario o contraseña incorrectos.");
      }
    } catch (err: any) {
      setLoginError(`Error en el servidor: ${err.message || err}`);
    }
  };

  // Sync Sheets handler
  const handleSyncClick = async () => {
    setSyncing(true);
    try {
      await onRefreshData();
      await fetchUsers();
      await fetchCustomers();
      await fetchReviews();
      alert("¡Todos los fardos, ventas, clientes y reseñas han sido sincronizados exitosamente con Google Sheets!");
    } catch (e: any) {
      alert(`Error al sincronizar: ${e.message || e}`);
    } finally {
      setSyncing(false);
    }
  };

  // Settings Save handler
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingConfig(true);
    try {
      await onUpdateConfig({
        spreadsheetId: editedSheetId,
        appsScriptUrl: editedAppsScriptUrl,
        companyInfo: {
          name: editedName,
          phone: editedPhone,
          address: editedAddress,
          hours: editedHours,
          bankDetails: editedBank,
          cashDiscountPercent: editedDiscount
        }
      });
      alert("Configuración de tienda guardada exitosamente y sincronización bidireccional activada.");
    } catch (e: any) {
      alert(`Error al guardar: ${e.message || e}`);
    } finally {
      setSavingConfig(false);
    }
  };

  const handleTestConnection = async () => {
    if (!editedSheetId) {
      alert("Por favor escribe el ID del Google Spreadsheet primero.");
      return;
    }
    if (!editedAppsScriptUrl) {
      alert("Por favor escribe la URL de Apps Script primero.");
      return;
    }
    setTestingConnection(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/config/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          spreadsheetId: editedSheetId,
          appsScriptUrl: editedAppsScriptUrl
        })
      });
      const data = await res.json();
      setTestResult(data);
    } catch (e: any) {
      setTestResult({ success: false, error: e.message || String(e) });
    } finally {
      setTestingConnection(false);
    }
  };

  // Multi-format Image File Uploader (Converting to server static uploads via base64 backend)
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, product: Product) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingProductId(product.id);
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      try {
        const response = await fetch("/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: file.name,
            base64: base64String
          })
        });

        if (!response.ok) {
          throw new Error("No se pudo subir la foto.");
        }

        const data = await response.json();
        if (data.success && data.imageUrl) {
          // Apply override to product
          await onUpdateProductOverride(product.id, "imagen", data.imageUrl);
          alert("¡Imagen cargada y asociada correctamente!");
          setSelectedProductForUploader(null);
        }
      } catch (err: any) {
        console.error(err);
        alert(`Error al subir imagen: ${err.message || err}`);
      } finally {
        setUploadingProductId(null);
      }
    };
  };

  // Summary Metrics calculations
  const totalSalesNormal = orders
    .filter(o => o.status !== "Cancelado")
    .reduce((sum, o) => sum + o.totalNormal, 0);

  const totalSalesNet = orders
    .filter(o => o.status !== "Cancelado")
    .reduce((sum, o) => {
      const isDiscounted = o.paymentMethod !== "Tarjeta";
      return sum + (isDiscounted ? o.totalEfectivo : o.totalNormal);
    }, 0);

  const pendingOrders = orders.filter(o => o.status === "Pendiente");
  const confirmedOrders = orders.filter(o => o.status === "Confirmado" || o.status === "Enviado" || o.status === "Completado");
  const totalSavingsApplied = orders
    .filter(o => o.status !== "Cancelado" && o.paymentMethod !== "Tarjeta")
    .reduce((sum, o) => sum + o.totalDescuento, 0);

  const stats = [
    { title: "Ventas Netas Totales", value: `L. ${totalSalesNet.toLocaleString()}`, description: `Monto sumado de pedidos válidos`, icon: Coins, color: "text-emerald-600 bg-emerald-50" },
    { title: "Pedidos Registrados", value: orders.length, description: `${pendingOrders.length} pendientes de confirmar`, icon: ShoppingBag, color: "text-blue-600 bg-blue-50" },
    { title: "Descuento Promocionado", value: `L. ${totalSavingsApplied.toLocaleString()}`, description: `Ahorros aplicados en efectivo`, icon: TrendingUp, color: "text-amber-600 bg-amber-50" },
    { title: "Artículos en Catálogo", value: products.length, description: `${products.filter(p => !p.visible).length} ocultos de la venta`, icon: Database, color: "text-teal-600 bg-teal-50" }
  ];

  // Filters within active views
  const filteredOrders = orders.filter(o => {
    return o.clienteNombre.toLowerCase().includes(orderQuery.toLowerCase()) ||
           o.id.toLowerCase().includes(orderQuery.toLowerCase()) ||
           o.clienteTelefono.includes(orderQuery);
  });

  const filteredProducts = products.filter(p => {
    return p.nombre.toLowerCase().includes(inventoryQuery.toLowerCase()) ||
           p.id.toLowerCase().includes(inventoryQuery.toLowerCase()) ||
           p.categoria.toLowerCase().includes(inventoryQuery.toLowerCase());
  });

  // Secure Panel render if unauthorized
  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-slate-800 rounded-3xl overflow-hidden border border-slate-750 shadow-2xl relative">
          <div className="bg-gradient-to-r from-teal-800 to-emerald-700 p-8 text-center text-white">
            <div className="size-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/10">
              <Lock className="w-6 h-6 text-emerald-300" />
            </div>
            <h1 className="text-2xl font-black">Consola Administrativa</h1>
            <p className="text-xs text-emerald-100 mt-1">Ecomoda Store Management System</p>
          </div>

          <form onSubmit={handleLoginSubmit} className="p-8 space-y-5">
            {loginError && (
              <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs px-4 py-2.5 rounded-xl flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Email del Administrador</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Escribir Correo"
                className="w-full bg-slate-850 border border-slate-700 text-white rounded-xl py-3 px-4 text-sm focus:outline-hidden focus:border-emerald-500 transition-all focus:bg-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Contraseña</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-slate-850 border border-slate-700 text-white rounded-xl py-3 px-4 text-sm focus:outline-hidden focus:border-emerald-500 transition-all focus:bg-slate-800"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-extrabold text-sm py-3.5 rounded-xl shadow-lg shadow-emerald-900/20 transition-all cursor-pointer mt-2"
            >
              Ingresar al Sistema
            </button>
            <p className="text-center text-[10px] text-slate-500">
              * Acceso restringido exclusivamente a gerentes autorizados.
            </p>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col md:flex-row">
      
      {/* Admin Sidebar Navigation */}
      <div className="w-full md:w-64 bg-slate-900 text-white shrink-0 shadow-xl flex flex-col justify-between">
        <div>
          {/* Logo Brand Header */}
          <div className="p-4 sm:p-6 bg-slate-950 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="size-10 bg-emerald-600 text-white flex items-center justify-center rounded-xl font-black text-xl">
                E
              </div>
              <div>
                <h1 className="font-extrabold text-sm tracking-tight leading-tight">Ecomoda Admin</h1>
                <p className="text-[10px] font-semibold text-emerald-400 flex items-center gap-0.5">
                  <ShieldCheck className="w-3 h-3" />
                  Panel de Control
                </p>
              </div>
            </div>
            {/* Mobile Menu Toggle Button */}
            <button 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              title="Alternar Menú"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

          {/* Nav menu */}
          <nav className={`p-4 space-y-1.5 ${isMobileMenuOpen ? "block" : "hidden md:block"}`}>
            <button
              onClick={() => {
                setActiveTab("summary");
                setIsMobileMenuOpen(false);
              }}
              className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold text-left transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === "summary" ? "bg-emerald-600 text-white" : "hover:bg-slate-800 text-slate-400"
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              Resumen General
            </button>
            <button
              onClick={() => {
                setActiveTab("orders");
                setIsMobileMenuOpen(false);
              }}
              className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold text-left transition-all flex items-center gap-2 cursor-pointer relative ${
                activeTab === "orders" ? "bg-emerald-600 text-white" : "hover:bg-slate-800 text-slate-400"
              }`}
            >
              <ShoppingBag className="w-4 h-4" />
              Pedidos / Ventas
              {pendingOrders.length > 0 && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white">
                  {pendingOrders.length}
                </span>
              )}
            </button>
            <button
              onClick={() => {
                setActiveTab("inventory");
                setIsMobileMenuOpen(false);
              }}
              className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold text-left transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === "inventory" ? "bg-emerald-600 text-white" : "hover:bg-slate-800 text-slate-400"
              }`}
            >
              <Database className="w-4 h-4" />
              Sincronizar Inventario
            </button>
            <button
              onClick={() => {
                setActiveTab("settings");
                setIsMobileMenuOpen(false);
              }}
              className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold text-left transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === "settings" ? "bg-emerald-600 text-white" : "hover:bg-slate-800 text-slate-400"
              }`}
            >
              <Settings className="w-4 h-4" />
              Configurar Tienda
            </button>
            <button
              onClick={() => {
                setActiveTab("users");
                setIsMobileMenuOpen(false);
              }}
              className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold text-left transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === "users" ? "bg-emerald-600 text-white" : "hover:bg-slate-800 text-slate-400"
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              Acceso Usuarios ({syncedUsers.length})
            </button>
            <button
              onClick={() => {
                setActiveTab("customers");
                setIsMobileMenuOpen(false);
              }}
              className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold text-left transition-all flex items-center gap-2 cursor-pointer relative ${
                activeTab === "customers" ? "bg-emerald-600 text-white" : "hover:bg-slate-800 text-slate-400"
              }`}
            >
              <Users className="w-4 h-4" />
              Base Clientes ({syncedCustomers.length})
            </button>
            <button
              onClick={() => {
                setActiveTab("reviews");
                setIsMobileMenuOpen(false);
              }}
              className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold text-left transition-all flex items-center gap-2 cursor-pointer relative ${
                activeTab === "reviews" ? "bg-emerald-600 text-white" : "hover:bg-slate-800 text-slate-400"
              }`}
            >
              <Star className="w-4 h-4" />
              Reseñas Tienda ({syncedReviews.length})
            </button>
          </nav>
        </div>

        {/* Sync Status Button inside sidebar */}
        <div className={`p-4 border-t border-slate-800 bg-slate-950/40 text-center space-y-3 ${isMobileMenuOpen ? "block" : "hidden md:block"}`}>
          {currentUser && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-left flex items-center gap-2.5">
              {currentUser.foto ? (
                <img referrerPolicy="no-referrer" src={currentUser.foto} alt="Avatar" className="w-7 h-7 rounded-full object-cover shrink-0 border border-slate-700" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center shrink-0 uppercase">
                  {currentUser.nombre.charAt(0)}
                </div>
              )}
              <div className="truncate">
                <p className="text-[11px] font-extrabold text-white truncate leading-tight">{currentUser.nombre}</p>
                <p className="text-[9px] text-slate-400 truncate mt-0.5">{currentUser.correo}</p>
              </div>
            </div>
          )}
          
          <button
            disabled={syncing}
            onClick={() => {
              handleSyncClick();
              setIsMobileMenuOpen(false);
            }}
            className="w-full py-2 px-3 bg-emerald-650 hover:bg-emerald-500 disabled:opacity-50 text-white text-[11px] font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer bg-emerald-600"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Sincronizando..." : "Sincronizar Sheets"}
          </button>
          <p className="text-[9px] text-slate-500 mt-2 font-mono">
            ID: ...{spreadsheetId?.substring(0, 8)}...
          </p>
        </div>
      </div>

      {/* Main Content Workspace viewport */}
      <main className="flex-1 p-6 sm:p-8 lg:p-10 overflow-y-auto max-w-7xl">
        
        {/* VIEW 1: Summary Dashboard stats */}
        {activeTab === "summary" && (
          <div className="space-y-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-2xl font-black text-slate-900">Resumen del Negocio</h2>
                <p className="text-xs text-slate-500 mt-1">Métricas actuales y acumulados en tiempo real.</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSyncClick}
                  className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-3xs cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Sincronizar Catalogos
                </button>
              </div>
            </div>

            {/* Metric Bento Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {stats.map((st, i) => (
                <div key={i} className="bg-white rounded-2xl p-5 border border-slate-100 shadow-3xs flex items-center gap-4">
                  <div className={`p-3 rounded-xl ${st.color} shrink-0`}>
                    <st.icon className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="block text-[11px] uppercase tracking-wider font-bold text-slate-400">{st.title}</span>
                    <strong className="block text-2xl font-black text-slate-900 mt-0.5">{st.value}</strong>
                    <span className="block text-[10px] text-slate-550 mt-1 leading-tight">{st.description}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Quick Pedidos list summary */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-xs p-6">
              <h3 className="font-bold text-slate-900 text-sm mb-4">Pedidos Pendientes de Confirmar ({pendingOrders.length})</h3>
              
              {pendingOrders.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <Inbox className="w-10 h-10 text-slate-350 mx-auto mb-2 font-light" />
                  <p className="text-xs font-bold text-slate-500">No hay pedidos pendientes de aprobación</p>
                  <p className="text-[10px] mt-0.5">Sigue promocionando tu tienda e incrementando tus fardos.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-400 font-bold bg-slate-50">
                        <th className="py-3 px-4">COD PEDIDO</th>
                        <th className="py-3 px-4">FECHA</th>
                        <th className="py-3 px-4">CLIENTE</th>
                        <th className="py-3 px-4">PAGO</th>
                        <th className="py-3 px-4">TOTAL</th>
                        <th className="py-3 px-4 text-center">ACCIONES</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {pendingOrders.map((ord) => {
                        const netTotal = ord.paymentMethod === "Tarjeta" ? ord.totalNormal : ord.totalEfectivo;
                        return (
                          <tr key={ord.id} className="hover:bg-slate-50/50">
                            <td className="py-3.5 px-4 font-bold text-emerald-700">{ord.id}</td>
                            <td className="py-3.5 px-4 text-slate-500 font-mono">{new Date(ord.fecha).toLocaleDateString()}</td>
                            <td className="py-3.5 px-4 font-semibold text-slate-800">{ord.clienteNombre}</td>
                            <td className="py-3.5 px-4">
                              <span className={`px-2 py-0.5 rounded-md font-bold text-[9px] uppercase ${
                                ord.paymentMethod === "Tarjeta" ? "bg-slate-250 text-slate-800 bg-slate-100" : "bg-emerald-50 text-emerald-800 border border-emerald-100"
                              }`}>
                                {ord.paymentMethod}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 font-bold text-slate-900">L. {netTotal.toLocaleString()}</td>
                            <td className="py-3.5 px-4 text-center">
                              <button
                                onClick={() => setActiveTab("orders")}
                                className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-[10px] font-bold hover:bg-slate-800 shadow-3xs cursor-pointer"
                              >
                                Administrar Pedido
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* VIEW 2: Complete Orders/Ventas Management logs */}
        {activeTab === "orders" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-2xl font-black text-slate-900">Pedidos & Ventas</h2>
                <p className="text-xs text-slate-500 mt-1">Monitorea y despacha las compras de clientes.</p>
              </div>
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 text-slate-400" />
                <input
                  type="text"
                  value={orderQuery}
                  onChange={(e) => setOrderQuery(e.target.value)}
                  placeholder="Buscar pedido o cliente..."
                  className="w-full bg-white border border-slate-200 focus:border-emerald-500 rounded-xl py-2 pl-9 pr-4 text-xs focus:outline-hidden transition-all shadow-3xs"
                />
              </div>
            </div>

            {filteredOrders.length === 0 ? (
              <div className="bg-white rounded-3xl py-12 text-center text-slate-400 max-w-sm mx-auto border border-slate-105">
                <Inbox className="w-12 h-12 text-slate-350 mx-auto mb-3" />
                <h4 className="font-bold text-slate-700 text-sm">Sin Ordenes Encontradas</h4>
                <p className="text-xs mt-1">No hay pedidos que coincidan con tu criterio.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredOrders.map((ord) => {
                  const netTotal = ord.paymentMethod === "Tarjeta" ? ord.totalNormal : ord.totalEfectivo;
                  
                  return (
                    <div
                      key={ord.id}
                      className="bg-white rounded-2xl border border-slate-150 p-5 sm:p-6 shadow-3xs flex flex-col lg:flex-row justify-between gap-6"
                    >
                      {/* Left Block: Client metadata & item detail summaries */}
                      <div className="space-y-3 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <strong className="text-base text-emerald-800 font-extrabold">{ord.id}</strong>
                          <span className="text-slate-400 font-mono text-[11px] font-bold">({new Date(ord.fecha).toLocaleString()})</span>
                          
                          {/* Payment status */}
                          <span className={`px-2 py-0.5 rounded-full text-[9px] uppercase font-bold border ${
                            ord.paymentMethod === "Tarjeta" 
                              ? "bg-slate-100 text-slate-700 border-slate-200" 
                              : "bg-emerald-50 text-emerald-800 border-emerald-100"
                          }`}>
                            Pago: {ord.paymentMethod === "Transferencia" ? "Transferencia" : ord.paymentMethod}
                          </span>
                        </div>

                        {/* Customer block */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                          <p className="text-slate-700">👤 <strong>Cliente:</strong> {ord.clienteNombre}</p>
                          <p className="text-indigo-900 font-semibold">📍 <strong>Dirección:</strong> {ord.clienteDireccion}</p>
                          
                          {/* Deliverer Phone Actionable */}
                          <p className="text-slate-600 flex items-center gap-1.5">
                            📞 <strong>Tel:</strong> 
                            <a 
                              href={`tel:${ord.clienteTelefono}`} 
                              className="text-emerald-700 hover:underline font-bold"
                            >
                              {ord.clienteTelefono}
                            </a>
                            <a 
                              href={`https://wa.me/${ord.clienteTelefono.replace(/[^0-9]/g, "")}`} 
                              target="_blank" 
                              rel="noreferrer"
                              className="bg-emerald-1100 bg-emerald-50 px-2 py-0.5 rounded-md text-emerald-600 font-bold hover:bg-emerald-100 text-[10px]"
                            >
                              WhatsApp
                            </a>
                          </p>
                          
                          {ord.clienteEmail && (
                            <p className="text-slate-600">✉️ <strong>Email:</strong> {ord.clienteEmail}</p>
                          )}
                        </div>

                        {ord.clienteNotas && (
                          <div className="bg-amber-50 border border-amber-200/50 p-2.5 rounded-xl text-amber-900 text-xs italic">
                            💬 <strong>Notas del pedido:</strong> "{ord.clienteNotas}"
                          </div>
                        )}

                        {/* Item items row list */}
                        <div className="pt-3 border-t border-slate-100">
                          <h4 className="font-extrabold text-slate-400 text-[10px] uppercase tracking-wider mb-2">Detalle de Prendas ({ord.items.length})</h4>
                          <div className="space-y-1.5">
                            {ord.items.map((it, idx) => (
                              <div key={idx} className="flex items-center gap-2 text-xs">
                                <span className="text-slate-400 font-bold">{it.cantidad}x</span>
                                <span className="font-semibold text-slate-800">{it.nombre}</span>
                                <span className="text-slate-400 text-[10px] font-mono">COD: {it.id}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Right Block: Totals computations and state update buttons */}
                      <div className="flex flex-col justify-between items-stretch lg:items-end w-full lg:w-64 border-t lg:border-t-0 lg:border-l border-slate-100 pt-3 lg:pt-0 lg:pl-6 shrink-0">
                        {/* Totals Section */}
                        <div className="flex flex-row lg:flex-col justify-between items-center lg:items-end w-full border-b lg:border-b-0 border-slate-100 pb-2.5 lg:pb-0">
                          <div className="text-left lg:text-right">
                            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide">Totales</span>
                            <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                              <span className="text-xs text-slate-400 line-through">L. {ord.totalNormal.toLocaleString()}</span>
                              {ord.paymentMethod !== "Tarjeta" && (
                                <span className="text-[10px] text-emerald-650 font-bold bg-emerald-50 px-1.5 py-0.2 rounded-md">Desct.</span>
                              )}
                            </div>
                          </div>
                          <strong className="block text-lg lg:text-xl font-extrabold text-slate-900 leading-none lg:mt-1.5">
                            L. {netTotal.toLocaleString()}
                          </strong>
                        </div>

                        {/* Interactive fields: Side-by-side on mobile, stacked on desktop */}
                        <div className="grid grid-cols-2 lg:grid-cols-1 gap-2.5 w-full mt-2 lg:mt-4">
                          {/* Estado del Pedido */}
                          <div className="space-y-1">
                            <label className="block text-left text-[9px] uppercase font-bold text-slate-400">Estado del Pedido</label>
                            <select
                              value={ord.status}
                              onChange={(e) => onUpdateOrderStatus(ord.id, e.target.value as Order["status"])}
                              className={`w-full py-1.5 px-2 bg-white border border-slate-200 rounded-lg text-xs font-bold focus:outline-hidden cursor-pointer ${
                                ord.status === "Pendiente" ? "bg-amber-100 text-amber-900" :
                                ord.status === "Confirmado" ? "bg-blue-105 bg-blue-100 text-blue-900" :
                                ord.status === "Enviado" ? "bg-cyan-100 text-cyan-900" :
                                ord.status === "Completado" ? "bg-emerald-100 text-emerald-900" :
                                "bg-rose-100 text-rose-900"
                              }`}
                            >
                              <option value="Pendiente">⚠️ Pendiente</option>
                              <option value="Confirmado">✅ Confirmado</option>
                              <option value="Enviado">🚚 Enviado</option>
                              <option value="Completado">🎉 Completado</option>
                              <option value="Cancelado">❌ Cancelado</option>
                            </select>
                          </div>

                          {/* Vendedor Asignado */}
                          <div className="space-y-1">
                            <label className="block text-left text-[9px] uppercase font-bold text-slate-400">Vendedor Asignado</label>
                            <select
                              value={ord.usuarioVendedor || ""}
                              onChange={(e) => onUpdateOrderStatus(ord.id, undefined, e.target.value)}
                              className="w-full py-1.5 px-2 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-hidden cursor-pointer bg-slate-50 text-slate-850"
                            >
                              <option value="">👤 No asignado</option>
                              {syncedUsers.map(u => (
                                <option key={u.idUsuario} value={u.nombre}>
                                  {u.nombre}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Extra delete action to completely manage order */}
                        <div className="w-full mt-2 lg:mt-3 pt-1 lg:pt-2 text-right">
                          <button
                            onClick={() => handleDeleteItem("order", ord.id)}
                            className="border border-rose-100 hover:bg-rose-50 text-rose-700 font-extrabold text-[9px] px-2.5 py-1 rounded-md flex items-center gap-1 cursor-pointer transition-colors ml-auto uppercase tracking-wide"
                          >
                            <Trash2 className="w-3 h-3 text-rose-600 animate-pulse" /> Borrar Orden
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* VIEW 3: Google Sheets Sync & Overrides Panel (Photos, visible state, overriding prices) */}
        {activeTab === "inventory" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-2xl font-black text-slate-900">Catálogo de Prendas</h2>
                <p className="text-xs text-slate-500 mt-1">Sincronizado en tiempo real con la hoja <strong className="text-emerald-700">"Productos en Linea"</strong> de su Google Sheet.</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSyncClick}
                  disabled={syncing}
                  className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-3xs cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
                  {syncing ? "Sincronizando..." : "Sincronizar Desde Google"}
                </button>
                <button
                  onClick={() => openAddModal("product")}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Agregar Prenda
                </button>
              </div>
            </div>

            {/* Config alert reminder */}
            <div className="bg-slate-900 text-teal-300 p-5 rounded-2xl text-xs border border-teal-500/20 leading-relaxed flex items-center justify-between gap-4">
              <div>
                <p className="font-bold text-white text-sm flex items-center gap-1.5 mb-1">
                  <Database className="w-4 h-4 text-emerald-400" />
                  Mapeo del Google Sheet
                </p>
                <p className="text-slate-350 max-w-xl">
                  Estamos usando el Spreadsheet con ID <span className="font-mono text-white bg-slate-800 px-1.5 py-0.5 rounded-md">{spreadsheetId}</span>. Cualquier cambio se escribe inmediatamente en Google Sheets sin necesidad de usar el botón "Sincronizar Sheets".
                </p>
              </div>
              <button 
                onClick={() => setActiveTab("settings")}
                className="shrink-0 bg-white/10 hover:bg-white/20 text-white font-bold py-2 px-3 rounded-xl transition-all cursor-pointer"
              >
                Cambiar ID
              </button>
            </div>

            {/* Inventory listing table and tools */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-xs p-5">
              <div className="flex justify-between items-center mb-4 gap-4">
                <h3 className="font-bold text-slate-900 text-sm">Prendas Cargadas ({products.length})</h3>
                <div className="relative w-64">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={inventoryQuery}
                    onChange={(e) => setInventoryQuery(e.target.value)}
                    placeholder="Filtrar por nombre, categoría..."
                    className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 rounded-xl py-1.5 pl-8 pr-3 text-xs focus:outline-hidden transition-all"
                  />
                </div>
              </div>

              {filteredProducts.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  No hay prendas disponibles que coincidan con la búsqueda.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-400 font-bold bg-slate-50 font-mono">
                        <th className="py-3 px-4">COD</th>
                        <th className="py-3 px-4">IMAGEN</th>
                        <th className="py-3 px-4">PRENDA</th>
                        <th className="py-3 px-4">STOCK</th>
                        <th className="py-3 px-4">PRECIOS (REG / CASH)</th>
                        <th className="py-3 px-4">VISIBILIDAD</th>
                        <th className="py-3 px-4 text-center">FOTO</th>
                        <th className="py-3 px-4 text-center">ACCIONES</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-150">
                      {filteredProducts.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50/40">
                          <td className="py-3 px-4 font-mono font-bold text-slate-450">{p.id}</td>
                          <td className="py-3 px-4">
                            <div className="size-11 rounded-md overflow-hidden bg-slate-105">
                              <img
                                src={p.imagen}
                                alt={p.nombre}
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.currentTarget as HTMLImageElement).src = "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=500&q=80";
                                }}
                              />
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div>
                              <strong className="block text-slate-800 font-semibold">{p.nombre}</strong>
                              <span className="block text-[10px] text-slate-400 uppercase tracking-wide font-bold">{p.categoria}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-slate-650 font-semibold font-mono">{p.stock} pzas.</td>
                          <td className="py-3 px-4">
                            <div>
                              <p className="text-slate-400 line-through">L. {p.precioNormal.toLocaleString()}</p>
                              <strong className="text-emerald-700 font-bold">L. {p.precioEfectivo.toLocaleString()}</strong>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <button
                              onClick={() => onUpdateProductOverride(p.id, "visible", !p.visible)}
                              className={`px-2.5 py-1 rounded-md text-[9px] font-bold uppercase cursor-pointer ${
                                p.visible 
                                  ? "bg-emerald-50 text-emerald-800 border border-emerald-100" 
                                  : "bg-slate-100 text-slate-500 border border-slate-200"
                              }`}
                            >
                              {p.visible ? "Visible" : "Oculto"}
                            </button>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => setSelectedProductForUploader(p)}
                              className="px-2 bg-slate-900 text-white rounded-lg text-[10px] font-bold hover:bg-slate-800 shadow-3xs flex items-center gap-1 mx-auto cursor-pointer py-1"
                            >
                              <Upload className="w-3 h-3 text-emerald-400" />
                              Subir
                            </button>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex gap-1.5 justify-center">
                              <button
                                onClick={() => openEditModal("product", p)}
                                className="p-1 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-750 rounded-md text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                              >
                                <Edit className="w-3 h-3 text-indigo-600" /> Editar
                              </button>
                              <button
                                onClick={() => handleDeleteItem("product", p.id)}
                                className="p-1 px-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-md text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* VIEW 4: Core Store Settings & Metadata parameters */}
        {activeTab === "settings" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-black text-slate-900">Configuración de la Tienda</h2>
              <p className="text-xs text-slate-500 mt-1">Escribe las credenciales, cuentas bancarias e información del negocio.</p>
            </div>

            <form onSubmit={handleSaveSettings} className="bg-white rounded-3xl border border-slate-100 shadow-xs p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6 border-b border-slate-100">
                <div className="space-y-4">
                  <h3 className="font-black text-xs text-slate-900 uppercase tracking-widest text-slate-450 flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-emerald-600" />
                    Sincronización de Google Sheets
                  </h3>

                  <div>
                    <label className="block text-xs font-bold text-slate-705 text-slate-700 mb-1.5">ID del Google Spreadsheet (Base de datos) *</label>
                    <input
                      type="text"
                      required
                      value={editedSheetId}
                      onChange={(e) => setEditedSheetId(e.target.value)}
                      placeholder="p. ej: 1B_4I0Ruyb4D_c5o7gsk74J_1f3Peb5a_q9E07x9Bv68"
                      className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-xl py-2.5 px-3.5 text-xs font-mono focus:outline-hidden transition-all"
                    />
                    <span className="block text-[10px] text-slate-455 mt-1 leading-relaxed text-slate-400">
                      💡 Sincroniza productos, ventas, clientes y reseñas con la hoja de cálculo de Google.
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      URL de Aplicación Web de Google Apps Script (Recomendado)
                    </label>
                    <input
                      type="text"
                      value={editedAppsScriptUrl}
                      onChange={(e) => setEditedAppsScriptUrl(e.target.value)}
                      placeholder="https://script.google.com/macros/s/.../exec"
                      className="w-full bg-slate-50 border border-slate-200 focus:border-amber-400 focus:bg-white rounded-xl py-2.5 px-3.5 text-xs font-mono focus:outline-hidden transition-all text-amber-900 border-amber-100"
                    />
                    <span className="block text-[10px] text-slate-500 mt-1 pb-1">
                      Enlaza Google Apps Script para sincronización bidireccional instantánea <strong>sin caducidad de token</strong>.
                    </span>

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={handleTestConnection}
                        disabled={testingConnection}
                        className="py-1.5 px-3 bg-slate-900 border border-slate-800 text-teal-300 hover:text-white hover:bg-slate-850 disabled:bg-slate-100 disabled:text-slate-450 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shrink-0"
                      >
                        {testingConnection ? "Probando..." : "⚡ Probar Conexión"}
                      </button>
                      
                      {testResult && (
                        <div className={`text-[11px] px-2.5 py-1.5 rounded-xl border flex items-center gap-1.5 leading-tight ${
                          testResult.success 
                            ? "bg-emerald-50 text-emerald-800 border-emerald-200" 
                            : "bg-rose-50 text-rose-800 border-rose-200"
                        }`}>
                          <span className={`inline-block size-1.5 rounded-full ${testResult.success ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />
                          <span className="font-semibold">
                            {testResult.success 
                              ? `¡Conexión Exitosa! Encontradas ${testResult.sheets?.length || 0} hojas.` 
                              : `Error: ${testResult.error}`}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Explainer and Script Block */}
                    <div className="mt-2.5 p-3.5 bg-slate-50 border border-slate-150 rounded-xl space-y-2">
                      <p className="text-[10px] font-bold text-slate-800 flex items-center gap-1">
                        👉 <strong>¿Cómo obtener tu URL de Apps Script?</strong>
                      </p>
                      <ol className="text-[10px] text-slate-600 list-decimal pl-4 space-y-1">
                        <li>En tu Google Sheet, ve a <strong>Extensiones &gt; Apps Script</strong>.</li>
                        <li>Copia y pega el código que está abajo de esta lista en el editor de Apps Script.</li>
                        <li>Haz clic en <strong>Guardar</strong> (el icono de disquete) y pulsa <strong>Implementar &gt; Nueva implementación</strong>.</li>
                        <li>Elige tipo <strong>Aplicación web</strong>, ejecuta como "Tú" y cambia el acceso a <strong>"Cualquiera"</strong>.</li>
                        <li>Copia la <strong>URL de aplicación web</strong> resultante y pégala arrriba. ¡Eso es todo!</li>
                      </ol>

                      <div className="pt-2">
                        <label className="block text-[9px] font-black text-slate-500 uppercase">Script para pegar en tu Google Sheet (Copia Todo):</label>
                        <textarea
                          readOnly
                          rows={6}
                          onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                          className="w-full bg-white border border-slate-200 text-slate-650 p-2 rounded-lg text-[9px] font-mono mt-1 focus:outline-hidden cursor-pointer"
                          value={`var SCHEMAS = {
  "Productos en Linea": ["Codigo_Fardo", "Producto", "Precio_Efectivo", "Existencia", "Precio_Normal", "Codigo_Simple", "Descuento", "Fecha_Hasta", "Cant_Piezas", "Foto_Fardo", "Categoria"],
  "Ventas": ["Id_Venta", "Fecha", "Prefijo", "Contacto", "Nombre_Cliente", "Municipio", "Direccion_Exacta", "Subtotal", "Descuento", "Pago_Efectivo", "Pago_Transferencia", "Pago_Tarjeta", "ISV", "Monto_Total", "Estado", "Notas_del_pedido", "Tipo_Pago", "Usuario_Vendedor"],
  "Ventas_Detalles": ["ID_Venta_Detalle", "Id_Venta", "Fecha", "Codigo_Fardo", "Producto", "Cantidad_Producto", "Precio_Normal", "Descuento", "Precio_Descuento", "Monto_Final"],
  "Datos_Empresa": ["Nombre", "Prefijo_Pais", "Contacto", "Departamento", "Municipio", "Direccion", "Coordenadas", "Logo_Img", "Horario"],
  "Resenias": ["ID_Resenia", "Fecha", "Nombre", "Calificacion", "Comentario", "Producto"],
  "Clientes": ["Id_Cliente", "Nombre", "Prefijo_Pais", "Contacto", "Correo", "Municipio", "Direccion_Exacta"],
  "Usuarios": ["ID_Usuario", "Nombre", "Prefijo_Pais", "Contacto", "Correo", "Password", "Foto", "Rol", "Estado_Perfil", "Ultimo_Acceso"]
};

function ensureSheetsStructure(ss) {
  for (var sheetName in SCHEMAS) {
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    }
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, SCHEMAS[sheetName].length).setValues([SCHEMAS[sheetName]]);
    }
  }
}

function doGet(e) {
  var action = e.parameter.action;
  var spreadsheetId = e.parameter.spreadsheetId;
  
  if (!spreadsheetId) {
    return ContentService.createTextOutput(JSON.stringify({ error: "Falta spreadsheetId" }))
                         .setMimeType(ContentService.MimeType.JSON);
  }
  
  try {
    var ss = SpreadsheetApp.openById(spreadsheetId);
    ensureSheetsStructure(ss);
    
    if (action === "readAll") {
      var result = {};
      var sheets = ss.getSheets();
      for (var i = 0; i < sheets.length; i++) {
         var sheet = sheets[i];
         var name = sheet.getName();
         var range = sheet.getDataRange();
         var values = range.getValues();
         result[name] = values;
      }
      return ContentService.createTextOutput(JSON.stringify(result))
                           .setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ error: "Accion no soportada en GET" }))
                         .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.toString() }))
                         .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    var params = JSON.parse(e.postData.contents);
    var action = params.action;
    var spreadsheetId = params.spreadsheetId;
    var sheetName = params.sheet;
    
    if (!spreadsheetId || !sheetName) {
      return ContentService.createTextOutput(JSON.stringify({ error: "Falta spreadsheetId o hoja" }))
                           .setMimeType(ContentService.MimeType.JSON);
    }
    
    var ss = SpreadsheetApp.openById(spreadsheetId);
    ensureSheetsStructure(ss);
    
    var sheet = ss.getSheetByName(sheetName);
    
    if (action === "writeAll") {
      var rowValues = params.values;
      sheet.clearContents();
      if (rowValues && rowValues.length > 0) {
        sheet.getRange(1, 1, rowValues.length, rowValues[0].length).setValues(rowValues);
      }
      return ContentService.createTextOutput(JSON.stringify({ success: true }))
                           .setMimeType(ContentService.MimeType.JSON);
    }
    
    if (action === "append") {
      var rowValues = params.values;
      sheet.appendRow(rowValues);
      return ContentService.createTextOutput(JSON.stringify({ success: true }))
                           .setMimeType(ContentService.MimeType.JSON);
    }
    
    if (action === "updateRow") {
      var keyColumnIndex = params.keyColumnIndex;
      var keyValue = params.keyValue;
      var targetColumnIndex = params.targetColumnIndex;
      var newValue = params.value;
      
      var range = sheet.getDataRange();
      var values = range.getValues();
      var foundRow = -1;
      
      for (var i = 1; i < values.length; i++) {
        if (String(values[i][keyColumnIndex]).trim() === String(keyValue).trim()) {
          foundRow = i + 1;
          break;
        }
      }
      
      if (foundRow !== -1) {
        sheet.getRange(foundRow, targetColumnIndex + 1).setValue(newValue);
        return ContentService.createTextOutput(JSON.stringify({ success: true }))
                             .setMimeType(ContentService.MimeType.JSON);
      } else {
        return ContentService.createTextOutput(JSON.stringify({ error: "Clave no encontrada" }))
                             .setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({ error: "Accion de escritura no soportada" }))
                         .setMimeType(ContentService.MimeType.JSON);
    
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.toString() }))
                         .setMimeType(ContentService.MimeType.JSON);
  }
}`}
                        />
                        <span className="block text-[8px] text-slate-400 mt-0.5">💡 Haz clic para seleccionar todo y luego cópialo (Ctrl+C / Cmd+C).</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Porcentaje de Descuento por Efectivo/Transferencia (%)</label>
                    <input
                      type="number"
                      required
                      min={0}
                      max={100}
                      value={editedDiscount}
                      onChange={(e) => setEditedDiscount(parseInt(e.target.value) || 0)}
                      className="w-24 bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-xl py-2 px-3 text-xs focus:outline-hidden transition-all font-mono font-bold text-slate-800"
                    />
                  </div>
                </div>

                {/* Company profile settings block */}
                <div className="space-y-4">
                  <h3 className="font-black text-sm text-slate-900 uppercase tracking-widest text-[11px] text-slate-450">Perfil de la Empresa (Datos del Cliente)</h3>
                  
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Nombre de la Tienda *</label>
                    <input
                      type="text"
                      required
                      value={editedName}
                      onChange={(e) => setEditedName(e.target.value)}
                      placeholder="Fardos Ecomoda"
                      className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-xl py-2.5 px-3.5 text-xs focus:outline-hidden transition-all font-bold text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">WhatsApp Oficial (Ej. +50499008822) *</label>
                    <input
                      type="text"
                      required
                      value={editedPhone}
                      onChange={(e) => setEditedPhone(e.target.value)}
                      placeholder="+504 9900-8822"
                      className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-xl py-2.5 px-3.5 text-xs focus:outline-hidden transition-all font-mono"
                    />
                    <span className="block text-[10px] text-slate-400 mt-1">Este número recibirá los pedidos itemizados de los clientes.</span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Dirección Oficial de Sucursal</label>
                    <input
                      type="text"
                      value={editedAddress}
                      onChange={(e) => setEditedAddress(e.target.value)}
                      placeholder="Bulevar Morazán, Tegucigalpa, Honduras"
                      className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-xl py-2.5 px-3.5 text-xs focus:outline-hidden transition-all text-slate-650"
                    />
                  </div>
                </div>
              </div>

              {/* Bank accounts and schedules block */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                <div className="space-y-4">
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Horarios de Atención Publicados</label>
                  <textarea
                    value={editedHours}
                    onChange={(e) => setEditedHours(e.target.value)}
                    rows={3}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-xl py-2 px-3.5 text-xs focus:outline-hidden transition-all text-slate-650"
                    placeholder="Lunes a Viernes: 8am - 6pm..."
                  />
                </div>

                <div className="space-y-4">
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Cuentas Bancarias para Transferencias Rectas</label>
                  <textarea
                    value={editedBank}
                    onChange={(e) => setEditedBank(e.target.value)}
                    rows={3}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-xl py-2 px-3.5 text-xs focus:outline-hidden transition-all font-mono text-slate-650 text-xs"
                    placeholder="Banco Sol - Cuenta: 192837192..."
                  />
                </div>
              </div>

              {/* Save checkout configuration footer */}
              <div className="flex justify-end pt-4 border-t border-slate-100">
                <button
                  type="submit"
                  disabled={savingConfig}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs py-3 px-6 rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                >
                  {savingConfig ? "Guardando..." : "Guardar Cambios"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* VIEW 5: Sincronización y Vista de Usuarios */}
        {activeTab === "users" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-2xl font-black text-slate-900">Usuarios Atendiendo y Accesos</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Administre el equipo de vendedores y autorizaciones. Sincronizado en tiempo real con la pestaña <strong className="text-emerald-700">"Usuarios"</strong> de Google Sheets.
                </p>
              </div>
              <button
                onClick={() => openAddModal("user")}
                className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Agregar Usuario
              </button>
            </div>

            <div className="bg-slate-50 border border-slate-150 rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-center gap-3">
              <p className="text-xs text-slate-650 leading-relaxed max-w-2xl">
                ⚠️ <strong>Criterio de Acceso Admin:</strong> Los usuarios aquí registrados con un estado de perfil <strong>"Activo"</strong> e ingresando su correo y contraseña correspondiente podrán acceder a este Panel de Control.
              </p>
              <div className="bg-emerald-100 text-emerald-950 px-3 py-1.5 rounded-xl text-[11px] font-black tracking-wide uppercase shrink-0">
                Total: {syncedUsers.length} Usuarios
              </div>
            </div>

            {/* List and Grid profile card display */}
            {syncedUsers.length === 0 ? (
              <div className="bg-white border border-slate-100 rounded-3xl p-12 text-center text-slate-500 space-y-3">
                <ShieldCheck className="w-12 h-12 text-slate-300 mx-auto" />
                <h4 className="font-bold text-slate-800 text-sm">Sin usuarios sincronizados aún</h4>
                <p className="text-xs text-slate-450 max-w-sm mx-auto">
                  Por favor, agregue algún usuario para comenzar.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {syncedUsers.map((u) => {
                  const isActive = u.estadoPerfil?.toLowerCase() === "activo";
                  return (
                    <div 
                      key={u.idUsuario} 
                      className={`bg-white border text-left p-5 rounded-3xl space-y-4 hover:shadow-md transition-all relative overflow-hidden flex flex-col justify-between ${
                        isActive ? "border-slate-150" : "border-rose-100 bg-rose-50/10"
                      }`}
                    >
                      <div>
                        {/* Top Ribbon Status */}
                        <div className="absolute top-4 right-4 flex items-center gap-1.5">
                          <span className={`inline-block size-2 rounded-full ${isActive ? "bg-emerald-500 animate-pulse" : "bg-rose-400"}`} />
                          <span className={`text-[9px] font-black uppercase tracking-wider ${isActive ? "text-emerald-700" : "text-rose-600"}`}>
                            {u.estadoPerfil || "Inactivo"}
                          </span>
                        </div>

                        {/* User Header Profile */}
                        <div className="flex items-center gap-3.5 pr-14">
                          {u.foto ? (
                            <img 
                              referrerPolicy="no-referrer" 
                              src={u.foto} 
                              alt={u.nombre} 
                              className="w-11 h-11 rounded-2xl object-cover border border-slate-200 shadow-sm shrink-0" 
                            />
                          ) : (
                            <div className="w-11 h-11 rounded-2xl bg-slate-900 text-emerald-400 flex items-center justify-center font-black text-sm shrink-0 uppercase">
                              {u.nombre.slice(0, 2)}
                            </div>
                          )}
                          <div className="truncate">
                            <h3 className="font-extrabold text-slate-900 text-sm leading-snug truncate">{u.nombre}</h3>
                            <span className="inline-block bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-0.5 mt-1 rounded-sm uppercase tracking-wide">
                              {u.rol || "Vendedor"}
                            </span>
                          </div>
                        </div>

                        {/* Main contact profile indexes */}
                        <div className="space-y-2 pt-3 border-t border-slate-100 text-xs text-left">
                          <div className="flex justify-between items-center">
                            <span className="text-slate-400 font-medium">ID Usuario / Ref:</span>
                            <span className="font-mono text-[10.5px] font-black text-slate-650 bg-slate-50 px-2 py-0.5 rounded-sm">{u.idUsuario}</span>
                          </div>

                          <div className="flex justify-between items-center">
                            <span className="text-slate-400 font-medium">WhatsApp / Tel:</span>
                            <span className="font-bold text-slate-800 flex items-center gap-1">
                              +{u.prefijoPais || "504"} {u.contacto || "N/A"}
                              {u.contacto && (
                                <a 
                                  href={`https://wa.me/${(u.prefijoPais || "504") + u.contacto.replace(/\s|-/g, "")}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-emerald-600 hover:text-emerald-500 ml-1"
                                  title="Contactar por WhatsApp"
                                >
                                  💬
                                </a>
                              )}
                            </span>
                          </div>

                          <div className="flex flex-col pt-1.5 space-y-1">
                            <span className="text-slate-400 font-medium">Correo Electrónico:</span>
                            <span className="font-mono text-[11px] font-bold text-slate-700 bg-slate-50/50 p-2 rounded-xl border border-slate-100 truncate">
                              {u.correo}
                            </span>
                          </div>

                          <div className="flex flex-col pt-1 space-y-1">
                            <span className="text-slate-400 font-medium">Contraseña Registrada:</span>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[11px] text-slate-605 tracking-wide font-semibold select-all bg-slate-50/55 px-2 py-1 rounded-md border border-slate-100">
                                {u.password || "••••••••"}
                              </span>
                            </div>
                          </div>

                          <div className="flex justify-between items-center pt-2 text-[10.5px] text-slate-500">
                            <span>Último ingreso:</span>
                            <span className="font-semibold text-slate-700 bg-emerald-50 text-emerald-950 px-2 py-0.5 rounded-md font-mono">
                              {u.ultimoAcceso || "Sin accesos registrados"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* CRUD Actions Block */}
                      <div className="flex gap-2 pt-3 border-t border-slate-100 justify-end mt-4">
                        <button
                          onClick={() => openEditModal("user", u)}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors border border-slate-150"
                        >
                          <Edit className="w-3.5 h-3.5 text-indigo-650" /> Editar
                        </button>
                        <button
                          onClick={() => handleDeleteItem("user", u.idUsuario)}
                          className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-bold cursor-pointer transition-colors border border-rose-100"
                          title="Eliminar usuario"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === "customers" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-2xl font-black text-slate-900">Base de Datos de Clientes</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Listado de clientes registrados. Sincronizado en tiempo real con la pestaña <strong className="text-emerald-700">"Clientes"</strong> en Google Sheets.
                </p>
              </div>
              <button
                onClick={() => openAddModal("customer")}
                className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Agregar Cliente
              </button>
            </div>

            {/* Customers Search and Counter */}
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar por nombre, contacto o correo..."
                  value={customerQuery}
                  onChange={(e) => setCustomerQuery(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl py-2 pl-9 pr-4 text-xs focus:outline-hidden focus:border-emerald-500 font-medium"
                />
              </div>
              <div className="bg-emerald-100 text-emerald-950 px-3 py-1.5 rounded-xl text-[11px] font-black tracking-wide uppercase">
                Total: {syncedCustomers.length} Clientes
              </div>
            </div>

            {/* Customers list/table */}
            {syncedCustomers.length === 0 ? (
              <div className="bg-white border border-slate-150 rounded-3xl p-12 text-center text-slate-500 space-y-3">
                <Users className="w-12 h-12 text-slate-300 mx-auto" />
                <h4 className="font-bold text-slate-800 text-sm">Sin clientes registrados en la base</h4>
                <p className="text-xs text-slate-450 max-w-sm mx-auto">
                  Agregue un cliente para comenzar.
                </p>
              </div>
            ) : (
              <div className="bg-white border border-slate-150 rounded-3xl overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-150 text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">
                        <th className="py-3.5 px-5">ID Cliente</th>
                        <th className="py-3.5 px-5">Nombre</th>
                        <th className="py-3.5 px-5">Prefijo / Contacto</th>
                        <th className="py-3.5 px-5">Correo</th>
                        <th className="py-3.5 px-5">Municipio</th>
                        <th className="py-3.5 px-5">Dirección Exacta</th>
                        <th className="py-3.5 px-5 text-center">ACCIONES</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                      {syncedCustomers
                        .filter(c => {
                          const q = customerQuery.toLowerCase();
                          return (
                            c.nombre?.toLowerCase().includes(q) ||
                            c.id?.toLowerCase().includes(q) ||
                            c.contacto?.includes(q) ||
                            c.correo?.toLowerCase().includes(q) ||
                            c.municipio?.toLowerCase().includes(q) ||
                            c.direccionExacta?.toLowerCase().includes(q)
                          );
                        })
                        .map(c => (
                          <tr key={c.id} className="hover:bg-slate-50/55 transition-colors">
                            <td className="py-4 px-5 font-mono text-[10px] font-bold text-slate-550">{c.id}</td>
                            <td className="py-4 px-5 font-bold text-slate-900">{c.nombre}</td>
                            <td className="py-4 px-5 font-semibold text-slate-800 font-mono">
                              +{c.prefijoPais || "504"} {c.contacto}
                              <a 
                                href={`https://wa.me/${(c.prefijoPais || "504") + c.contacto?.replace(/[^0-9]/g, "")}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-emerald-600 ml-1.5"
                              >
                                💬
                              </a>
                            </td>
                            <td className="py-4 px-5 font-mono text-[11px] font-semibold text-slate-600">{c.correo || "N/A"}</td>
                            <td className="py-4 px-5 text-slate-800">{c.municipio}</td>
                            <td className="py-4 px-5 max-w-xs truncate text-slate-800" title={c.direccionExacta}>{c.direccionExacta}</td>
                            <td className="py-4 px-5 text-center">
                              <div className="flex gap-1.5 justify-center">
                                <button
                                  onClick={() => openEditModal("customer", c)}
                                  className="p-1 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-755 rounded-md text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                                >
                                  <Edit className="w-3 h-3 text-indigo-600" /> Editar
                                </button>
                                <button
                                  onClick={() => handleDeleteItem("customer", c.id)}
                                  className="p-1 px-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-md text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* VIEW 7: Reseñas de la Tienda */}
        {activeTab === "reviews" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-2xl font-black text-slate-900">Reseñas de Clientes</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Administre opiniones de prendas y modere comentarios ofensivos. Sincronizado en tiempo real con la pestaña <strong className="text-emerald-700">"Resenias"</strong> de Google Sheets.
                </p>
              </div>
              <button
                onClick={() => openAddModal("review")}
                className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Agregar Reseña
              </button>
            </div>

            {/* Reviews query filter */}
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar comentario, nombre o producto..."
                  value={reviewQuery}
                  onChange={(e) => setReviewQuery(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl py-2 pl-9 pr-4 text-xs focus:outline-hidden focus:border-emerald-500 font-medium"
                />
              </div>
              <div className="bg-emerald-100 text-emerald-955 px-3 py-1.5 rounded-xl text-[11px] font-black tracking-wide uppercase">
                Total: {syncedReviews.length} Reseñas Sincronizadas
              </div>
            </div>

            {/* List block reviews card columns */}
            {syncedReviews.length === 0 ? (
              <div className="bg-white border border-slate-150 rounded-3xl p-12 text-center text-slate-500 space-y-3">
                <Star className="w-12 h-12 text-slate-300 mx-auto" />
                <h4 className="font-bold text-slate-800 text-sm">Sin reseñas para mostrar aún</h4>
                <p className="text-xs text-slate-450 max-w-sm mx-auto">
                  Agregue una opinión para comenzar.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-left">
                {syncedReviews
                  .filter(r => {
                    const q = reviewQuery.toLowerCase();
                    return (
                      r.nombre?.toLowerCase().includes(q) ||
                      r.comentario?.toLowerCase().includes(q) ||
                      r.producto?.toLowerCase().includes(q)
                    );
                  })
                  .map(r => (
                    <div key={r.id} className="bg-white border border-slate-150 p-5 rounded-3xl hover:shadow-xs transition-shadow flex flex-col justify-between space-y-4">
                      <div>
                        <div className="flex justify-between items-start gap-2">
                          <div>
                            <strong className="text-slate-900 text-sm font-bold block">{r.nombre}</strong>
                            <span className="text-[10px] text-slate-400 font-bold block mt-0.5">{r.fecha ? new Date(r.fecha).toLocaleDateString() : ""}</span>
                          </div>
                          <span className="font-mono text-[9px] text-slate-400 font-bold tracking-wider">{r.id}</span>
                        </div>
                        
                        {/* Star Rating display list */}
                        <div className="flex gap-0.5 mt-2.5">
                          {Array.from({ length: 5 }).map((_, sIdx) => (
                            <Star 
                              key={sIdx} 
                              className={`size-3.5 ${sIdx < r.calificacion ? "fill-amber-400 text-amber-400" : "text-slate-200"}`} 
                            />
                          ))}
                        </div>

                        <p className="text-slate-700 text-xs italic leading-relaxed mt-3.5">
                          "{r.comentario}"
                        </p>
                      </div>

                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] gap-2">
                        <div className="truncate">
                          <span className="text-slate-400 font-medium mr-1">Asociado a:</span>
                          <span className="font-extrabold text-emerald-600 uppercase font-mono truncate inline-block max-w-40" title={r.producto}>{r.producto}</span>
                        </div>
                        
                        <div className="flex gap-1 shrink-0">
                          <button
                            onClick={() => openEditModal("review", r)}
                            className="p-1 px-2.5 bg-slate-105 hover:bg-slate-200 text-slate-750 text-[10px] font-extrabold rounded-md flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            <Edit className="w-3 h-3 text-indigo-600" /> Editar
                          </button>
                          <button
                            onClick={() => handleDeleteItem("review", r.id)}
                            className="p-1 px-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-md text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-rose-650" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Box Image Upload Overlay Modal overlay */}
      {selectedProductForUploader && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs" onClick={() => setSelectedProductForUploader(null)} />
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden relative z-10 p-6 space-y-4 border border-slate-100">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">Actualizar Foto de Prenda</h3>
              <button 
                onClick={() => setSelectedProductForUploader(null)} 
                className="p-1 hover:bg-slate-100 rounded-lg cursor-pointer text-slate-450"
              >
                &times;
              </button>
            </div>

            <div className="space-y-1">
              <span className="block text-[10px] text-slate-400 font-bold uppercase font-mono">Prenda seleccionada:</span>
              <strong className="block text-slate-800 text-xs leading-tight">{selectedProductForUploader.nombre}</strong>
              <span className="block text-[10px] text-slate-450 font-semibold font-mono">COD: {selectedProductForUploader.id}</span>
            </div>

            <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center flex flex-col justify-center items-center gap-2 relative bg-slate-50/50 hover:bg-slate-50 transition-colors">
              {uploadingProductId === selectedProductForUploader.id ? (
                <div className="space-y-2 py-4">
                  <RefreshCw className="w-8 h-8 text-emerald-650 animate-spin mx-auto text-emerald-600" />
                  <p className="text-xs text-slate-500 font-bold">Subiendo imagen al servidor...</p>
                </div>
              ) : (
                <>
                  <Upload className="w-10 h-10 text-slate-400 shrink-0" />
                  <div>
                    <p className="text-xs text-slate-700 font-bold">Selecciona una foto desde tu dispositivo</p>
                    <p className="text-[10px] text-slate-400 mt-1">Soporta PNG, JPG y JPEG</p>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileChange(e, selectedProductForUploader)}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                </>
              )}
            </div>

            <div className="flex justify-between gap-3 pt-2">
              <button
                onClick={async () => {
                  if (await confirm("¿Estás seguro de restablecer la foto a la registrada por defecto?")) {
                    await onUpdateProductOverride(selectedProductForUploader.id, "imagen", undefined);
                    alert("Foto restablecida térmicamente.");
                    setSelectedProductForUploader(null);
                  }
                }}
                className="flex-1 py-2 px-3 text-slate-500 text-[10.5px] font-semibold hover:text-slate-850 text-center"
              >
                Restablecer por Defecto
              </button>
              <button
                onClick={() => setSelectedProductForUploader(null)}
                className="py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition-all cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unified CRUD Add/Edit Overlay Modal */}
      {activeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs" onClick={() => setActiveModal(null)} />
          <div className="bg-white w-full max-w-xl rounded-2xl shadow-xl overflow-y-auto max-h-[90vh] relative z-10 p-6 space-y-4 border border-slate-100 text-left">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-900 text-sm capitalize">
                {modalMode === "add" ? "Agregar" : "Modificar"} {
                  activeModal === "product" ? "Prenda / Producto" :
                  activeModal === "user" ? "Usuario / Acceso" :
                  activeModal === "customer" ? "Cliente" :
                  "Reseña o Comentario"
                }
              </h3>
              <button 
                onClick={() => setActiveModal(null)} 
                className="p-1 hover:bg-slate-100 rounded-lg cursor-pointer text-slate-450 text-lg font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleModalSubmit} className="space-y-4 text-xs">
              {activeModal === "product" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1 sm:col-span-2">
                    <label className="block font-bold text-slate-700">Código Fardo (ID Único / Obligatorio)</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej: FARDO-101, F-98"
                      disabled={modalMode === "edit"}
                      value={formData.id || ""}
                      onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-xl py-2 px-3 text-xs focus:outline-hidden disabled:opacity-50 text-slate-905 font-bold"
                    />
                  </div>

                  <div className="space-y-1 sm:col-span-2">
                    <label className="block font-bold text-slate-700">Nombre de la Prenda o Producto</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej: Vestido Casual de Algodón"
                      value={formData.nombre || ""}
                      onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-xl py-2 px-3 text-xs focus:outline-hidden text-slate-905 font-bold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block font-bold text-slate-700">Precio Efectivo (Lempiras)</label>
                    <input
                      type="number"
                      required
                      min={0}
                      placeholder="Ej: 150"
                      value={formData.precioEfectivo ?? ""}
                      onChange={(e) => setFormData({ ...formData, precioEfectivo: Number(e.target.value) })}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-xl py-2 px-3 text-xs focus:outline-hidden text-slate-905 font-bold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block font-bold text-slate-700">Precio Normal (Lempiras)</label>
                    <input
                      type="number"
                      required
                      min={0}
                      placeholder="Ej: 200"
                      value={formData.precioNormal ?? ""}
                      onChange={(e) => setFormData({ ...formData, precioNormal: Number(e.target.value) })}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-xl py-2 px-3 text-xs focus:outline-hidden text-slate-905 font-bold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block font-bold text-slate-705">Existencia (Unidades)</label>
                    <input
                      type="number"
                      required
                      min={0}
                      placeholder="Ej: 5"
                      value={formData.stock ?? ""}
                      onChange={(e) => setFormData({ ...formData, stock: Number(e.target.value) })}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-xl py-2 px-3 text-xs focus:outline-hidden text-slate-905 font-bold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block font-bold text-slate-700">Código Simple</label>
                    <input
                      type="text"
                      placeholder="Ej: CS-1011"
                      value={formData.codigoSimple || ""}
                      onChange={(e) => setFormData({ ...formData, codigoSimple: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-xl py-2 px-3 text-xs focus:outline-hidden text-slate-905 font-bold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block font-bold text-slate-700">Descuento (Lempiras)</label>
                    <input
                      type="number"
                      min={0}
                      placeholder="Ej: 50"
                      value={formData.descuento ?? ""}
                      onChange={(e) => setFormData({ ...formData, descuento: Number(e.target.value) })}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-xl py-2 px-3 text-xs focus:outline-hidden text-slate-905 font-bold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block font-bold text-slate-750">Descuento Vence En (AAAA-MM-DD)</label>
                    <input
                      type="text"
                      placeholder="Ej: 2026-12-31"
                      value={formData.fechaHasta || ""}
                      onChange={(e) => setFormData({ ...formData, fechaHasta: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-xl py-2 px-3 text-xs focus:outline-hidden text-slate-905 font-bold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block font-bold text-slate-700">Cantidad de Piezas</label>
                    <input
                      type="number"
                      placeholder="Ej: 1"
                      value={formData.cantPiezas ?? ""}
                      onChange={(e) => setFormData({ ...formData, cantPiezas: Number(e.target.value) })}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-xl py-2 px-3 text-xs focus:outline-hidden text-slate-905 font-bold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block font-bold text-slate-700">Categoría (Filtro exacto)</label>
                    <select
                      value={formData.categoria || ""}
                      onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                      required
                      className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-xl py-2 px-3 text-xs focus:outline-hidden cursor-pointer text-slate-905 font-bold"
                    >
                      <option value="">Selecciona Categoría</option>
                      <option value="Vestidos">Vestidos</option>
                      <option value="Blusas">Blusas</option>
                      <option value="Pantalones">Pantalones</option>
                      <option value="Faldas">Faldas</option>
                      <option value="Zapatos">Zapatos</option>
                      <option value="Accesorios">Accesorios</option>
                      <option value="Otros">Otros</option>
                    </select>
                  </div>

                  <div className="space-y-1 sm:col-span-2">
                    <label className="block font-bold text-slate-700">URL Foto Predeterminada (Foto_Fardo)</label>
                    <input
                      type="url"
                      placeholder="Ej: https://images.unsplash.com/..."
                      value={formData.imagen || ""}
                      onChange={(e) => setFormData({ ...formData, imagen: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-xl py-2 px-3 text-xs focus:outline-hidden"
                    />
                  </div>
                </div>
              )}

              {activeModal === "user" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block font-bold text-slate-700">ID de Usuario (ID_Usuario / Único)</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej: USR01"
                      disabled={modalMode === "edit"}
                      value={formData.idUsuario || ""}
                      onChange={(e) => setFormData({ ...formData, idUsuario: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-xl py-2 px-3 text-xs focus:outline-hidden disabled:opacity-50 text-slate-905 font-bold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block font-bold text-slate-700">Nombre Completo</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej: María López"
                      value={formData.nombre || ""}
                      onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-xl py-2 px-3 text-xs focus:outline-hidden text-slate-905 font-bold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block font-bold text-slate-700">Celular / WhatsApp (Ej: 99887766)</label>
                    <input
                      type="text"
                      required
                      placeholder="8 dígitos"
                      value={formData.contacto || ""}
                      onChange={(e) => setFormData({ ...formData, contacto: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-xl py-2 px-3 text-xs focus:outline-hidden text-slate-905 font-bold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block font-bold text-slate-700">Correo Electrónico (Para login)</label>
                    <input
                      type="email"
                      required
                      placeholder="m@example.com"
                      value={formData.correo || ""}
                      onChange={(e) => setFormData({ ...formData, correo: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-xl py-2 px-3 text-xs focus:outline-hidden text-slate-905 font-bold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block font-bold text-slate-700">Contraseña</label>
                    <input
                      type="text"
                      required
                      placeholder="Mínimo 6 caracteres"
                      value={formData.password || ""}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-xl py-2 px-3 text-xs focus:outline-hidden text-slate-905 font-bold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block font-bold text-slate-700">Rol</label>
                    <select
                      value={formData.rol || "Vendedor"}
                      onChange={(e) => setFormData({ ...formData, rol: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-xl py-2 px-3 text-xs focus:outline-hidden cursor-pointer text-slate-905 font-bold"
                    >
                      <option value="Administrador">Administrador</option>
                      <option value="Vendedor">Vendedor</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block font-bold text-slate-705">Estado Perfil</label>
                    <select
                      value={formData.estadoPerfil || "Activo"}
                      onChange={(e) => setFormData({ ...formData, estadoPerfil: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-xl py-2 px-3 text-xs focus:outline-hidden cursor-pointer text-slate-905 font-bold"
                    >
                      <option value="Activo">Activo</option>
                      <option value="Inactivo">Inactivo</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block font-bold text-slate-700">URL Foto Perfil (Opcional)</label>
                    <input
                      type="url"
                      placeholder="https://..."
                      value={formData.foto || ""}
                      onChange={(e) => setFormData({ ...formData, foto: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-xl py-2 px-3 text-xs focus:outline-hidden"
                    />
                  </div>
                </div>
              )}

              {activeModal === "customer" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block font-bold text-slate-700">ID Cliente (ID_Cliente / Único)</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej: CLI45"
                      disabled={modalMode === "edit"}
                      value={formData.id || ""}
                      onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-xl py-2 px-3 text-xs focus:outline-hidden disabled:opacity-50 text-slate-905 font-bold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block font-bold text-slate-700">Nombre Completo</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej: Juan Pérez"
                      value={formData.nombre || ""}
                      onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-xl py-2 px-3 text-xs focus:outline-hidden text-slate-905 font-bold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block font-bold text-slate-700">Teléfono / WhatsApp (Ej: 99887766)</label>
                    <input
                      type="text"
                      required
                      placeholder="8 dígitos"
                      value={formData.contacto || ""}
                      onChange={(e) => setFormData({ ...formData, contacto: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-xl py-2 px-3 text-xs focus:outline-hidden text-slate-905 font-bold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block font-bold text-slate-700">Correo Electrónico</label>
                    <input
                      type="email"
                      placeholder="opcional@example.com"
                      value={formData.correo || ""}
                      onChange={(e) => setFormData({ ...formData, correo: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-xl py-2 px-3 text-xs focus:outline-hidden text-slate-905 font-bold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block font-bold text-slate-700">Municipio</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej: Tegucigalpa, San Pedro Sula"
                      value={formData.municipio || ""}
                      onChange={(e) => setFormData({ ...formData, municipio: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-xl py-2 px-3 text-xs focus:outline-hidden text-slate-905 font-bold"
                    />
                  </div>

                  <div className="space-y-1 sm:col-span-2">
                    <label className="block font-bold text-slate-700">Dirección Exacta de Entrega</label>
                    <textarea
                      required
                      rows={2}
                      placeholder="Colonia, bloque, número..."
                      value={formData.direccionExacta || ""}
                      onChange={(e) => setFormData({ ...formData, direccionExacta: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-xl py-2 px-3 text-xs focus:outline-hidden text-slate-905 font-bold"
                    />
                  </div>
                </div>
              )}

              {activeModal === "review" && (
                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-1">
                    <label className="block font-bold text-slate-700">ID de Reseña (ID / Único)</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej: RES-91"
                      disabled={modalMode === "edit"}
                      value={formData.id || ""}
                      onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-xl py-2 px-3 text-xs focus:outline-hidden disabled:opacity-50 text-slate-905 font-bold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block font-bold text-slate-700">Nombre del Autor o Cliente</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej: Anónimo"
                      value={formData.nombre || ""}
                      onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-xl py-2 px-3 text-xs focus:outline-hidden text-slate-905 font-bold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block font-bold text-slate-700">Prenda o Código de Fardo Asociado</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej: FARDO-101"
                      value={formData.producto || ""}
                      onChange={(e) => setFormData({ ...formData, producto: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-xl py-2 px-3 text-xs focus:outline-hidden text-slate-905 font-bold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block font-bold text-slate-700">Calificación (1 a 5 estrellas)</label>
                    <select
                      value={formData.calificacion || 5}
                      onChange={(e) => setFormData({ ...formData, calificacion: Number(e.target.value) })}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-xl py-2 px-3 text-xs focus:outline-hidden cursor-pointer text-slate-905 font-bold"
                    >
                      <option value={5}>⭐⭐⭐⭐⭐ 5 estrellas</option>
                      <option value={4}>⭐⭐⭐⭐ 4 estrellas</option>
                      <option value={3}>⭐⭐⭐ 3 estrellas</option>
                      <option value={2}>⭐⭐ 2 estrellas</option>
                      <option value={1}>⭐ 1 estrella</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block font-bold text-slate-700">Comentario u Opinión</label>
                    <textarea
                      required
                      rows={3}
                      placeholder="Escribe la reseña de la prenda..."
                      value={formData.comentario || ""}
                      onChange={(e) => setFormData({ ...formData, comentario: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-xl py-2 px-3 text-xs focus:outline-hidden text-slate-905 font-bold"
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="py-2.5 px-4 text-slate-500 hover:text-slate-800 font-bold transition-all text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-extrabold py-2.5 px-5 rounded-xl text-xs transition-all flex items-center gap-1 cursor-pointer"
                >
                  {formSubmitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Procesando...
                    </>
                  ) : (
                    "Guardar Cambios"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Safe Modal: Confirm Dialog */}
      {confirmDialog && confirmDialog.isOpen && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-9999">
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 flex flex-col gap-4 transform scale-100 transition-all">
            <div className="flex items-start gap-3">
              <div className="size-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 animate-bounce" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-black text-slate-900">{confirmDialog.title}</h3>
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">{confirmDialog.message}</p>
              </div>
            </div>
            <div className="flex gap-2.5 mt-2 justify-end">
              <button
                type="button"
                onClick={confirmDialog.onCancel}
                className="py-2 px-3.5 text-slate-500 hover:bg-slate-50 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDialog.onConfirm}
                className="bg-emerald-600 hover:bg-emerald-505 bg-emerald-600 text-white font-extrabold text-xs py-2 px-4 rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Safe Modal: Feedback Alert */}
      {feedbackAlert && feedbackAlert.isOpen && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-9999">
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <div className="size-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-black text-slate-900">{feedbackAlert.title}</h3>
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed whitespace-pre-line">{feedbackAlert.message}</p>
              </div>
            </div>
            <div className="flex justify-end mt-2">
              <button
                type="button"
                onClick={() => setFeedbackAlert(null)}
                className="bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs py-2 px-4.5 rounded-xl transition-all cursor-pointer"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
