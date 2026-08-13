'use client'

import { useState } from 'react'
import { CircleDollarSign } from 'lucide-react'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAdminFinances } from '@/hooks/use-admin-finances'
import { ExpensesPanel } from './ExpensesPanel'
import { FinanceFilters } from './FinanceFilters'
import { FinanceSettingsPanel } from './FinanceSettingsPanel'
import { FinanceEmptyState, FinanceErrorState, FinanceLoadingState, FinanceStaleDataAlert } from './FinanceStates'
import { FinanceSummary } from './FinanceSummary'
import { PayrollPanel } from './PayrollPanel'
import { ProfitabilityPanel } from './ProfitabilityPanel'

const tabs = ['Resumen', 'Gastos', 'Nómina', 'Rentabilidad', 'Configuración'] as const

function isEmptySummary(summary: NonNullable<ReturnType<typeof useAdminFinances>['summary']>) {
  const accruedValues = [summary.accrued.revenue, summary.accrued.directCosts, summary.accrued.grossProfit, summary.accrued.operatingExpenses, summary.accrued.payrollCost, summary.accrued.netProfit]
  const cashValues = [summary.cash.collected, summary.cash.paid, summary.cash.netCashFlow]
  return accruedValues.every((value) => value === null || value === 0) && cashValues.every((value) => value === 0) && summary.upcomingDue.length === 0 && summary.overdue.length === 0 && summary.coverageWarnings.length === 0 && summary.complete
}

export function FinancesSystem() {
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>('Resumen')
  const finances = useAdminFinances()
  const selectedBranchId = finances.filters.branchId

  return <div className="space-y-6"><header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><CircleDollarSign className="h-6 w-6 text-primary" aria-hidden="true" />Finanzas</h1><p className="mt-1 max-w-2xl text-sm text-muted-foreground">Resultado, caja y compromisos financieros con el mismo período y sucursal para toda la administración.</p></div></header><FinanceFilters filters={finances.filters} isRefreshing={finances.isRefreshing ?? false} onDateRangeChange={finances.setDateRange} onRefresh={finances.refresh} /><Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as (typeof tabs)[number])} className="space-y-5"><TabsList className="h-auto w-full justify-start overflow-x-auto" aria-label="Secciones de Finanzas">{tabs.map((tab) => <TabsTrigger key={tab} value={tab} className="min-w-max">{tab}</TabsTrigger>)}</TabsList><TabsContent value="Resumen">{finances.isLoading ? <FinanceLoadingState /> : null}{!finances.isLoading && finances.error && !finances.summary ? <FinanceErrorState error={finances.error} onRetry={finances.refresh} /> : null}{!finances.isLoading && finances.error && finances.summary ? <FinanceStaleDataAlert error={finances.error} generatedAt={finances.summary.generatedAt} onRetry={finances.refresh} /> : null}{!finances.isLoading && finances.summary && isEmptySummary(finances.summary) ? <FinanceEmptyState /> : null}{!finances.isLoading && finances.summary && !isEmptySummary(finances.summary) ? <FinanceSummary summary={finances.summary} /> : null}</TabsContent><TabsContent value="Gastos">{finances.organizationId ? <ExpensesPanel organizationId={finances.organizationId} branchId={selectedBranchId} filters={finances.filters} onChanged={finances.refresh} /> : <FinanceLoadingState />}</TabsContent><TabsContent value="Nómina">{finances.organizationId ? <PayrollPanel organizationId={finances.organizationId} branchId={selectedBranchId} filters={finances.filters} onChanged={finances.refresh} /> : <FinanceLoadingState />}</TabsContent><TabsContent value="Rentabilidad">{finances.organizationId ? <ProfitabilityPanel organizationId={finances.organizationId} filters={finances.filters} /> : <FinanceLoadingState />}</TabsContent><TabsContent value="Configuración">{finances.organizationId ? <FinanceSettingsPanel organizationId={finances.organizationId} branchId={selectedBranchId} /> : <FinanceLoadingState />}</TabsContent></Tabs></div>
}
