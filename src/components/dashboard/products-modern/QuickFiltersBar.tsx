/**
 * QuickFiltersBar Component - Rediseñado
 * Barra compacta y moderna con filtros rápidos
 */

import React, { useMemo } from 'react'
import { AlertTriangle, ShieldAlert, CheckCircle2, EyeOff, Package, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Product } from '@/types/products'
import { isLowStock, isOutOfStock } from '@/lib/products-dashboard-utils'
import { cn } from '@/lib/utils'

export interface QuickFilterCounts {
  all: number
  low_stock: number
  out_of_stock: number
  active: number
  inactive: number
}

export interface QuickFiltersBarProps {
  products: Product[]
  counts?: QuickFilterCounts
  activeFilter?: 'all' | 'low_stock' | 'out_of_stock' | 'active' | 'inactive' | null
  onFilterClick: (filter: 'all' | 'low_stock' | 'out_of_stock' | 'active' | 'inactive') => void
  className?: string
}

export function QuickFiltersBar({
  products,
  counts: providedCounts,
  activeFilter,
  onFilterClick,
  className
}: QuickFiltersBarProps) {
  // Prefer global counts; otherwise derive from local products
  const counts = useMemo(() => {
    if (providedCounts) return providedCounts

    const total = products.length
    const lowStock = products.filter(isLowStock).length
    const outOfStock = products.filter(isOutOfStock).length
    const active = products.filter(p => p.is_active).length
    const inactive = products.filter(p => !p.is_active).length

    return {
      all: total,
      low_stock: lowStock,
      out_of_stock: outOfStock,
      active,
      inactive
    }
  }, [products, providedCounts])

  const isFiltered = activeFilter && activeFilter !== 'all'

  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-2 p-2 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white/70 dark:bg-slate-900/50 backdrop-blur-md shadow-xs text-xs',
        className
      )}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mr-1 hidden sm:inline">
          Filtros rápidos:
        </span>

        {/* Todos */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onFilterClick('all')}
          className={cn(
            'h-7.5 px-2.5 text-xs font-semibold rounded-lg gap-1.5 transition-all',
            activeFilter === 'all' || !activeFilter
              ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 shadow-xs'
              : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
          )}
        >
          <Package className="h-3.5 w-3.5" />
          <span>Todos</span>
          <Badge variant="secondary" className="px-1 py-0 text-[10px] font-mono h-4 rounded-md">
            {counts.all}
          </Badge>
        </Button>

        {/* Bajo Stock */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onFilterClick('low_stock')}
          className={cn(
            'h-7.5 px-2.5 text-xs font-semibold rounded-lg gap-1.5 transition-all',
            activeFilter === 'low_stock'
              ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-400 dark:border-amber-700 text-amber-800 dark:text-amber-300 shadow-xs'
              : 'hover:bg-amber-50/50 dark:hover:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-200/80 dark:border-amber-800/60'
          )}
        >
          <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
          <span>Bajo Stock</span>
          <Badge
            variant="outline"
            className="px-1 py-0 text-[10px] font-mono h-4 rounded-md bg-amber-100/60 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700"
          >
            {counts.low_stock}
          </Badge>
        </Button>

        {/* Agotados */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onFilterClick('out_of_stock')}
          className={cn(
            'h-7.5 px-2.5 text-xs font-semibold rounded-lg gap-1.5 transition-all',
            activeFilter === 'out_of_stock'
              ? 'bg-red-50 dark:bg-red-950/60 border-red-400 dark:border-red-700 text-red-800 dark:text-red-300 shadow-xs'
              : 'hover:bg-red-50/50 dark:hover:bg-red-950/30 text-red-700 dark:text-red-400 border-red-200/80 dark:border-red-800/60'
          )}
        >
          <ShieldAlert className="h-3.5 w-3.5 text-red-500" />
          <span>Agotados</span>
          <Badge
            variant="outline"
            className="px-1 py-0 text-[10px] font-mono h-4 rounded-md bg-red-100/60 dark:bg-red-900/40 text-red-800 dark:text-red-300 border-red-300 dark:border-red-700"
          >
            {counts.out_of_stock}
          </Badge>
        </Button>

        {/* Activos */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onFilterClick('active')}
          className={cn(
            'h-7.5 px-2.5 text-xs font-semibold rounded-lg gap-1.5 transition-all',
            activeFilter === 'active'
              ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-400 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300 shadow-xs'
              : 'hover:bg-emerald-50/50 dark:hover:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200/80 dark:border-emerald-800/60'
          )}
        >
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
          <span>Activos</span>
          <Badge
            variant="outline"
            className="px-1 py-0 text-[10px] font-mono h-4 rounded-md bg-emerald-100/60 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700"
          >
            {counts.active}
          </Badge>
        </Button>

        {/* Inactivos */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onFilterClick('inactive')}
          className={cn(
            'h-7.5 px-2.5 text-xs font-semibold rounded-lg gap-1.5 transition-all',
            activeFilter === 'inactive'
              ? 'bg-slate-200/80 dark:bg-slate-800 border-slate-400 dark:border-slate-600 text-slate-900 dark:text-slate-100 shadow-xs'
              : 'hover:bg-slate-100 dark:hover:bg-slate-800/50 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800'
          )}
        >
          <EyeOff className="h-3.5 w-3.5 text-slate-500" />
          <span>Inactivos</span>
          <Badge
            variant="outline"
            className="px-1 py-0 text-[10px] font-mono h-4 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700"
          >
            {counts.inactive}
          </Badge>
        </Button>
      </div>

      {isFiltered && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onFilterClick('all')}
          className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground gap-1"
        >
          <X className="h-3 w-3" />
          Limpiar filtro rápido
        </Button>
      )}
    </div>
  )
}
