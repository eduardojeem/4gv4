'use client'

import type { DateRange } from 'react-day-picker'
import {
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  isValid,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
} from 'date-fns'
import { Calendar as CalendarIcon, Filter, RefreshCw, Sparkles } from 'lucide-react'

import { BranchSelector } from '@/components/branches/branch-selector'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { DatePickerWithRange } from '@/components/ui/date-range-picker'
import type { AdminFinanceFilters } from '@/hooks/use-admin-finances'
import { cn } from '@/lib/utils'

interface FinanceFiltersProps {
  filters: AdminFinanceFilters
  isRefreshing: boolean
  onDateRangeChange: (range: DateRange | undefined) => void
  onRefresh: () => void
}

export function FinanceFilters({
  filters,
  isRefreshing,
  onDateRangeChange,
  onRefresh,
}: FinanceFiltersProps) {
  const fromDate = parseISO(filters.startDate)
  const toDate = parseISO(filters.endDate)
  const dateRange: DateRange = {
    from: isValid(fromDate) ? fromDate : undefined,
    to: isValid(toDate) ? toDate : undefined,
  }

  const now = new Date()
  const quickRanges: Array<{ label: string; range: DateRange; startStr: string; endStr: string }> = [
    {
      label: 'Hoy',
      range: { from: startOfDay(now), to: endOfDay(now) },
      startStr: format(startOfDay(now), 'yyyy-MM-dd'),
      endStr: format(endOfDay(now), 'yyyy-MM-dd'),
    },
    {
      label: 'Esta semana',
      range: { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }) },
      startStr: format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
      endStr: format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
    },
    {
      label: 'Este mes',
      range: { from: startOfMonth(now), to: endOfMonth(now) },
      startStr: format(startOfMonth(now), 'yyyy-MM-dd'),
      endStr: format(endOfMonth(now), 'yyyy-MM-dd'),
    },
    {
      label: 'Mes anterior',
      range: {
        from: startOfMonth(subMonths(now, 1)),
        to: endOfMonth(subMonths(now, 1)),
      },
      startStr: format(startOfMonth(subMonths(now, 1)), 'yyyy-MM-dd'),
      endStr: format(endOfMonth(subMonths(now, 1)), 'yyyy-MM-dd'),
    },
    {
      label: 'Últimos 30 días',
      range: { from: subDays(now, 30), to: now },
      startStr: format(subDays(now, 30), 'yyyy-MM-dd'),
      endStr: format(now, 'yyyy-MM-dd'),
    },
    {
      label: 'Últimos 90 días',
      range: { from: subDays(now, 90), to: now },
      startStr: format(subDays(now, 90), 'yyyy-MM-dd'),
      endStr: format(now, 'yyyy-MM-dd'),
    },
  ]

  return (
    <Card className="border-border/70 shadow-sm bg-card/70 backdrop-blur-sm overflow-hidden">
      <CardContent className="space-y-3.5 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
              <Filter className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Filtro de Período y Sucursal</p>
              <p className="text-xs text-foreground/80">
                Los cálculos se comparan automáticamente contra el período anterior de igual duración.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <DatePickerWithRange date={dateRange} onDateChange={onDateRangeChange} className="w-full [&_button]:w-full sm:[&_button]:w-[280px]" />
            <BranchSelector compact className="w-full sm:w-auto" />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="h-9 gap-1.5 font-medium shadow-xs"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', isRefreshing && 'animate-spin')} />
              Actualizar
            </Button>
          </div>
        </div>

        {/* ── Presets Rápidos con estado Activo ── */}
        <div className="flex items-center gap-2 border-t border-border/50 pt-3 flex-wrap">
          <span className="text-xs font-semibold text-muted-foreground mr-1 flex items-center gap-1">
            <CalendarIcon className="h-3.5 w-3.5" />
            Períodos:
          </span>
          {quickRanges.map((quickRange) => {
            const isActive =
              filters.startDate === quickRange.startStr &&
              filters.endDate === quickRange.endStr

            return (
              <Button
                key={quickRange.label}
                type="button"
                variant={isActive ? 'default' : 'outline'}
                size="sm"
                className={cn(
                  'h-7 rounded-full px-3 text-xs font-medium transition-all select-none',
                  isActive
                    ? 'shadow-xs scale-[1.02]'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/80'
                )}
                onClick={() => onDateRangeChange(quickRange.range)}
              >
                {quickRange.label}
              </Button>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
