import { after } from 'next/server'
import { config } from '@/lib/config'
import { logger } from '@/lib/logger'
import { dispatchNotificationEvent } from './dispatcher'
import { createAdminSupabase } from '@/lib/supabase/admin'

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
      actorUserId: params.actorUserId,
    })
    if (params.total != null && params.total >= LARGE_SALE_THRESHOLD) {
      await dispatchNotificationEvent({
        organizationId: params.organizationId,
        branchId: params.branchId,
        type: 'LARGE_SALE',
        resourceType: 'sale',
        resourceId: params.saleId,
        data,
        actorUserId: params.actorUserId,
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
    actorUserId: params.actorUserId ?? null,
  }))
}

const ORDER_STATUS_NOTIFICATION_TYPE = {
  CONFIRMED: 'ORDER_CONFIRMED',
  READY: 'ORDER_READY',
  CANCELLED: 'ORDER_CANCELLED',
} as const

export function notifyOrderStatusChanged(params: {
  organizationId: string
  branchId: string | null
  orderId: string
  status: string
  actorUserId?: string | null
  orderNumber?: string | null
  customerName?: string | null
  total?: number | null
}) {
  const type = ORDER_STATUS_NOTIFICATION_TYPE[params.status as keyof typeof ORDER_STATUS_NOTIFICATION_TYPE]
  if (!type) return Promise.resolve()

  return safely('el estado del pedido', () => dispatchNotificationEvent({
    organizationId: params.organizationId,
    branchId: params.branchId,
    type,
    resourceType: 'order',
    resourceId: params.orderId,
    data: {
      orderNumber: params.orderNumber ?? null,
      customerName: params.customerName ?? null,
      totalFormatted: params.total != null ? formatNotificationAmount(params.total) : undefined,
      status: params.status,
    },
    actorUserId: params.actorUserId ?? null,
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
      actorUserId: params.actorUserId,
      // El técnico asignado recibe el aviso personal de abajo, no los dos.
      excludeUserIds: params.technicianId ? [params.technicianId] : [],
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

/** Texto del equipo para el aviso: «Samsung A54» o null. */
export function repairDeviceLabel(repair: { device_brand?: string | null; device_model?: string | null } | null | undefined) {
  return [repair?.device_brand, repair?.device_model].map((value) => value?.trim()).filter(Boolean).join(' ') || null
}

/** La reparación pasó a «listo»: avisa a quienes pueden entregarla. */
export function notifyRepairReady(params: {
  organizationId: string
  branchId: string | null
  repairId: string
  actorUserId: string
  device?: string | null
}) {
  return safely('la reparación lista', () => dispatchNotificationEvent({
    organizationId: params.organizationId,
    branchId: params.branchId,
    type: 'REPAIR_READY',
    resourceType: 'repair',
    resourceId: params.repairId,
    data: { device: params.device ?? null },
    actorUserId: params.actorUserId,
  }))
}

/**
 * Reparaciones entregadas (desde Reparaciones o cobradas en el POS): avisa a
 * la sucursal, con el equipo y si se retiró sin reparar.
 */
export function notifyRepairsDelivered(params: {
  organizationId: string
  branchId: string | null
  repairIds: string[]
  actorUserId: string
}) {
  if (params.repairIds.length === 0) return Promise.resolve()
  return safely('la reparación entregada', async () => {
    const { data, error } = await createAdminSupabase()
      .from('repairs')
      .select('id, device_brand, device_model, delivery_outcome, status')
      .eq('organization_id', params.organizationId)
      .in('id', params.repairIds)
    if (error) throw error
    for (const repair of data ?? []) {
      if (repair.status !== 'entregado') continue
      await dispatchNotificationEvent({
        organizationId: params.organizationId,
        branchId: params.branchId,
        type: 'REPAIR_DELIVERED',
        resourceType: 'repair',
        resourceId: String(repair.id),
        data: { device: repairDeviceLabel(repair), outcome: repair.delivery_outcome ?? null },
        actorUserId: params.actorUserId,
      })
    }
  })
}

const APPOINTMENT_NOTIFICATION_TYPES = {
  booked: 'BOOKING_CREATED',
  rescheduled: 'BOOKING_RESCHEDULED',
  cancelled: 'BOOKING_CANCELLED',
} as const

/**
 * El cliente reservó, cambió o canceló su turno desde la web: avisa al celular
 * del comercio con el mismo texto de la campanita de la Agenda.
 */
export function notifyAppointmentChanged(params: {
  organizationId: string
  appointmentId: string
  kind: keyof typeof APPOINTMENT_NOTIFICATION_TYPES
  text: string
}) {
  return safely('el turno', () => dispatchNotificationEvent({
    organizationId: params.organizationId,
    branchId: null,
    type: APPOINTMENT_NOTIFICATION_TYPES[params.kind],
    resourceType: 'booking',
    resourceId: params.appointmentId,
    data: { text: params.text },
    // Lo hizo el cliente, no alguien del comercio: nadie queda afuera.
    actorUserId: null,
  }))
}

export type StockLevel = { productId: string; name: string; stock: number; minStock: number | null }

/** Agotado (0 o menos), stock bajo (llegó al mínimo) o nada. Sin mínimo cargado solo avisa agotado. */
export function classifyStockLevel(level: Pick<StockLevel, 'stock' | 'minStock'>): 'OUT_OF_STOCK' | 'LOW_STOCK' | null {
  if (level.stock <= 0) return 'OUT_OF_STOCK'
  if (level.minStock != null && level.minStock > 0 && level.stock <= level.minStock) return 'LOW_STOCK'
  return null
}

/**
 * Después de vender: revisa los productos vendidos y avisa stock bajo o
 * agotado. Con sucursal mira su inventario y su mínimo (o el del producto).
 * Como máximo un aviso por día, por producto, sucursal y tipo.
 */
export function notifyStockLevelsAfterSale(params: {
  organizationId: string
  branchId: string | null
  productIds: string[]
  now?: Date
}) {
  const productIds = [...new Set(params.productIds.filter(Boolean))]
  if (productIds.length === 0) return Promise.resolve()
  return safely('el stock', async () => {
    const admin = createAdminSupabase()
    const { data: products, error } = await admin
      .from('products')
      .select('id, name, stock_quantity, min_stock, unit_measure, is_active')
      .eq('organization_id', params.organizationId)
      .in('id', productIds)
    if (error) throw error
    const branchRows = new Map<string, { stock_quantity: number | null; min_stock: number | null }>()
    if (params.branchId) {
      const { data: inventory, error: inventoryError } = await admin
        .from('branch_inventory')
        .select('product_id, stock_quantity, min_stock')
        .eq('branch_id', params.branchId)
        .in('product_id', productIds)
      if (inventoryError) throw inventoryError
      for (const row of inventory ?? []) branchRows.set(String(row.product_id), row)
    }
    const day = (params.now ?? new Date()).toISOString().slice(0, 10)
    for (const product of products ?? []) {
      // Los servicios no tienen stock; un producto inactivo no se repone.
      if (product.unit_measure === 'servicio' || product.is_active === false) continue
      const branch = branchRows.get(String(product.id))
      if (params.branchId && !branch) continue
      const level: StockLevel = {
        productId: String(product.id),
        name: String(product.name ?? 'Producto'),
        stock: Number(branch ? branch.stock_quantity : product.stock_quantity) || 0,
        minStock: (branch?.min_stock ?? product.min_stock ?? null) as number | null,
      }
      const type = classifyStockLevel(level)
      if (!type) continue
      await dispatchNotificationEvent({
        organizationId: params.organizationId,
        branchId: params.branchId,
        type,
        resourceType: 'product',
        resourceId: level.productId,
        data: { productName: level.name, stock: level.stock, minStock: level.minStock },
        idempotencyKey: `stock:${type}:${level.productId}:${params.branchId ?? 'org'}:${day}`,
      })
    }
  })
}
