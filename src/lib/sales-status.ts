export const SALE_STATUS = {
  PENDING: 'pending',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const

export const LEGACY_SALE_STATUS = {
  PENDING: 'pendiente',
  COMPLETED: 'completada',
  CANCELLED: 'cancelada',
} as const

export type CanonicalSaleStatus = (typeof SALE_STATUS)[keyof typeof SALE_STATUS]

const SALE_STATUS_ALIAS_MAP: Record<string, CanonicalSaleStatus> = {
  [SALE_STATUS.PENDING]: SALE_STATUS.PENDING,
  [SALE_STATUS.COMPLETED]: SALE_STATUS.COMPLETED,
  [SALE_STATUS.CANCELLED]: SALE_STATUS.CANCELLED,
  [LEGACY_SALE_STATUS.PENDING]: SALE_STATUS.PENDING,
  [LEGACY_SALE_STATUS.COMPLETED]: SALE_STATUS.COMPLETED,
  [LEGACY_SALE_STATUS.CANCELLED]: SALE_STATUS.CANCELLED,
}

export const PENDING_SALE_STATUSES = [SALE_STATUS.PENDING, LEGACY_SALE_STATUS.PENDING] as const
export const COMPLETED_SALE_STATUSES = [SALE_STATUS.COMPLETED, LEGACY_SALE_STATUS.COMPLETED] as const
export const CANCELLED_SALE_STATUSES = [SALE_STATUS.CANCELLED, LEGACY_SALE_STATUS.CANCELLED] as const

export const normalizeSaleStatus = (status?: string | null): CanonicalSaleStatus | null => {
  const normalized = String(status || '').trim().toLowerCase()
  if (!normalized) return null
  return SALE_STATUS_ALIAS_MAP[normalized] || null
}

export const isCompletedSaleStatus = (status?: string | null): boolean => {
  return normalizeSaleStatus(status) === SALE_STATUS.COMPLETED
}

export const isPendingSaleStatus = (status?: string | null): boolean => {
  return normalizeSaleStatus(status) === SALE_STATUS.PENDING
}

export const isCancelledSaleStatus = (status?: string | null): boolean => {
  return normalizeSaleStatus(status) === SALE_STATUS.CANCELLED
}
