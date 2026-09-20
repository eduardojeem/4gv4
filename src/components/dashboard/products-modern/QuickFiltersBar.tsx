/**
 * Los filtros de arriba del listado.
 *
 * Eran ocho botones en fila, cada uno con su color (azul, índigo, violeta,
 * rosa, ámbar, rojo, esmeralda, gris) y su badge del mismo tono: nada decía
 * cuáles se excluían entre sí ni cuál estaba puesto, porque todos gritaban
 * igual. Ahora son tres grupos rotulados —tipo, estado y alertas—, neutros
 * salvo el que está activo, y el color queda para lo que significa algo: el
 * punto ámbar del bajo stock y el rojo del agotado.
 */

import React, { useMemo } from 'react'
import { Layers, Package, Wrench, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Product } from '@/types/products'
import { isLowStock, isOutOfStock, isServiceLikeProduct } from '@/lib/products-dashboard-utils'
import { cn } from '@/lib/utils'

export type QuickFilterValue =
  | 'all'
  | 'low_stock'
  | 'out_of_stock'
  | 'active'
  | 'inactive'
  | 'products'
  | 'services'
  | 'variants'

export interface QuickFilterCounts {
  all: number
  products?: number
  services?: number
  variants?: number
  low_stock: number
  out_of_stock: number
  active: number
  inactive: number
}

export interface QuickFiltersBarProps {
  /** Sin módulo de servicios ni servicios cargados, el filtro no aparece. */
  showServices?: boolean
  products: Product[]
  counts?: QuickFilterCounts
  activeFilter?: QuickFilterValue | null
  /** El tipo con el que abre la sección, que sobrevive a los otros filtros. */
  catalogKind?: 'part' | 'service' | null
  /** Igual que el tipo: `true` es «solo activos», `false` «solo inactivos». */
  isActive?: boolean | null
  onFilterClick: (filter: QuickFilterValue) => void
  className?: string
}

type ChipProps = {
  label: string
  count?: number
  active: boolean
  onClick: () => void
  icon?: React.ReactNode
  /** Un punto de color cuando el filtro significa una alerta. */
  dotClassName?: string
}

function Chip({ label, count, active, onClick, icon, dotClassName }: ChipProps) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'h-7 rounded-lg px-2.5 text-xs font-medium gap-1.5 transition-colors',
        active
          ? 'border-primary/40 bg-primary/10 text-primary font-semibold hover:bg-primary/15 dark:border-primary/50 dark:bg-primary/15 dark:hover:bg-primary/20'
          : 'border-slate-200 bg-transparent text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:bg-transparent dark:text-slate-400 dark:hover:bg-slate-800/60',
      )}
    >
      {dotClassName && <span className={cn('h-1.5 w-1.5 rounded-full', dotClassName)} aria-hidden="true" />}
      {icon}
      <span>{label}</span>
      {count !== undefined && (
        <span
          className={cn(
            'rounded px-1 text-[10px] font-semibold tabular-nums',
            active ? 'bg-primary/15' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
          )}
        >
          {count}
        </span>
      )}
    </Button>
  )
}

/** El rótulo de cada grupo, para que se lea qué decide cada fila de chips. */
function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </span>
  )
}

export function QuickFiltersBar({
  showServices = true,
  products,
  counts: providedCounts,
  activeFilter,
  catalogKind,
  isActive,
  onFilterClick,
  className,
}: QuickFiltersBarProps) {
  // Prefer global counts; otherwise derive from local products
  const counts = useMemo(() => {
    if (providedCounts) {
      return {
        ...providedCounts,
        products: providedCounts.products ?? Math.max(0, providedCounts.all - (providedCounts.services ?? 0)),
        services: providedCounts.services ?? 0,
        variants: providedCounts.variants ?? products.filter(p => p.has_variants || (p.variants && p.variants.length > 0)).length,
      }
    }

    const total = products.length
    const services = products.filter(isServiceLikeProduct).length
    const physicalProducts = total - services
    const variants = products.filter(p => p.has_variants || (p.variants && p.variants.length > 0)).length
    const lowStock = products.filter(p => !isServiceLikeProduct(p) && isLowStock(p)).length
    const outOfStock = products.filter(p => !isServiceLikeProduct(p) && isOutOfStock(p)).length
    const active = products.filter(p => p.is_active).length
    const inactive = products.filter(p => !p.is_active).length

    return {
      all: total,
      products: physicalProducts,
      services,
      variants,
      low_stock: lowStock,
      out_of_stock: outOfStock,
      active,
      inactive,
    }
  }, [products, providedCounts])

  // El tipo y el estado viven en el alcance de la sección; los de alerta, en
  // `activeFilter`. Los valores viejos de `activeFilter` se siguen entendiendo
  // para las pantallas que todavía no pasan el alcance.
  const tipo = catalogKind ?? (activeFilter === 'products' ? 'part' : activeFilter === 'services' ? 'service' : null)
  const estado = isActive ?? (activeFilter === 'active' ? true : activeFilter === 'inactive' ? false : null)
  const alerta = activeFilter && ['low_stock', 'out_of_stock', 'variants'].includes(activeFilter) ? activeFilter : null
  const hayFiltro = tipo !== null || estado !== null || alerta !== null

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-slate-200 bg-white/70 px-3 py-2 shadow-xs backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/50',
        className,
      )}
    >
      <div className="flex items-center gap-1.5">
        <GroupLabel>Tipo</GroupLabel>
        <Chip
          label="Productos"
          count={counts.products ?? 0}
          active={tipo === 'part'}
          onClick={() => onFilterClick('products')}
          icon={<Package className="h-3.5 w-3.5" aria-hidden="true" />}
        />
        {showServices && (
          <Chip
            label="Servicios"
            count={counts.services ?? 0}
            active={tipo === 'service'}
            onClick={() => onFilterClick('services')}
            icon={<Wrench className="h-3.5 w-3.5" aria-hidden="true" />}
          />
        )}
      </div>

      <span className="hidden h-5 w-px bg-slate-200 sm:inline-block dark:bg-slate-800" aria-hidden="true" />

      <div className="flex items-center gap-1.5">
        <GroupLabel>Estado</GroupLabel>
        <Chip
          label="Activos"
          count={counts.active}
          active={estado === true}
          onClick={() => onFilterClick('active')}
        />
        <Chip
          label="Inactivos"
          count={counts.inactive}
          active={estado === false}
          onClick={() => onFilterClick('inactive')}
        />
      </div>

      <span className="hidden h-5 w-px bg-slate-200 sm:inline-block dark:bg-slate-800" aria-hidden="true" />

      <div className="flex items-center gap-1.5">
        <GroupLabel>Alertas</GroupLabel>
        <Chip
          label="Bajo stock"
          count={counts.low_stock}
          active={alerta === 'low_stock'}
          onClick={() => onFilterClick('low_stock')}
          dotClassName="bg-amber-500"
        />
        <Chip
          label="Agotados"
          count={counts.out_of_stock}
          active={alerta === 'out_of_stock'}
          onClick={() => onFilterClick('out_of_stock')}
          dotClassName="bg-red-500"
        />
        <Chip
          label="Con variantes"
          count={counts.variants ?? 0}
          active={alerta === 'variants'}
          onClick={() => onFilterClick('variants')}
          icon={<Layers className="h-3.5 w-3.5" aria-hidden="true" />}
        />
      </div>

      {hayFiltro && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onFilterClick('all')}
          className="ml-auto h-7 gap-1 px-2 text-[11px] text-muted-foreground hover:text-foreground"
        >
          <X className="h-3 w-3" aria-hidden="true" />
          Todo el catálogo
          <span className="font-semibold tabular-nums">{counts.all}</span>
        </Button>
      )}
    </div>
  )
}
