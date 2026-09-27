'use client'

import React from 'react'
import {
  BarChart3,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  TrendingDown,
  CheckCircle2,
  DollarSign,
  Package,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MetricsGrid } from './MetricsGrid'
import { AlertsBanner } from './AlertsBanner'
import { DashboardMetrics, ProductAlert } from '@/types/products-dashboard'
import { formatCurrencyCompact } from '@/lib/currency'
import { cn } from '@/lib/utils'

export interface ProductSummaryOverviewProps {
  metrics: DashboardMetrics
  alerts?: ProductAlert[]
  canViewCost?: boolean
  showServices?: boolean
  isExpanded: boolean
  onToggleExpanded: () => void
  onMetricClick?: (metric: 'all' | 'low_stock' | 'out_of_stock' | 'value' | 'products' | 'services' | 'active') => void
  onAlertClick?: (alertType: 'out_of_stock' | 'low_stock' | 'missing_data') => void
  onDismissAlert?: (alertId: string) => void
  className?: string
}

export function ProductSummaryOverview({
  metrics,
  alerts = [],
  canViewCost = true,
  showServices = true,
  isExpanded,
  onToggleExpanded,
  onMetricClick,
  onAlertClick,
  onDismissAlert,
  className,
}: ProductSummaryOverviewProps) {
  const formattedValue = formatCurrencyCompact(metrics.inventory_value)
  const physicalCount =
    metrics.physical_products_count ??
    Math.max(0, metrics.total_products - (metrics.services_count ?? 0))
  const servicesCount = metrics.services_count ?? 0

  return (
    <div
      className={cn(
        'rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-slate-900 shadow-2xs overflow-hidden transition-all duration-200',
        className
      )}
    >
      {/* Barra de Resumen Compacta (Siempre Visible) */}
      <div
        className={cn(
          'flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 px-3 py-2 sm:px-4 sm:py-2 bg-gradient-to-r from-slate-50/90 via-white to-slate-50/50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950/60 transition-colors',
          isExpanded && 'border-b border-slate-200/80 dark:border-slate-800/80'
        )}
      >
        {/* Lado Izquierdo: Ícono, Título y Pastillas Rápidas */}
        <div className="flex items-center gap-2.5 flex-wrap min-w-0">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500 text-white shadow-2xs">
            <BarChart3 className="h-3.5 w-3.5" />
          </div>

          <span className="text-xs sm:text-sm font-bold tracking-tight text-slate-900 dark:text-slate-100 shrink-0">
            Resumen de Inventario
          </span>

          <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block" />

          {/* Pastillas Interactivas Rápidas */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Total */}
            <button
              type="button"
              onClick={() => onMetricClick?.('all')}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100/90 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700/80 transition-colors cursor-pointer"
              title="Ver catálogo total"
            >
              <Package className="h-3 w-3 text-blue-600 dark:text-blue-400" />
              <span className="text-muted-foreground font-normal">Total:</span>
              <span className="font-bold text-slate-900 dark:text-white">
                {metrics.total_products}
              </span>
              {showServices && (
                <span className="text-[10px] text-muted-foreground font-normal hidden md:inline">
                  ({physicalCount} prod · {servicesCount} serv)
                </span>
              )}
            </button>

            {/* Bajo Stock */}
            <button
              type="button"
              onClick={() => onMetricClick?.('low_stock')}
              className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer',
                metrics.low_stock_count > 0
                  ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-300/60 dark:border-amber-700/50 hover:bg-amber-500/20'
                  : 'bg-slate-100/80 dark:bg-slate-800/70 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              )}
              title="Filtrar productos con stock bajo"
            >
              <AlertTriangle
                className={cn(
                  'h-3 w-3',
                  metrics.low_stock_count > 0
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-slate-400'
                )}
              />
              <span className="text-muted-foreground font-normal">Bajo stock:</span>
              <span className="font-bold">{metrics.low_stock_count}</span>
            </button>

            {/* Agotados */}
            <button
              type="button"
              onClick={() => onMetricClick?.('out_of_stock')}
              className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer',
                metrics.out_of_stock_count > 0
                  ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-300/60 dark:border-rose-700/50 hover:bg-rose-500/20'
                  : 'bg-slate-100/80 dark:bg-slate-800/70 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              )}
              title="Filtrar productos agotados"
            >
              <TrendingDown
                className={cn(
                  'h-3 w-3',
                  metrics.out_of_stock_count > 0
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-slate-400'
                )}
              />
              <span className="text-muted-foreground font-normal">Agotados:</span>
              <span className="font-bold">{metrics.out_of_stock_count}</span>
            </button>

            {/* Activos */}
            <button
              type="button"
              onClick={() => onMetricClick?.('active')}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-300/60 dark:border-emerald-700/50 hover:bg-emerald-500/20 transition-colors cursor-pointer"
              title="Filtrar productos activos en venta"
            >
              <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
              <span className="text-muted-foreground font-normal">Activos:</span>
              <span className="font-bold">{metrics.active_products}</span>
            </button>

            {/* Valor Total (si tiene permiso para ver costos) */}
            {canViewCost && (
              <button
                type="button"
                onClick={() => onMetricClick?.('value')}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100/90 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700/80 transition-colors cursor-pointer hidden sm:inline-flex"
                title="Ver catálogo para análisis de valor total"
              >
                <DollarSign className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                <span className="text-muted-foreground font-normal">Valor:</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {formattedValue}
                </span>
              </button>
            )}

            {/* Indicador de Alertas activas */}
            {alerts && alerts.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-800 dark:text-amber-200 border border-amber-300/70 dark:border-amber-700/70">
                <AlertTriangle className="h-2.5 w-2.5" />
                <span>
                  {alerts.length} {alerts.length === 1 ? 'alerta' : 'alertas'}
                </span>
              </span>
            )}
          </div>
        </div>

        {/* Lado Derecho: Botón Contraer / Expandir */}
        <div className="flex items-center justify-end shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onToggleExpanded}
            aria-expanded={isExpanded}
            className={cn(
              'h-8 px-3 text-xs font-bold rounded-xl gap-1.5 transition-all shadow-2xs',
              isExpanded
                ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700'
                : 'bg-blue-50/90 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/80'
            )}
          >
            {isExpanded ? (
              <>
                <span>Plegar resumen</span>
                <ChevronUp className="h-3.5 w-3.5" />
              </>
            ) : (
              <>
                <span>Ver resumen completo</span>
                <ChevronDown className="h-3.5 w-3.5" />
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Contenido Desplegable: MetricsGrid y AlertsBanner */}
      {isExpanded && (
        <div className="p-3 sm:p-4 space-y-3 bg-slate-50/40 dark:bg-slate-950/20 animate-in fade-in slide-in-from-top-2 duration-200">
          <MetricsGrid
            metrics={metrics}
            showServices={showServices}
            canViewCost={canViewCost}
            onMetricClick={onMetricClick}
          />

          {alerts && alerts.length > 0 && (
            <AlertsBanner
              alerts={alerts}
              onAlertClick={onAlertClick}
              onDismissAlert={onDismissAlert}
            />
          )}
        </div>
      )}
    </div>
  )
}
