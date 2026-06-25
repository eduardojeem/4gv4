'use client'

import { useAuth } from '@/contexts/auth-context'
import { PRODUCT_COST_PERMISSION } from '@/lib/auth/role-utils'

/**
 * Indica si el usuario actual puede ver el costo (purchase_price) y el margen
 * de los productos: admin/super_admin, o cualquier usuario con el permiso
 * específico products.read_cost (asignable desde el modal de edición de usuario).
 */
export function useCanViewCost(): boolean {
  const { isAdmin, hasPermission } = useAuth()
  return isAdmin || hasPermission(PRODUCT_COST_PERMISSION)
}
