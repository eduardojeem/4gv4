/**
 * Resuelve de forma segura y tipada la ruta de navegación interna
 * correspondiente a una notificación, impidiendo navegación a URLs externas o arbitrarias.
 */
export function resolveNotificationRoute(payload: {
  type?: string | null
  resourceType?: string | null
  resourceId?: string | null
}): string {
  const type = payload.type ? String(payload.type).trim() : ''
  const resourceType = payload.resourceType ? String(payload.resourceType).trim().toLowerCase() : ''
  const resourceId = payload.resourceId ? String(payload.resourceId).trim() : ''

  // Sanitizar ID: solo caracteres seguros para rutas alfanuméricas y guiones/guion bajo
  const safeId = /^[A-Za-z0-9_-]+$/.test(resourceId) ? encodeURIComponent(resourceId) : ''

  // 1. Reparaciones
  if (type.startsWith('REPAIR_') || resourceType === 'repair') {
    return safeId ? `/panel/repairs/${safeId}` : '/panel/repairs'
  }

  // 2. Reservas / Servicios / Agenda
  if (type.startsWith('BOOKING_') || resourceType === 'booking' || resourceType === 'appointment') {
    return '/panel/agenda'
  }

  // 3. Ventas (POS)
  if (type.startsWith('SALE_') || resourceType === 'sale') {
    return '/panel/pos'
  }

  // 4. Pedidos
  if (type.startsWith('ORDER_') || type === 'NEW_ONLINE_ORDER' || resourceType === 'order') {
    return safeId ? `/panel/orders/${safeId}` : '/panel/orders'
  }

  // 5. Inventario / Productos
  if (
    type === 'LOW_STOCK' ||
    type === 'OUT_OF_STOCK' ||
    type === 'VARIANT_LOW_STOCK' ||
    type === 'STOCK_ADJUSTMENT' ||
    resourceType === 'product'
  ) {
    return safeId ? `/panel/products/${safeId}` : '/panel/products'
  }

  // 6. Caja
  if (type.startsWith('CASH_') || resourceType === 'cash') {
    return '/panel/cash-register'
  }

  // 7. Créditos
  if (type.startsWith('CREDIT_') || type.startsWith('PAYMENT_') || resourceType === 'credit') {
    return safeId ? `/panel/credits/${safeId}` : '/panel/credits'
  }

  // 8. Proveedores
  if (type.startsWith('PURCHASE_ORDER_') || type.startsWith('SUPPLIER_') || resourceType === 'supplier') {
    return '/panel/suppliers'
  }

  // 9. Configuración / Preferencias
  if (type === 'ROLE_CHANGED' || type === 'PERMISSION_CHANGED' || type === 'EMPLOYEE_INVITED') {
    return '/panel/settings/notifications'
  }

  // Fallback seguro ante eventos desconocidos o URLs arbitrarias: centro de notificaciones
  return '/panel/notifications'
}
