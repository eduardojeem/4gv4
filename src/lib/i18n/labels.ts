/**
 * Etiquetas en español para los valores que la base guarda en inglés.
 *
 * Varias pantallas renderizaban el valor crudo: un cliente mayorista aparecia
 * como "wholesale" y un pago en efectivo como "cash". Ademas habia traducciones
 * sueltas repetidas en cada componente (`case 'wholesale': return ...`), que se
 * desincronizan apenas alguien agrega un valor nuevo.
 *
 * Todos los mapas aceptan tanto el valor en ingles como su equivalente en
 * español, porque en esta base conviven los dos: `payment_method` guarda
 * 'cash' en unos flujos y 'efectivo' en otros.
 */

/** Último recurso: un valor desconocido se muestra legible, no crudo ni vacío. */
function humanize(value: string): string {
  const clean = value.trim().replace(/[_-]+/g, ' ')
  if (!clean) return ''
  return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase()
}

function lookup(map: Record<string, string>, value: string | null | undefined): string {
  const key = String(value ?? '').trim().toLowerCase()
  if (!key) return ''
  return map[key] ?? humanize(key)
}

/** Segmento del cliente (`customers.segment`). */
const CUSTOMER_SEGMENT: Record<string, string> = {
  regular: 'Particular',
  wholesale: 'Mayorista',
  mayorista: 'Mayorista',
  vip: 'VIP',
  business: 'Empresa',
  empresa: 'Empresa',
  premium: 'Premium',
  new: 'Nuevo',
  nuevo: 'Nuevo',
  high_value: 'Alto valor',
  low_value: 'Bajo valor',
  returning: 'Recurrente',
  individual: 'Particular',
}

export function customerSegmentLabel(value: string | null | undefined) {
  return lookup(CUSTOMER_SEGMENT, value)
}

/** Tipo de cliente (`customers.customer_type`). Comparte vocabulario con el segmento. */
export function customerTypeLabel(value: string | null | undefined) {
  return lookup(CUSTOMER_SEGMENT, value)
}

/**
 * Clave canonica del tipo/segmento, para comparar en vez de mostrar.
 *
 * El formulario de clientes guarda 'mayorista' y el resto de la app compara
 * contra 'wholesale': un cliente cargado desde ese formulario no recibia la
 * chapa de Mayorista en el cobro. La tabla de sinonimos ya vive en este
 * archivo, asi que duplicarla afuera se desincronizaria sola.
 */
const CUSTOMER_TYPE_CANONICAL: Record<string, string> = {
  regular: 'regular',
  particular: 'regular',
  individual: 'regular',
  wholesale: 'wholesale',
  mayorista: 'wholesale',
  vip: 'vip',
  business: 'business',
  empresa: 'business',
  premium: 'premium',
}

export function customerTypeKey(value: string | null | undefined): string {
  const key = String(value ?? '').trim().toLowerCase()
  return CUSTOMER_TYPE_CANONICAL[key] ?? key
}

/** Estado del cliente (`customers.status`). */
const CUSTOMER_STATUS: Record<string, string> = {
  active: 'Activo',
  activo: 'Activo',
  inactive: 'Inactivo',
  inactivo: 'Inactivo',
  pending: 'Pendiente',
  pendiente: 'Pendiente',
  suspended: 'Suspendido',
  suspendido: 'Suspendido',
  blocked: 'Bloqueado',
}

export function customerStatusLabel(value: string | null | undefined) {
  return lookup(CUSTOMER_STATUS, value)
}

/** Medio de pago. Conviven variantes en ingles y español en la misma columna. */
const PAYMENT_METHOD: Record<string, string> = {
  cash: 'Efectivo',
  efectivo: 'Efectivo',
  card: 'Tarjeta',
  tarjeta: 'Tarjeta',
  card_terminal: 'Tarjeta (POS)',
  transfer: 'Transferencia',
  transferencia: 'Transferencia',
  bank_transfer: 'Transferencia bancaria',
  credit: 'Crédito',
  credito: 'Crédito',
  qr: 'QR',
  digital_wallet: 'Billetera digital',
  mixed: 'Pago mixto',
  mixto: 'Pago mixto',
  activation: 'Activación',
  activation_code: 'Código de activación',
  other: 'Otro',
  otros: 'Otros',
}

export function paymentMethodLabel(value: string | null | undefined) {
  return lookup(PAYMENT_METHOD, value)
}

/**
 * Estado de reparación. La columna ya guarda español, pero sin tildes ni
 * mayusculas: 'diagnostico' se mostraba tal cual.
 */
const REPAIR_STATUS: Record<string, string> = {
  recibido: 'Recibido',
  received: 'Recibido',
  diagnostico: 'Diagnóstico',
  diagnosis: 'Diagnóstico',
  reparacion: 'En reparación',
  en_reparacion: 'En reparación',
  in_progress: 'En reparación',
  repairing: 'En reparación',
  pausado: 'Pausado',
  paused: 'Pausado',
  listo: 'Listo para entregar',
  ready: 'Listo para entregar',
  completed: 'Listo para entregar',
  entregado: 'Entregado',
  delivered: 'Entregado',
  cancelado: 'Cancelado',
  cancelled: 'Cancelado',
  canceled: 'Cancelado',
}

export function repairStatusLabel(value: string | null | undefined) {
  return lookup(REPAIR_STATUS, value)
}

/** Visibilidad del producto (`products.visibility`). */
const PRODUCT_VISIBILITY: Record<string, string> = {
  public: 'Público',
  publico: 'Público',
  wholesale: 'Solo mayoristas',
  hidden: 'Oculto',
  oculto: 'Oculto',
}

export function productVisibilityLabel(value: string | null | undefined) {
  return lookup(PRODUCT_VISIBILITY, value)
}

/** Estado de pedido de la tienda pública (`customer_orders.status`). */
const ORDER_STATUS: Record<string, string> = {
  pending: 'Pendiente',
  confirmed: 'Confirmado',
  preparing: 'En preparación',
  ready: 'Listo',
  shipped: 'Enviado',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
  canceled: 'Cancelado',
}

export function orderStatusLabel(value: string | null | undefined) {
  return lookup(ORDER_STATUS, value)
}
