import { createClient } from '@/lib/supabase/client'
import { isDemoMode } from '@/lib/config'

export interface Product {
  id: string
  name: string
  stock_quantity: number
  min_stock: number
  sale_price: number
}

export interface ProductAlert {
  id: string
  product_id: string
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

// Mock data para modo demo
const mockProducts: Product[] = [
  {
    id: '1',
    name: 'iPhone 14 Pro',
    stock_quantity: 2,
    min_stock: 5,
    sale_price: 1200000
  },
  {
    id: '2', 
    name: 'Samsung Galaxy S23',
    stock_quantity: 0,
    min_stock: 3,
    sale_price: 950000
  },
  {
    id: '3',
    name: 'Protector de Pantalla',
    stock_quantity: 1,
    min_stock: 10,
    sale_price: 25000
  },
  {
    id: '4',
    name: 'Cargador USB-C',
    stock_quantity: 3,
    min_stock: 15,
    sale_price: 35000
  }
]

const mockAlerts: ProductAlert[] = [
  {
    id: '1',
    product_id: '1',
    alert_type: 'low_stock',
    message: 'Stock bajo: iPhone 14 Pro (2 unidades restantes)',
    is_resolved: false,
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 horas atrás
    product: {
      name: 'iPhone 14 Pro',
      stock_quantity: 2,
      min_stock: 5,
      sale_price: 1200000
    }
  },
  {
    id: '2',
    product_id: '2',
    alert_type: 'out_of_stock',
    message: 'Sin stock: Samsung Galaxy S23',
    is_resolved: false,
    created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 minutos atrás
    product: {
      name: 'Samsung Galaxy S23',
      stock_quantity: 0,
      min_stock: 3,
      sale_price: 950000
    }
  },
  {
    id: '3',
    product_id: '3',
    alert_type: 'low_stock',
    message: 'Stock bajo: Protector de Pantalla (1 unidad restante)',
    is_resolved: false,
    created_at: new Date(Date.now() - 45 * 60 * 1000).toISOString(), // 45 minutos atrás
    product: {
      name: 'Protector de Pantalla',
      stock_quantity: 1,
      min_stock: 10,
      sale_price: 25000
    }
  },
  {
    id: '4',
    product_id: '4',
    alert_type: 'low_stock',
    message: 'Stock bajo: Cargador USB-C (3 unidades restantes)',
    is_resolved: false,
    created_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(), // 15 minutos atrás
    product: {
      name: 'Cargador USB-C',
      stock_quantity: 3,
      min_stock: 15,
      sale_price: 35000
    }
  }
]

export class AlertService {
  private supabase = createClient()

  // Obtener todas las alertas activas
  async getActiveAlerts(): Promise<ProductAlert[]> {
    if (isDemoMode()) {
      // Simular delay de red
      await new Promise(resolve => setTimeout(resolve, 500))
      return mockAlerts.filter(alert => !alert.is_resolved)
    }

    try {
      const { data, error } = await this.supabase
        .from('product_alerts')
        .select(`
          *,
          product:products(name, stock_quantity, min_stock, sale_price)
        `)
        .eq('is_resolved', false)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error fetching alerts:', error)
      return []
    }
  }

  // Generar alertas automáticamente basadas en el stock
  async generateAutomaticAlerts(): Promise<void> {
    if (isDemoMode()) {
      // En modo demo, las alertas ya están generadas
      return
    }

    try {
      // Obtener productos con stock bajo
      const { data: products, error: productsError } = await this.supabase
        .from('products')
        .select('id, name, stock_quantity, min_stock, sale_price')
        .or('stock_quantity.lte.min_stock,stock_quantity.eq.0')

      if (productsError) throw productsError

      if (!products || products.length === 0) return

      // Verificar qué productos ya tienen alertas activas
      const productIds = products.map(p => p.id)
      const { data: existingAlerts, error: alertsError } = await this.supabase
        .from('product_alerts')
        .select('product_id')
        .in('product_id', productIds)
        .eq('is_resolved', false)

      if (alertsError) throw alertsError

      const existingAlertProductIds = new Set(
        existingAlerts?.map(alert => alert.product_id) || []
      )

      // Crear nuevas alertas para productos que no las tienen
      const newAlerts = products
        .filter(product => !existingAlertProductIds.has(product.id))
        .map(product => {
          const alertType = product.stock_quantity === 0 ? 'out_of_stock' : 'low_stock'
          const message = product.stock_quantity === 0
            ? `Sin stock: ${product.name}`
            : `Stock bajo: ${product.name} (${product.stock_quantity} unidades restantes)`

          return {
            product_id: product.id,
            alert_type: alertType,
            message,
            is_resolved: false
          }
        })

      if (newAlerts.length > 0) {
        const { error: insertError } = await this.supabase
          .from('product_alerts')
          .insert(newAlerts)

        if (insertError) throw insertError
      }
    } catch (error) {
      console.error('Error generating automatic alerts:', error)
    }
  }

  // Resolver una alerta
  async resolveAlert(alertId: string): Promise<boolean> {
    if (isDemoMode()) {
      // Simular resolución en modo demo
      const alertIndex = mockAlerts.findIndex(alert => alert.id === alertId)
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

  // Resolver todas las alertas de un producto
  async resolveProductAlerts(productId: string): Promise<boolean> {
    if (isDemoMode()) {
      // Simular resolución en modo demo
      mockAlerts.forEach(alert => {
        if (alert.product_id === productId) {
          alert.is_resolved = true
        }
      })
      return true
    }

    try {
      const { error } = await this.supabase
        .from('product_alerts')
        .update({ is_resolved: true })
        .eq('product_id', productId)
        .eq('is_resolved', false)

      if (error) throw error
      return true
    } catch (error) {
      console.error('Error resolving product alerts:', error)
      return false
    }
  }

  // Resolver todas las alertas activas
  async resolveAllAlerts(): Promise<boolean> {
    if (isDemoMode()) {
      // Simular resolución en modo demo
      mockAlerts.forEach(alert => {
        alert.is_resolved = true
      })
      return true
    }

    try {
      const { error } = await this.supabase
        .from('product_alerts')
        .update({ is_resolved: true })
        .eq('is_resolved', false)

      if (error) throw error
      return true
    } catch (error) {
      console.error('Error resolving all alerts:', error)
      return false
    }
  }

  // Obtener estadísticas de alertas
  async getAlertStats(): Promise<{
    total: number
    lowStock: number
    outOfStock: number
    resolved: number
  }> {
    if (isDemoMode()) {
      const total = mockAlerts.length
      const lowStock = mockAlerts.filter(a => a.alert_type === 'low_stock').length
      const outOfStock = mockAlerts.filter(a => a.alert_type === 'out_of_stock').length
      const resolved = mockAlerts.filter(a => a.is_resolved).length

      return { total, lowStock, outOfStock, resolved }
    }

    try {
      const { data, error } = await this.supabase
        .from('product_alerts')
        .select('alert_type, is_resolved')

      if (error) throw error

      const total = data?.length || 0
      const lowStock = data?.filter(a => a.alert_type === 'low_stock').length || 0
      const outOfStock = data?.filter(a => a.alert_type === 'out_of_stock').length || 0
      const resolved = data?.filter(a => a.is_resolved).length || 0

      return { total, lowStock, outOfStock, resolved }
    } catch (error) {
      console.error('Error fetching alert stats:', error)
      return { total: 0, lowStock: 0, outOfStock: 0, resolved: 0 }
    }
  }
}

// Instancia singleton del servicio
export const alertService = new AlertService()