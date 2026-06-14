import React, { useState, useMemo } from "react";
import { 
  Search, 
  Sparkles, 
  Tag, 
  MapPin, 
  Clock, 
  SlidersHorizontal,
  ChevronRight,
  ChevronLeft,
  Info,
  Star,
  MessageSquare,
  Truck,
  Package,
  Heart
} from "lucide-react";
import { Product, CompanyInfo, Review, Order } from "../types";
import { motion, AnimatePresence } from "motion/react";
import { ProductImageFallback } from "./ProductImageFallback";

const formatDiscountDate = (dateStr?: string) => {
  if (!dateStr || dateStr.trim() === "") return "";
  
  // Extract just the YYYY-MM-DD or DD-MM-YYYY part (ignoring T... or space...)
  let cleanStr = dateStr.trim();
  if (cleanStr.includes("T")) {
    cleanStr = cleanStr.split("T")[0];
  } else if (cleanStr.includes(" ")) {
    cleanStr = cleanStr.split(" ")[0];
  }
  
  // Replace slashes with dashes and split
  const normalized = cleanStr.replace(/\//g, "-");
  const parts = normalized.split("-");
  
  if (parts.length === 3) {
    // 1. Format: YYYY-MM-DD (e.g. 2026-06-15)
    if (parts[0].length === 4) {
      const year = parts[0].substring(2); // take last 2 digits
      const month = parts[1];
      const day = parts[2];
      return `${day}-${month}-${year}`;
    }
    // 2. Format: DD-MM-YYYY (e.g. 15-06-2026)
    if (parts[2].length === 4) {
      const day = parts[0];
      const month = parts[1];
      const year = parts[2].substring(2);
      return `${day}-${month}-${year}`;
    }
    // 3. Format: DD-MM-YY (e.g. 15-06-26)
    if (parts[0].length === 2 && parts[1].length === 2 && parts[2].length === 2) {
      return `${parts[0]}-${parts[1]}-${parts[2]}`;
    }
  }
  
  // Fallback to standard Date parsing
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      // Use UTC methods to avoid timezone shift inconsistencies for pure dates
      const day = String(d.getUTCDate()).padStart(2, '0');
      const month = String(d.getUTCMonth() + 1).padStart(2, '0');
      const year = String(d.getUTCFullYear()).substring(2);
      return `${day}-${month}-${year}`;
    }
  } catch (e) {
    // ignore
  }
  return cleanStr;
};

interface ClientShopProps {
  products: Product[];
  companyInfo: CompanyInfo;
  onAddToCart: (product: Product) => void;
  onOpenCart: () => void;
  cartCount: number;
  reviews: Review[];
  onSubmitReview: (review: { nombre: string; calificacion: number; comentario: string; producto: string }) => Promise<boolean>;
  orders: Order[];
}

export default function ClientShop({ 
  products, 
  companyInfo, 
  onAddToCart, 
  onOpenCart, 
  cartCount,
  reviews = [],
  onSubmitReview,
  orders = []
}: ClientShopProps) {
  // Navigation tabs for client view
  const [activeClientTab, setActiveClientTab] = useState<"catalog" | "tracking" | "reviews">("catalog");

  // Tracking tab states
  const [trackingCodeInput, setTrackingCodeInput] = useState("");
  const [trackedOrder, setTrackedOrder] = useState<Order | null | "notfound">(null);

  // Reviews tab states
  const [reviewName, setReviewName] = useState("");
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewProduct, setReviewProduct] = useState("General");
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

   const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Todas");
  const [sortBy, setSortBy] = useState("default");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});

  // Derive unique categories
  const categories = useMemo(() => {
    const list = new Set(products.map(p => p.categoria));
    return ["Todas", ...Array.from(list)];
  }, [products]);

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    return products
      .filter(p => p.visible)
      .filter(p => {
        const matchesSearch = p.nombre.toLowerCase().includes(search.toLowerCase()) || 
                              p.id.toLowerCase().includes(search.toLowerCase()) ||
                              p.categoria.toLowerCase().includes(search.toLowerCase());
        const matchesCategory = selectedCategory === "Todas" || p.categoria === selectedCategory;
        return matchesSearch && matchesCategory;
      })
      .sort((a, b) => {
        const priceA = a.precioNormal - a.descuento;
        const priceB = b.precioNormal - b.descuento;
        if (sortBy === "price-asc") return priceA - priceB;
        if (sortBy === "price-desc") return priceB - priceA;
        if (sortBy === "name-asc") return a.nombre.localeCompare(b.nombre);
        return 0; // Default order
      });
  }, [products, search, selectedCategory, sortBy]);

  return (
    <div id="client-shop" className="min-h-screen bg-slate-50 text-slate-800">
      {/* Brand Hero Cover */}
      <div className="relative bg-gradient-to-r from-teal-900 to-emerald-800 text-white overflow-hidden shadow-md">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 sm:py-4 flex flex-col md:flex-row md:items-center md:justify-between relative z-10">
          <div>
            <h1 className="text-xl sm:text-3xl font-extrabold tracking-tight font-sans">
              {companyInfo.name}
            </h1>
            <p className="mt-0.5 sm:mt-1.5 text-emerald-100 max-w-xl text-xs sm:text-sm font-semibold">
              Calidad Garantizada - Entregas Locales Comayagua Gratis
            </p>
          </div>

          <div className="mt-2.5 md:mt-0 flex gap-1.5 sm:gap-2.5 flex-wrap">
            <button
              onClick={() => setShowInfo(!showInfo)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg sm:rounded-xl bg-white/10 hover:bg-white/15 text-white font-medium text-xs sm:text-sm transition-all border border-white/10 cursor-pointer"
            >
              <Info className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              Ver Sucursal e Info
            </button>
            <button
              onClick={onOpenCart}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 sm:px-5 sm:py-2 rounded-lg sm:rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-semibold text-xs sm:text-sm shadow-lg shadow-emerald-950/20 transition-all cursor-pointer"
            >
              Ver Carrito
              {cartCount > 0 && (
                <span className="flex h-4 w-4 sm:h-5 sm:w-5 items-center justify-center rounded-full bg-white text-[10px] sm:text-xs font-bold text-teal-950">
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Selector de Navegación del Cliente */}
      <div id="client-nav-tabs" className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-4 sm:space-x-8 overflow-x-auto scrollbar-none">
            <button
              onClick={() => setActiveClientTab("catalog")}
              className={`flex items-center gap-1.5 py-2.5 sm:py-4 px-0.5 sm:px-1 border-b-2 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${
                activeClientTab === "catalog"
                  ? "border-emerald-600 text-emerald-700"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              <Package className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              Catálogo de Fardos
            </button>
            
            <button
              onClick={() => {
                setActiveClientTab("tracking");
                setTrackedOrder(null);
                setTrackingCodeInput("");
              }}
              className={`flex items-center gap-1.5 py-2.5 sm:py-4 px-0.5 sm:px-1 border-b-2 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap relative ${
                activeClientTab === "tracking"
                  ? "border-emerald-600 text-emerald-700"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              <Truck className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              Seguimiento de Pedidos
              <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              </span>
            </button>

            <button
              onClick={() => setActiveClientTab("reviews")}
              className={`flex items-center gap-1.5 py-2.5 sm:py-4 px-0.5 sm:px-1 border-b-2 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${
                activeClientTab === "reviews"
                  ? "border-emerald-600 text-emerald-700"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              Reseñas ({reviews.length})
            </button>
          </div>
        </div>
      </div>

      {/* Info Drawer Modal */}
      <AnimatePresence>
        {showInfo && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowInfo(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            />
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-lg rounded-2xl shadow-xl overflow-hidden relative z-10 border border-slate-100"
            >
              <div className="bg-gradient-to-r from-teal-900 to-emerald-800 p-6 text-white flex justify-between items-center">
                <h3 className="font-bold text-lg">Información de la Tienda</h3>
                <button 
                  onClick={() => setShowInfo(false)} 
                  className="p-1 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                >
                  &times;
                </button>
              </div>
              <div className="p-6 space-y-5">
                <div className="flex gap-3">
                  <MapPin className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-slate-900 text-sm">Dirección Física</h4>
                    <p className="text-slate-600 text-sm mt-0.5">{companyInfo.address}</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Clock className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-slate-900 text-sm">Horario de Atención</h4>
                    <p className="text-slate-600 text-sm mt-0.5 whitespace-pre-line">{companyInfo.hours}</p>
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-2">Instrucciones de Transferencia</h4>
                  <p className="text-slate-600 text-xs whitespace-pre-line leading-relaxed">{companyInfo.bankDetails}</p>
                </div>
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
                <button
                  onClick={() => setShowInfo(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-semibold transition-all cursor-pointer"
                >
                  Entendido
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Main Content & Catalog */}
      <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 py-3 sm:py-8">
        
        {/* TAB 1: CATALOG */}
        {activeClientTab === "catalog" && (
          <div className="space-y-4 sm:space-y-8">
            {/* Search & Advanced Filters */}
            <div className="sticky top-2 sm:top-4 z-30 bg-white/95 backdrop-blur-md shadow-sm border border-slate-100 p-2.5 sm:p-5 rounded-xl sm:rounded-2xl transition-all">
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 items-stretch sm:items-center">
                
                {/* Search Input */}
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar fardo, prenda o categoría..."
                    className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-lg sm:rounded-xl py-1.5 sm:py-2.5 pl-9 pr-4 text-xs sm:text-sm transition-all focus:outline-hidden"
                  />
                </div>

                {/* Sorby */}
                <div className="flex items-center gap-1.5 sm:w-64">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 rounded-lg sm:rounded-xl py-1.5 sm:py-2.5 px-2 sm:px-3 text-xs sm:text-sm transition-all focus:outline-hidden cursor-pointer"
                  >
                    <option value="default">Orden predeterminado</option>
                    <option value="price-asc">Precio: de menor a mayor</option>
                    <option value="price-desc">Precio: de mayor a menor</option>
                    <option value="name-asc">Nombre: A-Z</option>
                  </select>
                </div>
              </div>

              {/* Quick Categories list with horizontal scroll and arrows */}
              <div className="mt-2 sm:mt-4 pt-2 sm:pt-4 border-t border-slate-100 flex items-center gap-2 relative">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider shrink-0 hidden sm:inline">Categoría:</span>
                
                <div className="relative flex-1 flex items-center overflow-hidden group/carousel">
                  {/* Left scroll button */}
                  <button
                    onClick={() => {
                      const container = document.getElementById("categories-scroll-container");
                      if (container) {
                        container.scrollBy({ left: -150, behavior: "smooth" });
                      }
                    }}
                    className="absolute left-0 z-10 bg-white/90 hover:bg-white text-slate-700 shadow-sm border border-slate-200 rounded-full p-1 cursor-pointer flex items-center justify-center transition-all opacity-0 group-hover/carousel:opacity-100"
                    title="Anterior"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>

                  {/* Scrollable Container */}
                  <div
                    id="categories-scroll-container"
                    className="flex-1 flex gap-1.5 items-center overflow-x-auto scroll-smooth py-0.5 px-0.5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                  >
                    {categories.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={`text-[11px] sm:text-xs px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-full font-medium transition-all shrink-0 cursor-pointer ${
                          selectedCategory === cat 
                            ? "bg-emerald-600 text-white shadow-xs" 
                            : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>

                  {/* Right scroll button */}
                  <button
                    onClick={() => {
                      const container = document.getElementById("categories-scroll-container");
                      if (container) {
                        container.scrollBy({ left: 150, behavior: "smooth" });
                      }
                    }}
                    className="absolute right-0 z-10 bg-white/90 hover:bg-white text-slate-700 shadow-sm border border-slate-200 rounded-full p-1 cursor-pointer flex items-center justify-center transition-all opacity-0 group-hover/carousel:opacity-100"
                    title="Siguiente"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Catalog Grid */}
            {filteredProducts.length === 0 ? (
              <div className="bg-white rounded-2xl py-12 px-4 shadow-xs border border-slate-100 text-center text-slate-500 max-w-md mx-auto">
                <div className="size-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Search className="w-6 h-6 text-slate-400" />
                </div>
                <h3 className="font-bold text-slate-800 text-lg">No encontramos resultados</h3>
                <p className="text-sm mt-1">Prueba cambiando los filtros de búsqueda o categoría.</p>
                <button
                  onClick={() => {
                    setSearch("");
                    setSelectedCategory("Todas");
                  }}
                  className="mt-4 text-xs font-bold text-emerald-600 hover:text-emerald-500 underline"
                >
                  Restablecer filtros
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
                <AnimatePresence mode="popLayout">
                  {filteredProducts.map((product) => {
                    const hasDiscount = product.descuento > 0;
                    const isOutOfStock = product.stock <= 0;

                    return (
                      <motion.div
                        key={product.id}
                        layout
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ duration: 0.2 }}
                        className="group bg-white rounded-2xl overflow-hidden shadow-xs hover:shadow-lg border border-slate-100 hover:border-slate-200 flex flex-col transition-all duration-300 relative animate-fade-in"
                      >
                        {/* Stock Warning Badge */}
                        {product.stock <= 2 && product.stock > 0 && (
                          <div className="absolute top-3 right-3 z-10 bg-amber-500 text-white text-[10px] uppercase font-bold px-2 py-0.5 rounded-sm">
                            Últimas {product.stock}!
                          </div>
                        )}

                        {isOutOfStock && (
                          <div className="absolute inset-0 bg-white/70 z-10 backdrop-blur-3xs flex items-center justify-center">
                            <div className="bg-rose-600 text-white text-xs uppercase font-extrabold px-4 py-1.5 rounded-lg shadow-md transform -rotate-6">
                              Agotada
                            </div>
                          </div>
                        )}

                        {/* Image Box */}
                        <div 
                          onClick={() => !isOutOfStock && setSelectedProduct(product)}
                          className="aspect-square bg-slate-100 overflow-hidden relative cursor-pointer group-hover:opacity-95"
                        >
                          {!product.imagen || 
                           product.imagen.trim() === "" || 
                           product.imagen.includes("photo-1523381210434-271e8be1f52b") || 
                           imageErrors[product.id] ? (
                            <ProductImageFallback id={product.id} />
                          ) : (
                            <img
                              src={product.imagen}
                              alt={product.nombre}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                              onError={() => {
                                setImageErrors(prev => ({ ...prev, [product.id]: true }));
                              }}
                            />
                          )}
                        </div>

                        {/* Meta Body */}
                        <div className="p-3 sm:p-4 flex-1 flex flex-col justify-between gap-2">
                          <div>
                            {/* ID / Code and Category */}
                            <div className="flex justify-between items-center text-[10px] sm:text-[11px] font-mono text-slate-400 font-bold mb-1">
                              <span>COD: {product.id}</span>
                              <span className="uppercase">{product.categoria}</span>
                            </div>

                            {/* Title */}
                            <h4 className="font-bold text-slate-800 text-xs sm:text-sm group-hover:text-emerald-700 line-clamp-2 transition-colors">
                              {product.nombre}
                            </h4>

                            {/* Piece Counter Tag if present & > 0 */}
                            {product.cantPiezas !== undefined && product.cantPiezas > 0 && (
                              <div className="mt-1 flex items-center gap-1 text-[10px] text-teal-700 bg-teal-50 border border-teal-100 rounded-md px-1.5 py-0.5 w-fit font-bold">
                                <Package className="w-3 h-3 text-teal-600 shrink-0" />
                                <span>{product.cantPiezas} piezas</span>
                              </div>
                            )}
                          </div>

                          {/* Pricing block */}
                          <div className="pt-1.5 border-t border-slate-100 mt-1">
                            {product.descuento > 0 ? (
                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-xs text-slate-400 gap-2">
                                  <span>Antes:</span>
                                  <span className="line-through">L. {product.precioNormal.toLocaleString()}</span>
                                </div>
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-emerald-700 font-bold text-xs flex items-center gap-1">
                                    <Tag className="w-3.5 h-3.5 text-emerald-500 rotate-90 shrink-0" />
                                    Oferta:
                                  </span>
                                  <span className="text-sm sm:text-base md:text-lg font-extrabold text-emerald-600 whitespace-nowrap">
                                    L. {(product.precioNormal - product.descuento).toLocaleString()}
                                  </span>
                                </div>
                                {product.fechaHasta && (
                                  <div className="mt-1 flex items-center justify-between text-[9px] text-rose-600 bg-rose-50/70 px-1.5 py-0.5 border border-rose-100 rounded font-bold">
                                    <span className="flex items-center gap-0.5">
                                      <Clock className="w-2.5 h-2.5 shrink-0" />
                                      Hasta:
                                    </span>
                                    <span className="whitespace-nowrap">{formatDiscountDate(product.fechaHasta)}</span>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="flex items-center justify-between py-0.5 gap-2">
                                <span className="text-slate-500 font-bold text-xs">
                                  Precio:
                                </span>
                                <span className="text-sm sm:text-base md:text-lg font-extrabold text-slate-800 whitespace-nowrap">
                                  L. {product.precioNormal.toLocaleString()}
                                </span>
                              </div>
                            )}

                            {/* Order button */}
                            <button
                              disabled={isOutOfStock}
                              onClick={() => onAddToCart(product)}
                              className={`w-full mt-2 py-1.5 sm:py-2 px-3 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold transition-all duration-200 cursor-pointer ${
                                isOutOfStock 
                                  ? "bg-slate-100 text-slate-400" 
                                  : "bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white shadow-xs"
                              }`}
                            >
                              Agregar al carrito
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: REAL-TIME TRACKING */}
        {activeClientTab === "tracking" && (
          <div className="space-y-6 max-w-3xl mx-auto">
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 text-center space-y-4">
              <div className="size-14 bg-emerald-50 rounded-full flex items-center justify-center mx-auto text-emerald-600">
                <Truck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-slate-900">Seguimiento de tu fardo</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                  Introduce el código de orden generado durante la compra (por ejemplo, <strong>ORDEN001</strong>) para conocer su estado de preparación y envío en tiempo real.
                </p>
              </div>

              <div className="flex gap-2 max-w-md mx-auto pt-2">
                <input
                  type="text"
                  value={trackingCodeInput}
                  onChange={(e) => setTrackingCodeInput(e.target.value)}
                  placeholder="Ej: ORDEN001"
                  className="flex-1 bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-xl px-4 py-2.5 text-xs font-mono focus:outline-hidden font-bold uppercase"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const found = orders.find(o => o.id.trim().toUpperCase() === trackingCodeInput.trim().toUpperCase());
                      setTrackedOrder(found || "notfound");
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    const found = orders.find(o => o.id.trim().toUpperCase() === trackingCodeInput.trim().toUpperCase());
                    setTrackedOrder(found || "notfound");
                  }}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-all cursor-pointer shadow-sm"
                >
                  Buscar
                </button>
              </div>
            </div>

            {/* Tracking detail block */}
            {trackedOrder && trackedOrder !== "notfound" && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-3xl border border-slate-100 shadow-md overflow-hidden"
              >
                {/* Header card */}
                <div className="bg-slate-900 p-6 text-white flex flex-wrap justify-between items-center gap-4">
                  <div>
                    <span className="text-[10px] text-emerald-300 font-extrabold uppercase tracking-widest bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">LIVE: EN TIEMPO REAL</span>
                    <h4 className="text-lg font-black font-mono mt-1">Pedido #{trackedOrder.id}</h4>
                    <p className="text-xs text-slate-400 mt-0.5">Fecha: {new Date(trackedOrder.fecha).toLocaleDateString("es-HN", { hour: "numeric", minute: "numeric" })}</p>
                  </div>
                  <div>
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-extrabold uppercase tracking-wider ${
                      trackedOrder.status === "Completado" 
                        ? "bg-emerald-500/25 text-emerald-300" 
                        : trackedOrder.status === "Enviado"
                        ? "bg-blue-500/25 text-blue-300"
                        : trackedOrder.status === "Confirmado"
                        ? "bg-amber-500/25 text-amber-300"
                        : trackedOrder.status === "Cancelado"
                        ? "bg-rose-500/25 text-rose-300"
                        : "bg-slate-700 text-slate-300"
                    }`}>
                      <Package className="w-3.5 h-3.5" />
                      {trackedOrder.status}
                    </span>
                  </div>
                </div>

                {/* Progress Stepper bar */}
                <div className="p-6 border-b border-slate-100">
                  <h5 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest mb-6">Progreso del Pedido</h5>
                  
                  <div className="relative flex items-center justify-between">
                    {/* Background track line */}
                    <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1 bg-slate-100 -z-0"></div>
                    
                    {/* Colored track progress */}
                    <div 
                      className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-emerald-500 -z-0 transition-all duration-550"
                      style={{
                        width: 
                          trackedOrder.status === "Pendiente" ? "0%" :
                          trackedOrder.status === "Confirmado" ? "33%" :
                          trackedOrder.status === "Enviado" ? "66%" :
                          trackedOrder.status === "Completado" ? "100%" : "0%"
                      }}
                    ></div>

                    {/* Stepper Node 1 */}
                    <div className="flex flex-col items-center relative z-10">
                      <div className="size-8 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold shadow-md">1</div>
                      <span className="text-[10px] sm:text-xs font-bold text-slate-800 mt-2">Registrado</span>
                    </div>

                    {/* Stepper Node 2 */}
                    <div className="flex flex-col items-center relative z-10">
                      <div className={`size-8 rounded-full flex items-center justify-center text-xs font-bold transition-all shadow-sm ${
                        ["Confirmado", "Enviado", "Completado"].includes(trackedOrder.status)
                          ? "bg-emerald-600 text-white shadow-md"
                          : "bg-slate-200 text-slate-500"
                      }`}>2</div>
                      <span className="text-[10px] sm:text-xs font-bold text-slate-800 mt-2">Preparado</span>
                    </div>

                    {/* Stepper Node 3 */}
                    <div className="flex flex-col items-center relative z-10">
                      <div className={`size-8 rounded-full flex items-center justify-center text-xs font-bold transition-all shadow-sm ${
                        ["Enviado", "Completado"].includes(trackedOrder.status)
                          ? "bg-emerald-600 text-white shadow-md"
                          : "bg-slate-200 text-slate-500"
                      }`}>3</div>
                      <span className="text-[10px] sm:text-xs font-bold text-slate-800 mt-2">Despachado</span>
                    </div>

                    {/* Stepper Node 4 */}
                    <div className="flex flex-col items-center relative z-10">
                      <div className={`size-8 rounded-full flex items-center justify-center text-xs font-bold transition-all shadow-sm ${
                        trackedOrder.status === "Completado"
                          ? "bg-emerald-500 text-white shadow-md"
                          : "bg-slate-200 text-slate-500"
                      }`}>4</div>
                      <span className="text-[10px] sm:text-xs font-bold text-slate-800 mt-2">Recibido</span>
                    </div>
                  </div>
                </div>

                {/* Tracking information info log list */}
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 border-b border-slate-100 bg-slate-50/50">
                  <div className="space-y-3">
                    <h5 className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Detalles de Entrega</h5>
                    <div className="text-xs text-slate-600 space-y-1.5">
                      <p><strong>Destinatario:</strong> {trackedOrder.clienteNombre}</p>
                      <p><strong>Teléfono:</strong> {trackedOrder.clienteTelefono}</p>
                      <p><strong>Municipio / Región:</strong> {trackedOrder.municipio || "Honduras"}</p>
                      <p><strong>Dirección:</strong> {trackedOrder.clienteDireccion}</p>
                      {trackedOrder.clienteNotas && (
                        <p className="bg-amber-50 text-amber-800 border border-amber-100 p-2.5 rounded-xl text-[11px] mt-2 italic">
                          "Notas: {trackedOrder.clienteNotas}"
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h5 className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Pago y Envío</h5>
                    <div className="text-xs text-slate-600 space-y-1.5">
                      <p><strong>Forma de Pago:</strong> {trackedOrder.paymentMethod}</p>
                      <p><strong>Precio Regular:</strong> L. {trackedOrder.totalNormal.toLocaleString()}</p>
                      <p><strong>Descuento Aplicado:</strong> L. {trackedOrder.totalDescuento.toLocaleString()}</p>
                      <p className="text-emerald-700 bg-emerald-50/70 py-1.5 px-3 rounded-lg border border-emerald-100 inline-block">
                        <strong>Monto Final Pagado:</strong> <span className="font-extrabold text-sm">L. {trackedOrder.totalEfectivo.toLocaleString()}</span>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Items listing */}
                <div className="p-6 space-y-3.5">
                  <h5 className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Fardos / Prendas de esta Orden</h5>
                  <div className="space-y-3">
                    {trackedOrder.items.map((item) => (
                      <div key={item.id} className="flex items-center gap-3 bg-white p-3 border border-slate-100 rounded-xl">
                        {!item.imagen || 
                         item.imagen.trim() === "" || 
                         item.imagen.includes("photo-1523381210434-271e8be1f52b") || 
                         imageErrors[item.id] ? (
                          <div className="size-11 shrink-0 overflow-hidden rounded-lg">
                            <ProductImageFallback id={item.id} size="xs" />
                          </div>
                        ) : (
                          <img 
                            src={item.imagen} 
                            className="size-11 object-cover rounded-lg shrink-0" 
                            alt={item.nombre}
                            onError={() => {
                              setImageErrors(prev => ({ ...prev, [item.id]: true }));
                            }}
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <h6 className="font-bold text-slate-800 text-xs truncate">{item.nombre}</h6>
                          <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono font-bold mt-0.5">
                            <span>COD: {item.id} • Categoría: {item.categoria}</span>
                            <span>Cant: {item.cantidad}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-4 bg-slate-50 text-center border-t border-slate-100">
                  <p className="text-[10px] text-slate-400">Si requieres asistencia inmediata o deseas modificar tu fardo, contáctanos indicando el ID de orden.</p>
                </div>
              </motion.div>
            )}

            {trackedOrder === "notfound" && (
              <div className="bg-amber-50/50 border border-amber-200 rounded-3xl p-6 text-center space-y-2">
                <p className="text-sm text-amber-700 font-bold">⚠️ Código de pedido no encontrado</p>
                <p className="text-xs text-slate-500">Verifica que esté escrito exactamente como se te asignó al finalizar tu compra (ej: ORDEN001).</p>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: CLIENT REVIEWS */}
        {activeClientTab === "reviews" && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
              
              {/* Form panel card */}
              <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-4">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">Déjanos tu opinión</h4>
                  <p className="text-xs text-slate-500 mt-0.5">Tu feedback es sumamente valioso para ayudar a la comunidad.</p>
                </div>

                <form onSubmit={async (e) => {
                  e.preventDefault();
                  if (!reviewName.trim() || !reviewComment.trim()) return;
                  setIsSubmittingReview(true);
                  const success = await onSubmitReview({
                    nombre: reviewName.trim(),
                    calificacion: reviewRating,
                    comentario: reviewComment.trim(),
                    producto: reviewProduct
                  });
                  setIsSubmittingReview(false);
                  if (success) {
                    alert("¡Gracias! Tu reseña ha sido guardada y sincronizada directamente con Google Sheets.");
                    setReviewName("");
                    setReviewComment("");
                    setReviewProduct("General");
                  } else {
                    alert("Ocurrió un error al guardar tu opinión.");
                  }
                }} className="space-y-3.5">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Tu Nombre *</label>
                    <input 
                      type="text" 
                      required 
                      value={reviewName}
                      onChange={(e) => setReviewName(e.target.value)}
                      placeholder="Ej: Sofía Martínez"
                      className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-xl py-2 px-3 text-xs focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Calificación *</label>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setReviewRating(star)}
                          className="p-1 cursor-pointer hover:scale-110 transition-transform"
                        >
                          <Star className={`w-5 h-5 ${star <= reviewRating ? "text-amber-400 fill-amber-400" : "text-slate-200"}`} />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Fardo / Prenda Comprada</label>
                    <select
                      value={reviewProduct}
                      onChange={(e) => setReviewProduct(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 rounded-xl py-2 px-2.5 text-xs focus:outline-hidden cursor-pointer"
                    >
                      <option value="General">Opinión General / Tienda</option>
                      {products.map(p => (
                        <option key={p.id} value={`${p.id} - ${p.nombre}`}>{p.id} - {p.nombre}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Tu Mensaje *</label>
                    <textarea
                      required
                      rows={3}
                      value={reviewComment}
                      onChange={(e) => setReviewComment(e.target.value)}
                      placeholder="Cuéntanos más acerca del estado del fardo, envío o atención..."
                      className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-xl py-2 px-3 text-xs focus:outline-hidden font-sans"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmittingReview}
                    className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-100 disabled:text-slate-400 text-white font-bold text-xs py-2.5 rounded-xl transition-all cursor-pointer shadow-sm"
                  >
                    {isSubmittingReview ? "Enviando..." : "Sincronizar Reseña"}
                  </button>
                </form>
              </div>

              {/* Reviews Feed panel */}
              <div className="md:col-span-2 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">Opiniones de Compradores</h4>
                    <p className="text-xs text-slate-500">Historial de clientes satisfechos que han comprado fardos.</p>
                  </div>
                  <div className="text-right sm:text-left bg-emerald-50 rounded-2xl py-2 px-4 border border-emerald-100 flex items-center gap-2">
                    <Star className="w-4 h-4 text-emerald-600 fill-emerald-600" />
                    <span className="font-extrabold text-sm text-emerald-800">
                      {(reviews.reduce((sum, r) => sum + r.calificacion, 0) / (reviews.length || 1)).toFixed(1)} / 5.0
                    </span>
                  </div>
                </div>

                {reviews.length === 0 ? (
                  <div className="bg-slate-50 border border-slate-200 rounded-3xl py-12 text-center text-slate-500">
                    <MessageSquare className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p className="text-xs font-bold">Sé el primero en compartir tu opinión</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Escribe tu reseña en el formulario lateral.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4">
                    {reviews.map((rev) => (
                      <div key={rev.id} className="bg-white border border-slate-100 shadow-xs p-5 rounded-3xl flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-black text-slate-800 font-sans">{rev.nombre}</span>
                            <span className="text-[9px] text-slate-400 font-mono">{rev.fecha.substring(0, 10)}</span>
                          </div>
                          
                          <div className="flex gap-0.5 mb-2.5">
                            {Array.from({ length: 5 }).map((_, starIdx) => (
                              <Star 
                                key={starIdx} 
                                className={`w-3.5 h-3.5 ${starIdx < rev.calificacion ? "text-amber-400 fill-amber-400" : "text-slate-150 text-slate-200"}`} 
                              />
                            ))}
                          </div>

                          <p className="text-slate-600 text-xs italic leading-relaxed font-sans mt-1">"{rev.comentario}"</p>
                        </div>

                        {rev.producto && (
                          <div className="mt-3 pt-2.5 border-t border-slate-50 text-[10px] font-bold text-emerald-700 flex items-center gap-1">
                            <Package className="w-3 h-3 text-emerald-600 shrink-0" />
                            <span>Referencia: {rev.producto}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Product Zoom Modal Drawer */}
      <AnimatePresence>
        {selectedProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedProduct(null)}
              className="fixed inset-0 bg-black/80 backdrop-blur-xs"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white w-full max-w-3xl rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden relative z-10 border border-slate-100 grid grid-cols-1 md:grid-cols-2"
            >
              {/* Product Close Button */}
              <button
                onClick={() => setSelectedProduct(null)}
                className="absolute top-3 right-3 z-20 p-1.5 bg-slate-900/80 text-white hover:bg-slate-800 rounded-full transition-all cursor-pointer leading-none text-xl w-8 h-8 flex items-center justify-center"
              >
                &times;
              </button>

              {/* Box Image */}
              <div className="bg-slate-100 aspect-square md:aspect-auto md:h-[400px] overflow-hidden relative">
                {!selectedProduct.imagen || 
                 selectedProduct.imagen.trim() === "" || 
                 selectedProduct.imagen.includes("photo-1523381210434-271e8be1f52b") || 
                 imageErrors[selectedProduct.id] ? (
                  <ProductImageFallback id={selectedProduct.id} />
                ) : (
                  <img
                    src={selectedProduct.imagen}
                    alt={selectedProduct.nombre}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover select-none"
                    onError={() => {
                      setImageErrors(prev => ({ ...prev, [selectedProduct.id]: true }));
                    }}
                  />
                )}
              </div>

              {/* Box Info */}
              <div className="p-4 sm:p-5 flex flex-col justify-between gap-3">
                <div>
                  <div className="flex items-center justify-between text-xs font-mono font-bold text-emerald-600 mb-1.5">
                    <span>COD: {selectedProduct.id}</span>
                    <span className="uppercase bg-emerald-50 border border-emerald-150 text-emerald-800 px-2 py-0.5 rounded-md text-[10px]">
                      {selectedProduct.categoria}
                    </span>
                  </div>

                  <h2 className="text-lg sm:text-xl font-extrabold text-slate-800 tracking-tight leading-snug mb-3">
                    {selectedProduct.nombre}
                  </h2>

                   {/* High-efficiency Grid for Stock & Price */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-2">
                    {/* Stock Status Box */}
                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 flex flex-col justify-center">
                      <div className="flex justify-between items-center">
                        <span className="block text-[9px] uppercase font-bold text-slate-400">Inventario</span>
                        {selectedProduct.cantPiezas !== undefined && selectedProduct.cantPiezas > 0 && (
                          <span className="inline-flex items-center gap-0.5 text-[9px] bg-teal-50 text-teal-700 px-1.5 py-0.5 rounded border border-teal-100 font-bold">
                            {selectedProduct.cantPiezas} pzs
                          </span>
                        )}
                      </div>
                      <strong className={`text-sm font-extrabold mt-0.5 ${selectedProduct.stock > 0 ? "text-emerald-700" : "text-rose-600"}`}>
                        {selectedProduct.stock > 0 ? `${selectedProduct.stock} unidades` : "Agotado"}
                      </strong>
                    </div>

                    {/* Pricing Box */}
                    <div className="bg-emerald-50/45 rounded-xl p-2.5 border border-emerald-50 flex flex-col justify-center">
                      {selectedProduct.descuento > 0 ? (
                        <div className="space-y-0.5">
                          <div className="flex justify-between items-center text-[10px] text-slate-400">
                            <span>Antes:</span>
                            <span className="line-through">L. {selectedProduct.precioNormal.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between items-center gap-1.5">
                            <span className="text-emerald-800 font-bold text-[10px] flex items-center gap-0.5 shrink-0">
                              Oferta:
                            </span>
                            <span className="text-base font-black text-emerald-600 whitespace-nowrap">
                              L. {(selectedProduct.precioNormal - selectedProduct.descuento).toLocaleString()}
                            </span>
                          </div>
                          {selectedProduct.fechaHasta && (
                            <div className="text-[9px] text-rose-600 bg-rose-50 border border-rose-100 px-1 py-0.5 rounded-sm mt-0.5 font-bold text-center">
                              Oferta válida hasta: <span className="font-extrabold whitespace-nowrap">{formatDiscountDate(selectedProduct.fechaHasta)}</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex justify-between items-center py-1">
                          <span className="text-slate-500 font-bold text-[10px]">Precio:</span>
                          <span className="text-base font-black text-slate-800 whitespace-nowrap">
                            L. {selectedProduct.precioNormal.toLocaleString()}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-2 mt-auto">
                  <button
                    disabled={selectedProduct.stock <= 0}
                    onClick={() => {
                      onAddToCart(selectedProduct);
                      setSelectedProduct(null);
                    }}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-100 disabled:text-slate-400 py-2.5 rounded-xl text-xs font-bold text-white transition-all shadow-xs cursor-pointer active:scale-98"
                  >
                    Agregar prenda al carrito
                  </button>
                  <button
                    onClick={() => setSelectedProduct(null)}
                    className="w-full text-[11px] font-bold text-slate-400 hover:text-slate-600 transition-colors py-0.5 cursor-pointer"
                  >
                    Cerrar Detalle
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating Cart Button (FAB) */}
      <AnimatePresence>
        {cartCount > 0 && (
          <motion.button
            initial={{ scale: 0, opacity: 0, y: 50 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0, opacity: 0, y: 50 }}
            onClick={onOpenCart}
            className="fixed bottom-6 right-6 z-40 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full p-4 shadow-2xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2 focus:outline-hidden cursor-pointer"
            id="floating-cart-fab"
            title="Ver Bolsa de Compras"
          >
            <span className="relative flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path>
              </svg>
              <span className="absolute -top-2.5 -right-2.5 bg-rose-650 bg-rose-600 text-[10px] text-white font-black w-5.5 h-5.5 rounded-full flex items-center justify-center border-2 border-emerald-600">
                {cartCount}
              </span>
            </span>
            <span className="hidden sm:inline font-bold text-xs uppercase tracking-wider pr-1">Ver Bolsa</span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
