import { after } from 'next/server'
import { config } from '@/lib/config'
import { logger } from '@/lib/logger'
import { dispatchNotificationEvent } from './dispatcher'

/**
 * Avisos de la operación diaria (venta, pedido, reparación nueva) en la
 * campanita y como push al celular. Se llaman después de responder (`after`):
 * nunca frenan ni rompen la venta, y la clave por recurso evita que un
 * reintento de la misma venta vuelva a sonar.
 */

/** Desde este monto la venta llega como «Venta destacada» a quien ve reportes. */
export const LARGE_SALE_THRESHOLD = Number(process.env.NOTIFY_LARGE_SALE_THRESHOLD) || 1_000_000

export function formatNotificationAmount(amount: number, currency = config.currency) {
  try {
    return new Intl.NumberFormat('es-PY', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount)
  } catch {
    return `${currency} ${Math.round(amount).toLocaleString('es-PY')}`
  }
}

/**
 * Corre el aviso después de responder. Fuera de una petición de Next (tests,
 * scripts) `after` no existe: ahí se lanza igual, sin esperarlo.
 */
export function afterResponse(task: () => Promise<unknown>) {
  try {
    after(task)
  } catch {
    void task()
  }
}

async function safely(label: string, run: () => Promise<unknown>) {
  try {
    await run()
  } catch (error) {
    logger.warn(`[notifications] No se pudo avisar ${label}`, { error: error instanceof Error ? error.message : String(error) })
  }
}

export function notifySaleCreated(params: {
  organizationId: string
  branchId: string | null
  saleId: string
  actorUserId: string
  total: number | null
  code?: string | null
}) {
  const totalFormatted = params.total != null ? formatNotificationAmount(params.total) : undefined
  const data = { saleId: params.saleId, code: params.code ?? null, total: params.total, totalFormatted }
  return safely('la venta', async () => {
    await dispatchNotificationEvent({
      organizationId: params.organizationId,
      branchId: params.branchId,
      type: 'SALE_CREATED',
      resourceType: 'sale',
      resourceId: params.saleId,
      data,
      excludeUserIds: [params.actorUserId],
    })
    if (params.total != null && params.total >= LARGE_SALE_THRESHOLD) {
      await dispatchNotificationEvent({
        organizationId: params.organizationId,
        branchId: params.branchId,
        type: 'LARGE_SALE',
        resourceType: 'sale',
        resourceId: params.saleId,
        data,
        excludeUserIds: [params.actorUserId],
      })
    }
  })
}

export function notifyOrderCreated(params: {
  organizationId: string
  branchId: string | null
  orderId: string
  online: boolean
  actorUserId?: string | null
  orderNumber?: string | null
  customerName?: string | null
  total?: number | null
}) {
  return safely('el pedido', () => dispatchNotificationEvent({
    organizationId: params.organizationId,
    branchId: params.branchId,
    type: params.online ? 'NEW_ONLINE_ORDER' : 'ORDER_CREATED',
    resourceType: 'order',
    resourceId: params.orderId,
    data: {
      orderNumber: params.orderNumber ?? null,
      customerName: params.customerName ?? null,
      totalFormatted: params.total != null ? formatNotificationAmount(params.total) : undefined,
    },
    excludeUserIds: params.actorUserId ? [params.actorUserId] : [],
  }))
}

export function notifyRepairCreated(params: {
  organizationId: string
  branchId: string | null
  repairId: string
  actorUserId: string
  device?: string | null
  customerName?: string | null
  technicianId?: string | null
}) {
  return safely('la reparación', async () => {
    await dispatchNotificationEvent({
      organizationId: params.organizationId,
      branchId: params.branchId,
      type: 'REPAIR_CREATED',
      resourceType: 'repair',
      resourceId: params.repairId,
      data: { device: params.device ?? null, customerName: params.customerName ?? null },
      // El técnico asignado recibe el aviso personal de abajo, no los dos.
      excludeUserIds: [params.actorUserId, ...(params.technicianId ? [params.technicianId] : [])],
    })
    // Si ya entra con técnico, a él le llega «Te asignaron…».
    if (params.technicianId && params.technicianId !== params.actorUserId) {
      await dispatchNotificationEvent({
        organizationId: params.organizationId,
        branchId: params.branchId,
        type: 'REPAIR_ASSIGNED',
        resourceType: 'repair',
        resourceId: params.repairId,
        data: { device: params.device ?? null },
        targetUserIds: [params.technicianId],
      })
    }
  })
}
