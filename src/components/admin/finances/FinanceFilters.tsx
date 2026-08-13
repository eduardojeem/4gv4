'use client'

import type { DateRange } from 'react-day-picker'
import { format, isValid, parseISO } from 'date-fns'
import { CalendarRange, RefreshCw } from 'lucide-react'

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

  const fromLabel = isValid(fromDate) ? format(fromDate, 'dd/MM/yyyy') : '—'
  const toLabel = isValid(toDate) ? format(toDate, 'dd/MM/yyyy') : '—'

  return (
    <Card className="border-border/70 shadow-sm">
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-col gap-1">
            <p className="text-sm font-medium">Período y sucursal</p>
            <p className="text-xs text-muted-foreground">
              El período se compara automáticamente con el anterior de igual duración.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <DatePickerWithRange date={dateRange} onDateChange={onDateRangeChange} className="w-full [&_button]:w-full sm:[&_button]:w-[300px]" />
            <BranchSelector compact className="w-full sm:w-auto" />
            <Button type="button" variant="outline" onClick={onRefresh} disabled={isRefreshing}>
              <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
              Actualizar
            </Button>
          </div>
        </div>
        <p className="flex items-center gap-2 border-t pt-3 text-xs text-muted-foreground">
          <CalendarRange className="h-4 w-4" />
          {fromLabel} al {toLabel}
        </p>
      </CardContent>
    </Card>
  )
}
