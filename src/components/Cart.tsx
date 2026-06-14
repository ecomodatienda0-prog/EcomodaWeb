import React, { useState } from "react";
import { 
  X, 
  Trash2, 
  ShoppingBag, 
  ArrowRight, 
  Tag, 
  PhoneCall, 
  MapPin, 
  FileText,
  BadgeAlert,
  Loader2,
  CheckCircle,
  QrCode,
  Landmark
} from "lucide-react";
import { CartItem, CompanyInfo, OrderItem, Order } from "../types";
import { motion, AnimatePresence } from "motion/react";
import { jsPDF } from "jspdf";
import { ProductImageFallback } from "./ProductImageFallback";

interface CartProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: CartItem[];
  companyInfo: CompanyInfo;
  onUpdateQuantity: (id: string, amount: number) => void;
  onRemoveItem: (id: string) => void;
  onClearCart: () => void;
  onOrderSuccess: (order: Order) => void;
}

export default function Cart({
  isOpen,
  onClose,
  cartItems,
  companyInfo,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onOrderSuccess
}: CartProps) {
  const [step, setStep] = useState<"cart" | "checkout" | "success">("cart");
  const [submitting, setSubmitting] = useState(false);
  const [createdOrder, setCreatedOrder] = useState<Order | null>(null);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});

  // Form states
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [countryPrefix, setCountryPrefix] = useState("+504");
  const [phoneSuffix, setPhoneSuffix] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"Efectivo" | "Transferencia" | "Tarjeta">("Efectivo");

  // Sum calculations
  const totalNormal = cartItems.reduce((acc, item) => acc + (item.precioNormal * item.cantidad), 0);
  const totalDescuento = cartItems.reduce((acc, item) => acc + (item.descuento * item.cantidad), 0);
  const totalNeto = totalNormal - totalDescuento;

  const activeTotal = totalNeto;
  const totalEfectivo = totalNeto;
  const savings = totalDescuento;

  // Handle Close & Reset
  const handleClose = () => {
    onClose();
    // delay reset slightly to allow transition
    setTimeout(() => {
      setStep("cart");
      setName("");
      setEmail("");
      setPhoneSuffix("");
      setAddress("");
      setNotes("");
      setPaymentMethod("Efectivo");
      setCreatedOrder(null);
    }, 300);
  };

  // PDF Generator using jsPDF
  const generatePDF = (order: Order) => {
    try {
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
      });

      // Background decorative banner
      doc.setFillColor(15, 118, 110); // Teal-700
      doc.rect(0, 0, 210, 35, "F");

      // Header Text
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.text(companyInfo.name.toUpperCase(), 15, 18);
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text("RECIBO DIGITAL DE PEDIDO / ORDEN DE COMPRA", 15, 26);

      // Order invoice details box
      doc.setTextColor(50, 50, 50);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text(`PRE COMPRA: ${order.id}`, 140, 15, { align: "left" });
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(`Fecha: ${new Date(order.fecha).toLocaleString()}`, 140, 21, { align: "left" });
      doc.text(`Estado: PENDIENTE DE CONFIRMACION`, 140, 27, { align: "left" });

      // Company and Client block grid
      let y = 45;
      doc.setFillColor(245, 247, 250);
      doc.rect(12, y, 186, 28, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text("DATOS DE LA EMISORA:", 15, y + 5);
      doc.setFont("helvetica", "normal");
      doc.text(`${companyInfo.name}`, 15, y + 10);
      doc.text(`Dirección: ${companyInfo.address.substring(0, 48)}...`, 15, y + 15);
      doc.text(`Telf: ${companyInfo.phone}`, 15, y + 20);

      doc.setFont("helvetica", "bold");
      doc.text("DATOS DEL CLIENTE:", 110, y + 5);
      doc.setFont("helvetica", "normal");
      doc.text(`Cliente: ${order.clienteNombre}`, 110, y + 10);
      doc.text(`Teléfono: ${order.clienteTelefono}`, 110, y + 15);
      doc.text(`Método Pago: ${order.paymentMethod === "Transferencia" ? "Transferencia Bancaria" : order.paymentMethod}`, 110, y + 20);

      // Table Header
      y = 80;
      doc.setFillColor(230, 235, 240);
      doc.rect(12, y, 186, 7, "F");

      doc.setFont("helvetica", "bold");
      doc.text("COD", 15, y + 5);
      doc.text("DESCRIPCION PRENDA", 35, y + 5);
      doc.text("CANT", 140, y + 5);
      doc.text("P. UNIT", 160, y + 5);
      doc.text("P. TOTAL", 180, y + 5);

      // Table Rows
      doc.setFont("helvetica", "normal");
      order.items.forEach((item, index) => {
        const itemY = y + 12 + (index * 8);
        doc.text(String(item.id), 15, itemY);
        doc.text(item.nombre.substring(0, 50), 35, itemY);
        doc.text(String(item.cantidad), 142, itemY);

        const unitPrice = item.precioEfectivo;
        const totalPrice = unitPrice * item.cantidad;

        doc.text(`L. ${unitPrice.toLocaleString()}`, 160, itemY);
        doc.text(`L. ${totalPrice.toLocaleString()}`, 180, itemY);

        // draw dividing line
        doc.setDrawColor(240, 240, 240);
        doc.line(12, itemY + 2, 198, itemY + 2);
      });

      // Totals Box alignment
      const rowsCount = order.items.length;
      let totalsY = y + 15 + (rowsCount * 8);

      doc.setFillColor(250, 251, 252);
      doc.rect(120, totalsY, 78, 25, "F");
      doc.setDrawColor(220, 225, 230);
      doc.rect(120, totalsY, 78, 25, "S");

      doc.setFont("helvetica", "normal");
      doc.text("Subtotal de Prendas:", 125, totalsY + 6);
      doc.text(`L. ${order.totalNormal.toLocaleString()}`, 175, totalsY + 6);

      if (order.totalDescuento > 0) {
        doc.setTextColor(16, 124, 65); // emerald
        doc.text(`Descuento Aplicado:`, 125, totalsY + 12);
        doc.text(`- L. ${order.totalDescuento.toLocaleString()}`, 175, totalsY + 12);
      }

      doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "bold");
      doc.text("TOTAL NETO A PAGAR:", 125, totalsY + 20);
      const netTotal = order.totalNormal - order.totalDescuento;
      doc.text(`L. ${netTotal.toLocaleString()}`, 175, totalsY + 20);

      // Footnote instructions
      let footnoteY = totalsY + 35;
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(100, 100, 100);
      doc.text("NOTAS / INSTRUCCIONES ADICIONALES:", 15, footnoteY);
      doc.setFont("helvetica", "normal");
      if (order.clienteNotas) {
        doc.text(`- Notas del cliente: "${order.clienteNotas}"`, 15, footnoteY + 4);
      }
      doc.text(`- Teléfono de entrega: ${order.clienteTelefono}`, 15, footnoteY + 8);
      doc.text(`- Dirección: ${order.clienteDireccion}`, 15, footnoteY + 12);

      if (order.paymentMethod === "Transferencia") {
        doc.setFont("helvetica", "bold");
        doc.text("POR FAVOR ENVIAR EL COMPROBANTE DE TRANSFERENCIA A NUESTRO WHATSAPP:", 15, footnoteY + 18);
        doc.setFont("helvetica", "normal");
        doc.text(companyInfo.bankDetails.replace(/\n/g, " | "), 15, footnoteY + 22);
      }

      // Decorative Footer
      doc.setFontSize(7);
      doc.setTextColor(150, 150, 150);
      doc.text(`Ecomoda Store Management System | Generado de forma automática el ${new Date().toLocaleDateString()}`, 15, 280);

      doc.save(`Recibo_Ecomoda_${order.id}.pdf`);
    } catch (e) {
      console.error("PDF generation fail:", e);
    }
  };

  // WhatsApp Sender
  const openWhatsApp = (order: Order) => {
    try {
      const cleanPhone = companyInfo.phone.replace(/[^0-9]/g, ""); // strip characters
      
      const itemsText = order.items.map(item => {
        const itemPrice = item.precioEfectivo;
        return `• ${item.cantidad}x ${item.nombre} [COD: ${item.id}] - L. ${(itemPrice * item.cantidad).toLocaleString()}`;
      }).join("\n");

      const paymentLabel = order.paymentMethod === "Transferencia" ? "Transferencia Bancaria" : order.paymentMethod;

      const message = `*NUEVO PEDIDO EN FARDO ECOMODA* 🛍️\n\n` +
        `*Código de Pre-compra:* ${order.id}\n` +
        `*Fecha:* ${new Date(order.fecha).toLocaleDateString()}\n\n` +
        `👤 *Cliente:* ${order.clienteNombre}\n` +
        `📞 *Teléfono:* ${order.clienteTelefono}\n` +
        `📍 *Dirección de Entrega:* ${order.clienteDireccion}\n` +
        `💬 *Notas/Especificaciones:* ${order.clienteNotas || "Ninguna"}\n\n` +
        `💳 *Método de Pago Seleccionado:* ${paymentLabel}\n\n` +
        `👕 *Detalle de Prendas:* \n${itemsText}\n\n` +
        `----------------------------------------\n` +
        `*Subtotal de Prendas:* L. ${order.totalNormal.toLocaleString()}\n` +
        (order.totalDescuento > 0 ? `*Descuento Aplicado:* - L. ${order.totalDescuento.toLocaleString()}\n` : "") +
        `*TOTAL NETO A PAGAR:* *L. ${(order.totalNormal - order.totalDescuento).toLocaleString()}*\n\n` +
        (order.paymentMethod === "Transferencia" ? `💡 _Adjuntaré mi comprobante de transferencia a continuación_` : `📦 _Espero mi pedido con ansias!_`);

      const encodedText = encodeURIComponent(message);
      const url = `https://wa.me/${cleanPhone}?text=${encodedText}`;
      window.open(url, "_blank");
    } catch (e) {
      console.error("WhatsApp trigger error:", e);
    }
  };

  // Handle Form Submit
  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return alert("Por favor ingresa tu nombre completo.");
    if (!phoneSuffix.trim() || phoneSuffix.length < 7) return alert("Por favor ingresa un número de teléfono válido.");
    if (!address.trim()) return alert("Por favor ingresa la dirección de entrega.");

    setSubmitting(true);

    const orderItems: OrderItem[] = cartItems.map(item => ({
      id: item.id,
      nombre: item.nombre,
      talla: item.talla,
      categoria: item.categoria,
      precioNormal: item.precioNormal,
      precioEfectivo: item.precioEfectivo,
      imagen: item.imagen,
      cantidad: item.cantidad
    }));

    const fullPhone = `${countryPrefix} ${phoneSuffix.trim()}`;

    const orderPayload = {
      clienteNombre: name.trim(),
      clienteEmail: email.trim(),
      clienteTelefono: fullPhone,
      clienteDireccion: address.trim(),
      clienteNotas: notes.trim(),
      paymentMethod,
      items: orderItems,
      totalNormal,
      totalEfectivo,
      totalDescuento: savings
    };

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: orderPayload })
      });

      if (!response.ok) {
        throw new Error("No se pudo almacenar el pedido");
      }

      const result = await response.json();
      if (result.success && result.order) {
        setCreatedOrder(result.order);
        onOrderSuccess(result.order);
        setStep("success");
        onClearCart();
      }
    } catch (error) {
      console.error("Order processing error:", error);
      alert("Hubo un problema al procesar tu orden. Intenta nuevamente.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div id="shopping-cart-drawer" className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-3xs"
          />

          <div className="absolute inset-y-0 right-0 max-w-full flex pl-10 max-w-2xl w-full">
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="w-full bg-white flex flex-col shadow-2xl relative border-l border-slate-100"
            >
              {/* Drawer Header */}
              <div className="bg-slate-900 text-white p-6 flex items-center justify-between shadow-xs">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-emerald-400" />
                  <div>
                    <h3 className="font-bold text-base">
                      {step === "cart" && "Bolsa de Compras"}
                      {step === "checkout" && "Detalles de Envío"}
                      {step === "success" && "¡Compra Exitosa!"}
                    </h3>
                    <p className="text-xs text-slate-400 font-mono">
                      {step === "cart" && `${cartItems.length} prendas seleccionadas`}
                      {step === "checkout" && "Paso Final de Pre-compra"}
                      {step === "success" && "¡Recibo generado listo!"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleClose}
                  className="p-1.5 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Step 1: Browse active shopping cart items */}
              {step === "cart" && (
                <div className="flex-1 flex flex-col justify-between overflow-hidden">
                  {cartItems.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-400">
                      <ShoppingBag className="w-12 h-12 text-slate-350 stroke-1 mb-4" />
                      <h4 className="font-bold text-slate-700">Tu bolsa está vacía</h4>
                      <p className="text-sm mt-1 max-w-xs">Navega por nuestro catálogo de fardos e incorpora prendas increíbles.</p>
                      <button
                        onClick={handleClose}
                        className="mt-6 px-5 py-2.5 bg-emerald-600 font-bold text-xs text-white uppercase rounded-xl transition-all cursor-pointer hover:bg-emerald-500"
                      >
                        Volver a la Tienda
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* Items loop */}
                      <div className="flex-1 overflow-y-auto p-6 space-y-4">
                        {cartItems.map((item) => (
                          <div
                            key={item.id}
                            className="flex gap-4 p-3 bg-slate-50 border border-slate-100 rounded-2xl relative group hover:border-slate-200 transition-colors"
                          >
                            {/* Product photo block */}
                            <div className="size-16 rounded-xl overflow-hidden bg-slate-200 shrink-0">
                              {!item.imagen || 
                               item.imagen.trim() === "" || 
                               item.imagen.includes("photo-1523381210434-271e8be1f52b") || 
                               imageErrors[item.id] ? (
                                <ProductImageFallback id={item.id} size="sm" />
                              ) : (
                                <img
                                  src={item.imagen}
                                  alt={item.nombre}
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full object-cover"
                                  onError={() => {
                                    setImageErrors(prev => ({ ...prev, [item.id]: true }));
                                  }}
                                />
                              )}
                            </div>

                            {/* Meta & Price description */}
                            <div className="flex-1 flex flex-col justify-between">
                              <div>
                                <h4 className="font-bold text-xs text-slate-800 line-clamp-1">
                                  {item.nombre}
                                </h4>
                                <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-450 font-semibold font-mono">
                                  <span>COD: {item.id}</span>
                                </div>
                              </div>

                              <div className="flex items-center justify-between pt-1">
                                <div className="flex items-center bg-white border border-slate-200 rounded-lg overflow-hidden h-7 shrink-0">
                                  <button
                                    onClick={() => onUpdateQuantity(item.id, -1)}
                                    className="px-2 hover:bg-slate-100 text-slate-600 font-bold text-xs h-full shrink-0 cursor-pointer"
                                  >
                                    -
                                  </button>
                                  <span className="w-8 text-center text-xs font-extrabold text-slate-700">
                                    {item.cantidad}
                                  </span>
                                  <button
                                    disabled={item.cantidad >= item.stock}
                                    onClick={() => onUpdateQuantity(item.id, 1)}
                                    className="px-2 hover:bg-slate-100 text-slate-600 font-bold text-xs h-full shrink-0 disabled:opacity-30 cursor-pointer"
                                  >
                                    +
                                  </button>
                                </div>

                                <div className="text-right">
                                  {item.precioNormal - item.precioEfectivo > 0 ? (
                                    <>
                                      <p className="text-[10px] text-slate-400 line-through">L. {item.precioNormal.toLocaleString()}</p>
                                      <p className="text-xs font-extrabold text-emerald-600">L. {item.precioEfectivo.toLocaleString()}</p>
                                    </>
                                  ) : (
                                    <p className="text-xs font-extrabold text-slate-700">L. {item.precioNormal.toLocaleString()}</p>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Trash button */}
                            <button
                              onClick={() => onRemoveItem(item.id)}
                              className="absolute top-2.5 right-2.5 p-1 text-slate-350 hover:text-rose-600 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>

                      {/* Totals panel */}
                      <div className="p-6 bg-slate-50 border-t border-slate-150 space-y-4">
                        <div className="space-y-2">
                          <div className="flex justify-between text-xs text-slate-500">
                            <span>Subtotal de Prendas:</span>
                            <span className="font-mono">L. {totalNormal.toLocaleString()}</span>
                          </div>
                          
                          {totalDescuento > 0 && (
                            <div className="flex justify-between text-xs text-emerald-700 font-bold">
                              <span>Descuento Aplicado:</span>
                              <span className="font-mono">- L. {totalDescuento.toLocaleString()}</span>
                            </div>
                          )}

                          <div className="flex justify-between items-end pt-2 border-t border-slate-200">
                            <div>
                              <p className="text-[11px] font-bold text-slate-700 tracking-wider">TOTAL NETO A PAGAR:</p>
                              <p className="text-slate-400 text-[10px]">Sujeto a confirmación por WhatsApp</p>
                            </div>
                            <span className="text-2xl font-black text-slate-900 font-sans">
                              L. {totalNeto.toLocaleString()}
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={() => setStep("checkout")}
                          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/10 transition-all cursor-pointer"
                        >
                          Proceder al Envío
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Step 2: Shipping details forms */}
              {step === "checkout" && (
                <form onSubmit={handleSubmitOrder} className="flex-1 flex flex-col justify-between overflow-hidden">
                  <div className="flex-1 overflow-y-auto p-6 space-y-5">
                    
                    {/* User delivery prompt banner */}
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-xs text-slate-600 leading-relaxed flex gap-3">
                      <PhoneCall className="w-5 h-5 text-emerald-650 shrink-0 mt-0.5 text-emerald-600 animate-pulse" />
                      <p>
                        <strong>¡Casi listo!</strong> Por favor completa tus datos de entrega a continuación. No se requiere registro de usuario. Al confirmar tu compra, se abrirá un enlace directo para enviarle de forma automática los datos a la tienda vía WhatsApp.
                      </p>
                    </div>

                    {/* Inputs */}
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Nombre Completo *</label>
                        <input
                          type="text"
                          required
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="p. ej. María José Reyes"
                          className="w-full bg-slate-50 border border-slate-250 focus:border-emerald-500 focus:bg-white rounded-xl py-2.5 px-3.5 text-sm focus:outline-hidden transition-all"
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div className="col-span-1">
                          <label className="block text-xs font-bold text-slate-700 mb-1">Prefijo *</label>
                          <select
                            value={countryPrefix}
                            onChange={(e) => setCountryPrefix(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-250 focus:border-emerald-500 focus:bg-white rounded-xl py-2.5 px-2 text-sm focus:outline-hidden cursor-pointer"
                          >
                            <option value="+504">HN (+504)</option>
                            <option value="+502">GT (+502)</option>
                            <option value="+503">SV (+503)</option>
                            <option value="+505">NI (+505)</option>
                            <option value="+506">CR (+506)</option>
                            <option value="+507">PA (+507)</option>
                          </select>
                        </div>
                        <div className="col-span-2">
                          <label className="block text-xs font-bold text-slate-700 mb-1">Celular / WhatsApp *</label>
                          <input
                            type="tel"
                            required
                            value={phoneSuffix}
                            onChange={(e) => setPhoneSuffix(e.target.value.replace(/[^0-9]/g, ""))}
                            placeholder="p. ej. 99887766"
                            className="w-full bg-slate-50 border border-slate-250 focus:border-emerald-500 focus:bg-white rounded-xl py-2.5 px-3.5 text-sm focus:outline-hidden transition-all"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Email de Contacto (Opcional)</label>
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="p. ej. cliente@correo.com"
                          className="w-full bg-slate-50 border border-slate-250 focus:border-emerald-500 focus:bg-white rounded-xl py-2.5 px-3.5 text-sm focus:outline-hidden transition-all"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Dirección de Entrega Detallada *</label>
                        <textarea
                          required
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                          placeholder="Colonia, bloque, color de casa, referencias o señas específicas..."
                          rows={2}
                          className="w-full bg-slate-50 border border-slate-250 focus:border-emerald-500 focus:bg-white rounded-xl py-2 px-3.5 text-sm focus:outline-hidden transition-all"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Notas de Pedido (Opcional)</label>
                        <input
                          type="text"
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="Ej: Dejar en la portería o llamar al llegar..."
                          className="w-full bg-slate-50 border border-slate-250 focus:border-emerald-500 focus:bg-white rounded-xl py-2.5 px-3.5 text-sm focus:outline-hidden transition-all"
                        />
                      </div>
                    </div>

                    {/* Method of payment choice */}
                    <div className="border-t border-slate-100 pt-4">
                      <label className="block text-xs font-bold text-slate-700 mb-2">Selecciona Método de Pago</label>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {/* Efectivo cash */}
                        <div
                          onClick={() => setPaymentMethod("Efectivo")}
                          className={`border-2 p-3 rounded-xl cursor-pointer transition-all text-center flex flex-col justify-center items-center h-14 relative overflow-hidden ${
                            paymentMethod === "Efectivo"
                              ? "bg-emerald-50/55 border-emerald-500 text-teal-900"
                              : "border-slate-200 text-slate-600 hover:border-slate-300"
                          }`}
                        >
                          <span className="font-extrabold text-xs block uppercase">Efectivo</span>
                        </div>

                        {/* Transferencia bank */}
                        <div
                          onClick={() => setPaymentMethod("Transferencia")}
                          className={`border-2 p-3 rounded-xl cursor-pointer transition-all text-center flex flex-col justify-center items-center h-14 relative overflow-hidden ${
                            paymentMethod === "Transferencia"
                              ? "bg-emerald-50/55 border-emerald-500 text-teal-900"
                              : "border-slate-200 text-slate-600 hover:border-slate-300"
                          }`}
                        >
                          <span className="font-extrabold text-xs block uppercase">Transferencia</span>
                        </div>

                        {/* Tarjeta credit */}
                        <div
                          onClick={() => setPaymentMethod("Tarjeta")}
                          className={`border-2 p-3 rounded-xl cursor-pointer transition-all text-center flex flex-col justify-center items-center h-14 relative overflow-hidden ${
                            paymentMethod === "Tarjeta"
                              ? "bg-slate-50/70 border-slate-800 text-slate-900"
                              : "border-slate-200 text-slate-600 hover:border-slate-300"
                          }`}
                        >
                          <span className="font-extrabold text-xs block uppercase">Tarjeta</span>
                        </div>
                      </div>

                      {/* Bank Details render */}
                      {paymentMethod === "Transferencia" && (
                        <div className="mt-3 bg-teal-50 border border-teal-200 p-3 rounded-xl">
                          <h4 className="font-bold text-teal-900 text-[10px] uppercase flex items-center gap-1 tracking-wide mb-1">
                            <Landmark className="w-3.5 h-3.5" />
                            Datos para la Transferencia Bancaria:
                          </h4>
                          <p className="text-teal-800 text-xs whitespace-pre-line leading-relaxed font-mono">
                            {companyInfo.bankDetails}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Submit checkout footer */}
                  <div className="p-6 bg-slate-50 border-t border-slate-150 space-y-3">
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-xs text-slate-600">
                        <span>Subtotal de Prendas:</span>
                        <span className="font-mono">L. {totalNormal.toLocaleString()}</span>
                      </div>
                      {totalDescuento > 0 && (
                        <div className="flex justify-between items-center text-xs text-emerald-700 font-bold">
                          <span>Descuento Aplicado:</span>
                          <span className="font-mono">- L. {totalDescuento.toLocaleString()}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                        <span className="font-bold text-slate-800 text-sm">TOTAL NETO A PAGAR:</span>
                        <span className="text-xl font-extrabold text-slate-900 font-mono">
                          L. {totalNeto.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => setStep("cart")}
                        className="py-3 px-4 font-bold text-xs bg-slate-200 hover:bg-slate-350 text-slate-700 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-all cursor-pointer text-center"
                      >
                        Atrás
                      </button>
                      <button
                        type="submit"
                        disabled={submitting}
                        className="py-3 px-4 font-bold text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
                      >
                        {submitting ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Procesando...
                          </>
                        ) : (
                          "Confirmar Pre-compra"
                        )}
                      </button>
                    </div>
                  </div>
                </form>
              )}

              {/* Step 3: Success state */}
              {step === "success" && createdOrder && (
                <div className="flex-1 flex flex-col justify-between p-6 text-center text-slate-800 overflow-y-auto">
                  <div className="flex-1 flex flex-col items-center justify-center max-w-sm mx-auto space-y-6">
                    <div className="size-20 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 shadow-md">
                      <CheckCircle className="w-10 h-10" />
                    </div>

                    <div>
                      <h3 className="text-2xl font-black text-slate-900 leading-tight">¡Pedido Recibido!</h3>
                      <p className="text-emerald-700 font-extrabold font-mono mt-1 text-sm">{createdOrder.id}</p>
                      <p className="text-slate-600 text-xs mt-3 leading-relaxed">
                        Tu pre-compra se ha registrado correctamente en nuestra base de datos. Se ha generado una factura digital descargable para tu control.
                      </p>
                    </div>

                    <div className="w-full bg-slate-50 border border-slate-100 p-4 rounded-2xl text-left space-y-3 shadow-3xs">
                      <h4 className="font-bold text-slate-800 text-[11px] uppercase tracking-wider mb-2 pb-1 border-b border-slate-100">Resumen de Entrega:</h4>
                      <p className="text-slate-600 text-xs"><strong>Cliente:</strong> {createdOrder.clienteNombre}</p>
                      <p className="text-slate-600 text-xs"><strong>Teléfono:</strong> {createdOrder.clienteTelefono}</p>
                      <p className="text-slate-600 text-xs line-clamp-2"><strong>Dirección:</strong> {createdOrder.clienteDireccion}</p>
                      <p className="text-slate-600 text-xs"><strong>Total Neto:</strong> <strong className="text-emerald-700 text-sm">L. {(createdOrder.paymentMethod === "Tarjeta" ? createdOrder.totalNormal : createdOrder.totalEfectivo).toLocaleString()}</strong></p>
                    </div>

                    <div className="space-y-3 w-full">
                      <button
                        onClick={() => generatePDF(createdOrder)}
                        className="w-full bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 border border-slate-700 shadow-xs cursor-pointer transition-all"
                      >
                        <FileText className="w-4 h-4 text-emerald-400" />
                        Descargar Factura PDF
                      </button>

                      <button
                        onClick={() => openWhatsApp(createdOrder)}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-md hover:scale-[1.01] transition-transform duration-100 cursor-pointer"
                      >
                        Enviar Detalle por WhatsApp
                      </button>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-slate-100 mt-6">
                    <button
                      onClick={handleClose}
                      className="w-full text-xs font-bold text-slate-500 hover:text-slate-800 py-2 transition-colors cursor-pointer"
                    >
                      Volver can catálogo de la tienda
                    </button>
                  </div>
                </div>
              )}

            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}
