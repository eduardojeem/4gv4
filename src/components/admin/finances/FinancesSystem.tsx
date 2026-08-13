'use client'

import { useState } from 'react'
import { CircleDollarSign } from 'lucide-react'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAdminFinances } from '@/hooks/use-admin-finances'
import { FinanceFilters } from './FinanceFilters'
import { FinanceEmptyState, FinanceErrorState, FinanceLoadingState } from './FinanceStates'
import { FinanceSummary } from './FinanceSummary'

const tabs = ['Resumen', 'Gastos', 'Nómina', 'Rentabilidad', 'Configuración'] as const

function isEmptySummary(summary: NonNullable<ReturnType<typeof useAdminFinances>['summary']>) {
  return summary.accrued.revenue === 0
    && summary.cash.collected === 0
    && summary.cash.paid === 0
    && summary.upcomingDue.length === 0
    && summary.overdue.length === 0
}

export function FinancesSystem() {
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>('Resumen')
  const finances = useAdminFinances()

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <CircleDollarSign className="h-6 w-6 text-primary" aria-hidden="true" />
            Finanzas
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Resultado, caja y compromisos financieros con el mismo período y sucursal para toda la administración.
          </p>
        </div>
      </header>

      <FinanceFilters
        filters={finances.filters}
        isRefreshing={finances.isRefreshing ?? false}
        onDateRangeChange={finances.setDateRange}
        onRefresh={finances.refresh}
      />

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as (typeof tabs)[number])} className="space-y-5">
        <TabsList className="h-auto w-full justify-start overflow-x-auto" aria-label="Secciones de Finanzas">
          {tabs.map((tab) => <TabsTrigger key={tab} value={tab} className="min-w-max">{tab}</TabsTrigger>)}
        </TabsList>

        <TabsContent value="Resumen">
          {finances.isLoading ? <FinanceLoadingState /> : null}
          {!finances.isLoading && finances.error && !finances.summary ? <FinanceErrorState error={finances.error} onRetry={finances.refresh} /> : null}
          {!finances.isLoading && !finances.error && finances.summary && isEmptySummary(finances.summary) ? <FinanceEmptyState /> : null}
          {!finances.isLoading && finances.summary && !isEmptySummary(finances.summary) ? <FinanceSummary summary={finances.summary} /> : null}
        </TabsContent>

        {tabs.filter((tab) => tab !== 'Resumen').map((tab) => (
          <TabsContent key={tab} value={tab}>
            <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
              {tab}: las operaciones detalladas estarán disponibles en el siguiente módulo.
            </p>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
