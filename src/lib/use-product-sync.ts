import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { InventoryManager } from '@/lib/inventory-manager'
import { config, isDemoNoDb } from '@/lib/config'

type DbProductRow = {
  id: string
  name: string
  sku: string
  stock: number | null
  min_stock: number | null
  sale_price: number
  description: string | null
  updated_at: string
}

const mapRowToProduct = (row: DbProductRow) => ({
  id: row.id,
  name: row.name,
  sku: row.sku,
  price: row.sale_price,
  stock: row.stock ?? 0,
  category: 'Inventario',
  description: row.description || '',
  featured: false,
  minStock: row.min_stock ?? 5,
  lastUpdated: row.updated_at,
})

export const useProductSync = (manager: InventoryManager) => {
  useEffect(() => {
    // Evitar llamadas a Supabase en modo demo sin BD o si no está configurado
    if (!config.supabase.isConfigured || isDemoNoDb()) {
      return
    }

    const supabase = createClient()

    const loadInitial = async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id,name,sku,stock,min_stock,sale_price,purchase_price,description,updated_at')

      if (error) {
        const msg = error.message || ''
        const missingTable = msg.includes("Could not find the table 'public.products'") || msg.includes('relation "products" does not exist')
        if (missingTable) {
          console.warn('Tabla de productos no encontrada en Supabase; omitimos sincronización y usamos inventario local.')
        } else {
          console.warn('Error cargando productos:', msg)
        }
        return
      }

      const mapped = (data || []).map(mapRowToProduct)
      manager.importData({ products: mapped })
    }

    loadInitial()

    const channel = supabase
      .channel('products-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, (payload) => {
        const row = (payload.new || payload.old) as DbProductRow | null
        if (!row) return

        if (payload.eventType === 'DELETE') {
          manager.removeProduct(row.id)
          return
        }

        const mapped = mapRowToProduct(row)
        if (payload.eventType === 'INSERT') {
          manager.upsertProduct(mapped)
        } else if (payload.eventType === 'UPDATE') {
          manager.updateProductInfo(row.id, mapped)
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [manager])
}

export default useProductSync