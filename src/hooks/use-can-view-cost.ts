'use client'

import { useAuth } from '@/contexts/auth-context'

/**
 * Indica si el usuario actual puede ver el costo (purchase_price) y el margen
 * de los productos. Solo admin y super_admin. El resto de roles lo ve oculto.
 *
 * `isAdmin` del AuthContext ya equivale a (admin || super_admin).
 */
export function useCanViewCost(): boolean {
  const { isAdmin } = useAuth()
  return isAdmin
}
