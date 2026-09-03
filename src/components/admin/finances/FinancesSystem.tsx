'use client'

import { useCallback, useState } from 'react'
import { CircleDollarSign, ReceiptText, UsersRound, ChartNoAxesCombined, Settings2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAdminFinances } from '@/hooks/use-admin-finances'
import { ExpensesPanel } from './ExpensesPanel'
import { FinanceFilters } from './FinanceFilters'
import { FinanceHelp } from './FinanceHelp'
import { FinanceSectionHelp } from './FinanceSectionHelp'
import { FinanceSettingsPanel } from './FinanceSettingsPanel'
import { FinanceEmptyState, FinanceErrorState, FinanceLoadingState, FinanceStaleDataAlert } from './FinanceStates'
import { FinanceSummary } from './FinanceSummary'
import { PayrollPanel } from './PayrollPanel'
import { ProfitabilityPanel } from './ProfitabilityPanel'

const sections = [
  { value: 'Resumen', icon: CircleDollarSign },
  { value: 'Gastos', icon: ReceiptText },
  { value: 'Nómina', icon: UsersRound },
  { value: 'Rentabilidad', icon: ChartNoAxesCombined },
  { value: 'Configuración', icon: Settings2 },
] as const
type FinanceSection = (typeof sections)[number]['value']
export type ExpenseAction = 'new' | 'overdue' | 'upcoming' | 'all'

function isEmptySummary(summary: NonNullable<ReturnType<typeof useAdminFinances>['summary']>) {
  return Object.values(summary.accrued).every((value) => value === null || value === 0)
    && Object.values(summary.cash).every((value) => value === 0)
    && !summary.upcomingDue.length && !summary.overdue.length && !summary.coverageWarnings.length && summary.complete
}

export function FinancesSystem() {
  const [activeTab, setActiveTab] = useState<FinanceSection>('Resumen')
  const [refreshVersion, setRefreshVersion] = useState(0)
  const [expenseAction, setExpenseAction] = useState<{ mode: ExpenseAction; nonce: number }>({ mode: 'all', nonce: 0 })
  const finances = useAdminFinances()
  const summary = finances.summary
  const branchId = finances.filters.branchId
  const organizationId = finances.organizationId
  const scopeKey = `${organizationId}:${branchId ?? 'all'}`
  const consumeNewExpense = useCallback(() => setExpenseAction((current) => current.mode === 'new' ? { ...current, mode: 'all' } : current), [])
  const viewExpenses = (mode: ExpenseAction = 'all') => {
    setExpenseAction((current) => ({ mode, nonce: current.nonce + 1 }))
    setActiveTab('Gastos')
  }
  const refreshAll = () => {
    setRefreshVersion((value) => value + 1)
    void finances.refresh()
  }

  return <div className="space-y-4">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Finanzas</h1>
        <p className="mt-1 max-w-xl text-sm text-muted-foreground">Tomá decisiones con una vista clara del negocio: resultados, dinero y pagos pendientes.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <FinanceHelp />
        <Button size="sm" onClick={() => viewExpenses('new')} disabled={!organizationId} className="gap-2"><Plus className="h-4 w-4" />Nuevo gasto</Button>
      </div>
    </header>
    <FinanceFilters filters={finances.filters} isRefreshing={finances.isRefreshing ?? false} onDateRangeChange={finances.setDateRange} onRefresh={refreshAll} />
    <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as FinanceSection)} className="space-y-4">
      <h2 className="sr-only">Qué querés administrar</h2>
      <div className="overflow-x-auto pb-1">
        <TabsList className="h-auto w-max min-w-full justify-start gap-1 p-1" aria-label="Secciones de Finanzas">
          {sections.map(({ value, icon: Icon }) => <TabsTrigger key={value} value={value} className="min-h-10 flex-1 gap-2 px-3">
            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />{value}
          </TabsTrigger>)}
        </TabsList>
      </div>
      <FinanceSectionHelp key={activeTab} section={activeTab} />
      <TabsContent value="Resumen" className="mt-0 space-y-4">
        {finances.isLoading && !summary ? <FinanceLoadingState /> : null}
        {!finances.isLoading && finances.error && !summary ? <FinanceErrorState error={finances.error} onRetry={refreshAll} /> : null}
        {finances.error && summary ? <FinanceStaleDataAlert error={finances.error} generatedAt={summary.generatedAt} onRetry={refreshAll} /> : null}
        {summary && isEmptySummary(summary) && !finances.isLoading ? <FinanceEmptyState /> : null}
        {summary && !isEmptySummary(summary) ? <FinanceSummary summary={summary} onViewExpenses={viewExpenses} onViewProfitability={() => setActiveTab('Rentabilidad')} onViewPayroll={() => setActiveTab('Nómina')} /> : null}
      </TabsContent>
      <TabsContent value="Gastos" className="mt-0">{organizationId ? <ExpensesPanel key={scopeKey} organizationId={organizationId} branchId={branchId} filters={finances.filters} onChanged={finances.refresh} refreshVersion={refreshVersion} action={expenseAction} onActionHandled={consumeNewExpense} /> : <FinanceLoadingState />}</TabsContent>
      <TabsContent value="Nómina" className="mt-0">{organizationId ? <PayrollPanel key={scopeKey} organizationId={organizationId} branchId={branchId} filters={finances.filters} onChanged={finances.refresh} refreshVersion={refreshVersion} /> : <FinanceLoadingState />}</TabsContent>
      <TabsContent value="Rentabilidad" className="mt-0">{organizationId ? <ProfitabilityPanel key={scopeKey} organizationId={organizationId} filters={finances.filters} refreshVersion={refreshVersion} /> : <FinanceLoadingState />}</TabsContent>
      <TabsContent value="Configuración" className="mt-0">{organizationId ? <FinanceSettingsPanel key={scopeKey} organizationId={organizationId} branchId={branchId} refreshVersion={refreshVersion} /> : <FinanceLoadingState />}</TabsContent>
    </Tabs>
  </div>
}
