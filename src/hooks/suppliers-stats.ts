import type { UISupplier } from '../lib/types/supplier-ui'

export interface SupplierStats {
  total_suppliers: number
  active_suppliers: number
  inactive_suppliers: number
  pending_suppliers: number
  avg_rating: number
  total_orders: number
  total_amount: number
}

export const computeSupplierStats = (supplierData: UISupplier[]): SupplierStats => {
  const total = supplierData.length
  const active = supplierData.filter(s => s.status === 'active').length
  const inactive = supplierData.filter(s => s.status === 'inactive').length
  const pending = supplierData.filter(s => s.status === 'pending').length
  const avgRating = total > 0
    ? supplierData.reduce((acc, s) => acc + s.rating, 0) / total
    : 0
  const totalOrders = supplierData.reduce((acc, s) => acc + (s.total_orders || 0), 0)
  const totalAmount = supplierData.reduce((acc, s) => acc + (s.total_amount || 0), 0)

  return {
    total_suppliers: total,
    active_suppliers: active,
    inactive_suppliers: inactive,
    pending_suppliers: pending,
    avg_rating: avgRating,
    total_orders: totalOrders,
    total_amount: totalAmount
  }
}

