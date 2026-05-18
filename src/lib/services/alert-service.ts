import { createClient } from '@/lib/supabase/client'
import { isDemoMode } from '@/lib/config'
import { loadBranchInventoryStockMap } from '@/lib/branches/inventory'

export interface ProductAlert {
  id: string
  product_id: string
  branch_id?: string | null
  alert_type: 'low_stock' | 'out_of_stock'
  message: string
  is_resolved: boolean
  created_at: string
  product?: {
    name: string
    stock_quantity: number
    min_stock: number
    sale_price: number
  }
}

const STOCK_ALERT_TYPES: ProductAlert['alert_type'][] = ['low_stock', 'out_of_stock']

const mockAlerts: ProductAlert[] = [
  {
    id: '1',
    product_id: '1',
    alert_type: 'low_stock',
    message: 'Stock bajo: iPhone 14 Pro (2 unidades restantes)',
    is_resolved: false,
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    product: {
      name: 'iPhone 14 Pro',
      stock_quantity: 2,
      min_stock: 5,
      sale_price: 1200000,
    },
  },
  {
    id: '2',
    product_id: '2',
    alert_type: 'out_of_stock',
    message: 'Sin stock: Samsung Galaxy S23',
    is_resolved: false,
    created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    product: {
      name: 'Samsung Galaxy S23',
      stock_quantity: 0,
      min_stock: 3,
      sale_price: 950000,
    },
  },
  {
    id: '3',
    product_id: '3',
    alert_type: 'low_stock',
    message: 'Stock bajo: Protector de Pantalla (1 unidad restante)',
    is_resolved: false,
    created_at: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    product: {
      name: 'Protector de Pantalla',
      stock_quantity: 1,
      min_stock: 10,
      sale_price: 25000,
    },
  },
  {
    id: '4',
    product_id: '4',
    alert_type: 'low_stock',
    message: 'Stock bajo: Cargador USB-C (3 unidades restantes)',
    is_resolved: false,
    created_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    product: {
      name: 'Cargador USB-C',
      stock_quantity: 3,
      min_stock: 15,
      sale_price: 35000,
    },
  },
]

export class AlertService {
  private supabase = createClient()

  async getActiveAlerts(branchId?: string | null): Promise<ProductAlert[]> {
    if (isDemoMode()) {
      await new Promise((resolve) => setTimeout(resolve, 500))
      return mockAlerts.filter((alert) => !alert.is_resolved)
    }

    try {
      let query = this.supabase
        .from('product_alerts')
        .select(`
          *,
          product:products(name, stock_quantity, min_stock, sale_price)
        `)
        .eq('is_resolved', false)
        .in('alert_type', STOCK_ALERT_TYPES)
        .order('created_at', { ascending: false })

      if (branchId) {
        query = query.eq('branch_id', branchId)
      }

      const { data, error } = await query

      if (error) throw error
      if (!data || data.length === 0 || !branchId) {
        return data || []
      }

      const productIds = [...new Set(data.map((alert) => alert.product_id))]
      const { stockMap } = await loadBranchInventoryStockMap(this.supabase, branchId, productIds)

      return data.map((alert) => ({
        ...alert,
        product: alert.product
          ? {
              ...alert.product,
              stock_quantity: stockMap.get(alert.product_id) ?? alert.product.stock_quantity,
            }
          : alert.product,
      }))
    } catch (error) {
      console.error('Error fetching alerts:', error)
      return []
    }
  }

  // Las alertas de stock ahora se recalculan desde triggers en la base de datos.
  async generateAutomaticAlerts(_branchId?: string | null): Promise<void> {
    void _branchId

    if (isDemoMode()) {
      return
    }
  }

  async resolveAlert(alertId: string): Promise<boolean> {
    if (isDemoMode()) {
      const alertIndex = mockAlerts.findIndex((alert) => alert.id === alertId)
      if (alertIndex !== -1) {
        mockAlerts[alertIndex].is_resolved = true
        return true
      }
      return false
    }

    try {
      const { error } = await this.supabase
        .from('product_alerts')
        .update({ is_resolved: true })
        .eq('id', alertId)

      if (error) throw error
      return true
    } catch (error) {
      console.error('Error resolving alert:', error)
      return false
    }
  }

  async resolveProductAlerts(productId: string, branchId?: string | null): Promise<boolean> {
    if (isDemoMode()) {
      mockAlerts.forEach((alert) => {
        if (alert.product_id === productId) {
          alert.is_resolved = true
        }
      })
      return true
    }

    try {
      let query = this.supabase
        .from('product_alerts')
        .update({ is_resolved: true })
        .eq('product_id', productId)
        .eq('is_resolved', false)
        .in('alert_type', STOCK_ALERT_TYPES)

      if (branchId) {
        query = query.eq('branch_id', branchId)
      }

      const { error } = await query

      if (error) throw error
      return true
    } catch (error) {
      console.error('Error resolving product alerts:', error)
      return false
    }
  }

  async resolveAllAlerts(branchId?: string | null): Promise<boolean> {
    if (isDemoMode()) {
      mockAlerts.forEach((alert) => {
        alert.is_resolved = true
      })
      return true
    }

    try {
      let query = this.supabase
        .from('product_alerts')
        .update({ is_resolved: true })
        .eq('is_resolved', false)
        .in('alert_type', STOCK_ALERT_TYPES)

      if (branchId) {
        query = query.eq('branch_id', branchId)
      }

      const { error } = await query

      if (error) throw error
      return true
    } catch (error) {
      console.error('Error resolving all alerts:', error)
      return false
    }
  }

  async getAlertStats(branchId?: string | null): Promise<{
    total: number
    lowStock: number
    outOfStock: number
    resolved: number
  }> {
    if (isDemoMode()) {
      const total = mockAlerts.length
      const lowStock = mockAlerts.filter((a) => a.alert_type === 'low_stock').length
      const outOfStock = mockAlerts.filter((a) => a.alert_type === 'out_of_stock').length
      const resolved = mockAlerts.filter((a) => a.is_resolved).length

      return { total, lowStock, outOfStock, resolved }
    }

    try {
      let query = this.supabase
        .from('product_alerts')
        .select('alert_type, is_resolved')
        .in('alert_type', STOCK_ALERT_TYPES)

      if (branchId) {
        query = query.eq('branch_id', branchId)
      }

      const { data, error } = await query

      if (error) throw error

      const total = data?.length || 0
      const lowStock = data?.filter((a) => a.alert_type === 'low_stock').length || 0
      const outOfStock = data?.filter((a) => a.alert_type === 'out_of_stock').length || 0
      const resolved = data?.filter((a) => a.is_resolved).length || 0

      return { total, lowStock, outOfStock, resolved }
    } catch (error) {
      console.error('Error fetching alert stats:', error)
      return { total: 0, lowStock: 0, outOfStock: 0, resolved: 0 }
    }
  }
}

export const alertService = new AlertService()
