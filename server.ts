import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { google } from "googleapis";

// Local database file path
const DB_FILE = path.join(process.cwd(), "db.json");
const UPLOADS_DIR = path.join(process.cwd(), "uploads");

// Ensure uploads folder exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Interfaces matching types.ts
interface CompanyInfo {
  name: string;
  phone: string;
  address: string;
  hours: string;
  bankDetails: string;
  cashDiscountPercent: number;
  department?: string;
  municipio?: string;
  googleMapsLink?: string;
  logo?: string;
}

interface OrderItem {
  id: string;
  nombre: string;
  talla: string;
  categoria: string;
  precioNormal: number;
  precioEfectivo: number;
  imagen: string;
  cantidad: number;
}

interface Order {
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
  municipio?: string;
  usuarioVendedor?: string;
}

interface Product {
  id: string; // Codigo_Fardo
  nombre: string; // Producto
  categoria: string; // Categoria
  talla: string; // Talla
  precioNormal: number; // Precio_Normal
  precioEfectivo: number; // Precio_Efectivo
  descuento: number; // Descuento subtraction value
  imagen: string; // Foto_Fardo
  stock: number; // Existencia
  visible: boolean;
  codigoSimple?: string;
  fechaHasta?: string;
  cantPiezas?: number;
}

interface Review {
  id: string;
  fecha: string;
  nombre: string;
  calificacion: number;
  comentario: string;
  producto: string;
}

interface Customer {
  id: string;
  nombre: string;
  prefijoPais: string;
  contacto: string;
  correo: string;
  municipio: string;
  direccionExacta: string;
}

interface User {
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

interface GoogleToken {
  accessToken: string;
  expiryDate?: number;
}

interface LocalDB {
  spreadsheetId: string;
  appsScriptUrl?: string;
  companyInfo: CompanyInfo;
  orders: Order[];
  productOverrides: Record<string, Partial<Product>>;
  cachedProducts: Product[];
  cachedAt: number | null;
  reviews: Review[];
  customers: Customer[];
  users: User[];
  googleToken: GoogleToken | null;
}

const DEFAULT_DB: LocalDB = {
  spreadsheetId: "1jy5o7FqHbsKkurjPmBosOE-SnpDuCkm5Z4-bullnZUw", // direct default spreadsheet ID
  appsScriptUrl: "",
  companyInfo: {
    name: "Fardos Ecomoda",
    phone: "+504 9547-1667",
    address: "Comayagua Comayagua, Calle Principal contigo a estadio carlos miranda",
    hours: "Lunes a Sábado: 9:00 AM - 7:00 PM | Domingo: 10:00 AM - 5:00 PM",
    bankDetails: "BAC Credomatic - Cuenta de Ahorros: 750924172\nA nombre de: Ecomoda S. de R. L.",
    cashDiscountPercent: 2,
    department: "Comayagua",
    municipio: "Comayagua",
    googleMapsLink: "",
    logo: "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=100&h=100&fit=crop",
  },
  orders: [],
  productOverrides: {},
  cachedProducts: [],
  cachedAt: null,
  reviews: [],
  customers: [],
  users: [],
  googleToken: null,
};

// Database helper functions
function getDB(): LocalDB {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(DEFAULT_DB, null, 2));
    return DEFAULT_DB;
  }
  try {
    const content = fs.readFileSync(DB_FILE, "utf-8");
    const data = JSON.parse(content);
    // Fill in placeholders if absent
    if (!data.reviews) data.reviews = [];
    if (!data.customers) data.customers = [];
    if (!data.users) data.users = [];
    if (!data.googleToken) data.googleToken = null;
    if (!data.orders) data.orders = [];
    if (!data.productOverrides) data.productOverrides = {};
    if (!data.cachedProducts) data.cachedProducts = [];
    if (data.appsScriptUrl === undefined) data.appsScriptUrl = "";

    // Sanitize polluted values (HTML/JS garbage) that may have slipped in from unauthorized spreadsheet URLs
    const isGarbage = (val: string) => {
      if (!val) return false;
      const s = String(val);
      return (
        s.includes("</style>") ||
        s.includes("<script") ||
        s.includes("function ") ||
        s.includes("/*#") ||
        s.includes("use strict") ||
        s.length > 80
      );
    };

    let needsCleanSave = false;
    if (Array.isArray(data.reviews) && data.reviews.length > 0) {
      const originalLength = data.reviews.length;
      data.reviews = data.reviews.filter((r: any) => r && r.id && !isGarbage(r.id) && !isGarbage(r.comentario));
      if (data.reviews.length !== originalLength) needsCleanSave = true;
    }
    if (Array.isArray(data.customers) && data.customers.length > 0) {
      const originalLength = data.customers.length;
      data.customers = data.customers.filter((c: any) => c && c.id && !isGarbage(c.id) && !isGarbage(c.nombre));
      if (data.customers.length !== originalLength) needsCleanSave = true;
    }
    if (Array.isArray(data.users) && data.users.length > 0) {
      const originalLength = data.users.length;
      data.users = data.users.filter((u: any) => u && u.idUsuario && !isGarbage(u.idUsuario) && !isGarbage(u.nombre));
      if (data.users.length !== originalLength) needsCleanSave = true;
    }

    if (needsCleanSave) {
      console.log("Database contained HTML/JS garbage records from unshared spreadsheet fallback. Cleaned and saved successfully.");
      fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
    }

    return data as LocalDB;
  } catch (error) {
    console.error("Error reading database file, returning defaults", error);
    return DEFAULT_DB;
  }
}

function saveDB(data: LocalDB) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("Error saving database file", error);
  }
}

// Google Sheets Client Creator helper
function getSheetsClient(accessToken: string) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.sheets({ version: "v4", auth });
}

// Convert index position into spreadsheet column letter
function getColLetter(index: number): string {
  let letter = "";
  let temp = index;
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter || "A";
}

// Parse custom formatted local date to DD/MM/YYYY hh:mm:ss
function formatLocalTimestamp(date: Date): string {
  const d = date.getDate().toString().padStart(2, "0");
  const m = (date.getMonth() + 1).toString().padStart(2, "0");
  const y = date.getFullYear();
  const h = date.getHours().toString().padStart(2, "0");
  const min = date.getMinutes().toString().padStart(2, "0");
  const s = date.getSeconds().toString().padStart(2, "0");
  return `${d}/${m}/${y} ${h}:${min}:${s}`;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

  // Serve static uploaded files
  app.use("/uploads", express.static(UPLOADS_DIR));

  // --- API API ROUTES ---

  // Get Store Configuration and Info
  app.get("/api/config", (req, res) => {
    const db = getDB();
    res.json({
      spreadsheetId: db.spreadsheetId,
      appsScriptUrl: db.appsScriptUrl || "",
      companyInfo: db.companyInfo,
      cachedAt: db.cachedAt,
      googleTokenActive: !!db.googleToken,
    });
  });

  // Update Store Configuration
  app.post("/api/config", (req, res) => {
    const { spreadsheetId, appsScriptUrl, companyInfo } = req.body;
    const db = getDB();

    if (spreadsheetId !== undefined) {
      db.spreadsheetId = spreadsheetId;
    }
    if (appsScriptUrl !== undefined) {
      db.appsScriptUrl = appsScriptUrl;
    }
    if (companyInfo !== undefined) {
      db.companyInfo = { ...db.companyInfo, ...companyInfo };
    }

    saveDB(db);
    res.json({ success: true, config: { spreadsheetId: db.spreadsheetId, appsScriptUrl: db.appsScriptUrl, companyInfo: db.companyInfo } });
  });

  // Test connection to Google Apps Script
  app.post("/api/config/test", async (req, res) => {
    const { spreadsheetId, appsScriptUrl } = req.body;
    if (!spreadsheetId) {
      return res.status(400).json({ success: false, error: "El ID de Google Sheets es requerido." });
    }
    if (!appsScriptUrl) {
      return res.status(400).json({ success: false, error: "La URL de Apps Script es requerida." });
    }

    try {
      const trimmedUrl = appsScriptUrl.trim();
      const separator = trimmedUrl.includes("?") ? "&" : "?";
      const testUrl = `${trimmedUrl}${separator}action=readAll&spreadsheetId=${spreadsheetId.trim()}`;
      
      console.log(`Testing Apps Script connection at: ${testUrl}`);
      const response = await fetch(testUrl);
      
      if (response.ok) {
        const text = await response.text();
        let data: any;
        try {
          data = JSON.parse(text);
        } catch (parseErr) {
          return res.json({ 
            success: false, 
            error: "La respuesta no es de tipo JSON. Asegúrate de haber publicado tu Apps Script como una Aplicación Web con acceso para 'Cualquiera' (Anyone)." 
          });
        }

        if (data && data.error) {
          return res.json({ success: false, error: `Google Apps Script devolvió un error: ${data.error}` });
        }
        
        return res.json({ success: true, sheets: Object.keys(data) });
      } else {
        return res.json({ success: false, error: `Apps Script respondió con estatus HTTP ${response.status}.` });
      }
    } catch (e: any) {
      return res.json({ success: false, error: `No se pudo conectar: ${e.message || String(e)}` });
    }
  });

  // Store Google OAuth Bearer token from Admin Consent Flow
  app.post("/api/config/google-token", (req, res) => {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ error: "Token string is required" });
    }

    const db = getDB();
    db.googleToken = {
      accessToken: token,
      expiryDate: Date.now() + 3500 * 1000, // typically expires in 1 hour
    };
    saveDB(db);
    console.log("Successfully saved OAuth Credentials on the server!");
    res.json({ success: true });
  });

  // Revoke Google Integration
  app.post("/api/config/google-token/revoke", (req, res) => {
    const db = getDB();
    db.googleToken = null;
    saveDB(db);
    res.json({ success: true });
  });

  // Fetch Inventory (Merged cache, sheet data, and overrides)
  app.get("/api/products", async (req, res) => {
    const db = getDB();
    const CACHE_STALL_MS = 15 * 60 * 1000; // 15 mins cache
    const forceSync = req.query.sync === "true";

    // Standard non-forced cache read
    if (!forceSync && db.cachedProducts.length > 0 && db.cachedAt && (Date.now() - db.cachedAt < CACHE_STALL_MS)) {
      const merged = applyOverrides(db.cachedProducts, db.productOverrides);
      return res.json({ products: merged, source: "cache", cachedAt: db.cachedAt });
    }

    // Try Google Sheets synchronization
    if (db.spreadsheetId && db.spreadsheetId !== "") {
      try {
        console.log(`Synchronizing database from Google sheet: ${db.spreadsheetId}`);
        
        // Mode 0: Google Apps Script Web App sync
        if (db.appsScriptUrl && db.appsScriptUrl.trim() !== "") {
          try {
            await syncAncillarySheets(db);
            saveDB(db);
            const merged = applyOverrides(db.cachedProducts, db.productOverrides);
            return res.json({ products: merged, source: "apps-script", cachedAt: db.cachedAt });
          } catch (appsScriptErr: any) {
            console.warn("Apps Script fetch failed in product sync, falling back to other routes:", appsScriptErr.message || appsScriptErr);
          }
        }

        let rows: string[][] = [];

        // Mode A: Direct Google Sheets API if we've saved OAuth tokens
        if (db.googleToken && db.googleToken.accessToken) {
          try {
            const sheets = getSheetsClient(db.googleToken.accessToken);
            const response = await sheets.spreadsheets.values.get({
              spreadsheetId: db.spreadsheetId,
              range: "'Productos en Linea'!A1:K1000",
            });
            if (response.data.values) {
              rows = response.data.values;
              console.log(`Fetched ${rows.length} rows directly from Sheets API!`);
            }
          } catch (apiError: any) {
            console.warn("Direct Sheets API sync failed, shifting to public CSV backup:", apiError.message || apiError);
            // invalidate token if we hit unauthorized
            if (apiError.status === 401) {
              db.googleToken = null;
              saveDB(db);
            }
          }
        }

        // Mode B: Public CSV Fetch Export backup
        if (rows.length === 0) {
          const csvUrl = `https://docs.google.com/spreadsheets/d/${db.spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent("Productos en Linea")}`;
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout

          const response = await fetch(csvUrl, { signal: controller.signal });
          clearTimeout(timeoutId);

          if (!response.ok) {
            throw new Error(`CSV download failed with status ${response.status}`);
          }

          const csvText = await response.text();
          rows = parseCSV(csvText);
          console.log(`Parsed ${rows.length} lines via CSV fetch!`);
        }

        if (rows.length > 1) {
          const parsedProducts = mapRowsToProducts(rows);
          if (parsedProducts.length > 0) {
            db.cachedProducts = parsedProducts;
            db.cachedAt = Date.now();

            // Await synchronization of ancillary data: profile, reviews, customers, users!
            try {
              await syncAncillarySheets(db);
            } catch (ancillaryErr) {
              console.error("Ancillary sync failed during product sync:", ancillaryErr);
            }

            saveDB(db);
            const merged = applyOverrides(db.cachedProducts, db.productOverrides);
            return res.json({ products: merged, source: "sheets", cachedAt: db.cachedAt });
          }
        }
      } catch (error: any) {
        console.error("Sheets sync failed, returning existing database cache:", error.message || error);
      }
    }

    // Default Fallback Cache
    const merged = applyOverrides(db.cachedProducts, db.productOverrides);
    res.json({ products: merged, source: "fallback-cache", cachedAt: db.cachedAt });
  });

  // Apply visual overrides (e.g. customized images, manual price changes)
  app.post("/api/products/override", (req, res) => {
    const { productId, field, value } = req.body;
    if (!productId || !field) {
      return res.status(400).json({ error: "productId and field are required" });
    }

    const db = getDB();
    if (!db.productOverrides[productId]) {
      db.productOverrides[productId] = {};
    }

    db.productOverrides[productId][field] = value;
    saveDB(db);

    res.json({ success: true, override: db.productOverrides[productId] });
  });

  // Reset product overrides
  app.post("/api/products/reset-overrides", (req, res) => {
    const db = getDB();
    db.productOverrides = {};
    saveDB(db);
    res.json({ success: true });
  });

  // Base64 Image Upload
  app.post("/api/upload", (req, res) => {
    const { filename, base64 } = req.body;
    if (!filename || !base64) {
      return res.status(400).json({ error: "filename and base64 string are required" });
    }

    try {
      // clean base64 data header if present
      const cleanBase64 = base64.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(cleanBase64, "base64");

      // generate secure path
      const ext = path.extname(filename) || ".png";
      const cleanName = path.basename(filename, ext).replace(/[^a-z0-9_-]/gi, "_");
      const uniqueName = `${cleanName}_${Date.now()}${ext}`;
      const destPath = path.join(UPLOADS_DIR, uniqueName);

      fs.writeFileSync(destPath, buffer);

      const imageUrl = `/uploads/${uniqueName}`;
      res.json({ success: true, imageUrl });
    } catch (error: any) {
      console.error("Upload error:", error);
      res.status(500).json({ error: `Upload failed: ${error.message}` });
    }
  });

  // Place a new Order
  app.post("/api/orders", async (req, res) => {
    const { order } = req.body;
    if (!order || !order.clienteNombre || !order.clienteTelefono || !order.items || order.items.length === 0) {
      return res.status(400).json({ error: "Datos de pedido inválidos" });
    }

    const db = getDB();
    
    // Auto-increment order ID to respect "ORDEN001", "ORDEN002", etc...
    let lastOrderNum = 0;
    db.orders.forEach(o => {
      const numMatch = o.id.match(/\d+/);
      const num = numMatch ? parseInt(numMatch[0]) : 0;
      if (num > lastOrderNum) lastOrderNum = num;
    });

    const newOrderId = `ORDEN${String(lastOrderNum + 1).padStart(3, "0")}`;
    const timestampStr = formatLocalTimestamp(new Date());

    const newOrder: Order = {
      id: newOrderId,
      fecha: new Date().toISOString(),
      clienteNombre: order.clienteNombre,
      clienteEmail: order.clienteEmail || "",
      clienteTelefono: order.clienteTelefono,
      clienteDireccion: order.clienteDireccion,
      clienteNotas: order.clienteNotas || "",
      paymentMethod: order.paymentMethod || "Efectivo",
      items: order.items,
      totalNormal: order.totalNormal,
      totalEfectivo: order.totalEfectivo,
      totalDescuento: order.totalDescuento,
      status: "Pendiente",
      municipio: order.municipio || db.companyInfo.municipio || "Comayagua",
    };

    // Deduct stock from cached products
    order.items.forEach((item: OrderItem) => {
      const idx = db.cachedProducts.findIndex(p => p.id === item.id);
      if (idx !== -1) {
        db.cachedProducts[idx].stock = Math.max(0, db.cachedProducts[idx].stock - item.cantidad);
      }
    });

    // Save locally first to guarantee fast purchase responses
    db.orders.unshift(newOrder);

    // Save client profile in local database list
    const clientPhoneClean = order.clienteTelefono.replace(/[^0-9]/g, "");
    let existingCustomer = db.customers.find(c => c.contacto.replace(/[^0-9]/g, "") === clientPhoneClean);
    if (!existingCustomer) {
      const newCliId = `CLI${String(db.customers.length + 1).padStart(3, "0")}`;
      existingCustomer = {
        id: newCliId,
        nombre: order.clienteNombre,
        prefijoPais: "504",
        contacto: order.clienteTelefono.replace(/^\+504\s*/, ""),
        correo: order.clienteEmail || "",
        municipio: order.municipio || db.companyInfo.municipio || "Comayagua",
        direccionExacta: order.clienteDireccion,
      };
      db.customers.push(existingCustomer);
    }
    
    saveDB(db);

    // Try Google Sheets Writing Asynchronously so we never block checkout!
    if (db.spreadsheetId && db.spreadsheetId !== "") {
      // Run in background without awaiting so we return the client response instantly!
      (async () => {
        try {
          console.log(`Writing order ${newOrderId} dynamically to Google Sheets...`);
          
          // Ventas Columns: Id_Venta, Fecha, Prefijo, Contacto, Nombre_Cliente, Municipio, Direccion_Exacta, Subtotal, Descuento, Pago_Efectivo, Pago_Transferencia, Pago_Tarjeta, ISV, Monto_Total, Estado, Notas_del_pedido, Tipo_Pago, Usuario_Vendedor
          const pEfectivoVal = newOrder.paymentMethod === "Efectivo" ? `L.${Math.round(newOrder.totalEfectivo).toLocaleString()}` : "L.0";
          const pTransfVal = newOrder.paymentMethod === "Transferencia" ? `L.${Math.round(newOrder.totalEfectivo).toLocaleString()}` : "L.0";
          const pTarjetaVal = newOrder.paymentMethod === "Tarjeta" ? `L.${Math.round(newOrder.totalNormal).toLocaleString()}` : "L.0";
          const totalPaidVal = newOrder.paymentMethod === "Tarjeta" ? `L.${Math.round(newOrder.totalNormal).toLocaleString()}` : `L.${Math.round(newOrder.totalEfectivo).toLocaleString()}`;

          const ventasValues = [
            newOrderId,
            timestampStr,
            "504",
            newOrder.clienteTelefono.replace(/^\+504\s*/, ""),
            newOrder.clienteNombre,
            newOrder.municipio || "",
            newOrder.clienteDireccion,
            `L.${Math.round(newOrder.totalNormal).toLocaleString()}`,
            `L.${Math.round(newOrder.totalDescuento).toLocaleString()}`,
            pEfectivoVal,
            pTransfVal,
            pTarjetaVal,
            "L.0",
            totalPaidVal,
            "Pendiente",
            newOrder.clienteNotas || "",
            newOrder.paymentMethod,
            newOrder.usuarioVendedor || "",
          ];

          // 2. Prepare Ventas_Detalles Rows
          const detallesRows: any[][] = [];
          newOrder.items.forEach((it, idx) => {
            const detailId = `${newOrderId}-D${String(idx + 1).padStart(3, "0")}`;
            const itemDiscount = it.precioNormal - it.precioEfectivo;
            const finalItemPrice = it.precioEfectivo;
            const finalItemTotal = finalItemPrice * it.cantidad;

            detallesRows.push([
              detailId,
              newOrderId,
              timestampStr,
              it.id,
              it.nombre,
              it.cantidad,
              `L.${Math.round(it.precioNormal).toLocaleString()}`,
              `L.${Math.round(itemDiscount).toLocaleString()}`,
              `L.${Math.round(finalItemPrice).toLocaleString()}`,
              `L.${Math.round(finalItemTotal).toLocaleString()}`,
            ]);
          });

          // 3. Prepare Customer Row if new
          const clientesValues = existingCustomer ? [
            existingCustomer.id,
            existingCustomer.nombre,
            existingCustomer.prefijoPais,
            existingCustomer.contacto,
            existingCustomer.correo,
            existingCustomer.municipio,
            existingCustomer.direccionExacta,
          ] : null;

          // Mode 0: Google Apps Script Web App writing (Primary)
          if (db.appsScriptUrl && db.appsScriptUrl.trim() !== "") {
            try {
              console.log("Writing order data using primary Apps Script Web App...");
              const wroteVenta = await appendWithAppsScript(db, "Ventas", ventasValues);
              if (wroteVenta) {
                for (const row of detallesRows) {
                  await appendWithAppsScript(db, "Ventas_Detalles", row);
                }
                if (existingCustomer && clientesValues) {
                  await appendWithAppsScript(db, "Clientes", clientesValues);
                }
                console.log(`Successfully wrote everything to Google Sheets via Apps Script Web App!`);
                return; // Perfect success, skip OAuth fallback
              }
            } catch (asErr: any) {
              console.warn("Apps Script order write failed, trying fallback direct Sheets API:", asErr.message || asErr);
            }
          }

          // Mode A: Fallback direct Google Sheets API if we've saved OAuth tokens
          if (db.googleToken && db.googleToken.accessToken) {
            const token = db.googleToken.accessToken;
            const sheets = getSheetsClient(token);

            await sheets.spreadsheets.values.append({
              spreadsheetId: db.spreadsheetId,
              range: "Ventas!A:R",
              valueInputOption: "USER_ENTERED",
              requestBody: { values: [ventasValues] },
            });

            await sheets.spreadsheets.values.append({
              spreadsheetId: db.spreadsheetId,
              range: "Ventas_Detalles!A:J",
              valueInputOption: "USER_ENTERED",
              requestBody: { values: detallesRows },
            });

            if (existingCustomer && clientesValues) {
              await sheets.spreadsheets.values.append({
                spreadsheetId: db.spreadsheetId,
                range: "Clientes!A:G",
                valueInputOption: "USER_ENTERED",
                requestBody: { values: [clientesValues] },
              });
            }
            console.log(`Pristinely wrote order ${newOrderId} to ALL Google Sheets tabs via OAuth!`);
          }
        } catch (sheetsError: any) {
          console.error("Async Google Sheets sync failed but transaction succeeded locally:", sheetsError.message || sheetsError);
        }
      })();
    }

    res.json({ success: true, orderId: newOrderId, order: newOrder });
  });

  // Get Orders (Admin)
  app.get("/api/orders", (req, res) => {
    const db = getDB();
    res.json({ orders: db.orders });
  });

  // Update Order Status (Admin)
  app.put("/api/orders/:id/status", async (req, res) => {
    const orderId = req.params.id;
    const { status, usuarioVendedor } = req.body;

    if (status && !["Pendiente", "Confirmado", "Enviado", "Completado", "Cancelado"].includes(status)) {
      return res.status(400).json({ error: "Invalid status value" });
    }

    const db = getDB();
    const orderIdx = db.orders.findIndex(o => o.id === orderId);

    if (orderIdx === -1) {
      return res.status(404).json({ error: "Order not found" });
    }

    if (status !== undefined) {
      db.orders[orderIdx].status = status;
    }
    if (usuarioVendedor !== undefined) {
      db.orders[orderIdx].usuarioVendedor = usuarioVendedor;
    }
    saveDB(db);

    // Try live status write to Google Sheets Ventas spreadsheet
    if (db.spreadsheetId && db.spreadsheetId !== "") {
      (async () => {
        try {
          let wroteWithAppsScript = false;
          if (db.appsScriptUrl && db.appsScriptUrl.trim() !== "") {
            let okStatus = true;
            let okSeller = true;
            if (status !== undefined) {
              okStatus = await updateRowWithAppsScript(db, "Ventas", 0, orderId, 14, status);
            }
            if (usuarioVendedor !== undefined) {
              okSeller = await updateRowWithAppsScript(db, "Ventas", 0, orderId, 17, usuarioVendedor);
            }
            wroteWithAppsScript = okStatus && okSeller;
          }

          if (!wroteWithAppsScript && db.googleToken && db.googleToken.accessToken) {
            const token = db.googleToken.accessToken;
            console.log(`Live updating order ${orderId} inside Google Sheets Status: ${status}, Seller: ${usuarioVendedor}...`);
            // Find row inside Ventas tab (Id_Venta column is usually cell-index 0)
            const sheets = getSheetsClient(token);
            const response = await sheets.spreadsheets.values.get({
              spreadsheetId: db.spreadsheetId,
              range: "Ventas!A:R",
            });

            const rows = response.data.values;
            if (rows) {
              const rowIndex = rows.findIndex(r => r[0] === orderId);
              if (rowIndex !== -1) {
                // "Estado" column is index 14 (O in A1 notations: A=0, B=1... O=14)
                if (status !== undefined) {
                  const cellRange = `Ventas!O${rowIndex + 1}`;
                  await sheets.spreadsheets.values.update({
                    spreadsheetId: db.spreadsheetId,
                    range: cellRange,
                    valueInputOption: "USER_ENTERED",
                    requestBody: { values: [[status]] },
                  });
                  console.log(`Live cell updated successfully: ${cellRange} with status ${status}`);
                }

                // "Usuario_Vendedor" column is index 17 (R in A1 notations: R=18th column)
                if (usuarioVendedor !== undefined) {
                  const cellRange = `Ventas!R${rowIndex + 1}`;
                  await sheets.spreadsheets.values.update({
                    spreadsheetId: db.spreadsheetId,
                    range: cellRange,
                    valueInputOption: "USER_ENTERED",
                    requestBody: { values: [[usuarioVendedor]] },
                  });
                  console.log(`Live cell updated successfully: ${cellRange} with seller ${usuarioVendedor}`);
                }
              }
            }
          }
        } catch (err: any) {
          console.error("Sheets live cell update failed:", err.message || err);
        }
      })();
    }

    res.json({ success: true, order: db.orders[orderIdx] });
  });

  // Fetch reviews (Client + Admin)
  app.get("/api/reviews", (req, res) => {
    const db = getDB();
    res.json({ reviews: db.reviews });
  });

  // Admin login credential validation via sheet or fallback
  app.post("/api/admin/login", async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: "Correo y contraseña son obligatorios." });
    }

    const db = getDB();
    const cleanEmail = email.trim().toLowerCase();

    // Check if user is in synced sheet database
    let authenticatedUser = db.users.find(
      u => u.correo.trim().toLowerCase() === cleanEmail && u.password === password
    );

    // Fallback credential for safety / recovery
    if (!authenticatedUser && cleanEmail === "ecomodatienda0@gmail.com" && password === "Honduras1231") {
      authenticatedUser = {
        idUsuario: "DEFAULT_ADMIN",
        nombre: "Administrador General",
        prefijoPais: "504",
        contacto: "9547-1667",
        correo: "ecomodatienda0@gmail.com",
        password: "Honduras1231",
        foto: "",
        rol: "Admin",
        estadoPerfil: "Activo",
        ultimoAcceso: "Nunca",
      };
    }

    if (authenticatedUser) {
      if (authenticatedUser.estadoPerfil && authenticatedUser.estadoPerfil.toLowerCase() === "inactivo") {
        return res.status(403).json({ success: false, error: "Tu perfil de usuario se encuentra inactivo." });
      }

      // Update Ultimo_Acceso timestamp
      const nowStr = formatLocalTimestamp(new Date());
      authenticatedUser.ultimoAcceso = nowStr;

      // Update in memory copy
      const storedIdx = db.users.findIndex(u => u.correo.trim().toLowerCase() === cleanEmail);
      if (storedIdx !== -1) {
        db.users[storedIdx].ultimoAcceso = nowStr;
      }
      saveDB(db);

      // Log/Update Ultimo_Acceso back to Google Sheets if possible
      if (db.spreadsheetId && db.spreadsheetId !== "") {
        (async () => {
          try {
            let wroteWithAppsScript = false;
            if (db.appsScriptUrl && db.appsScriptUrl.trim() !== "") {
              // Users tab, key column index 4 (correo), target column index 9 (ultimoAcceso/ultimo_acceso)
              wroteWithAppsScript = await updateRowWithAppsScript(db, "Usuarios", 4, cleanEmail, 9, nowStr);
            }

            if (!wroteWithAppsScript && db.googleToken && db.googleToken.accessToken) {
              const token = db.googleToken.accessToken;
              const sheets = getSheetsClient(token);
              const response = await sheets.spreadsheets.values.get({
                spreadsheetId: db.spreadsheetId,
                range: "Usuarios!A:J",
              });
              const rows = response.data.values;
              if (rows) {
                const rowIndex = rows.findIndex(r => r[4] && r[4].trim().toLowerCase() === cleanEmail);
                if (rowIndex !== -1) {
                  // "Ultimo_Acceso" is the 10th column (J, index 9)
                  const cellRange = `Usuarios!J${rowIndex + 1}`;
                  await sheets.spreadsheets.values.update({
                    spreadsheetId: db.spreadsheetId,
                    range: cellRange,
                    valueInputOption: "USER_ENTERED",
                    requestBody: { values: [[nowStr]] },
                  });
                  console.log(`Updated Ultimo_Acceso in sheets for ${cleanEmail}`);
                }
              }
            }
          } catch (e: any) {
            console.error("Failed to update User Ultimo_Acceso in Google Sheets:", e.message || e);
          }
        })();
      }

      return res.json({ success: true, user: { ...authenticatedUser, password: "" } });
    }

    return res.status(401).json({ success: false, error: "Correo o contraseña incorrectos." });
  });

  // Get active users (for Admin salesperson dropdown selector)
  app.get("/api/users", (req, res) => {
    const db = getDB();
    res.json({ users: db.users });
  });

  // Get synced customer profiles (Clientes Sheet)
  app.get("/api/customers", (req, res) => {
    const db = getDB();
    res.json({ customers: db.customers || [] });
  });

  // Submit product review
  app.post("/api/reviews", async (req, res) => {
    const { review } = req.body;
    if (!review || !review.nombre || !review.calificacion || !review.comentario || !review.producto) {
      return res.status(400).json({ error: "Missing review properties" });
    }

    const db = getDB();
    const newReviewId = `REV${String(db.reviews.length + 1).padStart(3, "0")}`;
    const timestampStr = formatLocalTimestamp(new Date());

    const newReview: Review = {
      id: newReviewId,
      fecha: new Date().toISOString(),
      nombre: review.nombre,
      calificacion: parseInt(review.calificacion) || 5,
      comentario: review.comentario,
      producto: review.producto,
    };

    db.reviews.push(newReview);
    saveDB(db);

    // Write to Google Sheets Resenias tab if connected
    if (db.spreadsheetId && db.spreadsheetId !== "") {
      (async () => {
        try {
          // Resenias Columns: ID_Resenia, Fecha, Nombre, Calificacion, Comentario, Producto
          const values = [
            newReviewId,
            timestampStr,
            newReview.nombre,
            newReview.calificacion,
            newReview.comentario,
            newReview.producto,
          ];

          let wroteWithAppsScript = false;
          if (db.appsScriptUrl && db.appsScriptUrl.trim() !== "") {
            wroteWithAppsScript = await appendWithAppsScript(db, "Resenias", values);
          }

          if (!wroteWithAppsScript && db.googleToken && db.googleToken.accessToken) {
            const token = db.googleToken.accessToken;
            const sheets = getSheetsClient(token);
            await sheets.spreadsheets.values.append({
              spreadsheetId: db.spreadsheetId,
              range: "Resenias!A:F",
              valueInputOption: "USER_ENTERED",
              requestBody: { values: [values] },
            });
            console.log(`Appended review ${newReviewId} directly to Google Sheets!`);
          }
        } catch (e: any) {
          console.error("Google Sheets review append failed:", e.message || e);
        }
      })();
    }

    res.json({ success: true, review: newReview });
  });

  // ==========================================
  // REAL-TIME SYNCHRONIZATION HELPERS (CRUD -> SHEETS)
  // ==========================================

  async function ensureGoogleSheetsStructure(db: any): Promise<void> {
    if (!db.spreadsheetId) return;
    
    // Check if we have token
    if (!db.googleToken || !db.googleToken.accessToken) {
      return;
    }
    
    try {
      const sheets = getSheetsClient(db.googleToken.accessToken);
      const spreadsheet = await sheets.spreadsheets.get({
        spreadsheetId: db.spreadsheetId,
      });
      
      const existingTitles = new Set(
        spreadsheet.data.sheets?.map(s => s.properties?.title).filter(Boolean) as string[]
      );

      const requiredSheets = [
        {
          name: "Productos en Linea",
          headers: ["Codigo_Fardo", "Producto", "Precio_Efectivo", "Existencia", "Precio_Normal", "Codigo_Simple", "Descuento", "Fecha_Hasta", "Cant_Piezas", "Foto_Fardo", "Categoria"]
        },
        {
          name: "Ventas",
          headers: ["Id_Venta", "Fecha", "Prefijo", "Contacto", "Nombre_Cliente", "Municipio", "Direccion_Exacta", "Subtotal", "Descuento", "Pago_Efectivo", "Pago_Transferencia", "Pago_Tarjeta", "ISV", "Monto_Total", "Estado", "Notas_del_pedido", "Tipo_Pago", "Usuario_Vendedor"]
        },
        {
          name: "Ventas_Detalles",
          headers: ["ID_Venta_Detalle", "Id_Venta", "Fecha", "Codigo_Fardo", "Producto", "Cantidad_Producto", "Precio_Normal", "Descuento", "Precio_Descuento", "Monto_Final"]
        },
        {
          name: "Datos_Empresa",
          headers: ["Nombre", "Prefijo_Pais", "Contacto", "Departamento", "Municipio", "Direccion", "Coordenadas", "Logo_Img", "Horario"]
        },
        {
          name: "Resenias",
          headers: ["ID_Resenia", "Fecha", "Nombre", "Calificacion", "Comentario", "Producto"]
        },
        {
          name: "Clientes",
          headers: ["Id_Cliente", "Nombre", "Prefijo", "Contacto", "Correo", "Municipio", "Direccion_Exacta"]
        },
        {
          name: "Usuarios",
          headers: ["ID_Usuario", "Nombre", "Prefijo", "Contacto", "Correo", "Password", "Foto", "Rol", "Estado_Perfil", "Ultimo_Acceso"]
        }
      ];

      const requests: any[] = [];
      for (const reqSheet of requiredSheets) {
        if (!existingTitles.has(reqSheet.name)) {
          requests.push({
            addSheet: {
              properties: { title: reqSheet.name }
            }
          });
        }
      }

      if (requests.length > 0) {
        console.log(`Creating ${requests.length} missing sheets in Google Spreadsheet...`);
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: db.spreadsheetId,
          requestBody: { requests }
        });
        
        // Append headers
        for (const reqSheet of requiredSheets) {
          if (!existingTitles.has(reqSheet.name)) {
            await sheets.spreadsheets.values.update({
              spreadsheetId: db.spreadsheetId,
              range: `'${reqSheet.name}'!A1`,
              valueInputOption: "USER_ENTERED",
              requestBody: {
                values: [reqSheet.headers]
              }
            });
          }
        }
        console.log("Successfully created missing sheets and initialized structures.");
      }
    } catch (err: any) {
      console.error("Error in ensureGoogleSheetsStructure:", err.message || err);
    }
  }

  async function syncTabToGoogleSheet(db: any, tabName: string): Promise<{ success: boolean; error?: string }> {
    if (!db.spreadsheetId || db.spreadsheetId === "") {
      return { success: false, error: "El ID de Google Spreadsheet no está configurado." };
    }
    
    // Ensure all 7 sheets exist
    await ensureGoogleSheetsStructure(db);

    let values: any[][] = [];
    
    if (tabName === "Productos en Linea") {
      values.push(["Codigo_Fardo", "Producto", "Precio_Efectivo", "Existencia", "Precio_Normal", "Codigo_Simple", "Descuento", "Fecha_Hasta", "Cant_Piezas", "Foto_Fardo", "Categoria"]);
      db.cachedProducts.forEach((p: any) => {
        values.push([
          p.id,
          p.nombre,
          p.precioEfectivo,
          p.stock,
          p.precioNormal,
          p.codigoSimple || "",
          p.descuento,
          p.fechaHasta || "",
          p.cantPiezas || 0,
          p.imagen,
          p.categoria
        ]);
      });
    } else if (tabName === "Ventas") {
      values.push(["Id_Venta", "Fecha", "Prefijo", "Contacto", "Nombre_Cliente", "Municipio", "Direccion_Exacta", "Subtotal", "Descuento", "Pago_Efectivo", "Pago_Transferencia", "Pago_Tarjeta", "ISV", "Monto_Total", "Estado", "Notas_del_pedido", "Tipo_Pago", "Usuario_Vendedor"]);
      db.orders.forEach((o: any) => {
        const pEfectivoVal = o.paymentMethod === "Efectivo" ? `L.${Math.round(o.totalEfectivo || 0).toLocaleString()}` : "L.0";
        const pTransfVal = o.paymentMethod === "Transferencia" ? `L.${Math.round(o.totalEfectivo || 0).toLocaleString()}` : "L.0";
        const pTarjetaVal = o.paymentMethod === "Tarjeta" ? `L.${Math.round(o.totalNormal || 0).toLocaleString()}` : "L.0";
        const totalPaidVal = o.paymentMethod === "Tarjeta" ? `L.${Math.round(o.totalNormal || 0).toLocaleString()}` : `L.${Math.round(o.totalEfectivo || 0).toLocaleString()}`;
        
        values.push([
          o.id,
          formatLocalTimestamp(new Date(o.fecha)),
          "504",
          o.clienteTelefono.replace(/^\+504\s*/, ""),
          o.clienteNombre,
          o.municipio || "",
          o.clienteDireccion,
          `L.${Math.round(o.totalNormal || 0).toLocaleString()}`,
          `L.${Math.round(o.totalDescuento || 0).toLocaleString()}`,
          pEfectivoVal,
          pTransfVal,
          pTarjetaVal,
          "L.0",
          totalPaidVal,
          o.status,
          o.clienteNotas || "",
          o.paymentMethod,
          o.usuarioVendedor || ""
        ]);
      });
    } else if (tabName === "Ventas_Detalles") {
      values.push(["ID_Venta_Detalle", "Id_Venta", "Fecha", "Codigo_Fardo", "Producto", "Cantidad_Producto", "Precio_Normal", "Descuento", "Precio_Descuento", "Monto_Final"]);
      db.orders.forEach((o: any) => {
        o.items.forEach((it: any, idx: number) => {
          const detailId = `${o.id}-D${String(idx + 1).padStart(3, "0")}`;
          const itemDiscount = it.precioNormal - it.precioEfectivo;
          const finalItemPrice = it.precioEfectivo;
          const finalItemTotal = finalItemPrice * it.cantidad;
          
          values.push([
            detailId,
            o.id,
            formatLocalTimestamp(new Date(o.fecha)),
            it.id,
            it.nombre,
            it.cantidad,
            `L.${Math.round(it.precioNormal || 0).toLocaleString()}`,
            `L.${Math.round(itemDiscount || 0).toLocaleString()}`,
            `L.${Math.round(finalItemPrice || 0).toLocaleString()}`,
            `L.${Math.round(finalItemTotal || 0).toLocaleString()}`
          ]);
        });
      });
    } else if (tabName === "Datos_Empresa") {
      values.push(["Nombre", "Prefijo_Pais", "Contacto", "Departamento", "Municipio", "Direccion", "Coordenadas", "Logo_Img", "Horario"]);
      values.push([
        db.companyInfo.name,
        "+504",
        db.companyInfo.phone.replace(/^\+504\s*/, ""),
        db.companyInfo.department || "",
        db.companyInfo.municipio || "",
        db.companyInfo.address,
        db.companyInfo.googleMapsLink || "",
        db.companyInfo.logo || "",
        db.companyInfo.hours
      ]);
    } else if (tabName === "Resenias") {
      values.push(["ID_Resenia", "Fecha", "Nombre", "Calificacion", "Comentario", "Producto"]);
      db.reviews.forEach((r: any) => {
        values.push([
          r.id,
          formatLocalTimestamp(new Date(r.fecha)),
          r.nombre,
          r.calificacion,
          r.comentario,
          r.producto
        ]);
      });
    } else if (tabName === "Clientes") {
      values.push(["Id_Cliente", "Nombre", "Prefijo", "Contacto", "Correo", "Municipio", "Direccion_Exacta"]);
      db.customers.forEach((c: any) => {
        values.push([
          c.id,
          c.nombre,
          c.prefijoPais,
          c.contacto,
          c.correo,
          c.municipio,
          c.direccionExacta
        ]);
      });
    } else if (tabName === "Usuarios") {
      values.push(["ID_Usuario", "Nombre", "Prefijo", "Contacto", "Correo", "Password", "Foto", "Rol", "Estado_Perfil", "Ultimo_Acceso"]);
      db.users.forEach((u: any) => {
        values.push([
          u.idUsuario,
          u.nombre,
          u.prefijoPais,
          u.contacto,
          u.correo,
          u.password,
          u.foto,
          u.rol,
          u.estadoPerfil,
          u.ultimoAcceso || ""
        ]);
      });
    }

    let appsScriptError: string | null = null;

    // Attempt Web App first
    if (db.appsScriptUrl && db.appsScriptUrl.trim() !== "") {
      try {
        const payload = {
          action: "writeAll",
          spreadsheetId: db.spreadsheetId,
          sheet: tabName,
          values: values
        };
        const response = await fetch(db.appsScriptUrl.trim(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        if (response.ok) {
          const resJson = await response.json().catch(() => null);
          if (resJson && resJson.success === true) {
            console.log(`Rewrote ${values.length} rows to "${tabName}" via Apps Script Web App!`);
            return { success: true };
          } else {
            appsScriptError = resJson && resJson.error 
              ? String(resJson.error) 
              : "La respuesta no es un JSON de éxito. Asegúrate de haber guardado y publicado tu Google Apps Script con acceso configurado para 'Cualquiera' (Anyone).";
            console.warn(`Apps Script writeAll failed or returned error for sheet ${tabName}: ${appsScriptError}`);
          }
        } else {
          appsScriptError = `HTTP status ${response.status}`;
          console.warn(`Apps Script writeAll failed for sheet ${tabName} with status ${response.status}`);
        }
      } catch (err: any) {
        appsScriptError = err.message || String(err);
        console.warn(`Apps Script writeAll failed for sheet ${tabName}:`, appsScriptError);
      }
    }

    // Direct API fallback
    if (db.googleToken && db.googleToken.accessToken) {
      try {
        const sheets = getSheetsClient(db.googleToken.accessToken);
        await sheets.spreadsheets.values.clear({
          spreadsheetId: db.spreadsheetId,
          range: `'${tabName}'!A1:Z5000`,
        });
        await sheets.spreadsheets.values.update({
          spreadsheetId: db.spreadsheetId,
          range: `'${tabName}'!A1`,
          valueInputOption: "USER_ENTERED",
          requestBody: { values },
        });
        console.log(`Rewrote ${values.length} rows to "${tabName}" via direct Google API!`);
        return { success: true };
      } catch (err: any) {
        console.error(`Google API direct update failed for sheet ${tabName}:`, err.message || err);
        return { success: false, error: `Direct Google API failed: ${err.message || err}` + (appsScriptError ? ` (Apps Script error: ${appsScriptError})` : "") };
      }
    }

    if (appsScriptError) {
      return { success: false, error: `Apps Script error: ${appsScriptError}` };
    }

    return { success: false, error: "No se configuró la URL de Google Apps Script ni credenciales directas de Google." };
  }

  // ==========================================
  // NEW ENDPOINTS: ADMINISTRATIVE CUSTOM CRUD ACTIONS
  // ==========================================

  // PRODUCTS CRUD
  app.post("/api/products", async (req, res) => {
    const db = getDB();
    const newProd = req.body;
    if (db.cachedProducts.some(p => p.id === newProd.id)) {
      return res.status(400).json({ error: "El Código de Fardo ya existe." });
    }
    db.cachedProducts.push(newProd);
    db.cachedAt = Date.now();
    saveDB(db);
    const syncRes = await syncTabToGoogleSheet(db, "Productos en Linea");
    res.json({ success: true, product: newProd, syncError: syncRes.success ? null : syncRes.error });
  });

  app.put("/api/products/:id", async (req, res) => {
    const db = getDB();
    const prodId = req.params.id;
    const idx = db.cachedProducts.findIndex(p => p.id === prodId);
    if (idx === -1) return res.status(404).json({ error: "Producto no encontrado." });
    db.cachedProducts[idx] = { ...db.cachedProducts[idx], ...req.body };
    db.cachedAt = Date.now();
    saveDB(db);
    const syncRes = await syncTabToGoogleSheet(db, "Productos en Linea");
    res.json({ success: true, product: db.cachedProducts[idx], syncError: syncRes.success ? null : syncRes.error });
  });

  app.delete("/api/products/:id", async (req, res) => {
    const db = getDB();
    const prodId = req.params.id;
    db.cachedProducts = db.cachedProducts.filter(p => p.id !== prodId);
    db.cachedAt = Date.now();
    saveDB(db);
    const syncRes = await syncTabToGoogleSheet(db, "Productos en Linea");
    res.json({ success: true, syncError: syncRes.success ? null : syncRes.error });
  });

  // USERS CRUD
  app.post("/api/users", async (req, res) => {
    const db = getDB();
    const newUser = req.body;
    if (db.users.some(u => u.idUsuario === newUser.idUsuario || u.correo === newUser.correo)) {
      return res.status(400).json({ error: "Usuario o Correo ya registrado." });
    }
    db.users.push(newUser);
    saveDB(db);
    const syncRes = await syncTabToGoogleSheet(db, "Usuarios");
    res.json({ success: true, user: newUser, syncError: syncRes.success ? null : syncRes.error });
  });

  app.put("/api/users/:id", async (req, res) => {
    const db = getDB();
    const userId = req.params.id;
    const idx = db.users.findIndex(u => u.idUsuario === userId);
    if (idx === -1) return res.status(404).json({ error: "Usuario no encontrado." });
    db.users[idx] = { ...db.users[idx], ...req.body };
    saveDB(db);
    const syncRes = await syncTabToGoogleSheet(db, "Usuarios");
    res.json({ success: true, user: db.users[idx], syncError: syncRes.success ? null : syncRes.error });
  });

  app.delete("/api/users/:id", async (req, res) => {
    const db = getDB();
    const userId = req.params.id;
    db.users = db.users.filter(u => u.idUsuario !== userId);
    saveDB(db);
    const syncRes = await syncTabToGoogleSheet(db, "Usuarios");
    res.json({ success: true, syncError: syncRes.success ? null : syncRes.error });
  });

  // REVIEWS CRUD (POST is already defined above, but we add PUT/DELETE)
  app.put("/api/reviews/:id", async (req, res) => {
    const db = getDB();
    const rId = req.params.id;
    const idx = db.reviews.findIndex(r => r.id === rId);
    if (idx === -1) return res.status(404).json({ error: "Reseña no encontrada." });
    db.reviews[idx] = { ...db.reviews[idx], ...req.body };
    saveDB(db);
    const syncRes = await syncTabToGoogleSheet(db, "Resenias");
    res.json({ success: true, review: db.reviews[idx], syncError: syncRes.success ? null : syncRes.error });
  });

  app.delete("/api/reviews/:id", async (req, res) => {
    const db = getDB();
    const rId = req.params.id;
    db.reviews = db.reviews.filter(r => r.id !== rId);
    saveDB(db);
    const syncRes = await syncTabToGoogleSheet(db, "Resenias");
    res.json({ success: true, syncError: syncRes.success ? null : syncRes.error });
  });

  // CUSTOMERS CRUD
  app.post("/api/customers", async (req, res) => {
    const db = getDB();
    const newCust = req.body;
    if (db.customers.some(c => c.id === newCust.id || c.contacto === newCust.contacto)) {
      return res.status(400).json({ error: "Cliente ya registrado." });
    }
    db.customers.push(newCust);
    saveDB(db);
    const syncRes = await syncTabToGoogleSheet(db, "Clientes");
    res.json({ success: true, customer: newCust, syncError: syncRes.success ? null : syncRes.error });
  });

  app.put("/api/customers/:id", async (req, res) => {
    const db = getDB();
    const cId = req.params.id;
    const idx = db.customers.findIndex(c => c.id === cId);
    if (idx === -1) return res.status(404).json({ error: "Cliente no encontrado." });
    db.customers[idx] = { ...db.customers[idx], ...req.body };
    saveDB(db);
    const syncRes = await syncTabToGoogleSheet(db, "Clientes");
    res.json({ success: true, customer: db.customers[idx], syncError: syncRes.success ? null : syncRes.error });
  });

  app.delete("/api/customers/:id", async (req, res) => {
    const db = getDB();
    const cId = req.params.id;
    db.customers = db.customers.filter(c => c.id !== cId);
    saveDB(db);
    const syncRes = await syncTabToGoogleSheet(db, "Clientes");
    res.json({ success: true, syncError: syncRes.success ? null : syncRes.error });
  });

  // ORDERS/SALES CRUD
  app.post("/api/admin/orders", async (req, res) => {
    const db = getDB();
    const newOrder = req.body;
    db.orders.unshift(newOrder);
    saveDB(db);
    const sync1 = await syncTabToGoogleSheet(db, "Ventas");
    const sync2 = await syncTabToGoogleSheet(db, "Ventas_Detalles");
    const combinedError = (!sync1.success || !sync2.success) 
      ? [sync1.error, sync2.error].filter(Boolean).join(" | ")
      : null;
    res.json({ success: true, order: newOrder, syncError: combinedError });
  });

  app.put("/api/orders/:id", async (req, res) => {
    const db = getDB();
    const orderId = req.params.id;
    const idx = db.orders.findIndex(o => o.id === orderId);
    if (idx === -1) return res.status(404).json({ error: "Pedido no encontrado." });
    db.orders[idx] = { ...db.orders[idx], ...req.body };
    saveDB(db);
    const sync1 = await syncTabToGoogleSheet(db, "Ventas");
    const sync2 = await syncTabToGoogleSheet(db, "Ventas_Detalles");
    const combinedError = (!sync1.success || !sync2.success)
      ? [sync1.error, sync2.error].filter(Boolean).join(" | ")
      : null;
    res.json({ success: true, order: db.orders[idx], syncError: combinedError });
  });

  app.delete("/api/orders/:id", async (req, res) => {
    const db = getDB();
    const orderId = req.params.id;
    db.orders = db.orders.filter(o => o.id !== orderId);
    saveDB(db);
    const sync1 = await syncTabToGoogleSheet(db, "Ventas");
    const sync2 = await syncTabToGoogleSheet(db, "Ventas_Detalles");
    const combinedError = (!sync1.success || !sync2.success)
      ? [sync1.error, sync2.error].filter(Boolean).join(" | ")
      : null;
    res.json({ success: true, syncError: combinedError });
  });

  // Force-Full Sheets Sync endpoint
  app.post("/api/sync-all", async (req, res) => {
    const db = getDB();
    try {
      await syncAncillarySheets(db);
      // Run the main product check
      let rows: string[][] = [];
      if (db.googleToken && db.googleToken.accessToken) {
        try {
          const sheets = getSheetsClient(db.googleToken.accessToken);
          const response = await sheets.spreadsheets.values.get({
            spreadsheetId: db.spreadsheetId,
            range: "'Productos en Linea'!A1:K1000",
          });
          if (response.data.values) rows = response.data.values;
        } catch (e) {
          console.warn("Direct Products sync failing during deep-sync", e);
        }
      }
      if (rows.length === 0) {
        const csvUrl = `https://docs.google.com/spreadsheets/d/${db.spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent("Productos en Linea")}`;
        const response = await fetch(csvUrl);
        if (response.ok) {
          const text = await response.text();
          rows = parseCSV(text);
        }
      }

      if (rows.length > 1) {
        db.cachedProducts = mapRowsToProducts(rows);
        db.cachedAt = Date.now();
      }

      saveDB(db);
      res.json({ success: true, config: db.companyInfo, reviewsCount: db.reviews.length, productsCount: db.cachedProducts.length });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message || err });
    }
  });

  // Helpers
  function applyOverrides(products: Product[], overrides: Record<string, Partial<Product>>): Product[] {
    return products.map(product => {
      const pOverride = overrides[product.id];
      if (pOverride) {
        return { ...product, ...pOverride };
      }
      return product;
    });
  }

  async function appendWithAppsScript(db: LocalDB, sheet: string, values: any[]) {
    if (!db.appsScriptUrl || db.appsScriptUrl.trim() === "") return false;
    try {
      const payload = {
        action: "append",
        spreadsheetId: db.spreadsheetId,
        sheet: sheet,
        values: values
      };
      const response = await fetch(db.appsScriptUrl.trim(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (response.ok) {
        console.log(`Successfully appended row to ${sheet} via Apps Script Web App!`);
        return true;
      } else {
        console.warn(`Apps Script append returned status ${response.status}`);
      }
    } catch (err: any) {
      console.error(`Apps Script append to ${sheet} failed:`, err.message || err);
    }
    return false;
  }

  async function updateRowWithAppsScript(db: LocalDB, sheet: string, keyColumnIndex: number, keyValue: string, targetColumnIndex: number, value: any) {
    if (!db.appsScriptUrl || db.appsScriptUrl.trim() === "") return false;
    try {
      const payload = {
        action: "updateRow",
        spreadsheetId: db.spreadsheetId,
        sheet: sheet,
        keyColumnIndex: keyColumnIndex,
        keyValue: keyValue,
        targetColumnIndex: targetColumnIndex,
        value: value
      };
      const response = await fetch(db.appsScriptUrl.trim(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (response.ok) {
        console.log(`Successfully updated row in ${sheet} key=${keyValue} via Apps Script Web App!`);
        return true;
      } else {
        console.warn(`Apps Script updateRow returned status ${response.status}`);
      }
    } catch (err: any) {
      console.error(`Apps Script updateRow in ${sheet} failed:`, err.message || err);
    }
    return false;
  }

  // Sync auxiliary sheets: Company information, reviews, and customer database
  async function syncAncillarySheets(db: LocalDB) {
    if (!db.spreadsheetId || db.spreadsheetId === "" || db.spreadsheetId.startsWith("1B_4I0Ruyb4D")) return;

    // Fast-path Apps Script Bidirectional Sync
    if (db.appsScriptUrl && db.appsScriptUrl.trim() !== "") {
      try {
        console.log(`Syncing all pages via Google Apps Script Web App... URL: ${db.appsScriptUrl}`);
        const separator = db.appsScriptUrl.includes("?") ? "&" : "?";
        const response = await fetch(`${db.appsScriptUrl.trim()}${separator}action=readAll&spreadsheetId=${db.spreadsheetId}`);
        if (response.ok) {
          const data = await response.json();
          if (data && !data.error) {
            // Map the sheet keys case-insensitively and ignore space/underscores/accents
            const normalizeKey = (k: string) => k.toLowerCase().replace(/_|\s/g, "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            
            const findKeyData = (name: string) => {
              const normName = normalizeKey(name);
              for (const key of Object.keys(data)) {
                if (normalizeKey(key) === normName) {
                  return data[key];
                }
              }
              // backup check for "Productos" or "Inventario"
              if (normName.includes("product")) {
                for (const key of Object.keys(data)) {
                  const normKey = normalizeKey(key);
                  if (normKey.includes("product") || normKey.includes("inventar") || normKey.includes("prenda")) {
                    return data[key];
                  }
                }
              }
              return null;
            };

            const datosEmpresa = findKeyData("Datos_Empresa") || findKeyData("Empresa");
            if (datosEmpresa && datosEmpresa.length > 1) {
              db.companyInfo = mapRowsToCompanyInfo(datosEmpresa, db.companyInfo);
            }
            
            const resenias = findKeyData("Resenias") || findKeyData("Reviews");
            if (resenias && resenias.length > 1) {
              db.reviews = mapRowsToReviews(resenias);
            }
            
            const clientes = findKeyData("Clientes") || findKeyData("Customers");
            if (clientes && clientes.length > 1) {
              db.customers = mapRowsToCustomers(clientes);
            }
            
            const usuarios = findKeyData("Usuarios") || findKeyData("Users");
            if (usuarios && usuarios.length > 1) {
              db.users = mapRowsToUsers(usuarios);
            }
            
            const productos = findKeyData("Productos en Linea") || findKeyData("Productos") || findKeyData("Inventario");
            if (productos && productos.length > 1) {
              db.cachedProducts = mapRowsToProducts(productos);
              db.cachedAt = Date.now();
            }
            
            console.log("Successfully bidirectionally synced all sheets via Apps Script!");
            saveDB(db);
            return; // Skip normal sheet syncing since Apps Script successfully synced everything!
          } else {
            console.warn("Apps Script returned error or empty data:", data ? data.error : "null");
          }
        } else {
          console.warn(`Apps Script HTTP request failed with status: ${response.status}`);
        }
      } catch (e: any) {
        console.warn("Google Apps Script sync failed, falling back to normal REST/CSV backup routes:", e.message || e);
      }
    }

    console.log("Synchronizing auxiliary Google Sheets tabs dynamically...");

    // 1. Sync Company Profile (Datos_Empresa)
    let companyRows: string[][] = [];
    if (db.googleToken && db.googleToken.accessToken) {
      try {
        const sheets = getSheetsClient(db.googleToken.accessToken);
        const resp = await sheets.spreadsheets.values.get({
          spreadsheetId: db.spreadsheetId,
          range: "'Datos_Empresa'!A1:I10",
        });
        if (resp.data.values) companyRows = resp.data.values;
      } catch (err) {
        console.warn("Error fetching Datos_Empresa via Google API", err);
      }
    }
    if (companyRows.length === 0) {
      try {
        const url = `https://docs.google.com/spreadsheets/d/${db.spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent("Datos_Empresa")}`;
        const text = await fetch(url).then(r => r.text());
        companyRows = parseCSV(text);
      } catch (err) {
        console.warn("Error fetching Datos_Empresa via CSV export", err);
      }
    }
    if (companyRows.length > 1) {
      db.companyInfo = mapRowsToCompanyInfo(companyRows, db.companyInfo);
    }

    // 2. Sync Reviews (Resenias)
    let reviewsRows: string[][] = [];
    if (db.googleToken && db.googleToken.accessToken) {
      try {
        const sheets = getSheetsClient(db.googleToken.accessToken);
        const resp = await sheets.spreadsheets.values.get({
          spreadsheetId: db.spreadsheetId,
          range: "'Resenias'!A1:F500",
        });
        if (resp.data.values) reviewsRows = resp.data.values;
      } catch (err) {
        console.warn("Error fetching Resenias via Google API", err);
      }
    }
    if (reviewsRows.length === 0) {
      try {
        const url = `https://docs.google.com/spreadsheets/d/${db.spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent("Resenias")}`;
        const text = await fetch(url).then(r => r.text());
        reviewsRows = parseCSV(text);
      } catch (err) {
        console.warn("Error fetching Resenias via CSV export", err);
      }
    }
    if (reviewsRows.length > 1) {
      db.reviews = mapRowsToReviews(reviewsRows);
    }

    // 3. Sync Customers (Clientes)
    let clientRows: string[][] = [];
    if (db.googleToken && db.googleToken.accessToken) {
      try {
        const sheets = getSheetsClient(db.googleToken.accessToken);
        const resp = await sheets.spreadsheets.values.get({
          spreadsheetId: db.spreadsheetId,
          range: "'Clientes'!A1:G1000",
        });
        if (resp.data.values) clientRows = resp.data.values;
      } catch (err) {
        console.warn("Error fetching Clientes via Google API", err);
      }
    }
    if (clientRows.length === 0) {
      try {
        const url = `https://docs.google.com/spreadsheets/d/${db.spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent("Clientes")}`;
        const text = await fetch(url).then(r => r.text());
        clientRows = parseCSV(text);
      } catch (err) {
        console.warn("Error fetching Clientes via CSV export", err);
      }
    }
    if (clientRows.length > 1) {
      db.customers = mapRowsToCustomers(clientRows);
    }

    // 4. Sync Users (Usuarios)
    let userRows: string[][] = [];
    if (db.googleToken && db.googleToken.accessToken) {
      try {
        const sheets = getSheetsClient(db.googleToken.accessToken);
        const resp = await sheets.spreadsheets.values.get({
          spreadsheetId: db.spreadsheetId,
          range: "'Usuarios'!A1:J500",
        });
        if (resp.data.values) userRows = resp.data.values;
      } catch (err) {
        console.warn("Error fetching Usuarios via Google API", err);
      }
    }
    if (userRows.length === 0) {
      try {
        const url = `https://docs.google.com/spreadsheets/d/${db.spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent("Usuarios")}`;
        const text = await fetch(url).then(r => r.text());
        userRows = parseCSV(text);
      } catch (err) {
        console.warn("Error fetching Usuarios via CSV export", err);
      }
    }
    if (userRows.length > 1) {
      db.users = mapRowsToUsers(userRows);
    }
  }

  // Parse lines to cells supporting double-quotes
  function parseCSV(csvText: string): string[][] {
    const trimmed = csvText.trim();
    if (trimmed.startsWith("<") || trimmed.toLowerCase().includes("<!doctype html") || trimmed.toLowerCase().includes("<html") || trimmed.toLowerCase().includes("<script")) {
      console.warn("parseCSV rejected input because it contains HTML content instead of CSV.");
      return [];
    }
    const lines = csvText.split(/\r?\n/);
    const result: string[][] = [];
    for (const line of lines) {
      if (!line.trim()) continue;
      const row = [];
      let cell = "";
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === "," && !inQuotes) {
          row.push(cell.trim());
          cell = "";
        } else {
          cell += char;
        }
      }
      row.push(cell.trim());
      // Handle the Google Sheets API formula/values outputs like `L.5,000`
      const cleanedRow = row.map(cell => {
        let clean = cell;
        if (clean.startsWith('"') && clean.endsWith('"')) {
          clean = clean.slice(1, -1);
        }
        return clean.trim();
      });
      result.push(cleanedRow);
    }
    return result;
  }

  function mapRowsToProducts(rows: string[][]): Product[] {
    if (rows.length <= 1) return [];
    
    // Normalize headers: remove spacing, underscores, accent letters
    const normalizeHeader = (h: string) => String(h || "").trim().toLowerCase()
      .replace(/_|\s/g, "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, ""); // strip accents
    
    const headers = rows[0].map(normalizeHeader);
    
    // Exact column mapping: Codigo_Fardo, Producto, Precio_Efectivo, Existencia, Precio_Normal, Codigo_Simple, Descuento, Fecha_Hasta, Cant_Piezas, Foto_Fardo, Categoria
    const iId = headers.findIndex(h => h.includes("codigofardo") || h === "codigo" || h === "id");
    const iNombre = headers.findIndex(h => h.includes("producto") || h === "nombre" || h.includes("prenda"));
    const iPrecioEfectivo = headers.findIndex(h => h.includes("precioefectivo") || h.includes("efectivo"));
    const iStock = headers.findIndex(h => h.includes("existencia") || h.includes("stock") || h === "existencias");
    const iPrecioNormal = headers.findIndex(h => h.includes("precionormal") || h === "normal");
    const iCodigoSimple = headers.findIndex(h => h.includes("codigosimple") || h === "simples" || h === "codigo_simple");
    const iDescuento = headers.findIndex(h => h === "descuento" || h.includes("descto"));
    const iFechaHasta = headers.findIndex(h => h.includes("fechahasta") || h.includes("limite") || h === "fecha_hasta");
    const iCantPiezas = headers.findIndex(h => h.includes("cantpiezas") || h.includes("piezas") || h === "cant_piezas");
    const iFoto = headers.findIndex(h => h.includes("fotofardo") || h === "foto" || h.includes("imagen") || h.includes("foto_fardo") || h === "imagen_fardo");
    const iCategoria = headers.findIndex(h => h === "categoria" || h.includes("cat"));

    const products: Product[] = [];
    const now = new Date();

    for (let i = 1; i < rows.length; i++) {
      const cells = rows[i];
      if (!cells || cells.length < 1) continue;

      const safeGet = (index: number, fallback: string = ""): string => {
        if (index === -1 || index >= cells.length || cells[index] === undefined || cells[index] === null) {
          return fallback;
        }
        return String(cells[index]).trim();
      };

      const id = iId !== -1 ? safeGet(iId) : "";
      if (!id) continue; // Skip empty rows or header clones

      const nombre = iNombre !== -1 ? safeGet(iNombre, `Fardo #${i}`) : `Fardo #${i}`;
      
      const pNormalStr = safeGet(iPrecioNormal, "0");
      const pNormal = parseFloat(pNormalStr.replace(/[^0-9.]/g, "")) || 0;

      const descStr = safeGet(iDescuento, "0");
      const rawDescuento = parseFloat(descStr.replace(/[^0-9.]/g, "")) || 0;

      const fechaHastaStr = safeGet(iFechaHasta, "");
      
      // Check discount expiration
      let discountActive = true;
      if (fechaHastaStr && rawDescuento > 0) {
        // Honduras format is normally DD/MM/YYYY or YYYY-MM-DD
        const dateParts = fechaHastaStr.split(/[-/]/);
        if (dateParts.length === 3) {
          let day = parseInt(dateParts[0]);
          let month = parseInt(dateParts[1]) - 1; // 0-indexed
          let year = parseInt(dateParts[2]);
          
          if (dateParts[0].length === 4) {
            year = parseInt(dateParts[0]);
            month = parseInt(dateParts[1]) - 1;
            day = parseInt(dateParts[2]);
          }

          if (year < 100) year += 2000;
          const expDate = new Date(year, month, day, 23, 59, 59);
          if (!isNaN(expDate.getTime()) && expDate < now) {
            discountActive = false; // expired
          }
        }
      }

      const discountAmount = discountActive ? rawDescuento : 0;

      const pEfectivoStr = safeGet(iPrecioEfectivo, "");
      let pEfectivo = pEfectivoStr !== "" ? parseFloat(pEfectivoStr.replace(/[^0-9.]/g, "")) || 0 : 0;

      // If active discount exists, cash price is Precio_Normal - Descuento. Otherwise follow Column
      if (discountAmount > 0) {
        pEfectivo = pNormal - discountAmount;
      } else {
        pEfectivo = pNormal; // No 2% automatic fallback promo
      }

      const stockStr = safeGet(iStock, "1");
      const stock = parseInt(stockStr.replace(/[^0-9]/g, "")) || 0;

      const categoria = iCategoria !== -1 ? safeGet(iCategoria, "Fardos") : "Fardos";
      const imagen = iFoto !== -1 ? safeGet(iFoto, "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=500&q=80") : "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=500&q=80";

      const codigoSimple = iCodigoSimple !== -1 ? safeGet(iCodigoSimple, "") : "";
      const cantPiezasStr = safeGet(iCantPiezas, "0");
      const cantPiezas = parseInt(cantPiezasStr.replace(/[^0-9]/g, "")) || 0;

      products.push({
        id,
        nombre,
        categoria,
        talla: "Única",
        precioNormal: pNormal,
        precioEfectivo: pEfectivo,
        descuento: discountAmount,
        imagen,
        stock,
        visible: stock > 0,
        codigoSimple,
        fechaHasta: fechaHastaStr,
        cantPiezas,
      });
    }
    return products;
  }

  function mapRowsToCompanyInfo(rows: string[][], fallback: CompanyInfo): CompanyInfo {
    const normalize = (h: string) => String(h).trim().toLowerCase().replace(/_|\s/g, "");
    const headers = rows[0].map(normalize);
    
    const iName = headers.findIndex(h => h.includes("nombre"));
    const iPrefix = headers.findIndex(h => h.includes("prefix") || h.includes("prefijo"));
    const iPhone = headers.findIndex(h => h.includes("contacto") || h.includes("telefono") || h.includes("teléfono"));
    const iDept = headers.findIndex(h => h.includes("departamento"));
    const iMunicipio = headers.findIndex(h => h.includes("municipio"));
    const iAddress = headers.findIndex(h => h.includes("direccion") || h.includes("dirección"));
    const iMaps = headers.findIndex(h => h.includes("coorden") || h.includes("maps") || h.includes("link"));
    const iLogo = headers.findIndex(h => h.includes("logo") || h.includes("logo_img"));
    const iHours = headers.findIndex(h => h.includes("horario") || h.includes("horas"));

    const row = rows[1];
    if (!row) return fallback;

    const prefix = iPrefix !== -1 && row[iPrefix] !== undefined && row[iPrefix] !== null ? String(row[iPrefix]).trim() : "+504";
    const phoneNumRaw = iPhone !== -1 && row[iPhone] !== undefined && row[iPhone] !== null ? String(row[iPhone]).trim() : "9547-1667";
    const cleanPhone = phoneNumRaw.startsWith("+") ? phoneNumRaw : `${prefix} ${phoneNumRaw}`;

    return {
      name: iName !== -1 && row[iName] !== undefined && row[iName] !== null ? String(row[iName]).trim() : fallback.name,
      phone: cleanPhone,
      address: iAddress !== -1 && row[iAddress] !== undefined && row[iAddress] !== null ? String(row[iAddress]).trim() : fallback.address,
      hours: iHours !== -1 && row[iHours] !== undefined && row[iHours] !== null ? String(row[iHours]).trim() : fallback.hours,
      bankDetails: fallback.bankDetails,
      cashDiscountPercent: fallback.cashDiscountPercent,
      department: iDept !== -1 && row[iDept] !== undefined && row[iDept] !== null ? String(row[iDept]).trim() : fallback.department,
      municipio: iMunicipio !== -1 && row[iMunicipio] !== undefined && row[iMunicipio] !== null ? String(row[iMunicipio]).trim() : fallback.municipio,
      googleMapsLink: iMaps !== -1 && row[iMaps] !== undefined && row[iMaps] !== null ? String(row[iMaps]).trim() : fallback.googleMapsLink,
      logo: iLogo !== -1 && row[iLogo] !== undefined && row[iLogo] !== null ? String(row[iLogo]).trim() : fallback.logo,
    };
  }

  function mapRowsToReviews(rows: string[][]): Review[] {
    const headers = rows[0].map(h => String(h).trim().toLowerCase().replace(/_|\s/g, "").normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
    const iId = headers.findIndex(h => h.includes("id"));
    const iFecha = headers.findIndex(h => h.includes("fecha"));
    const iName = headers.findIndex(h => h.includes("nombre"));
    const iRating = headers.findIndex(h => h.includes("calific") || h.includes("rating") || h.includes("calificacion"));
    const iComment = headers.findIndex(h => h.includes("coment") || h.includes("comentario"));
    const iPrd = headers.findIndex(h => h.includes("prod") || h.includes("producto"));

    const list: Review[] = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row.length < 3) continue;

      list.push({
        id: iId !== -1 && row[iId] !== undefined && row[iId] !== null ? String(row[iId]).trim() : `REV${String(i).padStart(3, "0")}`,
        fecha: iFecha !== -1 && row[iFecha] !== undefined && row[iFecha] !== null ? String(row[iFecha]).trim() : new Date().toISOString(),
        nombre: iName !== -1 && row[iName] !== undefined && row[iName] !== null ? String(row[iName]).trim() : "Cliente Satisfecho",
        calificacion: iRating !== -1 && row[iRating] !== undefined && row[iRating] !== null ? parseInt(String(row[iRating])) || 5 : 5,
        comentario: iComment !== -1 && row[iComment] !== undefined && row[iComment] !== null ? String(row[iComment]).trim() : "",
        producto: iPrd !== -1 && row[iPrd] !== undefined && row[iPrd] !== null ? String(row[iPrd]).trim() : "General",
      });
    }
    return list;
  }

  function mapRowsToCustomers(rows: string[][]): Customer[] {
    const headers = rows[0].map(h => String(h).trim().toLowerCase().replace(/_|\s/g, "").normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
    const iId = headers.findIndex(h => h.includes("id"));
    const iName = headers.findIndex(h => h.includes("nombre"));
    const iPrefix = headers.findIndex(h => h.includes("prefijo"));
    const iContact = headers.findIndex(h => h.includes("contacto") || h.includes("telefono") || h.includes("celular"));
    const iMail = headers.findIndex(h => h.includes("correo") || h.includes("email"));
    const iMuni = headers.findIndex(h => h.includes("muni") || h.includes("municipio"));
    const iAddr = headers.findIndex(h => h.includes("direc") || h.includes("direccion"));

    const list: Customer[] = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row.length < 3) continue;

      list.push({
        id: iId !== -1 && row[iId] !== undefined && row[iId] !== null ? String(row[iId]).trim() : `CLI-${i}`,
        nombre: iName !== -1 && row[iName] !== undefined && row[iName] !== null ? String(row[iName]).trim() : "General",
        prefijoPais: iPrefix !== -1 && row[iPrefix] !== undefined && row[iPrefix] !== null ? String(row[iPrefix]).trim() : "504",
        contacto: iContact !== -1 && row[iContact] !== undefined && row[iContact] !== null ? String(row[iContact]).trim() : "00000000",
        correo: iMail !== -1 && row[iMail] !== undefined && row[iMail] !== null ? String(row[iMail]).trim() : "",
        municipio: iMuni !== -1 && row[iMuni] !== undefined && row[iMuni] !== null ? String(row[iMuni]).trim() : "Comayagua",
        direccionExacta: iAddr !== -1 && row[iAddr] !== undefined && row[iAddr] !== null ? String(row[iAddr]).trim() : "",
      });
    }
    return list;
  }

  function mapRowsToUsers(rows: string[][]): User[] {
    const headers = rows[0].map(h => String(h).trim().toLowerCase().replace(/_|\s/g, "").normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
    const iId = headers.findIndex(h => h.includes("idusuario") || h === "id");
    const iName = headers.findIndex(h => h.includes("nombre"));
    const iPrefix = headers.findIndex(h => h.includes("prefijo"));
    const iContact = headers.findIndex(h => h.includes("contacto") || h.includes("telefono") || h.includes("celular"));
    const iMail = headers.findIndex(h => h.includes("correo") || h.includes("email"));
    const iPass = headers.findIndex(h => h.includes("pass") || h.includes("contra") || h === "password" || h.includes("contrasena"));
    const iFoto = headers.findIndex(h => h.includes("foto") || h.includes("imagen"));
    const iRol = headers.findIndex(h => h.includes("rol"));
    const iEstado = headers.findIndex(h => h.includes("estadoperfil") || h.includes("estado"));
    const iUltimo = headers.findIndex(h => h.includes("ultimoacceso") || h.includes("ultimo"));

    const list: User[] = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row.length < 2) continue;

      list.push({
        idUsuario: iId !== -1 && row[iId] !== undefined && row[iId] !== null ? String(row[iId]).trim() : `USR-${i}`,
        nombre: iName !== -1 && row[iName] !== undefined && row[iName] !== null ? String(row[iName]).trim() : `Usuario ${i}`,
        prefijoPais: iPrefix !== -1 && row[iPrefix] !== undefined && row[iPrefix] !== null ? String(row[iPrefix]).trim() : "+504",
        contacto: iContact !== -1 && row[iContact] !== undefined && row[iContact] !== null ? String(row[iContact]).trim() : "",
        correo: iMail !== -1 && row[iMail] !== undefined && row[iMail] !== null ? String(row[iMail]).trim() : "",
        password: iPass !== -1 && row[iPass] !== undefined && row[iPass] !== null ? String(row[iPass]).trim() : "",
        foto: iFoto !== -1 && row[iFoto] !== undefined && row[iFoto] !== null ? String(row[iFoto]).trim() : "",
        rol: iRol !== -1 && row[iRol] !== undefined && row[iRol] !== null ? String(row[iRol]).trim() : "Vendedor",
        estadoPerfil: iEstado !== -1 && row[iEstado] !== undefined && row[iEstado] !== null ? String(row[iEstado]).trim() : "Activo",
        ultimoAcceso: iUltimo !== -1 && row[iUltimo] !== undefined && row[iUltimo] !== null ? String(row[iUltimo]).trim() : "",
      });
    }
    return list;
  }

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
