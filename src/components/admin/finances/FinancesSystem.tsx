'use client'

import { useState } from 'react'
import {
  ChartNoAxesCombined,
  CircleDollarSign,
  ReceiptText,
  Settings2,
  UsersRound,
} from 'lucide-react'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAdminFinances } from '@/hooks/use-admin-finances'
import { ExpensesPanel } from './ExpensesPanel'
import { FinanceFilters } from './FinanceFilters'
import { FinanceSettingsPanel } from './FinanceSettingsPanel'
import { FinanceEmptyState, FinanceErrorState, FinanceLoadingState, FinanceStaleDataAlert } from './FinanceStates'
import { FinanceSummary } from './FinanceSummary'
import { PayrollPanel } from './PayrollPanel'
import { ProfitabilityPanel } from './ProfitabilityPanel'

const sections = [
  { value: 'Resumen', description: 'Estado general', icon: CircleDollarSign },
  { value: 'Gastos', description: 'Pagos y vencimientos', icon: ReceiptText },
  { value: 'Nómina', description: 'Sueldos y comisiones', icon: UsersRound },
  { value: 'Rentabilidad', description: 'Resultado por actividad', icon: ChartNoAxesCombined },
  { value: 'Configuración', description: 'Reglas y personal', icon: Settings2 },
] as const

type FinanceSection = (typeof sections)[number]['value']

function isEmptySummary(summary: NonNullable<ReturnType<typeof useAdminFinances>['summary']>) {
  const accruedValues = [summary.accrued.revenue, summary.accrued.directCosts, summary.accrued.grossProfit, summary.accrued.operatingExpenses, summary.accrued.payrollCost, summary.accrued.netProfit]
  const cashValues = [summary.cash.collected, summary.cash.paid, summary.cash.netCashFlow]
  const hasNoValues = accruedValues.every((value) => value === null || value === 0) && cashValues.every((value) => value === 0)
  const hasNoAlerts = summary.upcomingDue.length === 0 && summary.overdue.length === 0 && summary.coverageWarnings.length === 0
  // Only consider empty if there are absolutely no values AND no alerts AND data is confirmed complete.
  // If complete=false but no values, show the summary (it will show the coverage warnings).
  return hasNoValues && hasNoAlerts && summary.complete
}

export function FinancesSystem() {
  const [activeTab, setActiveTab] = useState<FinanceSection>('Resumen')
  const finances = useAdminFinances()
  const selectedBranchId = finances.filters.branchId

  return (
    <div className="space-y-6">
      {/* #7 — Header compactado: misma info pero en una sola línea horizontal
          liberando ~80px que antes empujaban el contenido hacia abajo. */}
      <header className="flex items-center gap-3 rounded-xl border border-border/70 bg-card px-5 py-3 shadow-sm">
        <div className="rounded-md bg-primary/10 p-2 text-primary shrink-0">
          <CircleDollarSign className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <h1 className="text-base font-bold tracking-tight">Finanzas</h1>
            <p className="text-xs text-muted-foreground">Administración financiera</p>
          </div>
          <p className="hidden text-xs text-muted-foreground sm:block">
            Tomá decisiones con una vista clara del negocio: cuánto ganás, qué dinero entró o salió y qué compromisos requieren atención.
          </p>
        </div>
      </header>

      <FinanceFilters
        filters={finances.filters}
        isRefreshing={finances.isRefreshing ?? false}
        onDateRangeChange={finances.setDateRange}
        onRefresh={finances.refresh}
      />

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as FinanceSection)} className="space-y-5">
        <section aria-labelledby="finance-sections-heading" className="rounded-xl border border-border/70 bg-card p-3 shadow-sm sm:p-4">
          <div className="mb-3 px-1">
            <h2 id="finance-sections-heading" className="text-sm font-semibold">Qué querés administrar</h2>
            <p className="mt-1 text-xs text-muted-foreground">Elegí una sección. El período y la sucursal seleccionados se mantienen en toda la pantalla.</p>
          </div>
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1 bg-muted/60 p-1 md:grid-cols-5" aria-label="Secciones de Finanzas">
            {sections.map(({ value, description, icon: Icon }) => (
              <TabsTrigger key={value} value={value} className="h-auto min-h-16 flex-col items-start justify-center gap-1 whitespace-normal px-3 py-2 text-left data-[state=active]:shadow-sm">
                <span className="flex items-center gap-2 text-sm font-medium"><Icon className="h-4 w-4" aria-hidden="true" />{value}</span>
                <span aria-hidden="true" className="text-left text-xs font-normal text-muted-foreground">{description}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </section>

        <TabsContent value="Resumen" className="mt-0">
          {finances.isLoading && !finances.summary ? <FinanceLoadingState /> : null}
          {!finances.isLoading && finances.error && !finances.summary ? (
            <FinanceErrorState error={finances.error} onRetry={finances.refresh} />
          ) : null}
          {finances.error && finances.summary ? (
            <FinanceStaleDataAlert
              error={finances.error}
              generatedAt={finances.summary.generatedAt}
              onRetry={finances.refresh}
            />
          ) : null}
          {finances.summary && isEmptySummary(finances.summary) && !finances.isLoading ? (
            <FinanceEmptyState />
          ) : null}
          {finances.summary && !isEmptySummary(finances.summary) ? (
            <FinanceSummary
              summary={finances.summary}
              onViewExpenses={() => setActiveTab('Gastos')}
              onViewProfitability={() => setActiveTab('Rentabilidad')}
              onViewPayroll={() => setActiveTab('Nómina')}
            />
          ) : null}
        </TabsContent>
        <TabsContent value="Gastos" className="mt-0">{finances.organizationId ? <ExpensesPanel organizationId={finances.organizationId} branchId={selectedBranchId} filters={finances.filters} onChanged={finances.refresh} /> : <FinanceLoadingState />}</TabsContent>
        <TabsContent value="Nómina" className="mt-0">{finances.organizationId ? <PayrollPanel organizationId={finances.organizationId} branchId={selectedBranchId} filters={finances.filters} onChanged={finances.refresh} /> : <FinanceLoadingState />}</TabsContent>
        <TabsContent value="Rentabilidad" className="mt-0">{finances.organizationId ? <ProfitabilityPanel organizationId={finances.organizationId} filters={finances.filters} /> : <FinanceLoadingState />}</TabsContent>
        <TabsContent value="Configuración" className="mt-0">{finances.organizationId ? <FinanceSettingsPanel organizationId={finances.organizationId} branchId={selectedBranchId} /> : <FinanceLoadingState />}</TabsContent>
      </Tabs>
    </div>
  )
}
