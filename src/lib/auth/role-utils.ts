export type AppRole = 'super_admin' | 'admin' | 'vendedor' | 'tecnico' | 'cliente'

export function normalizeRole(raw?: string | null): AppRole | undefined {
  if (!raw) return undefined
  const r = raw.toLowerCase().trim()
  if (r === 'super_admin') return 'super_admin'
  if (r === 'admin') return 'admin'
  if (r === 'vendedor' || r === 'employee' || r === 'manager') return 'vendedor'
  if (r === 'tecnico' || r === 'technician') return 'tecnico'
  if (
    r === 'cliente' ||
    r === 'viewer' ||
    r === 'client_normal' ||
    r === 'mayorista' ||
    r === 'client_mayorista'
  ) {
    return 'cliente'
  }
  return undefined
}

export function isWholesale(raw?: string | null): boolean {
  if (!raw) return false
  const r = raw.toLowerCase().trim()
  return r === 'mayorista' || r === 'client_mayorista'
}

/** Permiso específico que habilita ver el costo a un usuario no-admin. */
export const PRODUCT_COST_PERMISSION = 'products.read_cost'

/**
 * Puede ver el costo (purchase_price) y el margen quien sea admin/super_admin,
 * o quien tenga el permiso específico products.read_cost (asignable por usuario
 * desde el modal de edición).
 */
export function canViewProductCost(raw?: string | null, permissions?: string[] | null): boolean {
  const role = normalizeRole(raw)
  if (role === 'admin' || role === 'super_admin') return true
  return Array.isArray(permissions) && permissions.includes(PRODUCT_COST_PERMISSION)
}

/** Campos sensibles de costo que deben ocultarse a roles sin permiso. */
export const PRODUCT_COST_FIELDS = ['purchase_price'] as const

/**
 * Devuelve una copia del producto sin los campos de costo cuando el usuario no
 * tiene permiso para verlos. Para no-admins sin el permiso, omite purchase_price.
 */
export function stripProductCost<T extends Record<string, unknown>>(
  product: T,
  role?: string | null,
  permissions?: string[] | null
): T {
  if (canViewProductCost(role, permissions)) return product
  const clone: Record<string, unknown> = { ...product }
  for (const field of PRODUCT_COST_FIELDS) {
    delete clone[field]
  }
  return clone as T
}
