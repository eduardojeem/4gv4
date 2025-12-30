'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AlertTriangle, Package } from 'lucide-react'
import Link from 'next/link'

// Mock data - In real app, this would come from Supabase
const lowStockItems = [
  {
    id: 1,
    name: 'Pantalla iPhone 12',
    sku: 'IP12-SCR-001',
    currentStock: 2,
    minStock: 5,
    category: 'Repuestos'
  },
  {
    id: 2,
    name: 'Batería Samsung Galaxy S21',
    sku: 'SGS21-BAT-001',
    currentStock: 1,
    minStock: 3,
    category: 'Repuestos'
  },
  {
    id: 3,
    name: 'Cable USB-C',
    sku: 'ACC-USBC-001',
    currentStock: 3,
    minStock: 10,
    category: 'Accesorios'
  },
  {
    id: 4,
    name: 'Funda iPhone 13',
    sku: 'IP13-CASE-001',
    currentStock: 0,
    minStock: 5,
    category: 'Accesorios'
  },
  {
    id: 5,
    name: 'Destornillador Pentalobe',
    sku: 'TOOL-PENT-001',
    currentStock: 1,
    minStock: 2,
    category: 'Herramientas'
  }
]

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