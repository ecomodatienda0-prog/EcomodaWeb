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
  Download,
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
  Edit,
  Camera,
  Minus,
  Share2
} from "lucide-react";
import { Product, Order, CompanyInfo, User, Customer, Review } from "../types";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";

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
  const [selectedUserForUploader, setSelectedUserForUploader] = useState<User | null>(null);
  const [uploadingUserId, setUploadingUserId] = useState<string | null>(null);
  
  // Dashboard Slicers
  const [selectedFilterMonth, setSelectedFilterMonth] = useState<string>("Todos");
  const [selectedFilterYear, setSelectedFilterYear] = useState<string>("Todos");

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

  const [importingExcel, setImportingExcel] = useState(false);

  // States for manual order/sales generation (physical store)
  const [isManualOrderModalOpen, setIsManualOrderModalOpen] = useState(false);
  const [manualOrderForm, setManualOrderForm] = useState({
    clienteNombre: "",
    clienteEmail: "",
    clienteTelefono: "",
    clienteDireccion: "Retiro en tienda física",
    clienteNotas: "",
    municipio: "",
    paymentMethod: "Efectivo" as "Efectivo" | "Transferencia" | "Tarjeta",
    usuarioVendedor: "",
  });
  const [manualOrderItems, setManualOrderItems] = useState<any[]>([]);
  const [manualProductSearch, setManualProductSearch] = useState("");
  const [creatingManualOrder, setCreatingManualOrder] = useState(false);

  const handleCreateManualOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (manualOrderItems.length === 0) {
      alert("❌ Por favor agrega al menos un producto a la orden.");
      return;
    }
    if (!manualOrderForm.clienteNombre.trim() || !manualOrderForm.clienteTelefono.trim()) {
      alert("❌ El nombre del cliente y el teléfono son requeridos.");
      return;
    }

    setCreatingManualOrder(true);

    const totalNormal = manualOrderItems.reduce((sum, item) => sum + (item.precioNormal * item.cantidad), 0);
    const totalEfectivo = manualOrderItems.reduce((sum, item) => sum + (item.precioEfectivo * item.cantidad), 0);
    const savings = totalNormal - totalEfectivo;

    const orderPayload = {
      clienteNombre: manualOrderForm.clienteNombre.trim(),
      clienteEmail: manualOrderForm.clienteEmail.trim() || undefined,
      clienteTelefono: manualOrderForm.clienteTelefono.trim(),
      clienteDireccion: manualOrderForm.clienteDireccion.trim(),
      clienteNotas: (manualOrderForm.clienteNotas.trim() || "") + (manualOrderForm.usuarioVendedor ? ` [Vendedor: ${manualOrderForm.usuarioVendedor}]` : ""),
      paymentMethod: manualOrderForm.paymentMethod,
      items: manualOrderItems.map(item => ({
        id: item.id,
        nombre: item.nombre,
        precioNormal: item.precioNormal,
        precioEfectivo: item.precioEfectivo,
        descuento: item.descuento || 0,
        categoria: item.categoria,
        cantidad: item.cantidad
      })),
      totalNormal,
      totalEfectivo,
      totalDescuento: manualOrderForm.paymentMethod === "Tarjeta" ? 0 : savings,
      municipio: manualOrderForm.municipio.trim() || undefined,
      usuarioVendedor: manualOrderForm.usuarioVendedor || undefined,
      status: "Completado" as const
    };

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: orderPayload })
      });

      if (!response.ok) {
        throw new Error("No se pudo registrar la venta en la Base de Datos.");
      }

      const result = await response.json();
      if (result.success && result.order) {
        alert(`🎉 ¡Excelente! Venta física registrada con éxito con el código de orden: ${result.order.id}.`);
        
        try {
          const opt = window.confirm("¿Deseas descargar la Factura en PDF para entregársela al cliente?");
          if (opt) {
            handleGenerateInvoicePDF(result.order);
          }
        } catch (pdfErr) {
          console.error("PDF auto generation error:", pdfErr);
        }

        setIsManualOrderModalOpen(false);
        setManualOrderForm({
          clienteNombre: "",
          clienteEmail: "",
          clienteTelefono: "",
          clienteDireccion: "Retiro en tienda física",
          clienteNotas: "",
          municipio: "",
          paymentMethod: "Efectivo",
          usuarioVendedor: "",
        });
        setManualOrderItems([]);
        setManualProductSearch("");
        
        await onRefreshData();
      } else {
        throw new Error(result.error || "Ocurrió un error inesperado.");
      }
    } catch (err: any) {
      alert(`❌ Error al crear venta manual: ${err.message || err}`);
    } finally {
      setCreatingManualOrder(false);
    }
  };

  const handleAddManualProductItem = (pt: Product) => {
    const existing = manualOrderItems.find((it) => it.id === pt.id);
    if (existing) {
      if (existing.cantidad >= pt.stock) {
        alert(`⚠️ No puedes agregar más de la existencia actual (${pt.stock} unidades).`);
        return;
      }
      setManualOrderItems(
        manualOrderItems.map((it) =>
          it.id === pt.id ? { ...it, cantidad: it.cantidad + 1 } : it
        )
      );
    } else {
      if (pt.stock <= 0) {
        alert("⚠️ Este producto no tiene existencia disponible.");
        return;
      }
      setManualOrderItems([
        ...manualOrderItems,
        {
          id: pt.id,
          nombre: pt.nombre,
          precioNormal: pt.precioNormal,
          precioEfectivo: pt.precioEfectivo,
          descuento: pt.descuento || 0,
          categoria: pt.categoria,
          cantidad: 1,
          maxStock: pt.stock
        }
      ]);
    }
  };

  const handleUpdateManualItemQty = (productId: string, newQty: number) => {
    const existing = manualOrderItems.find(it => it.id === productId);
    if (!existing) return;
    if (newQty > existing.maxStock) {
      alert(`⚠️ No puedes vender más de la existencia disponible (${existing.maxStock} unidades).`);
      return;
    }
    if (newQty < 1) return;
    setManualOrderItems(
      manualOrderItems.map(it => it.id === productId ? { ...it, cantidad: newQty } : it)
    );
  };

  const handleRemoveManualItem = (productId: string) => {
    setManualOrderItems(manualOrderItems.filter(it => it.id !== productId));
  };

  // States and Handlers for editing existing orders/ventas
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [editOrderForm, setEditOrderForm] = useState({
    clienteNombre: "",
    clienteEmail: "",
    clienteTelefono: "",
    clienteDireccion: "",
    clienteNotas: "",
    municipio: "",
    paymentMethod: "Efectivo" as "Efectivo" | "Transferencia" | "Tarjeta",
    status: "Pendiente" as Order["status"],
    usuarioVendedor: "",
  });
  const [editOrderItems, setEditOrderItems] = useState<any[]>([]);
  const [editProductSearch, setEditProductSearch] = useState("");
  const [savingEditOrder, setSavingEditOrder] = useState(false);

  const handleEditOrderOpen = (ord: Order) => {
    setEditingOrder(ord);
    setEditOrderForm({
      clienteNombre: ord.clienteNombre || "",
      clienteEmail: ord.clienteEmail || "",
      clienteTelefono: ord.clienteTelefono || "",
      clienteDireccion: ord.clienteDireccion || "",
      clienteNotas: ord.clienteNotas || "",
      municipio: ord.municipio || "",
      paymentMethod: ord.paymentMethod || "Efectivo",
      status: ord.status || "Pendiente",
      usuarioVendedor: ord.usuarioVendedor || "",
    });
    setEditOrderItems(
      ord.items.map((it) => ({
        id: it.id,
        nombre: it.nombre,
        precioNormal: it.precioNormal,
        precioEfectivo: it.precioEfectivo,
        descuento: (it as any).descuento || 0,
        categoria: it.categoria,
        cantidad: it.cantidad,
        maxStock: 9999
      }))
    );
    setEditProductSearch("");
  };

  const handleAddEditProductItem = (pt: Product) => {
    const existing = editOrderItems.find((it) => it.id === pt.id);
    if (existing) {
      if (existing.cantidad >= pt.stock) {
        alert(`⚠️ No puedes agregar más de la existencia actual (${pt.stock} unidades).`);
        return;
      }
      setEditOrderItems(
        editOrderItems.map((it) =>
          it.id === pt.id ? { ...it, cantidad: it.cantidad + 1 } : it
        )
      );
    } else {
      if (pt.stock <= 0) {
        alert("⚠️ Este producto no tiene existencia disponible.");
        return;
      }
      setEditOrderItems([
        ...editOrderItems,
        {
          id: pt.id,
          nombre: pt.nombre,
          precioNormal: pt.precioNormal,
          precioEfectivo: pt.precioEfectivo,
          descuento: pt.descuento || 0,
          categoria: pt.categoria,
          cantidad: 1,
          maxStock: pt.stock
        }
      ]);
    }
  };

  const handleUpdateEditItemQty = (productId: string, newQty: number) => {
    const existing = editOrderItems.find((it) => it.id === productId);
    if (!existing) return;
    if (newQty > existing.maxStock) {
      alert(`⚠️ No puedes vender más de la existencia disponible (${existing.maxStock} unidades).`);
      return;
    }
    if (newQty < 1) return;
    setEditOrderItems(
      editOrderItems.map((it) => (it.id === productId ? { ...it, cantidad: newQty } : it))
    );
  };

  const handleRemoveEditItem = (productId: string) => {
    setEditOrderItems(editOrderItems.filter((it) => it.id !== productId));
  };

  const handleEditOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrder) return;
    if (editOrderItems.length === 0) {
      alert("❌ Por favor agrega al menos un producto a la orden.");
      return;
    }
    if (!editOrderForm.clienteNombre.trim() || !editOrderForm.clienteTelefono.trim()) {
      alert("❌ El nombre del cliente y el teléfono son requeridos.");
      return;
    }

    setSavingEditOrder(true);

    const totalNormal = editOrderItems.reduce((sum, item) => sum + (item.precioNormal * item.cantidad), 0);
    const totalEfectivo = editOrderItems.reduce((sum, item) => sum + (item.precioEfectivo * item.cantidad), 0);
    const savings = totalNormal - totalEfectivo;

    const updatedPayload = {
      clienteNombre: editOrderForm.clienteNombre.trim(),
      clienteEmail: editOrderForm.clienteEmail.trim() || undefined,
      clienteTelefono: editOrderForm.clienteTelefono.trim(),
      clienteDireccion: editOrderForm.clienteDireccion.trim(),
      clienteNotas: editOrderForm.clienteNotas.trim() || undefined,
      paymentMethod: editOrderForm.paymentMethod,
      status: editOrderForm.status,
      usuarioVendedor: editOrderForm.usuarioVendedor || undefined,
      municipio: editOrderForm.municipio.trim() || undefined,
      items: editOrderItems.map(item => ({
        id: item.id,
        nombre: item.nombre,
        precioNormal: item.precioNormal,
        precioEfectivo: item.precioEfectivo,
        descuento: item.descuento || 0,
        categoria: item.categoria,
        cantidad: item.cantidad
      })),
      totalNormal,
      totalEfectivo,
      totalDescuento: editOrderForm.paymentMethod === "Tarjeta" ? 0 : savings
    };

    try {
      const response = await fetch(`/api/orders/${editingOrder.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedPayload)
      });

      if (!response.ok) {
        throw new Error("No se pudo actualizar el pedido en la base de datos.");
      }

      const result = await response.json();
      if (result.success) {
        alert("🎉 ¡Pedido modificado y sincronizado con éxito!");
        setEditingOrder(null);
        await onRefreshData();
      } else {
        throw new Error(result.error || "Ocurrió un error inesperado.");
      }
    } catch (err: any) {
      alert(`❌ Error al modificar la orden: ${err.message || err}`);
    } finally {
      setSavingEditOrder(false);
    }
  };

  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportingExcel(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        if (!bstr) throw new Error("No se pudo leer el archivo.");
        
        const wb = XLSX.read(bstr, { type: "array" });
        let wsname = wb.SheetNames.find(name => name.toLowerCase() === "productos en linea");
        if (!wsname) {
          wsname = wb.SheetNames[0];
        }
        
        const ws = wb.Sheets[wsname];
        if (!ws) throw new Error("No se encontró ninguna hoja de cálculo en el archivo.");

        const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });
        if (rows.length < 2) {
          throw new Error("El archivo no contiene suficientes filas (se requiere cabecera y al menos una fila de datos).");
        }

        const headers = (rows[0] || []).map((h: any) => String(h).trim().toLowerCase());
        const idxId = headers.indexOf("codigo_fardo") !== -1 ? headers.indexOf("codigo_fardo") : headers.findIndex(h => h.includes("codigo_fardo") || h.includes("fardo") || h.includes("id") || h.includes("cod"));
        const idxNombre = headers.indexOf("producto") !== -1 ? headers.indexOf("producto") : headers.findIndex(h => h.includes("producto") || h.includes("nombre") || h.includes("name") || h.includes("art"));
        const idxPrecioEfectivo = headers.indexOf("precio_efectivo") !== -1 ? headers.indexOf("precio_efectivo") : headers.findIndex(h => h.includes("precio_efectivo") || h.includes("efectivo") || h.includes("cash"));
        const idxPrecioNormal = headers.indexOf("precio_normal") !== -1 ? headers.indexOf("precio_normal") : headers.findIndex(h => h.includes("precio_normal") || h.includes("normal") || h.includes("regular"));
        const idxStock = headers.indexOf("existencia") !== -1 ? headers.indexOf("existencia") : headers.findIndex(h => h.includes("existencia") || h.includes("stock") || h.includes("cant") || h.includes("cantidad"));
        const idxCodigoSimple = headers.indexOf("codigo_simple") !== -1 ? headers.indexOf("codigo_simple") : headers.findIndex(h => h.includes("codigo_simple") || h.includes("simple") || h.includes("codigo simple"));
        const idxDescuento = headers.indexOf("descuento") !== -1 ? headers.indexOf("descuento") : headers.findIndex(h => h.includes("descuento") || h.includes("desc"));
        const idxFechaHasta = headers.indexOf("fecha_hasta") !== -1 ? headers.indexOf("fecha_hasta") : headers.findIndex(h => h.includes("fecha_hasta") || h.includes("hasta") || h.includes("fecha hasta"));
        const idxCantPiezas = headers.indexOf("cant_piezas") !== -1 ? headers.indexOf("cant_piezas") : headers.findIndex(h => h.includes("cant_piezas") || h.includes("piezas") || h.includes("piezas_fardo"));
        const idxFoto = headers.indexOf("foto_fardo") !== -1 ? headers.indexOf("foto_fardo") : headers.findIndex(h => h.includes("foto_fardo") || h.includes("foto") || h.includes("imagen") || h.includes("img") || h.includes("url"));
        const idxCategoria = headers.indexOf("categoria") !== -1 ? headers.indexOf("categoria") : headers.findIndex(h => h.includes("categoria") || h.includes("categoría") || h.includes("cat"));

        if (idxId === -1) {
          throw new Error("No se pudo detectar la columna del Código de Fardo / ID. Asegúrese de que su archivo contenga una columna llamada 'Codigo_Fardo', 'Codigo_Fardo' o similar.");
        }

        const parsedProducts: any[] = [];
        for (let i = 1; i < rows.length; i++) {
          const r = rows[i];
          if (!r || r.length === 0) continue;
          
          const idVal = String(r[idxId] || "").trim();
          if (!idVal) continue;
          
          const nombreVal = idxNombre !== -1 && r[idxNombre] !== undefined ? String(r[idxNombre]).trim() : idVal;
          const precioEfectivoVal = idxPrecioEfectivo !== -1 && r[idxPrecioEfectivo] !== undefined ? Number(r[idxPrecioEfectivo]) || 0 : 0;
          const precioNormalVal = idxPrecioNormal !== -1 && r[idxPrecioNormal] !== undefined ? Number(r[idxPrecioNormal]) || 0 : 0;
          const stockVal = idxStock !== -1 && r[idxStock] !== undefined ? parseInt(String(r[idxStock])) || 0 : 1;
          const codigoSimpleVal = idxCodigoSimple !== -1 && r[idxCodigoSimple] !== undefined ? String(r[idxCodigoSimple]).trim() : "";
          const descuentoVal = idxDescuento !== -1 && r[idxDescuento] !== undefined ? Number(r[idxDescuento]) || 0 : 0;
          const fechaHastaVal = idxFechaHasta !== -1 && r[idxFechaHasta] !== undefined ? String(r[idxFechaHasta]).trim() : "";
          const cantPiezasVal = idxCantPiezas !== -1 && r[idxCantPiezas] !== undefined ? parseInt(String(r[idxCantPiezas])) || 0 : 0;
          const fotoVal = idxFoto !== -1 && r[idxFoto] !== undefined ? String(r[idxFoto]).trim() : "";
          const categoriaVal = idxCategoria !== -1 && r[idxCategoria] !== undefined ? String(r[idxCategoria]).trim() : "Fardos";

          parsedProducts.push({
            id: idVal,
            nombre: nombreVal,
            precioEfectivo: precioEfectivoVal,
            precioNormal: precioNormalVal,
            stock: stockVal,
            codigoSimple: codigoSimpleVal,
            descuento: descuentoVal,
            fechaHasta: fechaHastaVal,
            cantPiezas: cantPiezasVal,
            imagen: fotoVal,
            categoria: categoriaVal
          });
        }

        if (parsedProducts.length === 0) {
          throw new Error("No se encontraron fardos válidos para importar.");
        }

        const res = await fetch("/api/products/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(parsedProducts)
        });
        const result = await res.json();
        if (!res.ok) {
          throw new Error(result.error || "Fallo en la comunicación con el servidor.");
        }

        if (result.syncError) {
          alert(`⚠️ Catálogo importado localmente (${result.addedCount} agregados, ${result.updatedCount} actualizados) pero NO se pudo sincronizar con Google Sheets.\n\nDetalle: ${result.syncError}`);
        } else {
          alert(`🎉 ¡Excelente! Se importaron ${result.addedCount} prendas nuevas y se actualizaron ${result.updatedCount} existentes de forma masiva en Google Sheets y en tu inventario.`);
        }

        await onRefreshData();

      } catch (err: any) {
        alert(`❌ Error al importar catálogo: ${err.message || err}`);
      } finally {
        setImportingExcel(false);
        e.target.value = "";
      }
    };

    reader.readAsArrayBuffer(file);
  };

  const handleExcelExport = () => {
    try {
      const dataToExport = products.map((p) => ({
        "Codigo_Fardo": p.id,
        "Producto": p.nombre,
        "Precio_Efectivo": p.precioEfectivo,
        "Existencia": p.stock,
        "Precio_Normal": p.precioNormal,
        "Codigo_Simple": p.codigoSimple || "",
        "Descuento": p.descuento || 0,
        "Fecha_Hasta": p.fechaHasta || "",
        "Cant_Piezas": p.cantPiezas || 0,
        "Foto_Fardo": p.imagen,
        "Categoria": p.categoria
      }));

      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Productos en Linea");
      XLSX.writeFile(wb, "Catalogo_Productos.xlsx");
    } catch (err: any) {
      alert(`❌ Error al exportar catálogo: ${err.message || err}`);
    }
  };

  const handleGenerateInvoicePDF = (ord: Order) => {
    try {
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "letter"
      });

      // Color Palette - Slate & Emerald
      const primaryColor = [16, 185, 129]; // Emerald (16, 185, 129)
      const secondaryColor = [30, 41, 59]; // Slate (30, 41, 59)
      const textColor = [51, 65, 85]; // Dark grey slate (51, 65, 85)
      const lightGrey = [241, 245, 249]; // Light slate bg (241, 245, 249)

      // Header Banner
      doc.setFillColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      doc.rect(0, 0, 215.9, 40, "F");

      // Company Name
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.setTextColor(255, 255, 255);
      doc.text(companyInfo?.name || "EcoModa Tienda", 15, 18);

      // Bill To Label
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text("SISTEMA DE FACTURA DIGITAL", 15, 26);
      doc.setTextColor(180, 250, 220);
      doc.setFont("helvetica", "bold");
      doc.text(`ORDEN #${ord.id}`, 15, 33);

      // Invoice Meta
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      const dateStr = new Date(ord.fecha).toLocaleDateString();
      const timeStr = new Date(ord.fecha).toLocaleTimeString();
      doc.text(`Fecha: ${dateStr} - ${timeStr}`, 140, 16);
      doc.text(`Tel: ${companyInfo?.phone || ""}`, 140, 22);
      doc.text(`Horario: ${companyInfo?.hours || ""}`, 140, 28);
      doc.text(`Dirección: ${companyInfo?.address ? companyInfo.address.substring(0, 40) : ""}`, 140, 34);

      // Main Section
      let y = 50;

      // Customer Info Box
      doc.setFillColor(lightGrey[0], lightGrey[1], lightGrey[2]);
      doc.roundedRect(15, y, 185.9, 36, 3, 3, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      doc.text(" DATOS DEL CLIENTE", 18, y + 6);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(textColor[0], textColor[1], textColor[2]);
      doc.text(`Nombre: ${ord.clienteNombre}`, 18, y + 13);
      doc.text(`Teléfono: ${ord.clienteTelefono}`, 18, y + 19);
      if (ord.clienteEmail) {
        doc.text(`Correo Electrónico: ${ord.clienteEmail}`, 18, y + 25);
      }
      doc.text(`Método Pago: ${ord.paymentMethod}`, 18, y + 31);

      doc.text(`Dirección: ${ord.clienteDireccion}`, 110, y + 13);
      if (ord.municipio) {
        doc.text(`Municipio: ${ord.municipio}`, 110, y + 19);
      }
      if (ord.usuarioVendedor) {
        doc.text(`Atendido por: ${ord.usuarioVendedor}`, 110, y + 25);
      }

      y += 45;

      // Section: Products List
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      doc.text("ITEMS / PRENDAS ADQUIRIDAS", 15, y);

      y += 5;

      // Table Headers
      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.rect(15, y, 185.9, 8, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(255, 255, 255);
      doc.text("Cód/Prenda", 18, y + 5.5);
      doc.text("Precio Orig.", 115, y + 5.5);
      doc.text("Cant.", 145, y + 5.5);
      doc.text("Subtotal", 170, y + 5.5);

      y += 8;

      // Render Items
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(textColor[0], textColor[1], textColor[2]);

      ord.items.forEach((item, index) => {
        // Alternating rows
        if (index % 2 === 1) {
          doc.setFillColor(248, 250, 252);
          doc.rect(15, y, 185.9, 8, "F");
        }

        doc.setTextColor(51, 65, 85);
        // Draw row content
        const itemName = item.nombre.length > 50 ? item.nombre.substring(0, 48) + "..." : item.nombre;
        doc.text(`[${item.id}] ${itemName}`, 18, y + 5.5);
        
        const originalPrice = ord.paymentMethod === "Tarjeta" ? item.precioNormal : item.precioEfectivo;
        doc.text(`L. ${originalPrice.toLocaleString()}`, 115, y + 5.5);
        doc.text(`${item.cantidad}`, 145, y + 5.5);
        
        const sub = originalPrice * item.cantidad;
        doc.text(`L. ${sub.toLocaleString()}`, 170, y + 5.5);

        y += 8;
      });

      y += 5;

      // Draw Line
      doc.setDrawColor(226, 232, 240);
      doc.line(15, y, 200.9, y);

      y += 5;

      // Totals Section
      const netTotal = ord.paymentMethod === "Tarjeta" ? ord.totalNormal : ord.totalEfectivo;
      
      doc.setFont("helvetica", "bold");
      doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      doc.setFontSize(10);
      doc.text("Subtotal Normal:", 130, y);
      doc.setFont("helvetica", "normal");
      doc.text(`L. ${ord.totalNormal.toLocaleString()}`, 175, y);

      y += 6;

      if (ord.paymentMethod !== "Tarjeta" && ord.totalDescuento > 0) {
        doc.setFont("helvetica", "bold");
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.text("Descuento Efectivo:", 130, y);
        doc.text(`- L. ${ord.totalDescuento.toLocaleString()}`, 175, y);
        y += 6;
      }

      doc.setFont("helvetica", "bold");
      doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      doc.setFontSize(11);
      doc.text("TOTAL NETO:", 130, y);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text(`L. ${netTotal.toLocaleString()}`, 175, y);

      y += 12;

      // Bank Info banner
      if (companyInfo?.bankDetails) {
        doc.setFillColor(lightGrey[0], lightGrey[1], lightGrey[2]);
        doc.roundedRect(15, y, 185.9, 18, 2, 2, "F");
        
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
        doc.text("INFORMACIÓN DE PAGO / TRANSFERENCIA", 18, y + 5);
        
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(textColor[0], textColor[1], textColor[2]);
        const bankSnippet = companyInfo.bankDetails.length > 100 ? companyInfo.bankDetails.substring(0, 97) + "..." : companyInfo.bankDetails;
        doc.text(bankSnippet, 18, y + 11);
        
        y += 24;
      } else {
        y += 5;
      }

      // Footer Accent Bar
      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.rect(15, y, 185.9, 1.5, "F");

      y += 6;

      // Thank options
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      doc.text(`¡Gracias por su preferencia en ${companyInfo?.name || "EcoModa"}!`, 15, y);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(148, 163, 184); // grey
      doc.text("Este documento es un comprobante digital oficial de compra.", 15, y + 5);

      // Output / Save
      doc.save(`Factura_${ord.id}.pdf`);
    } catch (err: any) {
      alert(`❌ Error al generar la factura PDF: ${err.message || err}`);
    }
  };

  const handleShareWhatsApp = (ord: Order) => {
    try {
      const netTotal = ord.paymentMethod === "Tarjeta" ? ord.totalNormal : ord.totalEfectivo;
      const itemsText = ord.items.map(it => `• ${it.cantidad}x ${it.nombre} [COD: ${it.id}]`).join("\n");
      const message = `*Hola ${ord.clienteNombre}!* 👋\n\nEste es tu comprobante de compra de *${companyInfo?.name || "EcoModa Tienda"}*:\n\n*Pedido:* #${ord.id}\n*Fecha:* ${new Date(ord.fecha).toLocaleDateString()}\n\n*Detalle de compra:*\n${itemsText}\n\n*Método de pago:* ${ord.paymentMethod}\n*Monto Total:* *L. ${netTotal.toLocaleString()}*\n\n¡Muchas gracias por su preferencia! 💖`;
      const encodedText = encodeURIComponent(message);
      const phoneClean = ord.clienteTelefono.replace(/[^0-9]/g, "");
      const waUrl = `https://wa.me/${phoneClean}?text=${encodedText}`;
      window.open(waUrl, "_blank");
    } catch (err: any) {
      alert(`❌ Error al compartir por WhatsApp: ${err.message || err}`);
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

  const handleUserPhotoChange = async (e: React.ChangeEvent<HTMLInputElement>, user: User) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingUserId(user.idUsuario);
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
          throw new Error("No se pudo subir la foto de perfil.");
        }

        const data = await response.json();
        if (data.success && data.imageUrl) {
          // Update user photo field via PUT
          const putResponse = await fetch(`/api/users/${user.idUsuario}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...user, foto: data.imageUrl })
          });
          const putData = await putResponse.json();
          if (!putResponse.ok) {
            throw new Error(putData.error || "Error al actualizar la foto en la base de datos.");
          }
          if (putData.syncError) {
            alert(`⚠️ Sincronización fallida de Google Sheets:\n${putData.syncError}\n\nPero se actualizó localmente.`);
          } else {
            alert("¡Foto de perfil actualizada y sincronizada correctamente!");
          }
          setSelectedUserForUploader(null);
          await fetchUsers();
        }
      } catch (err: any) {
        console.error(err);
        alert(`Error al subir foto de perfil: ${err.message || err}`);
      } finally {
        setUploadingUserId(null);
      }
    };
  };

  // Safe Order Date Parsers and Memoizers
  const parseOrderDate = (dateStr: string): Date | null => {
    if (!dateStr) return null;
    if (dateStr.includes("-")) {
      const parts = dateStr.split("T")[0].split("-");
      if (parts.length === 3) {
        return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      }
    } else if (dateStr.includes("/")) {
      const parts = dateStr.split("/");
      if (parts.length === 3) {
        const d = parseInt(parts[0]);
        const m = parseInt(parts[1]);
        const y = parseInt(parts[2]);
        if (m <= 12) {
          return new Date(y, m - 1, d);
        } else {
          return new Date(y, d - 1, m);
        }
      }
    }
    const parsed = new Date(dateStr);
    return isNaN(parsed.getTime()) ? null : parsed;
  };

  const availableYears = React.useMemo(() => {
    const yearsSet = new Set<string>();
    orders.forEach(o => {
      const d = parseOrderDate(o.fecha);
      if (d) {
        yearsSet.add(d.getFullYear().toString());
      }
    });
    if (yearsSet.size === 0) {
      yearsSet.add(new Date().getFullYear().toString());
    }
    return Array.from(yearsSet).sort((a, b) => b.localeCompare(a));
  }, [orders]);

  // Dynamically Filtered Orders specifically for Dashboard charts and metrics
  const dashboardFilteredOrders = React.useMemo(() => {
    return orders.filter(o => {
      const d = parseOrderDate(o.fecha);
      if (!d) return true;
      const orderYear = d.getFullYear().toString();
      const orderMonth = (d.getMonth() + 1).toString().padStart(2, "0");

      if (selectedFilterYear !== "Todos" && orderYear !== selectedFilterYear) return false;
      if (selectedFilterMonth !== "Todos" && orderMonth !== selectedFilterMonth) return false;
      return true;
    });
  }, [orders, selectedFilterMonth, selectedFilterYear]);

  // Sliced Metric calculations
  const totalSalesNormal = dashboardFilteredOrders
    .filter(o => o.status !== "Cancelado")
    .reduce((sum, o) => sum + o.totalNormal, 0);

  const totalSalesNet = dashboardFilteredOrders
    .filter(o => o.status !== "Cancelado")
    .reduce((sum, o) => {
      const isDiscounted = o.paymentMethod !== "Tarjeta";
      return sum + (isDiscounted ? o.totalEfectivo : o.totalNormal);
    }, 0);

  const pendingOrders = dashboardFilteredOrders.filter(o => o.status === "Pendiente");
  const confirmedOrders = dashboardFilteredOrders.filter(o => o.status === "Confirmado" || o.status === "Enviado" || o.status === "Completado");
  const totalSavingsApplied = dashboardFilteredOrders
    .filter(o => o.status !== "Cancelado" && o.paymentMethod !== "Tarjeta")
    .reduce((sum, o) => sum + o.totalDescuento, 0);

  const stats = [
    { title: "Ventas Netas Filtradas", value: `L. ${totalSalesNet.toLocaleString()}`, description: `Pedidos según filtros activos`, icon: Coins, color: "text-emerald-600 bg-emerald-50" },
    { title: "Pedidos Registrados", value: dashboardFilteredOrders.length, description: `${pendingOrders.length} pendientes de confirmar`, icon: ShoppingBag, color: "text-blue-600 bg-blue-50" },
    { title: "Descuento Promocionado", value: `L. ${totalSavingsApplied.toLocaleString()}`, description: `Ahorros acumulados en físico`, icon: TrendingUp, color: "text-amber-600 bg-amber-50" },
    { title: "Artículos en Catálogo", value: products.length, description: `${products.filter(p => !p.visible).length} ocultos de la venta`, icon: Database, color: "text-teal-600 bg-teal-50" }
  ];

  // Complex Dashboard Chart Computations
  const chartData = React.useMemo(() => {
    const today = new Date();
    const todayDay = today.getDate();
    
    // 1. Month-over-Month (MoM) calculation
    const targetYr = selectedFilterYear !== "Todos" ? parseInt(selectedFilterYear) : today.getFullYear();
    const targetMth = selectedFilterMonth !== "Todos" ? parseInt(selectedFilterMonth) : (today.getMonth() + 1);
    
    let prevYr = targetYr;
    let prevMth = targetMth - 1;
    if (prevMth === 0) {
      prevMth = 12;
      prevYr = targetYr - 1;
    }

    let thisMonthToDateValue = 0;
    let prevMonthToDateValue = 0;

    orders.forEach(o => {
      if (o.status === "Cancelado") return;
      const d = parseOrderDate(o.fecha);
      if (!d) return;

      const yr = d.getFullYear();
      const mth = d.getMonth() + 1;
      const day = d.getDate();
      const isDiscounted = o.paymentMethod !== "Tarjeta";
      const netVal = isDiscounted ? o.totalEfectivo : o.totalNormal;

      // Current reference period to date comparison
      if (yr === targetYr && mth === targetMth) {
        if (day <= todayDay) {
          thisMonthToDateValue += netVal;
        }
      }

      // Previous period for comparison to date connection
      if (yr === prevYr && mth === prevMth) {
        if (day <= todayDay) {
          prevMonthToDateValue += netVal;
        }
      }
    });

    const momPercent = prevMonthToDateValue > 0 
      ? ((thisMonthToDateValue - prevMonthToDateValue) / prevMonthToDateValue) * 100 
      : 0;

    // 2. Monthly total sales for the selected year
    const monthlyList = Array.from({ length: 12 }, (_, index) => {
      const monthNum = index + 1;
      const label = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"][index];
      let totalAmount = 0;
      let totalCount = 0;

      orders.forEach(o => {
        if (o.status === "Cancelado") return;
        const d = parseOrderDate(o.fecha);
        if (!d) return;

        const yr = d.getFullYear().toString();
        const mth = d.getMonth() + 1;
        const isDiscounted = o.paymentMethod !== "Tarjeta";
        const netVal = isDiscounted ? o.totalEfectivo : o.totalNormal;

        if (selectedFilterYear === "Todos" || yr === selectedFilterYear) {
          if (mth === monthNum) {
            totalAmount += netVal;
            totalCount += 1;
          }
        }
      });

      return { label, monthNum, amount: totalAmount, count: totalCount };
    });

    // 3. Daily Sales for current selection
    const daysInMonth = 31;
    const dailyList = Array.from({ length: daysInMonth }, (_, index) => {
      const dayNum = index + 1;
      let totalAmount = 0;
      let totalCount = 0;

      orders.forEach(o => {
        if (o.status === "Cancelado") return;
        const d = parseOrderDate(o.fecha);
        if (!d) return;

        const orderDay = d.getDate();
        const orderMonth = (d.getMonth() + 1).toString().padStart(2, "0");
        const orderYear = d.getFullYear().toString();
        const isDiscounted = o.paymentMethod !== "Tarjeta";
        const netVal = isDiscounted ? o.totalEfectivo : o.totalNormal;

        const yearMatch = selectedFilterYear === "Todos" || orderYear === selectedFilterYear;
        const monthMatch = selectedFilterMonth === "Todos" || orderMonth === selectedFilterMonth;

        if (yearMatch && monthMatch && orderDay === dayNum) {
          totalAmount += netVal;
          totalCount += 1;
        }
      });

      return { dayNum, amount: totalAmount, count: totalCount };
    });

    // 4. Sales by product category
    const categoryMap: { [key: string]: { amount: number; qty: number } } = {};
    orders.forEach(o => {
      if (o.status === "Cancelado") return;
      const d = parseOrderDate(o.fecha);
      if (!d) return;

      const orderMonth = (d.getMonth() + 1).toString().padStart(2, "0");
      const orderYear = d.getFullYear().toString();

      const yearMatch = selectedFilterYear === "Todos" || orderYear === selectedFilterYear;
      const monthMatch = selectedFilterMonth === "Todos" || orderMonth === selectedFilterMonth;

      if (yearMatch && monthMatch) {
        o.items.forEach(it => {
          const cat = it.categoria || "Sin categoría";
          if (!categoryMap[cat]) {
            categoryMap[cat] = { amount: 0, qty: 0 };
          }
          const isDiscounted = o.paymentMethod !== "Tarjeta";
          const price = isDiscounted ? it.precioEfectivo : it.precioNormal;
          categoryMap[cat].amount += price * it.cantidad;
          categoryMap[cat].qty += it.cantidad;
        });
      }
    });

    const categoryList = Object.entries(categoryMap)
      .map(([name, data]) => ({
        name,
        amount: data.amount,
        qty: data.qty
      }))
      .sort((a, b) => b.qty - a.qty);

    return {
      mom: {
        thisMonthValue: thisMonthToDateValue,
        prevMonthValue: prevMonthToDateValue,
        percent: momPercent,
        dayLimit: todayDay,
        thisMonthLabel: ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"][targetMth - 1],
        prevMonthLabel: ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"][prevMth - 1]
      },
      monthly: monthlyList,
      daily: dailyList,
      categories: categoryList
    };
  }, [orders, selectedFilterMonth, selectedFilterYear]);

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
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <div>
                <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-emerald-600" />
                  Resumen del Negocio
                </h2>
                <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5">Filtros y métricas de desempeño comercial en tiempo real.</p>
              </div>
              
              {/* Compact Slicer Dropdowns */}
              <div className="flex items-center gap-2 w-full md:w-auto">
                <div className="flex-1 md:flex-initial">
                  <label className="block text-[9px] uppercase tracking-wider text-slate-400 font-bold mb-1">Año</label>
                  <select
                    value={selectedFilterYear}
                    onChange={(e) => setSelectedFilterYear(e.target.value)}
                    className="w-full bg-white border border-slate-200 text-slate-700 px-2.5 py-1.5 rounded-xl text-xs font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer shadow-3xs"
                  >
                    <option value="Todos">Todos</option>
                    {availableYears.map(yr => (
                      <option key={yr} value={yr}>{yr}</option>
                    ))}
                  </select>
                </div>
                
                <div className="flex-1 md:flex-initial">
                  <label className="block text-[9px] uppercase tracking-wider text-slate-400 font-bold mb-1">Mes</label>
                  <select
                    value={selectedFilterMonth}
                    onChange={(e) => setSelectedFilterMonth(e.target.value)}
                    className="w-full bg-white border border-slate-200 text-slate-700 px-2.5 py-1.5 rounded-xl text-xs font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer shadow-3xs"
                  >
                    <option value="Todos">Todos</option>
                    <option value="01">Enero</option>
                    <option value="02">Febrero</option>
                    <option value="03">Marzo</option>
                    <option value="04">Abril</option>
                    <option value="05">Mayo</option>
                    <option value="06">Junio</option>
                    <option value="07">Julio</option>
                    <option value="08">Agosto</option>
                    <option value="09">Septiembre</option>
                    <option value="10">Octubre</option>
                    <option value="11">Noviembre</option>
                    <option value="12">Diciembre</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Metric Bento Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 lg:gap-6">
              {stats.map((st, i) => (
                <div key={i} className="bg-white rounded-xl sm:rounded-2xl p-2.5 sm:p-4 lg:p-5 border border-slate-100 shadow-3xs flex items-center gap-2 sm:gap-4 hover:border-slate-200 transition-all">
                  <div className={`p-1.5 sm:p-3 rounded-lg sm:rounded-xl ${st.color} shrink-0`}>
                    <st.icon className="w-4 h-4 sm:w-6 h-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="block text-[8px] sm:text-[11px] uppercase tracking-wider font-bold text-slate-400 truncate">{st.title}</span>
                    <strong className="block text-sm sm:text-xl font-black text-slate-900 leading-tight mt-0.5 truncate">{st.value}</strong>
                    <span className="hidden sm:block text-[10px] text-slate-500 mt-1 leading-tight truncate">{st.description}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Row 1: MoM Comparison & Category Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-6">
              {/* MoM Comparison Card */}
              <div className="lg:col-span-5 bg-white rounded-xl sm:rounded-3xl border border-slate-100 shadow-xs p-3.5 sm:p-6 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-center">
                    <h3 className="font-bold text-slate-900 text-xs sm:text-sm">Comparativo MoM (Mes vs Anterior)</h3>
                    <span className="text-[8px] sm:text-[9px] bg-slate-100 px-2 py-0.5 rounded-full font-mono text-slate-600">Al día {chartData.mom.dayLimit}</span>
                  </div>
                  <p className="text-[9px] sm:text-[10px] text-slate-400 mb-4">Acumulado Neto actual vs el mismo día del mes inmediato anterior.</p>
                </div>

                <div className="space-y-4">
                  {/* Values Side by Side */}
                  <div className="grid grid-cols-2 gap-2 border-b border-slate-50 pb-4">
                    <div className="space-y-1">
                      <span className="text-[9px] text-slate-400 font-bold uppercase">{chartData.mom.thisMonthLabel || "Ref."}</span>
                      <p className="text-sm sm:text-base font-black text-slate-900 leading-tight">
                        L. {chartData.mom.thisMonthValue.toLocaleString()}
                      </p>
                      <span className="text-[8px] text-slate-400">1 al {chartData.mom.dayLimit}</span>
                    </div>

                    <div className="space-y-1 border-l border-slate-100 pl-4 font-sans">
                      <span className="text-[9px] text-slate-400 font-bold uppercase">{chartData.mom.prevMonthLabel || "Prev."}</span>
                      <p className="text-sm sm:text-base font-black text-slate-500 leading-tight">
                        L. {chartData.mom.prevMonthValue.toLocaleString()}
                      </p>
                      <span className="text-[8px] text-slate-400">1 al {chartData.mom.dayLimit}</span>
                    </div>
                  </div>

                  {/* Growth stats */}
                  <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl">
                    <span className="text-[10px] font-bold text-slate-550">Resultado del Desempeño:</span>
                    <span className={`text-[11px] font-black px-2 py-0.5 rounded-md flex items-center gap-0.5 ${
                      chartData.mom.percent >= 0 
                        ? "bg-emerald-50 text-emerald-700" 
                        : "bg-rose-50 text-rose-700"
                    }`}>
                      {chartData.mom.percent >= 0 ? "+" : ""}
                      {chartData.mom.percent.toFixed(1)}% MoM
                    </span>
                  </div>

                  {/* Visual comparison progress indicator */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between text-[9px] font-bold text-slate-400">
                      <span>Proporción de Venta</span>
                      <span>{chartData.mom.thisMonthValue >= chartData.mom.prevMonthValue ? "Crecimiento alcanzado" : "Debajo del mes anterior"}</span>
                    </div>
                    <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden flex">
                      {(() => {
                        const total = (chartData.mom.thisMonthValue + chartData.mom.prevMonthValue) || 1;
                        const thisPct = (chartData.mom.thisMonthValue / total) * 100;
                        const prevPct = (chartData.mom.prevMonthValue / total) * 100;
                        return (
                          <>
                            <div className="bg-emerald-500 h-full transition-all" style={{ width: `${thisPct}%` }} title="Ref." />
                            <div className="bg-slate-300 h-full transition-all" style={{ width: `${prevPct}%` }} title="Prev." />
                          </>
                        );
                      })()}
                    </div>
                    <div className="flex justify-between text-[8px] text-slate-400 font-mono">
                      <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-emerald-500" /> {chartData.mom.thisMonthLabel}: {(chartData.mom.thisMonthValue / ((chartData.mom.thisMonthValue + chartData.mom.prevMonthValue) || 1) * 100).toFixed(0)}%</span>
                      <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-slate-350" /> {chartData.mom.prevMonthLabel}: {(chartData.mom.prevMonthValue / ((chartData.mom.thisMonthValue + chartData.mom.prevMonthValue) || 1) * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Categorías más vendidas (7 Cols) */}
              <div className="lg:col-span-7 bg-white rounded-xl sm:rounded-3xl border border-slate-100 shadow-xs p-3.5 sm:p-6 flex flex-col justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 text-xs sm:text-sm">Ventas por Categoría (Cantidad y Monto)</h3>
                  <p className="text-[9px] sm:text-[10px] text-slate-400 mb-4">Suma de prendas vendidas y el valor acumulado asignado.</p>
                </div>

                <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                  {chartData.categories.length === 0 ? (
                    <div className="py-12 text-center text-slate-400 text-xs">
                      No hay ventas de categorías registradas para el rango seleccionado.
                    </div>
                  ) : (
                    (() => {
                      const maxQty = Math.max(...chartData.categories.map(c => c.qty), 1);
                      const maxAmount = Math.max(...chartData.categories.map(c => c.amount), 1);

                      return chartData.categories.map((c, idx) => {
                        const qtyPct = Math.round((c.qty / maxQty) * 100);
                        const amtPct = Math.round((c.amount / maxAmount) * 100);
                        return (
                          <div key={idx} className="bg-slate-50/50 hover:bg-slate-50 p-2 sm:p-3 rounded-xl border border-slate-100/50 space-y-1.5 transition-colors">
                            <div className="flex justify-between items-center text-[10px] sm:text-xs">
                              <span className="font-bold text-slate-800 flex items-center gap-1">
                                <span className="size-2 rounded-full bg-emerald-500" />
                                {c.name}
                              </span>
                              <div className="flex items-center gap-3 text-[10px] font-mono">
                                <span className="text-emerald-700 font-bold">{c.qty} piezas</span>
                                <span className="text-indigo-700 font-bold">L. {c.amount.toLocaleString()}</span>
                              </div>
                            </div>
                            
                            {/* Double sub-bar indicator */}
                            <div className="space-y-1">
                              {/* Quantity Share */}
                              <div className="flex items-center gap-1.5">
                                <span className="text-[8px] text-slate-405 text-slate-400 font-bold shrink-0 w-8">Cant:</span>
                                <div className="h-1.5 flex-1 bg-slate-100 rounded-full overflow-hidden">
                                  <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${qtyPct}%` }} />
                                </div>
                              </div>
                              {/* Amount Share */}
                              <div className="flex items-center gap-1.5">
                                <span className="text-[8px] text-slate-405 text-slate-400 font-bold shrink-0 w-8">Monto:</span>
                                <div className="h-1.5 flex-1 bg-slate-100 rounded-full overflow-hidden">
                                  <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${amtPct}%` }} />
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      });
                    })()
                  )}
                </div>
              </div>
            </div>

            {/* Row 2: Monthly Sales Chart & Daily Sales Scroll Chart */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-6">
              {/* Monthly sales total */}
              <div className="bg-white rounded-xl sm:rounded-3xl border border-slate-100 shadow-xs p-3.5 sm:p-6 flex flex-col justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 text-xs sm:text-sm">Ventas Mensuales Totales ({selectedFilterYear === "Todos" ? "Histórico" : selectedFilterYear})</h3>
                  <p className="text-[9px] sm:text-[10px] text-slate-400 mb-4">Montos de venta netos facturados por cada mes.</p>
                </div>

                <div className="h-40 sm:h-52 flex items-end gap-1.5 sm:gap-3.5 pt-4 px-2 border-b border-l border-slate-100">
                  {(() => {
                    const maxAmount = Math.max(...chartData.monthly.map(m => m.amount), 1);
                    return chartData.monthly.map((m, idx) => {
                      const pct = (m.amount / maxAmount) * 100;
                      return (
                        <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end group relative">
                          {/* Tooltip */}
                          <div className="absolute bottom-full mb-1 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-[9px] p-1.5 rounded-lg pointer-events-none whitespace-nowrap z-10 shadow-lg text-center leading-tight">
                            <p className="font-extrabold">{m.label}</p>
                            <p>L. {m.amount.toLocaleString()}</p>
                            <p className="text-[8px] text-slate-400">{m.count} pedidos</p>
                          </div>
                          
                          {/* Bar */}
                          <div className="w-full bg-slate-50 hover:bg-emerald-50 rounded-t-md flex items-end justify-center transition-all h-full">
                            <div 
                              className={`w-full rounded-t-md transition-all duration-700 ${
                                m.amount > 0 ? "bg-emerald-600 group-hover:bg-emerald-500" : "bg-slate-100"
                              }`}
                              style={{ height: m.amount > 0 ? `${Math.max(pct, 5)}%` : "2%" }}
                            />
                          </div>

                          {/* Month Label */}
                          <span className="text-[8px] sm:text-[10px] font-bold text-slate-400 mt-2 block">{m.label}</span>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>

              {/* Daily Sales Trend for selected Month */}
              <div className="bg-white rounded-xl sm:rounded-3xl border border-slate-100 shadow-xs p-3.5 sm:p-6 flex flex-col justify-between">
                <div>
                  <h3 className="font-bold text-slate-905 text-xs sm:text-sm">Ventas Diarias Activas ({selectedFilterMonth === "Todos" ? "Todo el Mes" : `Mes: ${selectedFilterMonth}`})</h3>
                  <p className="text-[9px] sm:text-[10px] text-slate-400 mb-4">Comportamiento de venta día a día. Desliza horizontalmente si es necesario.</p>
                </div>

                <div className="overflow-x-auto pb-2 scrollbar-thin">
                  <div className="h-40 sm:h-52 flex items-end gap-1.5 sm:gap-2.5 pt-4 px-2 border-b border-l border-slate-100 min-w-[500px]">
                    {(() => {
                      const maxAmount = Math.max(...chartData.daily.map(d => d.amount), 1);
                      return chartData.daily.map((d, idx) => {
                        const pct = (d.amount / maxAmount) * 100;
                        const isToday = new Date().getDate() === d.dayNum && selectedFilterMonth === (new Date().getMonth() + 1).toString().padStart(2, "0");
                        
                        return (
                          <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end group relative min-w-[12px]">
                            {/* Tooltip */}
                            <div className="absolute bottom-full mb-1 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-[9px] p-1.5 rounded-lg pointer-events-none whitespace-nowrap z-10 shadow-lg text-center leading-tight">
                              <p className="font-extrabold font-sans">Día {d.dayNum}</p>
                              <p>L. {d.amount.toLocaleString()}</p>
                              <p className="text-[8px] text-slate-400">{d.count} pedidos</p>
                            </div>
                            
                            {/* Bar */}
                            <div className={`w-full rounded-t-xs hover:bg-slate-100 flex items-end justify-center transition-all h-full ${isToday ? "bg-amber-50/50" : ""}`}>
                              <div 
                                className={`w-full rounded-t-xs transition-all duration-700 ${
                                  isToday ? "bg-amber-500" : d.amount > 0 ? "bg-indigo-600 group-hover:bg-indigo-500" : "bg-slate-100"
                                }`}
                                style={{ height: d.amount > 0 ? `${Math.max(pct, 5)}%` : "2%" }}
                              />
                            </div>

                            {/* Day Number Label */}
                            <span className={`text-[8px] font-bold mt-2 block ${isToday ? "text-amber-600 font-extrabold underline animate-pulse" : "text-slate-400"}`}>
                              {d.dayNum}
                            </span>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              </div>
            </div>

            {/* Row 3: Status Distribution & Seller Performance */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-6">
              {/* Chart 1: Progresión de Pedidos & Estado */}
              <div className="bg-white rounded-xl sm:rounded-3xl border border-slate-100 shadow-xs p-3.5 sm:p-6 flex flex-col justify-between">
                <div>
                  <h3 className="font-bold text-slate-905 text-xs sm:text-sm mb-0.5 sm:mb-1">Distribución por Estado de Pedidos</h3>
                  <p className="text-[9px] sm:text-[10px] text-slate-405 text-slate-400 mb-2 sm:mb-4">Relación porcentual sobre órdenes bajo el filtro activo.</p>
                </div>
                
                <div className="space-y-2 sm:space-y-3.5">
                  {[
                    { label: "Pendiente", count: dashboardFilteredOrders.filter(o => o.status === "Pendiente").length, color: "bg-amber-500" },
                    { label: "Confirmado", count: dashboardFilteredOrders.filter(o => o.status === "Confirmado").length, color: "bg-blue-500" },
                    { label: "Enviado", count: dashboardFilteredOrders.filter(o => o.status === "Enviado").length, color: "bg-cyan-500" },
                    { label: "Completado", count: dashboardFilteredOrders.filter(o => o.status === "Completado").length, color: "bg-emerald-500" },
                    { label: "Cancelado", count: dashboardFilteredOrders.filter(o => o.status === "Cancelado").length, color: "bg-rose-500" },
                  ].map((st, idx) => {
                    const total = dashboardFilteredOrders.length || 1;
                    const pct = Math.round((st.count / total) * 100);
                    return (
                      <div key={idx} className="space-y-0.5 sm:space-y-1">
                        <div className="flex justify-between items-center text-[10px] sm:text-xs font-semibold">
                          <span className="text-slate-600 flex items-center gap-1 sm:gap-1.5">
                            <span className={`size-1.5 sm:size-2 rounded-full ${st.color}`} />
                            {st.label}
                          </span>
                          <span className="text-slate-900 font-mono font-bold">
                            {st.count} un. <span className="text-[9px] sm:text-[10px] text-slate-400 font-normal">({pct}%)</span>
                          </span>
                        </div>
                        <div className="h-1.5 sm:h-2 w-full bg-slate-50 rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${st.color} rounded-full transition-all duration-500`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Chart 2: Rendimiento de Vendedores */}
              <div className="bg-white rounded-xl sm:rounded-3xl border border-slate-100 shadow-xs p-3.5 sm:p-6 flex flex-col justify-between">
                <div>
                  <h3 className="font-bold text-slate-905 text-xs sm:text-sm mb-0.5 sm:mb-1">Órdenes por Vendedor</h3>
                  <p className="text-[9px] sm:text-[10px] text-slate-400 mb-2 sm:mb-4">Asignación y productividad actual en el rango activo.</p>
                </div>

                <div className="space-y-2 sm:space-y-3.5 max-h-[160px] sm:max-h-[260px] overflow-y-auto pr-1">
                  {(() => {
                    const sellerCounts: { [key: string]: number } = {};
                    dashboardFilteredOrders.forEach(o => {
                      const v = o.usuarioVendedor || "Web Checkout";
                      sellerCounts[v] = (sellerCounts[v] || 0) + 1;
                    });
                    
                    const sellerData = Object.entries(sellerCounts)
                      .map(([name, count]) => ({ name, count }))
                      .sort((a, b) => b.count - a.count);

                    if (sellerData.length === 0) {
                      return (
                        <div className="py-4 text-center text-slate-400 text-xs">
                          No hay asignaciones de vendedores registradas.
                        </div>
                      );
                    }

                    const maxCount = Math.max(...sellerData.map(d => d.count), 1);

                    return sellerData.map((s, idx) => {
                      const pct = Math.round((s.count / maxCount) * 100);
                      return (
                        <div key={idx} className="space-y-0.5 sm:space-y-1">
                          <div className="flex justify-between items-center text-[10px] sm:text-xs font-semibold">
                            <span className="text-slate-700 flex items-center gap-1 font-sans truncate pr-2">
                              👤 {s.name}
                            </span>
                            <span className="font-mono text-slate-900 shrink-0 font-bold">
                              {s.count} {s.count === 1 ? "pedido" : "pedidos"}
                            </span>
                          </div>
                          <div className="h-1.5 sm:h-2 w-full bg-slate-50 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-emerald-600 rounded-full transition-all duration-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
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
                <div className="space-y-4">
                  {/* Desktop view: Columns & Rows Table */}
                  <div className="hidden md:block overflow-x-auto">
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

                  {/* Mobile view: Catalog card-style grid layout */}
                  <div className="grid grid-cols-2 md:hidden gap-3">
                    {pendingOrders.map((ord) => {
                      const netTotal = ord.paymentMethod === "Tarjeta" ? ord.totalNormal : ord.totalEfectivo;
                      return (
                        <div 
                          key={ord.id} 
                          className="group bg-white rounded-2xl overflow-hidden shadow-xs hover:shadow-md border border-slate-150 hover:border-slate-200 flex flex-col transition-all duration-300 relative"
                        >
                          {/* Payment method badge */}
                          <div className="absolute top-2 left-2 z-10">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider bg-white/95 backdrop-blur-3xs shadow-xs border ${
                              ord.paymentMethod === "Tarjeta" ? "text-slate-700 border-slate-200" : "text-emerald-700 border-emerald-100"
                            }`}>
                              <span className={`size-1.5 rounded-full ${ord.paymentMethod === "Tarjeta" ? "bg-slate-400" : "bg-emerald-500 animate-pulse"}`} />
                              {ord.paymentMethod}
                            </span>
                          </div>

                          {/* Avatar icon display */}
                          <div className="aspect-square bg-slate-100 overflow-hidden relative flex items-center justify-center border-b border-slate-100">
                            <div className="w-full h-full bg-slate-900 text-emerald-400 flex flex-col items-center justify-center font-black text-lg uppercase gap-1">
                              <Inbox className="w-8 h-8 text-emerald-400" />
                              <span className="text-[9px] text-slate-405 font-mono font-bold tracking-wider uppercase">Pendiente</span>
                            </div>
                          </div>

                          {/* Card Content details */}
                          <div className="p-2.5 flex-1 flex flex-col justify-between gap-2 text-left">
                            <div className="space-y-1">
                              <h4 className="font-bold text-slate-800 text-xs leading-snug line-clamp-2">{ord.clienteNombre}</h4>
                              <div className="text-[9px] text-slate-400 font-mono">
                                COD: <span className="font-bold text-slate-500">{ord.id}</span>
                              </div>
                            </div>

                            {/* Details (Total y Fecha) */}
                            <div className="space-y-1.5 border-t border-slate-100 pt-1.5 text-xs">
                              <div className="flex justify-between items-center text-[10px]">
                                <span className="text-slate-400 font-semibold">Fecha:</span>
                                <span className="text-slate-600 font-bold font-mono">{new Date(ord.fecha).toLocaleDateString()}</span>
                              </div>
                              <div className="bg-slate-50 p-1.5 rounded-md border border-slate-100 space-y-0.5 text-right shrink-0">
                                <p className="text-[9px] text-slate-400 line-through">L. {ord.totalNormal.toLocaleString()}</p>
                                <strong className="text-emerald-700 font-black text-[11px] block">L. {netTotal.toLocaleString()}</strong>
                              </div>
                            </div>

                            {/* Actions Footer */}
                            <div className="grid grid-cols-1 gap-1 border-t border-slate-100 pt-2 shrink-0">
                              <button
                                onClick={() => setActiveTab("orders")}
                                className="w-full py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[9.5px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                              >
                                Administrar Order
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
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
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
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
                <button
                  type="button"
                  onClick={() => setIsManualOrderModalOpen(true)}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Generar Orden
                </button>
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

                        <button
                          type="button"
                          onClick={() => handleEditOrderOpen(ord)}
                          className="w-full mt-3 py-2 bg-slate-950 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-3xs transition-all"
                        >
                          <Edit className="w-3.5 h-3.5 text-emerald-400" />
                          Modificar Orden
                        </button>

                        {/* Factura & Compartir Comprobante Action */}
                        <div className="w-full mt-4 pt-4 border-t border-slate-100 space-y-1.5">
                          <div className="flex justify-between items-center">
                            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                              Comprobante
                            </span>
                            {ord.status === "Completado" && (
                              <span className="bg-emerald-100 text-emerald-800 text-[9px] font-extrabold px-1.5 py-0.5 rounded-sm animate-pulse">
                                ✨ COMPLETADO
                              </span>
                            )}
                          </div>
                          
                          <div className="grid grid-cols-2 gap-1.5 w-full">
                            <button
                              type="button"
                              onClick={() => handleGenerateInvoicePDF(ord)}
                              className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg text-xs font-bold shadow-3xs cursor-pointer transition-all ${
                                ord.status === "Completado"
                                  ? "bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-700"
                                  : "bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200"
                              }`}
                              title="Descargar Factura PDF"
                            >
                              <FileText className="w-3.5 h-3.5 shrink-0" />
                              Factura
                            </button>

                            <button
                              type="button"
                              onClick={() => handleShareWhatsApp(ord)}
                              className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg text-xs font-bold shadow-3xs cursor-pointer transition-all ${
                                ord.status === "Completado"
                                  ? "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200"
                                  : "bg-slate-50 hover:bg-slate-100 text-slate-650 border border-slate-200"
                              }`}
                              title="Compartir por WhatsApp"
                            >
                              <Share2 className="w-3.5 h-3.5 shrink-0 text-emerald-500" />
                              WhatsApp
                            </button>
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
              <div className="flex gap-2 flex-wrap sm:flex-nowrap">
                <button
                  type="button"
                  onClick={() => document.getElementById("excel-bulk-import-input")?.click()}
                  disabled={importingExcel}
                  className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-3xs cursor-pointer disabled:opacity-50"
                >
                  <Upload className={`w-3.5 h-3.5 text-emerald-600 ${importingExcel ? "animate-bounce" : ""}`} />
                  {importingExcel ? "Importando..." : "Importar Excel"}
                </button>
                <input
                  id="excel-bulk-import-input"
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={handleExcelImport}
                />

                <button
                  type="button"
                  onClick={handleExcelExport}
                  className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-3xs cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-blue-600" />
                  Exportar Excel
                </button>

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
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-xs cursor-pointer whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Agregar Producto
                </button>
              </div>
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
                <div className="space-y-4">
                  {/* Desktop view: Columns & Rows Table */}
                  <div className="hidden md:block overflow-x-auto">
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

                  {/* Mobile view: Catalog card-style grid layout */}
                  <div className="grid grid-cols-2 md:hidden gap-3">
                    {filteredProducts.map((p) => {
                      const isOutOfStock = p.stock <= 0;
                      return (
                        <div 
                          key={p.id} 
                          className="group bg-white rounded-2xl overflow-hidden shadow-xs hover:shadow-md border border-slate-150 hover:border-slate-200 flex flex-col transition-all duration-300 relative"
                        >
                          {/* Visibility & Stock Badge */}
                          <div className="absolute top-2 left-2 z-10 flex flex-col gap-1">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8.5px] font-black uppercase tracking-wider bg-white/95 backdrop-blur-3xs shadow-xs border ${
                              p.visible ? "text-emerald-700 border-emerald-100" : "text-slate-550 border-slate-200"
                            }`}>
                              <span className={`size-1.5 rounded-full ${p.visible ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`} />
                              {p.visible ? "Visible" : "Oculto"}
                            </span>
                            {isOutOfStock && (
                              <span className="bg-rose-600 text-white text-[8px] uppercase font-black px-1.5 py-0.5 rounded-sm shadow-xs block text-center">
                                Agotado
                              </span>
                            )}
                          </div>

                          {/* Image Box */}
                          <div className="aspect-square bg-slate-100 overflow-hidden relative border-b border-slate-100 flex items-center justify-center">
                            {p.imagen ? (
                              <img
                                src={p.imagen}
                                alt={p.nombre}
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                onError={(e) => {
                                  (e.currentTarget as HTMLImageElement).src = "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=500&q=80";
                                }}
                              />
                            ) : (
                              <div className="w-full h-full bg-slate-900 text-emerald-400 flex flex-col items-center justify-center font-black text-sm uppercase gap-1">
                                <span>No Foto</span>
                              </div>
                            )}
                          </div>

                          {/* Card Content Details */}
                          <div className="p-2.5 flex-1 flex flex-col justify-between gap-2 text-left">
                            <div className="space-y-1">
                              <h4 className="font-bold text-slate-800 text-xs leading-snug line-clamp-2">{p.nombre}</h4>
                              <div className="text-[9px] text-slate-400 font-mono">
                                COD: <span className="font-bold text-slate-500">{p.id}</span>
                              </div>
                            </div>

                            {/* Details (Stock & Prices) */}
                            <div className="space-y-1.5 border-t border-slate-100 pt-1.5 text-xs">
                              <div className="flex justify-between items-center text-[10px]">
                                <span className="text-slate-400 font-semibold">Stock:</span>
                                <span className={`${isOutOfStock ? "text-rose-600 font-black" : "text-slate-700 font-bold"} font-mono`}>{p.stock} pzas.</span>
                              </div>
                              <div className="bg-slate-50 p-1.5 rounded-md border border-slate-100 space-y-0.5 text-right shrink-0">
                                <p className="text-[9px] text-slate-450 line-through">L. {p.precioNormal.toLocaleString()}</p>
                                <strong className="text-emerald-700 font-black text-[11px] block">L. {p.precioEfectivo.toLocaleString()}</strong>
                              </div>
                            </div>

                            {/* Quick Actions Footer - 4 grid columns: Toggle, Upload, Edit, Delete */}
                            <div className="grid grid-cols-4 gap-1 border-t border-slate-100 pt-2 shrink-0">
                              {/* Toggle Visibility */}
                              <button
                                onClick={() => onUpdateProductOverride(p.id, "visible", !p.visible)}
                                className={`p-1.5 rounded-lg flex flex-col items-center justify-center transition-all cursor-pointer border ${
                                  p.visible 
                                    ? "bg-emerald-50 hover:bg-emerald-100/80 text-emerald-700 border-emerald-100" 
                                    : "bg-slate-50 hover:bg-slate-100 text-slate-550 border-slate-200"
                                }`}
                                title={p.visible ? "Ocultar Prenda" : "Mostrar Prenda"}
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                              </button>

                              {/* Upload Photo Button */}
                              <button
                                onClick={() => setSelectedProductForUploader(p)}
                                className="p-1.5 bg-slate-900 hover:bg-slate-800 text-white border border-slate-950 rounded-lg flex flex-col items-center justify-center transition-all cursor-pointer"
                                title="Subir foto"
                              >
                                <Upload className="w-3.5 h-3.5 text-emerald-400" />
                              </button>

                              {/* Editar Button */}
                              <button
                                onClick={() => openEditModal("product", p)}
                                className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg flex flex-col items-center justify-center transition-all cursor-pointer"
                                title="Editar"
                              >
                                <Edit className="w-3.5 h-3.5 text-indigo-600" />
                              </button>

                              {/* Eliminar Button */}
                              <button
                                onClick={() => handleDeleteItem("product", p.id)}
                                className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-100 rounded-lg flex flex-col items-center justify-center transition-all cursor-pointer"
                                title="Eliminar"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
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
    
    if (action === "deleteRow") {
      var keyColumnIndex = params.keyColumnIndex;
      var keyValue = params.keyValue;
      
      var range = sheet.getDataRange();
      var values = range.getValues();
      var deletedCount = 0;
      
      for (var i = values.length - 1; i >= 1; i--) {
        if (String(values[i][keyColumnIndex]).trim() === String(keyValue).trim()) {
          sheet.deleteRow(i + 1);
          deletedCount++;
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ success: true, deletedCount: deletedCount }))
                           .setMimeType(ContentService.MimeType.JSON);
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
              <div className="space-y-4">
                {/* Desktop view: Columns & Rows Table */}
                <div className="hidden md:block bg-white rounded-3xl border border-slate-150 shadow-xs overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-150 text-slate-500 text-[11px] font-black tracking-wider uppercase">
                          <th className="py-3 px-4">Foto</th>
                          <th className="py-3 px-4">ID Usuario</th>
                          <th className="py-3 px-4">Nombre / Rol</th>
                          <th className="py-3 px-4">Contacto / WhatsApp</th>
                          <th className="py-3 px-4">Credenciales / Correo</th>
                          <th className="py-3 px-4">Estado</th>
                          <th className="py-3 px-4">Último Acceso</th>
                          <th className="py-3 px-4 text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {syncedUsers.map((u) => {
                          const isActive = u.estadoPerfil?.toLowerCase() === "activo";
                          return (
                            <tr key={u.idUsuario} className="hover:bg-slate-50/50 transition-colors">
                              {/* Photo Column */}
                              <td className="py-3 px-4">
                                {u.foto ? (
                                  <img 
                                    referrerPolicy="no-referrer" 
                                    src={u.foto} 
                                    alt={u.nombre} 
                                    className="w-10 h-10 rounded-xl object-cover border border-slate-200 shadow-xs shrink-0" 
                                  />
                                ) : (
                                  <div className="w-10 h-10 rounded-xl bg-slate-900 text-emerald-400 flex items-center justify-center font-black text-xs shrink-0 uppercase">
                                    {u.nombre.slice(0, 2)}
                                  </div>
                                )}
                              </td>

                              {/* ID Column */}
                              <td className="py-3 px-4 font-mono text-[11px] font-bold text-slate-400">
                                {u.idUsuario}
                              </td>

                              {/* Name / Role */}
                              <td className="py-3 px-4">
                                <div className="font-extrabold text-slate-800 leading-tight">{u.nombre}</div>
                                <span className="inline-block bg-slate-100 text-slate-600 text-[9px] font-black px-1.5 py-0.5 rounded-sm uppercase mt-1 tracking-wide">
                                  {u.rol || "Vendedor"}
                                </span>
                              </td>

                              {/* Contact / WhatsApp */}
                              <td className="py-3 px-4">
                                <div className="font-semibold text-slate-700">
                                  +{u.prefijoPais || "504"} {u.contacto || "N/A"}
                                </div>
                                {u.contacto && (
                                  <a 
                                    href={`https://wa.me/${(u.prefijoPais || "504") + u.contacto.replace(/\s|-/g, "")}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 text-[10px] text-emerald-600 hover:text-emerald-700 font-bold mt-1"
                                  >
                                    <span>Enviar WhatsApp</span> 💬
                                  </a>
                                )}
                              </td>

                              {/* Credentials */}
                              <td className="py-3 px-4 space-y-1">
                                <div className="font-medium text-slate-500 max-w-[170px] truncate" title={u.correo}>
                                  {u.correo}
                                </div>
                                <div className="font-mono text-[10px] text-slate-400 tracking-wide bg-slate-50 px-1.5 py-0.5 rounded-sm border border-slate-100/60 inline-block font-semibold">
                                  {u.password || "••••••••"}
                                </div>
                              </td>

                              {/* Status */}
                              <td className="py-3 px-4">
                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                  isActive ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-600"
                                }`}>
                                  <span className={`size-1.5 rounded-full ${isActive ? "bg-emerald-500 animate-pulse" : "bg-rose-400"}`} />
                                  {u.estadoPerfil || "Inactivo"}
                                </span>
                              </td>

                              {/* Last Access */}
                              <td className="py-3 px-4 text-slate-500 font-mono text-[10px]">
                                {u.ultimoAcceso || "Sin accesos"}
                              </td>

                              {/* Actions */}
                              <td className="py-3 px-4 text-right">
                                <div className="flex gap-1 justify-end">
                                  {/* Subir foto Perfil Action */}
                                  <button
                                    onClick={() => setSelectedUserForUploader(u)}
                                    className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold transition-all cursor-pointer border border-emerald-100/60"
                                    title="Subir foto de perfil"
                                  >
                                    <Camera className="w-3.5 h-3.5" />
                                  </button>
                                  {/* Editar Action */}
                                  <button
                                    onClick={() => openEditModal("user", u)}
                                    className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-bold transition-all cursor-pointer border border-slate-200"
                                    title="Editar usuario"
                                  >
                                    <Edit className="w-3.5 h-3.5 text-indigo-650" />
                                  </button>
                                  {/* Borrar Action */}
                                  <button
                                    onClick={() => handleDeleteItem("user", u.idUsuario)}
                                    className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-bold cursor-pointer transition-all border border-rose-100"
                                    title="Eliminar usuario"
                                  >
                                    <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Mobile view: Catalog card-style grid layout */}
                <div className="grid grid-cols-2 md:hidden gap-3">
                  {syncedUsers.map((u) => {
                    const isActive = u.estadoPerfil?.toLowerCase() === "activo";
                    return (
                      <div 
                        key={u.idUsuario} 
                        className="group bg-white rounded-2xl overflow-hidden shadow-xs hover:shadow-md border border-slate-150 hover:border-slate-200 flex flex-col transition-all duration-300 relative"
                      >
                        {/* Status Label */}
                        <div className="absolute top-2 left-2 z-10 flex items-center gap-1 bg-white/95 backdrop-blur-3xs px-2 py-0.5 rounded-full shadow-xs border border-slate-100">
                          <span className={`size-1.5 rounded-full ${isActive ? "bg-emerald-500 animate-pulse" : "bg-rose-400"}`} />
                          <span className={`text-[8px] font-black uppercase tracking-wider ${isActive ? "text-emerald-700" : "text-rose-600"}`}>
                            {u.estadoPerfil || "Inactivo"}
                          </span>
                        </div>

                        {/* Image aspect box */}
                        <div className="aspect-square bg-slate-100 overflow-hidden relative flex items-center justify-center border-b border-slate-100">
                          {u.foto ? (
                            <img 
                              referrerPolicy="no-referrer" 
                              src={u.foto} 
                              alt={u.nombre} 
                              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
                            />
                          ) : (
                            <div className="w-full h-full bg-slate-900 text-emerald-400 flex flex-col items-center justify-center font-black text-lg uppercase gap-1">
                              {u.nombre.slice(0, 2)}
                              <span className="text-[9px] text-slate-400 font-mono font-normal normal-case">Sin Foto</span>
                            </div>
                          )}
                        </div>

                        {/* Card Info Details */}
                        <div className="p-2.5 flex-1 flex flex-col justify-between gap-2">
                          <div className="space-y-1">
                            <span className="inline-block bg-slate-150 text-slate-700 text-[8px] font-black px-1.5 py-0.5 rounded-xs uppercase tracking-wide">
                              {u.rol || "Vendedor"}
                            </span>
                            <h4 className="font-bold text-slate-800 text-xs leading-snug line-clamp-2">{u.nombre}</h4>
                            <div className="text-[9px] text-slate-400 font-mono truncate">
                              ID: <span className="font-bold text-slate-500">{u.idUsuario}</span>
                            </div>
                          </div>

                          <div className="space-y-1 border-t border-slate-100 pt-1.5 text-[9px] text-slate-550 leading-tight">
                            <div className="truncate font-semibold text-slate-700">
                              ✉️ {u.correo}
                            </div>
                            <div className="flex justify-between items-center bg-slate-50 p-1 rounded-sm border border-slate-100 font-mono text-[8px] mt-0.5">
                              <span>Pass:</span>
                              <span className="font-bold text-slate-700">{u.password || "••••"}</span>
                            </div>
                            {u.contacto && (
                              <a 
                                href={`https://wa.me/${(u.prefijoPais || "504") + u.contacto.replace(/\s|-/g, "")}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-0.5 text-[8.5px] text-emerald-600 hover:text-emerald-700 font-black mt-2"
                              >
                                <span>WhatsApp: {u.contacto}</span> 💬
                              </a>
                            )}
                          </div>

                          {/* Quick Actions Footer with icons / smaller labels */}
                          <div className="grid grid-cols-3 gap-1 border-t border-slate-100 pt-2 shrink-0">
                            <button
                              onClick={() => setSelectedUserForUploader(u)}
                              className="py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer border border-emerald-100/60"
                              title="Subir foto de perfil"
                            >
                              <Camera className="w-3.5 h-3.5" />
                              <span className="text-[8px] font-bold">Foto</span>
                            </button>
                            <button
                              onClick={() => openEditModal("user", u)}
                              className="py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer border border-slate-200"
                              title="Editar"
                            >
                              <Edit className="w-3.5 h-3.5 text-indigo-650" />
                              <span className="text-[8px] font-bold">Editar</span>
                            </button>
                            <button
                              onClick={() => handleDeleteItem("user", u.idUsuario)}
                              className="py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer border border-rose-100"
                              title="Eliminar"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                              <span className="text-[8px] font-bold">Borrar</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
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
              <div className="space-y-4">
                {/* Desktop view: Columns & Rows Table */}
                <div className="hidden md:block bg-white border border-slate-150 rounded-3xl overflow-hidden shadow-xs">
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

                {/* Mobile view: Catalog card-style grid layout */}
                <div className="grid grid-cols-2 md:hidden gap-3">
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
                    .map((c) => {
                      return (
                        <div 
                          key={c.id} 
                          className="group bg-white rounded-2xl overflow-hidden shadow-xs hover:shadow-md border border-slate-150 hover:border-slate-200 flex flex-col transition-all duration-300 relative"
                        >
                          {/* Badge for City/Municipio */}
                          <div className="absolute top-2 left-2 z-10 flex items-center gap-1 bg-white/95 backdrop-blur-3xs px-2 py-0.5 rounded-full shadow-xs border border-slate-100">
                            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-[8px] font-black uppercase tracking-wider text-emerald-700 max-w-[65px] truncate">
                              {c.municipio || "Honduras"}
                            </span>
                          </div>

                          {/* Initials Placeholder - matches catalog aspect box */}
                          <div className="aspect-square bg-slate-100 overflow-hidden relative flex items-center justify-center border-b border-slate-100">
                            <div className="w-full h-full bg-slate-900 text-emerald-400 flex flex-col items-center justify-center font-black text-lg uppercase gap-1">
                              {c.nombre ? c.nombre.slice(0, 2) : "CL"}
                              <span className="text-[9px] text-slate-400 font-mono font-bold uppercase tracking-wider">Cliente</span>
                            </div>
                          </div>

                          {/* Card Content details */}
                          <div className="p-2.5 flex-1 flex flex-col justify-between gap-2 text-left">
                            <div className="space-y-1">
                              <h4 className="font-bold text-slate-800 text-xs leading-snug line-clamp-2">{c.nombre}</h4>
                              <div className="text-[9px] text-slate-400 font-mono">
                                ID: <span className="font-bold text-slate-500">{c.id}</span>
                              </div>
                            </div>

                            {/* Details (Contact, email, exact location) */}
                            <div className="space-y-1 border-t border-slate-100 pt-1.5 text-[9px] text-slate-550 leading-snug">
                              {c.contacto && (
                                <div className="font-semibold text-slate-700 flex items-center gap-1">
                                  <span>📞 +{(c.prefijoPais || "504")} {c.contacto}</span>
                                  <a 
                                    href={`https://wa.me/${(c.prefijoPais || "504") + c.contacto.replace(/[^0-9]/g, "")}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-emerald-600 hover:text-emerald-700"
                                    title="WhatsApp Link"
                                  >
                                    💬
                                  </a>
                                </div>
                              )}
                              {c.correo && (
                                <div className="truncate font-medium text-slate-500" title={c.correo}>
                                  ✉️ {c.correo}
                                </div>
                              )}
                              {c.direccionExacta && (
                                <div className="text-slate-450 line-clamp-2 text-[8.5px] italic leading-tight" title={c.direccionExacta}>
                                  📍 {c.direccionExacta}
                                </div>
                              )}
                            </div>

                            {/* Actions footer with Edit/Delete buttons */}
                            <div className="grid grid-cols-2 gap-1 border-t border-slate-100 pt-2 shrink-0">
                              <button
                                onClick={() => openEditModal("customer", c)}
                                className="py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-755 rounded-lg flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer border border-slate-200"
                                title="Editar"
                              >
                                <Edit className="w-3.5 h-3.5 text-indigo-650" />
                                <span className="text-[8px] font-bold">Editar</span>
                              </button>
                              <button
                                onClick={() => handleDeleteItem("customer", c.id)}
                                className="py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer border border-rose-100"
                                title="Eliminar"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-rose-650" />
                                <span className="text-[8px] font-bold">Borrar</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
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

      {/* User Logo / Avatar Upload Overlay */}
      {selectedUserForUploader && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs" onClick={() => setSelectedUserForUploader(null)} />
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden relative z-10 p-6 space-y-4 border border-slate-100">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">Surtir Foto de Perfil</h3>
              <button 
                onClick={() => setSelectedUserForUploader(null)} 
                className="p-1 hover:bg-slate-100 rounded-lg cursor-pointer text-slate-450"
              >
                &times;
              </button>
            </div>

            <div className="space-y-1">
              <span className="block text-[10px] text-slate-400 font-bold uppercase font-mono">Usuario seleccionado:</span>
              <strong className="block text-slate-800 text-xs leading-tight">{selectedUserForUploader.nombre}</strong>
              <span className="block text-[10px] text-slate-450 font-semibold font-mono">ID: {selectedUserForUploader.idUsuario}</span>
            </div>

            <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center flex flex-col justify-center items-center gap-2 relative bg-slate-50/50 hover:bg-slate-50 transition-colors">
              {uploadingUserId === selectedUserForUploader.idUsuario ? (
                <div className="space-y-2 py-4">
                  <RefreshCw className="w-8 h-8 text-emerald-650 animate-spin mx-auto text-emerald-600" />
                  <p className="text-xs text-slate-500 font-bold">Subiendo foto de perfil...</p>
                </div>
              ) : (
                <>
                  <Upload className="w-10 h-10 text-slate-400 shrink-0" />
                  <div>
                    <p className="text-xs text-slate-700 font-bold">Selecciona una imagen de perfil</p>
                    <p className="text-[10px] text-slate-400 mt-1">Soporta PNG, JPG y JPEG</p>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleUserPhotoChange(e, selectedUserForUploader)}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                </>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setSelectedUserForUploader(null)}
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
                      {Array.from(
                        new Set([
                          ...products.map((p) => p.categoria).filter(Boolean),
                          ...(formData.categoria ? [formData.categoria] : [])
                        ])
                      ).map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
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

      {/* MANUAL ORDER GENERATOR MODAL */}
      {isManualOrderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs" onClick={() => setIsManualOrderModalOpen(false)} />
          <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-y-auto max-h-[90vh] relative z-10 border border-slate-100 flex flex-col">
            
            {/* Header */}
            <div className="flex justify-between items-center p-6 border-b border-slate-100 shrink-0">
              <div>
                <h3 className="font-black text-slate-900 text-lg flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-emerald-600" />
                  Generar Orden Física / Venta Manual
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Crea pedidos en tiempo real para clientes que visitan la tienda física.</p>
              </div>
              <button 
                onClick={() => setIsManualOrderModalOpen(false)} 
                className="p-2 hover:bg-slate-100 rounded-xl cursor-pointer text-slate-400 hover:text-slate-600 text-lg font-bold transition-all"
              >
                &times;
              </button>
            </div>

            {/* Split layout in Modal body */}
            <div className="p-6 overflow-y-auto flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 text-xs">
              
              {/* Left Column: Client Details, Payment Method, Seller Assignment */}
              <div className="lg:col-span-5 space-y-4 border-r border-slate-100 lg:pr-6">
                <h4 className="font-bold text-slate-800 text-sm border-b border-slate-50 pb-1 uppercase tracking-wider text-[11px]">
                  Información del Cliente
                </h4>
                
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="block font-bold text-slate-700">Nombre Completo del Cliente <strong className="text-rose-500">*</strong></label>
                    <input
                      type="text"
                      required
                      placeholder="Ej: Juan Pérez"
                      value={manualOrderForm.clienteNombre}
                      onChange={(e) => setManualOrderForm({ ...manualOrderForm, clienteNombre: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-xl py-2 px-3 focus:outline-hidden text-slate-900 font-semibold"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block font-bold text-slate-700">Teléfono (WhatsApp) <strong className="text-rose-500">*</strong></label>
                      <input
                        type="text"
                        required
                        placeholder="Ej: +504 9988-7766"
                        value={manualOrderForm.clienteTelefono}
                        onChange={(e) => setManualOrderForm({ ...manualOrderForm, clienteTelefono: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-xl py-2 px-3 focus:outline-hidden text-slate-900 font-semibold"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block font-bold text-slate-700">Correo Electrónico</label>
                      <input
                        type="email"
                        placeholder="opcional@correo.com"
                        value={manualOrderForm.clienteEmail}
                        onChange={(e) => setManualOrderForm({ ...manualOrderForm, clienteEmail: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-xl py-2 px-3 focus:outline-hidden text-slate-900 font-semibold"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block font-bold text-slate-700">Departamento/Municipio</label>
                      <input
                        type="text"
                        placeholder="Ej: Tegucigalpa, Francisco Morazán"
                        value={manualOrderForm.municipio}
                        onChange={(e) => setManualOrderForm({ ...manualOrderForm, municipio: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-xl py-2 px-3 focus:outline-hidden text-slate-900 font-semibold"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block font-bold text-slate-700">Dirección de Entrega</label>
                      <input
                        type="text"
                        placeholder="Ej: Retiro en tienda física"
                        value={manualOrderForm.clienteDireccion}
                        onChange={(e) => setManualOrderForm({ ...manualOrderForm, clienteDireccion: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-xl py-2 px-3 focus:outline-hidden text-slate-900 font-semibold"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block font-bold text-slate-700">Notas Adicionales de la Orden</label>
                    <textarea
                      rows={2}
                      placeholder="Ej: Entregar fardo embolsado, pagó por adelantado."
                      value={manualOrderForm.clienteNotas}
                      onChange={(e) => setManualOrderForm({ ...manualOrderForm, clienteNotas: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-xl py-2 px-3 focus:outline-hidden text-slate-900 font-semibold resize-none"
                    />
                  </div>
                </div>

                <h4 className="font-bold text-slate-800 text-sm border-b border-slate-50 pb-1 uppercase tracking-wider text-[11px] pt-4">
                  Método de Pago y Atendente
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block font-bold text-slate-700">Método de Pago</label>
                    <select
                      value={manualOrderForm.paymentMethod}
                      onChange={(e) => setManualOrderForm({ ...manualOrderForm, paymentMethod: e.target.value as any })}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-xl py-2 px-3 focus:outline-hidden text-slate-900 font-bold"
                    >
                      <option value="Efectivo">💵 Efectivo (Aplica Descuento)</option>
                      <option value="Transferencia">🏦 Transferencia Bancaria</option>
                      <option value="Tarjeta">💳 Tarjeta (Precio Regular)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block font-bold text-slate-700">Vendedor que Atiende</label>
                    <select
                      value={manualOrderForm.usuarioVendedor}
                      onChange={(e) => setManualOrderForm({ ...manualOrderForm, usuarioVendedor: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-xl py-2 px-3 focus:outline-hidden text-slate-900 font-bold"
                    >
                      <option value="">👤 Seleccionar Vendedor</option>
                      {syncedUsers.map(u => (
                        <option key={u.idUsuario} value={u.nombre}>
                          {u.nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Right Column: Search Catalogo & Added items lists */}
              <div className="lg:col-span-7 flex flex-col space-y-4">
                
                {/* Search Bar */}
                <div className="space-y-1.5">
                  <h4 className="font-bold text-slate-800 text-sm border-b border-slate-50 pb-1 uppercase tracking-wider text-[11px]">
                    Buscar y Agregar Prendas del Catálogo
                  </h4>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Escribe código de fardo, nombre del artículo o categoría..."
                      value={manualProductSearch}
                      onChange={(e) => setManualProductSearch(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 focus:bg-white rounded-xl py-2 pl-9 pr-4 focus:outline-hidden text-slate-900 font-semibold"
                    />
                  </div>
                </div>

                {/* Match Search Results: scrollable list */}
                {manualProductSearch.trim() !== "" && (
                  <div className="bg-slate-50 rounded-2xl border border-slate-200 p-3 max-h-40 overflow-y-auto space-y-1.5">
                    {(() => {
                      const matches = products.filter(
                        p => p.stock > 0 && (
                          p.id.toLowerCase().includes(manualProductSearch.toLowerCase()) ||
                          p.nombre.toLowerCase().includes(manualProductSearch.toLowerCase()) ||
                          (p.categoria && p.categoria.toLowerCase().includes(manualProductSearch.toLowerCase()))
                        )
                      ).slice(0, 10);

                      if (matches.length === 0) {
                        return <p className="text-center text-slate-400 text-[10px] py-4">No se encontraron productos disponibles con existencias.</p>;
                      }

                      return matches.map((pt) => {
                        const inBasket = manualOrderItems.find(it => it.id === pt.id);
                        const basketQty = inBasket ? inBasket.cantidad : 0;
                        const availQty = pt.stock - basketQty;
                        
                        return (
                          <div key={pt.id} className="flex justify-between items-center bg-white border border-slate-100 rounded-xl p-2.5 hover:border-slate-300 transition-all">
                            <div className="flex items-center gap-2">
                              {pt.imagen ? (
                                <img src={pt.imagen} alt="" className="w-8 h-8 rounded-lg object-cover bg-slate-100 shrink-0" referrerPolicy="no-referrer" />
                              ) : (
                                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-[10px] shrink-0 font-mono">COD</div>
                              )}
                              <div className="text-[10px]">
                                <span className="font-extrabold text-lime-800 block leading-tight">{pt.id}</span>
                                <span className="font-semibold text-slate-700 block leading-tight">{pt.nombre}</span>
                                <span className="text-[9px] text-slate-400 block">Stock: {pt.stock} un | Cat: {pt.categoria || "Fardos"}</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-3">
                              <div className="text-right text-[10px]">
                                <span className="block font-bold text-slate-900">Efe: L. {pt.precioEfectivo.toLocaleString()}</span>
                                <span className="block text-[9px] text-slate-400 font-normal">Reg: L. {pt.precioNormal.toLocaleString()}</span>
                              </div>
                              <button
                                type="button"
                                disabled={availQty <= 0}
                                onClick={() => handleAddManualProductItem(pt)}
                                className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                                  availQty <= 0
                                    ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                                    : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-3xs"
                                }`}
                              >
                                {availQty <= 0 ? "Agotado" : "+ Agregar"}
                              </button>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                )}

                {/* Selected Basket items */}
                <div className="flex-1 flex flex-col min-h-[200px]">
                  <h4 className="font-bold text-slate-800 text-sm border-b border-slate-50 pb-1 uppercase tracking-wider text-[11px] mb-2 pt-2Circled">
                    Prendas en esta Orden ({manualOrderItems.reduce((sum, item) => sum + item.cantidad, 0)})
                  </h4>

                  {manualOrderItems.length === 0 ? (
                    <div className="flex-1 border-2 border-dashed border-slate-200 rounded-3xl flex flex-col items-center justify-center p-8 text-center text-slate-400">
                      <ShoppingBag className="w-8 h-8 text-slate-300 mb-2" />
                      <p className="font-bold text-xs text-slate-500">La orden está vacía</p>
                      <p className="text-[10px] mt-0.5">Usa la barra de arriba para buscar y agregar prendas de vestir.</p>
                    </div>
                  ) : (
                    <div className="block divide-y divide-slate-100 bg-white border border-slate-200 rounded-2xl overflow-y-auto max-h-56">
                      {manualOrderItems.map((item) => {
                        const price = manualOrderForm.paymentMethod === "Tarjeta" ? item.precioNormal : item.precioEfectivo;
                        
                        return (
                          <div key={item.id} className="flex items-center justify-between p-3">
                            <div className="flex items-center gap-2.5">
                              <span className="bg-slate-100 text-slate-800 text-[9px] font-black px-1.5 py-0.5 rounded-md font-mono">{item.id}</span>
                              <div>
                                <span className="font-bold text-slate-950 block text-[10px] sm:text-xs leading-tight">{item.nombre}</span>
                                <span className="text-[9px] text-slate-400 block mt-0.5">Precio: L. {price.toLocaleString()} ({manualOrderForm.paymentMethod === "Tarjeta" ? "Reg" : "Efe"})</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-4">
                              <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
                                <button
                                  type="button"
                                  onClick={() => handleUpdateManualItemQty(item.id, item.cantidad - 1)}
                                  className="p-1 px-2.5 hover:bg-slate-200 text-slate-500 transition-colors font-bold cursor-pointer"
                                >
                                  -
                                </button>
                                <span className="px-1 text-xs text-slate-800 font-extrabold w-6 text-center font-mono">
                                  {item.cantidad}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateManualItemQty(item.id, item.cantidad + 1)}
                                  className="p-1 px-2.5 hover:bg-slate-200 text-slate-500 transition-colors font-bold cursor-pointer"
                                >
                                  +
                                </button>
                              </div>

                              <span className="font-bold text-slate-850 font-mono text-xs w-20 text-right">
                                L. {(price * item.cantidad).toLocaleString()}
                              </span>

                              <button
                                type="button"
                                onClick={() => handleRemoveManualItem(item.id)}
                                className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors shrink-0 font-bold"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Calculations breakdown block */}
                  {manualOrderItems.length > 0 && (
                    <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 mt-3 space-y-1.5 text-xs font-semibold">
                      <div className="flex justify-between text-slate-500">
                        <span>Subtotal de Prendas (Regular):</span>
                        <span className="font-mono text-slate-900">
                          L. {manualOrderItems.reduce((sum, item) => sum + (item.precioNormal * item.cantidad), 0).toLocaleString()}
                        </span>
                      </div>

                      {manualOrderForm.paymentMethod !== "Tarjeta" && (
                        <div className="flex justify-between text-emerald-600 font-semibold">
                          <span>Descuento por método de pago:</span>
                          <span className="font-mono">
                            - L. {(() => {
                              const totalNormal = manualOrderItems.reduce((sum, item) => sum + (item.precioNormal * item.cantidad), 0);
                              const totalEfe = manualOrderItems.reduce((sum, item) => sum + (item.precioEfectivo * item.cantidad), 0);
                              return (totalNormal - totalEfe).toLocaleString();
                            })()}
                          </span>
                        </div>
                      )}

                      <div className="flex justify-between text-sm pt-2 border-t border-slate-200">
                        <span className="font-extrabold text-slate-800">TOTAL NETO VENTA:</span>
                        <span className="font-black text-emerald-800 text-sm font-mono">
                          L. {(() => {
                            const priceKey = manualOrderForm.paymentMethod === "Tarjeta" ? "precioNormal" : "precioEfectivo";
                            return manualOrderItems.reduce((sum, item) => sum + (item[priceKey] * item.cantidad), 0).toLocaleString();
                          })()}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* Footer buttons */}
            <div className="p-6 border-t border-slate-100 flex justify-end gap-3 shrink-0">
              <button
                type="button"
                disabled={creatingManualOrder}
                onClick={() => setIsManualOrderModalOpen(false)}
                className="py-2.5 px-4 text-slate-500 hover:bg-slate-100 rounded-xl text-xs font-bold transition-all cursor-pointer border border-transparent disabled:opacity-50"
              >
                Cerrar Ventana
              </button>
              <button
                type="button"
                disabled={creatingManualOrder || manualOrderItems.length === 0}
                onClick={handleCreateManualOrderSubmit}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs py-2.5 px-6 rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {creatingManualOrder ? "Registrando..." : "Registrar Venta Física"}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* EDIT EXISTING ORDER MODAL */}
      {editingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs" onClick={() => setEditingOrder(null)} />
          <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-y-auto max-h-[90vh] relative z-10 border border-slate-100 flex flex-col">
            
            {/* Header */}
            <div className="flex justify-between items-center p-6 border-b border-slate-100 shrink-0">
              <div>
                <h3 className="font-black text-slate-900 text-lg flex items-center gap-2">
                  <Edit className="w-5 h-5 text-emerald-600" />
                  Modificar Orden: <strong className="text-emerald-800 font-extrabold">{editingOrder.id}</strong>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Modifica los fardos, cantidades, estado de envío y datos de facturación.</p>
              </div>
              <button 
                onClick={() => setEditingOrder(null)} 
                className="p-2 hover:bg-slate-100 rounded-xl cursor-pointer text-slate-400 hover:text-slate-600 text-lg font-bold transition-all"
              >
                &times;
              </button>
            </div>

            {/* Split layout in Modal body */}
            <div className="p-6 overflow-y-auto flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 text-xs">
              
              {/* Left Column: Client Details, Payment Method, Seller Assignment */}
              <div className="lg:col-span-5 space-y-4 border-r border-slate-100 lg:pr-6">
                <h4 className="font-bold text-slate-800 text-sm border-b border-slate-50 pb-1 uppercase tracking-wider text-[11px]">
                  Información del Cliente
                </h4>
                
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="block font-bold text-slate-700">Nombre Completo del Cliente <strong className="text-rose-500">*</strong></label>
                    <input
                      type="text"
                      required
                      placeholder="Ej: Juan Pérez"
                      value={editOrderForm.clienteNombre}
                      onChange={(e) => setEditOrderForm({ ...editOrderForm, clienteNombre: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-xl py-2 px-3 focus:outline-hidden text-slate-900 font-semibold"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block font-bold text-slate-700">Teléfono (WhatsApp) <strong className="text-rose-500">*</strong></label>
                      <input
                        type="text"
                        required
                        placeholder="Ej: +504 9988-7766"
                        value={editOrderForm.clienteTelefono}
                        onChange={(e) => setEditOrderForm({ ...editOrderForm, clienteTelefono: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-xl py-2 px-3 focus:outline-hidden text-slate-900 font-semibold"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block font-bold text-slate-700">Correo Electrónico</label>
                      <input
                        type="email"
                        placeholder="opcional@correo.com"
                        value={editOrderForm.clienteEmail}
                        onChange={(e) => setEditOrderForm({ ...editOrderForm, clienteEmail: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-xl py-2 px-3 focus:outline-hidden text-slate-900 font-semibold"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block font-bold text-slate-700">Departamento/Municipio</label>
                      <input
                        type="text"
                        placeholder="Ej: Tegucigalpa, Francisco Morazán"
                        value={editOrderForm.municipio}
                        onChange={(e) => setEditOrderForm({ ...editOrderForm, municipio: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-xl py-2 px-3 focus:outline-hidden text-slate-900 font-semibold"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block font-bold text-slate-700">Dirección de Entrega</label>
                      <input
                        type="text"
                        placeholder="Ej: Retiro en tienda física"
                        value={editOrderForm.clienteDireccion}
                        onChange={(e) => setEditOrderForm({ ...editOrderForm, clienteDireccion: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-xl py-2 px-3 focus:outline-hidden text-slate-900 font-semibold"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block font-bold text-slate-700">Notas Adicionales de la Orden</label>
                    <textarea
                      rows={2}
                      placeholder="Ej: Entregar fardo embolsado, pagó por adelantado."
                      value={editOrderForm.clienteNotas}
                      onChange={(e) => setEditOrderForm({ ...editOrderForm, clienteNotas: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-xl py-2 px-3 focus:outline-hidden text-slate-900 font-semibold resize-none"
                    />
                  </div>
                </div>

                <h4 className="font-bold text-slate-800 text-sm border-b border-slate-50 pb-1 uppercase tracking-wider text-[11px] pt-4">
                  Método de Pago, Atendente y Estado
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <label className="block font-bold text-slate-700 text-[10px]">Método</label>
                    <select
                      value={editOrderForm.paymentMethod}
                      onChange={(e) => setEditOrderForm({ ...editOrderForm, paymentMethod: e.target.value as any })}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-xl py-2 px-1 focus:outline-hidden text-slate-900 font-bold text-[10px]"
                    >
                      <option value="Efectivo">💵 Efectivo</option>
                      <option value="Transferencia">🏦 Transferencia</option>
                      <option value="Tarjeta">💳 Tarjeta (Normal)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block font-bold text-slate-700 text-[10px]">Vendedor</label>
                    <select
                      value={editOrderForm.usuarioVendedor}
                      onChange={(e) => setEditOrderForm({ ...editOrderForm, usuarioVendedor: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-xl py-2 px-1 focus:outline-hidden text-slate-900 font-bold text-[10px]"
                    >
                      <option value="">No asignado</option>
                      {syncedUsers.map(u => (
                        <option key={u.idUsuario} value={u.nombre}>
                          {u.nombre}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block font-bold text-slate-700 text-[10px]">Estado</label>
                    <select
                      value={editOrderForm.status}
                      onChange={(e) => setEditOrderForm({ ...editOrderForm, status: e.target.value as any })}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-xl py-2 px-1 focus:outline-hidden text-slate-900 font-bold text-[10px]"
                    >
                      <option value="Pendiente">⚠️ Pendiente</option>
                      <option value="Confirmado">✅ Confirmado</option>
                      <option value="Enviado">🚚 Enviado</option>
                      <option value="Completado">🎉 Completado</option>
                      <option value="Cancelado">❌ Cancelado</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Right Column: Search Catalogo & Added items lists */}
              <div className="lg:col-span-7 flex flex-col space-y-4">
                
                {/* Search Bar */}
                <div className="space-y-1.5">
                  <h4 className="font-bold text-slate-800 text-sm border-b border-slate-50 pb-1 uppercase tracking-wider text-[11px]">
                    Buscar y Agregar Prendas del Catálogo
                  </h4>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Escribe código de fardo o nombre para agregar..."
                      value={editProductSearch}
                      onChange={(e) => setEditProductSearch(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 focus:bg-white rounded-xl py-2 pl-9 pr-4 focus:outline-hidden text-slate-900 font-semibold"
                    />
                  </div>
                </div>

                {/* Match Search Results: scrollable list */}
                {editProductSearch.trim() !== "" && (
                  <div className="bg-slate-50 rounded-2xl border border-slate-200 p-3 max-h-40 overflow-y-auto space-y-1.5">
                    {(() => {
                      const matches = products.filter(
                        p => p.stock > 0 && (
                          p.id.toLowerCase().includes(editProductSearch.toLowerCase()) ||
                          p.nombre.toLowerCase().includes(editProductSearch.toLowerCase()) ||
                          (p.categoria && p.categoria.toLowerCase().includes(editProductSearch.toLowerCase()))
                        )
                      ).slice(0, 10);

                      if (matches.length === 0) {
                        return <p className="text-center text-slate-400 text-[10px] py-4">No se encontraron productos disponibles con existencias.</p>;
                      }

                      return matches.map((pt) => {
                        const inBasket = editOrderItems.find(it => it.id === pt.id);
                        const basketQty = inBasket ? inBasket.cantidad : 0;
                        const availQty = pt.stock - basketQty;
                        
                        return (
                          <div key={pt.id} className="flex justify-between items-center bg-white border border-slate-100 rounded-xl p-2.5 hover:border-slate-300 transition-all">
                            <div className="flex items-center gap-2">
                              {pt.imagen ? (
                                <img src={pt.imagen} alt="" className="w-8 h-8 rounded-lg object-cover bg-slate-100 shrink-0" referrerPolicy="no-referrer" />
                              ) : (
                                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-[10px] shrink-0 font-mono">COD</div>
                              )}
                              <div className="text-[10px]">
                                <span className="font-extrabold text-lime-800 block leading-tight">{pt.id}</span>
                                <span className="font-semibold text-slate-700 block leading-tight">{pt.nombre}</span>
                                <span className="text-[9px] text-slate-400 block">Stock original: {pt.stock} un</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-3">
                              <div className="text-right text-[10px]">
                                <span className="block font-bold text-slate-900">Efe: L. {pt.precioEfectivo.toLocaleString()}</span>
                                <span className="block text-[9px] text-slate-400 font-normal">Reg: L. {pt.precioNormal.toLocaleString()}</span>
                              </div>
                              <button
                                type="button"
                                disabled={availQty <= 0}
                                onClick={() => handleAddEditProductItem(pt)}
                                className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                                  availQty <= 0
                                    ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                                    : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-3xs"
                                }`}
                              >
                                {availQty <= 0 ? "Agotado" : "+ Agregar"}
                              </button>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                )}

                {/* Selected Basket items */}
                <div className="flex-1 flex flex-col min-h-[200px]">
                  <h4 className="font-bold text-slate-800 text-sm border-b border-slate-50 pb-1 uppercase tracking-wider text-[11px] mb-2 pt-2">
                    Prendas en esta Orden ({editOrderItems.reduce((sum, item) => sum + item.cantidad, 0)})
                  </h4>

                  {editOrderItems.length === 0 ? (
                    <div className="flex-1 border-2 border-dashed border-slate-200 rounded-3xl flex flex-col items-center justify-center p-8 text-center text-slate-400">
                      <ShoppingBag className="w-8 h-8 text-slate-300 mb-2" />
                      <p className="font-bold text-xs text-slate-500">No hay fardos agregados</p>
                      <p className="text-[10px] mt-0.5">Usa el buscador para añadir prendas de vestir a esta venta.</p>
                    </div>
                  ) : (
                    <div className="block divide-y divide-slate-100 bg-white border border-slate-200 rounded-2xl overflow-y-auto max-h-56">
                      {editOrderItems.map((item) => {
                        const price = editOrderForm.paymentMethod === "Tarjeta" ? item.precioNormal : item.precioEfectivo;
                        
                        return (
                          <div key={item.id} className="flex items-center justify-between p-3">
                            <div className="flex items-center gap-2.5">
                              <span className="bg-slate-100 text-slate-800 text-[9px] font-black px-1.5 py-0.5 rounded-md font-mono">{item.id}</span>
                              <div>
                                <span className="font-bold text-slate-950 block text-[10px] sm:text-xs leading-tight">{item.nombre}</span>
                                <span className="text-[9px] text-slate-400 block mt-0.5">Precio: L. {price.toLocaleString()} ({editOrderForm.paymentMethod === "Tarjeta" ? "Reg" : "Efe"})</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-4">
                              <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
                                <button
                                  type="button"
                                  onClick={() => handleUpdateEditItemQty(item.id, item.cantidad - 1)}
                                  className="p-1 px-2.5 hover:bg-slate-200 text-slate-500 transition-colors font-bold cursor-pointer"
                                >
                                  -
                                </button>
                                <span className="px-1 text-xs text-slate-800 font-extrabold w-6 text-center font-mono">
                                  {item.cantidad}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateEditItemQty(item.id, item.cantidad + 1)}
                                  className="p-1 px-2.5 hover:bg-slate-200 text-slate-500 transition-colors font-bold cursor-pointer"
                                >
                                  +
                                </button>
                              </div>

                              <span className="font-bold text-slate-850 font-mono text-xs w-20 text-right">
                                L. {(price * item.cantidad).toLocaleString()}
                              </span>

                              <button
                                type="button"
                                onClick={() => handleRemoveEditItem(item.id)}
                                className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors shrink-0 font-bold"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Calculations breakdown block */}
                  {editOrderItems.length > 0 && (
                    <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 mt-3 space-y-1.5 text-xs font-semibold">
                      <div className="flex justify-between text-slate-500">
                        <span>Subtotal de Prendas (Regular):</span>
                        <span className="font-mono text-slate-900">
                          L. {editOrderItems.reduce((sum, item) => sum + (item.precioNormal * item.cantidad), 0).toLocaleString()}
                        </span>
                      </div>

                      {editOrderForm.paymentMethod !== "Tarjeta" && (
                        <div className="flex justify-between text-emerald-600 font-semibold">
                          <span>Descuento por método de pago:</span>
                          <span className="font-mono">
                            - L. {(() => {
                              const totalNormal = editOrderItems.reduce((sum, item) => sum + (item.precioNormal * item.cantidad), 0);
                              const totalEfe = editOrderItems.reduce((sum, item) => sum + (item.precioEfectivo * item.cantidad), 0);
                              return (totalNormal - totalEfe).toLocaleString();
                            })()}
                          </span>
                        </div>
                      )}

                      <div className="flex justify-between text-sm pt-2 border-t border-slate-200">
                        <span className="font-extrabold text-slate-800">TOTAL NETO VENTA:</span>
                        <span className="font-black text-emerald-800 text-sm font-mono">
                          L. {(() => {
                            const priceKey = editOrderForm.paymentMethod === "Tarjeta" ? "precioNormal" : "precioEfectivo";
                            return editOrderItems.reduce((sum, item) => sum + (item[priceKey] * item.cantidad), 0).toLocaleString();
                          })()}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* Footer buttons */}
            <div className="p-6 border-t border-slate-100 flex justify-end gap-3 shrink-0">
              <button
                type="button"
                disabled={savingEditOrder}
                onClick={() => setEditingOrder(null)}
                className="py-2.5 px-4 text-slate-500 hover:bg-slate-100 rounded-xl text-xs font-bold transition-all cursor-pointer border border-transparent disabled:opacity-50"
              >
                Cerrar Ventana
              </button>
              <button
                type="button"
                disabled={savingEditOrder || editOrderItems.length === 0}
                onClick={handleEditOrderSubmit}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs py-2.5 px-6 rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {savingEditOrder ? "Guardando..." : "Guardar Cambios"}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
