export type AfterSalesStatus = 'open' | 'approved' | 'rejected' | 'completed' | 'cancelled'
export type AfterSalesRequestType = 'repair_warranty' | 'product_warranty' | 'exchange' | 'return'
export type AfterSalesSourceType = 'repair' | 'sale'

const STATUS_ALIASES: Record<string, AfterSalesStatus> = {
  open: 'open',
  abierto: 'open',
  approved: 'approved',
  aprobado: 'approved',
  rejected: 'rejected',
  rechazado: 'rejected',
  completed: 'completed',
  completado: 'completed',
  cancelled: 'cancelled',
  canceled: 'cancelled',
  cancelado: 'cancelled',
}

const REQUEST_TYPE_ALIASES: Record<string, AfterSalesRequestType> = {
  repair_warranty: 'repair_warranty',
  garantia_reparacion: 'repair_warranty',
  product_warranty: 'product_warranty',
  garantia_producto: 'product_warranty',
  exchange: 'exchange',
  cambio: 'exchange',
  return: 'return',
  devolucion: 'return',
}

const SOURCE_TYPE_ALIASES: Record<string, AfterSalesSourceType> = {
  repair: 'repair',
  reparacion: 'repair',
  sale: 'sale',
  venta: 'sale',
}

const LEGACY_REQUEST_TYPE: Record<AfterSalesRequestType, string> = {
  repair_warranty: 'garantia_reparacion',
  product_warranty: 'garantia_producto',
  exchange: 'cambio',
  return: 'devolucion',
}

const LEGACY_SOURCE_TYPE: Record<AfterSalesSourceType, string> = {
  repair: 'reparacion',
  sale: 'venta',
}

const LEGACY_STATUS: Record<AfterSalesStatus, string> = {
  open: 'abierto',
  approved: 'aprobado',
  rejected: 'rechazado',
  completed: 'completado',
  cancelled: 'cancelado',
}

function normalizedKey(value: unknown) {
  return String(value ?? '').trim().toLowerCase()
}

export function normalizeAfterSalesStatus(value: unknown): AfterSalesStatus | null {
  return STATUS_ALIASES[normalizedKey(value)] ?? null
}

export function normalizeAfterSalesRequestType(value: unknown): AfterSalesRequestType | null {
  return REQUEST_TYPE_ALIASES[normalizedKey(value)] ?? null
}

export function normalizeAfterSalesSourceType(value: unknown): AfterSalesSourceType | null {
  return SOURCE_TYPE_ALIASES[normalizedKey(value)] ?? null
}

export function isLegacyAfterSalesStatus(value: unknown) {
  return Object.values(LEGACY_STATUS).includes(normalizedKey(value))
}

export function serializeAfterSalesStatus(status: AfterSalesStatus, legacy: boolean) {
  return legacy ? LEGACY_STATUS[status] : status
}

export function normalizeAfterSalesCase<T extends Record<string, unknown>>(row: T) {
  return {
    ...row,
    status: normalizeAfterSalesStatus(row.status) ?? row.status,
    request_type: normalizeAfterSalesRequestType(row.request_type) ?? row.request_type,
    source_type: normalizeAfterSalesSourceType(row.source_type) ?? row.source_type,
  }
}

export function getAfterSalesStatusAliases(status: AfterSalesStatus) {
  return [status, LEGACY_STATUS[status]]
}

export function getAfterSalesRequestTypeAliases(type: AfterSalesRequestType) {
  return [type, LEGACY_REQUEST_TYPE[type]]
}

export function getAfterSalesSourceTypeAliases(type: AfterSalesSourceType) {
  return [type, LEGACY_SOURCE_TYPE[type]]
}
