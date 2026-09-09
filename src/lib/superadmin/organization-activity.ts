import { isCompletedSaleStatus } from '@/lib/sales-status'

/**
 * Como le va al negocio, no como esta configurado.
 *
 * El expediente de una organizacion mostraba nombre, slug, UUID, zona horaria y
 * moneda: todo configuracion. Nada decia cuanto factura, cuando fue la ultima
 * vez que vendio, ni si su tienda esta publicada. Una empresa con 240 productos
 * que dejo de operar hace ocho meses se veia igual que una que vendio hoy.
 */
export interface OrganizationActivity {
  /** Facturado historico, solo ventas completadas. */
  revenueTotal: number
  /** Facturado en los ultimos 30 dias. */
  revenueLast30: number
  /** Ventas que efectivamente se cobraron. */
  completedSales: number
  /** Ventas registradas, incluidas las anuladas. */
  totalSales: number
  /** Fecha de la ultima venta completada. `null` si nunca vendio. */
  lastSaleAt: string | null
  /** Dias desde la ultima venta. `null` si nunca vendio. */
  daysSinceLastSale: number | null
}

export interface SaleLike {
  total_amount?: number | null
  status?: string | null
  created_at?: string | null
}

const DAY = 86_400_000

export function summarizeOrganizationActivity(
  sales: SaleLike[],
  now: number = Date.now()
): OrganizationActivity {
  let revenueTotal = 0
  let revenueLast30 = 0
  let completedSales = 0
  let lastSaleAt: string | null = null

  for (const sale of sales) {
    // Una venta anulada no facturo nada: contarla infla el historico y la
    // ultima actividad.
    if (!isCompletedSaleStatus(sale.status)) continue

    const amount = Number(sale.total_amount ?? 0)
    if (Number.isFinite(amount)) {
      revenueTotal += amount
      if (sale.created_at && now - new Date(sale.created_at).getTime() <= 30 * DAY) {
        revenueLast30 += amount
      }
    }

    completedSales += 1

    if (sale.created_at && (!lastSaleAt || sale.created_at > lastSaleAt)) {
      lastSaleAt = sale.created_at
    }
  }

  return {
    revenueTotal,
    revenueLast30,
    completedSales,
    totalSales: sales.length,
    lastSaleAt,
    daysSinceLastSale: lastSaleAt
      ? Math.floor((now - new Date(lastSaleAt).getTime()) / DAY)
      : null,
  }
}

export type ActivityLevel = 'never' | 'dormant' | 'slowing' | 'active'

/**
 * Cuan viva esta la cuenta. Un numero de dias no dice nada por si solo: lo que
 * el superadmin necesita saber es si hay que hacer algo.
 */
export function getActivityLevel(days: number | null): ActivityLevel {
  if (days === null) return 'never'
  if (days > 90) return 'dormant'
  if (days > 30) return 'slowing'
  return 'active'
}

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  never: 'Nunca vendió',
  dormant: 'Sin vender hace meses',
  slowing: 'Bajó el ritmo',
  active: 'Operando',
}

/**
 * Cuanto del limite del plan esta usado. `null` cuando el limite es ilimitado o
 * no esta definido: un 0% ahi se leeria como «no usa nada».
 */
export function limitUsage(used: number, limit: unknown): number | null {
  if (limit === null || limit === undefined) return null
  const max = typeof limit === 'number' ? limit : Number(limit)
  if (!Number.isFinite(max) || max <= 0) return null
  return Math.min(100, Math.round((used / max) * 100))
}
