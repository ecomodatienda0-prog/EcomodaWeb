export interface CompanyInfo {
  name: string;
  phone: string;
  address: string;
  hours: string;
  bankDetails: string;
  cashDiscountPercent: number;
  // Extended fields from Datos_Empresa
  department?: string;
  municipio?: string;
  googleMapsLink?: string;
  logo?: string;
}

export interface Product {
  id: string; // Codigo_Fardo
  nombre: string; // Producto
  categoria: string; // Categoria
  talla: string; // derived fallback or layout placeholder
  precioNormal: number; // Precio_Normal
  precioEfectivo: number; // Precio_Efectivo
  descuento: number; // Descuento (amount subtraction)
  imagen: string; // Foto_Fardo
  stock: number; // Existencia
  visible: boolean; // visibility
  codigoSimple?: string; // Codigo_Simple
  fechaHasta?: string; // Fecha_Hasta
  cantPiezas?: number; // Cant_Piezas
}

export interface OrderItem {
  id: string;
  nombre: string;
  talla: string;
  categoria: string;
  precioNormal: number;
  precioEfectivo: number;
  imagen: string;
  cantidad: number;
}

export interface Order {
  id: string;
  fecha: string;
  clienteNombre: string;
  clienteEmail: string;
  clienteTelefono: string;
  clienteDireccion: string;
  clienteNotas?: string;
  paymentMethod: "Efectivo" | "Transferencia" | "Tarjeta";
  items: OrderItem[];
  totalNormal: number;
  totalEfectivo: number;
  totalDescuento: number;
  status: "Pendiente" | "Confirmado" | "Enviado" | "Completado" | "Cancelado";
  // Extended details for Ventas Sheet Columns
  municipio?: string;
  usuarioVendedor?: string;
}

export interface CartItem extends Product {
  cantidad: number;
}

export interface Review {
  id: string;
  fecha: string;
  nombre: string;
  calificacion: number;
  comentario: string;
  producto: string; // associated Codigo_Fardo or product name
}

export interface Customer {
  id: string;
  nombre: string;
  prefijoPais: string;
  contacto: string;
  correo: string;
  municipio: string;
  direccionExacta: string;
}

export interface User {
  idUsuario: string;     // ID_Usuario
  nombre: string;        // Nombre
  prefijoPais: string;   // Prefijo_Pais
  contacto: string;      // Contacto
  correo: string;        // Correo
  password: string;      // Password
  foto: string;          // Foto
  rol: string;           // Rol
  estadoPerfil: string;  // Estado_Perfil
  ultimoAcceso: string;  // Ultimo_Acceso
}

