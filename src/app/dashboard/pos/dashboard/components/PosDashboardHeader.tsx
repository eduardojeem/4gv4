'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ArrowLeft, BarChart3, Calendar as CalendarIcon, Download, HandCoins, LayoutGrid, ShoppingCart, TrendingUp, Wrench, type LucideIcon } from 'lucide-react'
import { DateRange } from 'react-day-picker'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { SectionGuideButton } from '@/components/dashboard/common/SectionGuideButton'
import { POS_DASHBOARD_GUIDE } from '@/components/dashboard/common/section-guides-data'

import type { PosDashboardTabDefinition, PosDashboardViewTab } from '../lib/dashboard-tabs'
import { QUICK_RANGES, activeQuickRange } from '../lib/pos-dashboard-range'

export type { PosDashboardViewTab }

const TAB_ICONS: Record<PosDashboardViewTab, LucideIcon> = {
  all: LayoutGrid,
  sales: ShoppingCart,
  credits: HandCoins,
  repairs: Wrench,
  profit: TrendingUp,
}

const TAB_ACTIVE_TEXT: Record<PosDashboardViewTab, string> = {
  all: 'text-foreground',
  sales: 'text-emerald-600 dark:text-emerald-400',
  credits: 'text-rose-600 dark:text-rose-400',
  repairs: 'text-amber-600 dark:text-amber-400',
  profit: 'text-indigo-600 dark:text-indigo-400',
}

interface PosDashboardHeaderProps {
  dateRange: DateRange | undefined
  setDateRange: (range: DateRange | undefined) => void
  onExport: () => void
  activeViewTab: PosDashboardViewTab
  setActiveViewTab: (tab: PosDashboardViewTab) => void
  /** Solo las pestañas cuyos modulos tiene la organizacion. */
  availableTabs: readonly PosDashboardTabDefinition[]
}

export function PosDashboardHeader({ dateRange, setDateRange, onExport, activeViewTab, setActiveViewTab, availableTabs }: PosDashboardHeaderProps) {
  // El encabezado decia «POS & Taller» y hablaba de reparaciones tambien en
  // organizaciones sin taller.
  const tieneTaller = availableTabs.some((tab) => tab.value === 'repairs')
  const tieneCreditos = availableTabs.some((tab) => tab.value === 'credits')
  const areas = ['ventas', tieneCreditos && 'créditos', tieneTaller && 'reparaciones', 'ganancias y métodos de pago']
    .filter(Boolean)
    .join(', ')

  // Cual rango rapido esta aplicado: antes ningun boton quedaba marcado.
  const rangoActivo = activeQuickRange(dateRange)

  const rangeLabel = dateRange?.from
    ? dateRange.to
      ? `${format(dateRange.from, 'dd MMM', { locale: es })} – ${format(dateRange.to, 'dd MMM yyyy', { locale: es })}`
      : format(dateRange.from, 'dd MMM yyyy', { locale: es })
    : 'Seleccionar fechas'

  return (
    <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between w-full">
      <div className="space-y-2">
        <Button asChild variant="ghost" size="sm" className="-ml-2 h-8 gap-1.5 text-xs text-slate-500">
          <Link href="/dashboard/pos">
            <ArrowLeft className="h-3.5 w-3.5" />
            Volver al POS
          </Link>
        </Button>
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400">
          <BarChart3 className="h-3.5 w-3.5" />
          Analíticas POS{tieneTaller ? ' & Taller' : ''}
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">
          Dashboard del POS
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Resumen de {areas} del período seleccionado.
        </p>

        {/* Pestañas: Créditos y Taller solo aparecen si la organizacion tiene
            esos modulos, con la misma regla que el menu lateral. */}
        <div role="tablist" aria-label="Vistas del dashboard" className="mt-3 flex w-fit flex-wrap gap-1 rounded-lg border bg-muted/40 p-1">
          {availableTabs.map((tab) => {
            const Icon = TAB_ICONS[tab.value]
            const activa = activeViewTab === tab.value
            return (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={activa}
                onClick={() => setActiveViewTab(tab.value)}
                className={cn(
                  'flex h-7 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors',
                  activa
                    ? cn('bg-background font-semibold shadow-sm', TAB_ACTIVE_TEXT[tab.value])
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* Quick range buttons */}
        <div className="flex gap-1 rounded-lg border bg-muted/30 p-1">
          {QUICK_RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              aria-pressed={rangoActivo === r.key}
              onClick={() => setDateRange(r.getRange(new Date()))}
              className={cn(
                'h-7 rounded-md px-2.5 text-xs font-medium transition-colors',
                rangoActivo === r.key
                  ? 'bg-background font-semibold text-foreground shadow-sm'
                  : 'text-slate-500 hover:bg-background hover:text-slate-900 dark:hover:text-slate-50'
              )}
            >
              {r.label}
            </button>
          ))}
        </div>

        {/* Date picker */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn('h-9 gap-2 text-xs', !dateRange && 'text-slate-400')}
            >
              <CalendarIcon className="h-3.5 w-3.5" />
              {rangeLabel}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              initialFocus
              mode="range"
              required
              defaultMonth={dateRange?.from}
              selected={dateRange}
              onSelect={setDateRange}
              numberOfMonths={2}
              locale={es}
            />
          </PopoverContent>
        </Popover>

        <SectionGuideButton 
          guide={POS_DASHBOARD_GUIDE} 
          className="h-9 font-semibold text-xs border-indigo-500/30 hover:border-indigo-500/60 bg-indigo-500/5 hover:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 transition-all shadow-2xs"
        />

        <Button variant="outline" size="sm" className="h-9 gap-2 text-xs" onClick={onExport}>
          <Download className="h-3.5 w-3.5" />
          Exportar CSV
        </Button>

        <Button asChild size="sm" className="gap-2">
          <Link href="/dashboard/pos">
            <ShoppingCart className="h-3.5 w-3.5" />
            Ir al POS
          </Link>
        </Button>
      </div>
    </header>
  )
}
