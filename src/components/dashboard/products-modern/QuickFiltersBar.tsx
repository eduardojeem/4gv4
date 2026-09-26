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
import { Layers, Package, RotateCcw, Wrench } from 'lucide-react'
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
      variant="ghost"
      size="sm"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'h-7 rounded-lg px-2 text-xs font-medium gap-1.5 transition-all shadow-none',
        active
          ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-300 font-bold shadow-xs border border-slate-200/80 dark:border-slate-700/80 hover:bg-white dark:hover:bg-slate-900'
          : 'text-slate-600 dark:text-slate-400 hover:bg-white/60 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-200 border border-transparent',
      )}
    >
      {dotClassName && <span className={cn('h-2 w-2 rounded-full ring-2 ring-white dark:ring-slate-900', dotClassName)} aria-hidden="true" />}
      {icon}
      <span>{label}</span>
      {count !== undefined && (
        <span
          className={cn(
            'rounded-full px-1.5 py-0.2 text-[10px] font-bold tabular-nums leading-none',
            active
              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200'
              : 'bg-slate-200/70 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
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
    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 select-none px-1">
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
        'flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200/80 bg-white/70 p-2 shadow-xs backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/50',
        className,
      )}
    >
      {/* Grupo 1: Tipo de Ítem (Catálogo) */}
      <div className="flex items-center gap-1 bg-slate-100/70 dark:bg-slate-800/60 p-1 rounded-xl border border-slate-200/40 dark:border-slate-700/40">
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

      {/* Grupo 2: Alertas de Inventario Crítico */}
      <div className="flex items-center gap-1 bg-slate-100/70 dark:bg-slate-800/60 p-1 rounded-xl border border-slate-200/40 dark:border-slate-700/40">
        <GroupLabel>Alertas</GroupLabel>
        <Chip
          label="Bajo stock"
          count={counts.low_stock}
          active={alerta === 'low_stock'}
          onClick={() => onFilterClick('low_stock')}
          dotClassName="bg-amber-500 animate-pulse"
        />
        <Chip
          label="Agotados"
          count={counts.out_of_stock}
          active={alerta === 'out_of_stock'}
          onClick={() => onFilterClick('out_of_stock')}
          dotClassName="bg-rose-500"
        />
        <Chip
          label="Con variantes"
          count={counts.variants ?? 0}
          active={alerta === 'variants'}
          onClick={() => onFilterClick('variants')}
          icon={<Layers className="h-3.5 w-3.5" aria-hidden="true" />}
        />
      </div>

      {/* Grupo 3: Estado Operativo */}
      <div className="flex items-center gap-1 bg-slate-100/70 dark:bg-slate-800/60 p-1 rounded-xl border border-slate-200/40 dark:border-slate-700/40">
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

      {/* Acción para restablecer / ver catálogo completo */}
      {hayFiltro && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onFilterClick('all')}
          className="ml-auto h-8 gap-1.5 px-3 text-xs font-semibold rounded-xl text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100/80 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700 transition-all shadow-2xs"
        >
          <RotateCcw className="h-3 w-3 text-slate-500" aria-hidden="true" />
          <span>Todo el catálogo</span>
          <span className="rounded-full bg-slate-200 dark:bg-slate-700 px-1.5 py-0.2 text-[10px] font-bold tabular-nums leading-none">
            {counts.all}
          </span>
        </Button>
      )}
    </div>
  )
}
