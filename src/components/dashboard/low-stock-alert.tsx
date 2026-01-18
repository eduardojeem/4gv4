'use client'

import { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AlertTriangle, Package } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface LowStockItem {
  id: string
  name: string
  sku: string
  currentStock: number
  minStock: number
  category: string
}

const getStockStatus = (current: number, min: number) => {
  if (current === 0) {
    return { label: 'Agotado', color: 'bg-red-100 text-red-800' }
  } else if (current <= min / 2) {
    return { label: 'Crítico', color: 'bg-red-100 text-red-800' }
  } else {
    return { label: 'Bajo', color: 'bg-yellow-100 text-yellow-800' }
  }
}

export function LowStockAlert() {
  const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const fetchLowStockItems = async () => {
      try {
        const { data, error } = await supabase
          .from('products')
          .select('id, name, sku, stock, min_stock, category')
          .lte('stock', supabase.rpc('min_stock'))
          .order('stock', { ascending: true })
          .limit(5)

        if (error) throw error

        const items: LowStockItem[] = (data || []).map((item: any) => ({
          id: item.id,
          name: item.name,
          sku: item.sku || 'N/A',
          currentStock: item.stock || 0,
          minStock: item.min_stock || 0,
          category: item.category || 'Sin categoría'
        }))

        setLowStockItems(items)
      } catch (error) {
        console.error('Error fetching low stock items:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchLowStockItems()
  }, [])

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg animate-pulse">
            <div className="flex items-center space-x-3 flex-1">
              <div className="h-5 w-5 bg-gray-300 rounded" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-300 rounded w-3/4" />
                <div className="h-3 bg-gray-300 rounded w-1/2" />
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (lowStockItems.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
        <p>No hay productos con stock bajo</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {lowStockItems.map((item) => {
        const status = getStockStatus(item.currentStock, item.minStock)
        
        return (
          <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                <Package className="h-5 w-5 text-gray-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {item.name}
                </p>
                <p className="text-xs text-gray-500">
                  SKU: {item.sku} • {item.category}
                </p>
                <div className="flex items-center space-x-2 mt-1">
                  <span className="text-xs text-gray-600">
                    Stock: {item.currentStock} / Min: {item.minStock}
                  </span>
                  <Badge variant="secondary" className={status.color}>
                    {status.label}
                  </Badge>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              <Button size="sm" variant="outline" asChild>
                <Link href={`/dashboard/products/${item.id}`}>
                  Ver
                </Link>
              </Button>
            </div>
          </div>
        )
      })}
      
      <div className="pt-4 border-t">
        <Button variant="outline" className="w-full" asChild>
          <Link href="/dashboard/products?filter=low-stock">
            Ver todos los productos con stock bajo
          </Link>
        </Button>
      </div>
    </div>
  )
}