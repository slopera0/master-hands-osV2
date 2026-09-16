// public/js/bom.js
// Ítems por defecto preservados EXACTAMENTE del sistema original (Persona 5: no se
// reescribe contenido de dominio ya validado por el negocio; solo se blinda con
// validación numérica).

export const DEFAULT_BOM_ITEMS = [
  { name: 'Doble tabique desacoplado 60mm + 2 placas 15.9mm + lana roca (60 kg/m³)', qty: 51.9, unit: 'm²', price: 185000 },
  { name: 'Membrana acústica viscoelástica pesada (5 kg/m²)', qty: 51.9, unit: 'm²', price: 48000 },
  { name: 'Cielo raso desacoplado con colgadores de resorte antivibratorios', qty: 27.0, unit: 'm²', price: 220000 },
  { name: 'Piso flotante con tacos de elastómero Sylomer + doble OSB 18mm', qty: 27.0, unit: 'm²', price: 260000 },
  { name: 'Puerta acústica certificada STC 45 dB con drop seal automático', qty: 1.0, unit: 'und', price: 6500000 },
  { name: 'Ventana termoacústica oscilobatiente vidrio asimétrico laminado', qty: 1.0, unit: 'und', price: 3800000 },
  { name: 'Silenciadores Baffle Box HVAC + ductería flexible aislada', qty: 2.0, unit: 'c/u', price: 1900000 },
  { name: 'Acondicionamiento: Bafle frontal lana + Paneles laterales + Difusores Skyline', qty: 1.0, unit: 'gl', price: 12500000 },
  { name: 'Ingeniería, Metrología REW (Antes/Después), QA/QC y Dossier As-Built', qty: 1.0, unit: 'gl', price: 4500000 },
];

/**
 * Catálogo de referencia de materiales típicos de insonorización, para agregar rápido
 * a la BOM de un proyecto sin escribir todo a mano. Los precios son valores de
 * referencia de mercado (Medellín, orden de magnitud) — ajústalos siempre al cotizar,
 * no son un compromiso comercial del sistema.
 */
export const MATERIALS_CATALOG = [
  {
    category: 'Muros y tabiquería',
    items: [
      { name: 'Tabique sencillo 1 placa 12.5mm + lana mineral 50mm', unit: 'm²', price: 95000 },
      { name: 'Doble tabique desacoplado 60mm + 2 placas 15.9mm + lana roca (60 kg/m³)', unit: 'm²', price: 185000 },
      { name: 'Muro Room-Within-a-Room (estructura totalmente independiente)', unit: 'm²', price: 320000 },
      { name: 'Perfilería metálica calibre 20 desacoplada (parales + rieles)', unit: 'm²', price: 38000 },
      { name: 'Lana de roca basáltica 60 kg/m³ (relleno de cavidad)', unit: 'm²', price: 32000 },
      { name: 'Lana Black Theater (alta densidad, absorción reforzada)', unit: 'm²', price: 54000 },
    ],
  },
  {
    category: 'Membranas y masa acústica',
    items: [
      { name: 'Membrana acústica viscoelástica pesada (5 kg/m²)', unit: 'm²', price: 48000 },
      { name: 'Membrana viscoelástica reforzada (10 kg/m²)', unit: 'm²', price: 78000 },
      { name: 'Sellador acústico elastomérico (perimetral, por metro lineal)', unit: 'ml', price: 12000 },
    ],
  },
  {
    category: 'Cielo raso',
    items: [
      { name: 'Cielo raso desacoplado con colgadores de resorte antivibratorios', unit: 'm²', price: 220000 },
      { name: 'Cielo raso doble placa sin desacople (uso general, no home theater)', unit: 'm²', price: 110000 },
    ],
  },
  {
    category: 'Piso',
    items: [
      { name: 'Piso flotante con tacos de elastómero Sylomer + doble OSB 18mm', unit: 'm²', price: 260000 },
      { name: 'Manta acústica bajo piso laminado (uso residencial estándar)', unit: 'm²', price: 45000 },
    ],
  },
  {
    category: 'Puertas',
    items: [
      { name: 'Puerta acústica certificada STC 45 dB con drop seal automático', unit: 'und', price: 6500000 },
      { name: 'Puerta acústica certificada STC 50 dB (doble hoja)', unit: 'und', price: 9800000 },
      { name: 'Kit de sellos perimetrales + drop seal (retrofit puerta existente)', unit: 'und', price: 950000 },
    ],
  },
  {
    category: 'Ventanas',
    items: [
      { name: 'Ventana termoacústica oscilobatiente vidrio asimétrico laminado', unit: 'und', price: 3800000 },
      { name: 'Segunda ventana interior (sistema de doble ventana desacoplada)', unit: 'und', price: 2900000 },
    ],
  },
  {
    category: 'Climatización (HVAC)',
    items: [
      { name: 'Silenciadores Baffle Box HVAC + ductería flexible aislada', unit: 'c/u', price: 1900000 },
      { name: 'Aislamiento acústico de ductería existente (por metro lineal)', unit: 'ml', price: 65000 },
    ],
  },
  {
    category: 'Acondicionamiento acústico interior',
    items: [
      { name: 'Bafle frontal ciego con lana mineral 120mm (detrás de pantalla)', unit: 'gl', price: 4200000 },
      { name: 'Paneles de absorción primera reflexión (juego lateral)', unit: 'gl', price: 3800000 },
      { name: 'Difusor QRD Skyline 2D (pared trasera)', unit: 'und', price: 1250000 },
      { name: 'Nubes acústicas suspendidas de techo', unit: 'und', price: 980000 },
      { name: 'Bass traps de esquina (par)', unit: 'par', price: 1450000 },
      { name: 'Acondicionamiento completo (bafle + laterales + difusores) — paquete', unit: 'gl', price: 12500000 },
    ],
  },
  {
    category: 'Ingeniería y servicios',
    items: [
      { name: 'Ingeniería, Metrología REW (Antes/Después), QA/QC y Dossier As-Built', unit: 'gl', price: 4500000 },
      { name: 'Visita técnica y levantamiento adicional', unit: 'und', price: 350000 },
      { name: 'Medición de aislamiento en campo (ISO 16283 / ASTM E336)', unit: 'und', price: 1800000 },
    ],
  },
];

/**
 * Calcula el desglose de costos de la BOM.
 * @param {Array<{qty:number, price:number}>} items
 * @param {{waste:number, indirect:number, margin:number}} params porcentajes (0-100)
 */
export function calculateBom(items, params) {
  const waste = clampPct(params.waste);
  const indirect = clampPct(params.indirect);
  const margin = clampPct(params.margin, 99.9);

  const rawSubtotals = items.map((it) => Math.max(0, toNum(it.qty)) * Math.max(0, toNum(it.price)));
  const directWithWaste = rawSubtotals.reduce((sum, s) => sum + s * (1 + waste / 100), 0);
  const indirectCost = directWithWaste * (indirect / 100);
  const costBeforeMargin = directWithWaste + indirectCost;
  // precio de venta para lograr el margen objetivo sobre el precio de venta (margen comercial, no markup):
  // margin% = (precioVenta - costo) / precioVenta  =>  precioVenta = costo / (1 - margin/100)
  const salePrice = margin < 100 ? costBeforeMargin / (1 - margin / 100) : costBeforeMargin;

  return {
    subtotals: rawSubtotals,
    directCost: directWithWaste,
    indirectCost,
    salePrice,
  };
}

function toNum(v) { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; }
function clampPct(v, max = 100) { const n = toNum(v); return Math.min(Math.max(n, 0), max); }

export function formatCOP(n) {
  return '$' + Math.round(n || 0).toLocaleString('es-CO');
}
