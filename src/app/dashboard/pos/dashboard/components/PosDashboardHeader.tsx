'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ArrowLeft, BarChart3, Calendar as CalendarIcon, Download, ShoppingCart } from 'lucide-react'
import { DateRange } from 'react-day-picker'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { cn } from '@/lib/utils'

interface PosDashboardHeaderProps {
  dateRange: DateRange | undefined
  setDateRange: (range: DateRange | undefined) => void
  onExport: () => void
}

const QUICK_RANGES = [
  { label: 'Hoy', getRange: () => { const d = new Date(); return { from: d, to: d } } },
  { label: '7 días', getRange: () => { const to = new Date(); const from = new Date(); from.setDate(from.getDate() - 6); return { from, to } } },
  { label: '30 días', getRange: () => { const to = new Date(); const from = new Date(); from.setDate(from.getDate() - 29); return { from, to } } },
  { label: 'Este mes', getRange: () => { const now = new Date(); return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: now } } },
]

export function PosDashboardHeader({ dateRange, setDateRange, onExport }: PosDashboardHeaderProps) {
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
          Analíticas POS
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">
          Dashboard del POS
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Resumen de ventas, métodos de pago y top productos del período seleccionado.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* Quick range buttons */}
        <div className="flex gap-1 rounded-lg border bg-muted/30 p-1">
          {QUICK_RANGES.map((r) => (
            <button
              key={r.label}
              type="button"
              onClick={() => setDateRange(r.getRange())}
              className="h-7 rounded-md px-2.5 text-xs font-medium text-slate-500 transition-colors hover:bg-background hover:text-slate-900 dark:hover:text-slate-50"
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
              defaultMonth={dateRange?.from}
              selected={dateRange}
              onSelect={setDateRange}
              numberOfMonths={2}
              locale={es}
            />
          </PopoverContent>
        </Popover>

        <Button variant="outline" size="sm" className="gap-2" onClick={onExport}>
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
