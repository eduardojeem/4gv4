/**
 * QuickFiltersBar Component
 * Bar with predefined quick filter buttons
 */

import React, { useMemo } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { QuickFilterButton } from './QuickFilterButton'
import { Product } from '@/types/products'
import { cn } from '@/lib/utils'

export interface QuickFiltersBarProps {
  products: Product[]
  activeFilter?: 'all' | 'low_stock' | 'out_of_stock' | 'active' | null
  onFilterClick: (filter: 'all' | 'low_stock' | 'out_of_stock' | 'active') => void
  className?: string
}

export function QuickFiltersBar({
  products,
  activeFilter,
  onFilterClick,
  className
}: QuickFiltersBarProps) {
  // Calculate counts for each filter
  const counts = useMemo(() => {
    const total = products.length
    const lowStock = products.filter(
      p => p.stock_quantity <= p.min_stock && p.stock_quantity > 0
    ).length
    const outOfStock = products.filter(p => p.stock_quantity === 0).length
    const active = products.filter(p => p.is_active).length

    return {
      all: total,
      low_stock: lowStock,
      out_of_stock: outOfStock,
      active
    }
  }, [products])

  return (
    <Card className={cn('border-0 shadow-md', className)}>
      <CardContent className="p-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-gray-700">Filtros rápidos:</span>
            
            {/* All Products */}
            <QuickFilterButton
              label="Todos"
              count={counts.all}
              isActive={activeFilter === 'all' || !activeFilter}
              onClick={() => onFilterClick('all')}
              variant="default"
            />

            {/* Low Stock */}
            <QuickFilterButton
              label="Bajo Stock"
              count={counts.low_stock}
              isActive={activeFilter === 'low_stock'}
              onClick={() => onFilterClick('low_stock')}
              icon={AlertTriangle}
              variant="warning"
            />

            {/* Out of Stock */}
            <QuickFilterButton
              label="Agotados"
              count={counts.out_of_stock}
              isActive={activeFilter === 'out_of_stock'}
              onClick={() => onFilterClick('out_of_stock')}
              variant="danger"
            />

            {/* Active Products */}
            <QuickFilterButton
              label="Activos"
              count={counts.active}
              isActive={activeFilter === 'active'}
              onClick={() => onFilterClick('active')}
              variant="success"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
