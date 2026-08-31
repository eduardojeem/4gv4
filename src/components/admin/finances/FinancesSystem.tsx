'use client'

import { useState } from 'react'
import {
  Banknote,
  ChartNoAxesCombined,
  ChevronDown,
  ChevronUp,
  CircleDollarSign,
  HelpCircle,
  Landmark,
  Layers,
  Lightbulb,
  ReceiptText,
  Settings2,
  Sparkles,
  TrendingUp,
  UsersRound,
  WalletCards,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAdminFinances } from '@/hooks/use-admin-finances'
import { formatCurrency } from '@/lib/currency'
import { ExpensesPanel } from './ExpensesPanel'
import { FinanceFilters } from './FinanceFilters'
import { FinanceSettingsPanel } from './FinanceSettingsPanel'
import { FinanceEmptyState, FinanceErrorState, FinanceLoadingState, FinanceStaleDataAlert } from './FinanceStates'
import { FinanceSummary } from './FinanceSummary'
import { PayrollPanel } from './PayrollPanel'
import { ProfitabilityPanel } from './ProfitabilityPanel'

const sections = [
  { value: 'Resumen', description: 'Estado general y balance', icon: CircleDollarSign, color: 'text-blue-600 dark:text-blue-400' },
  { value: 'Gastos', description: 'Obligaciones y pagos', icon: ReceiptText, color: 'text-amber-600 dark:text-amber-400' },
  { value: 'Nómina', description: 'Sueldos y comisiones', icon: UsersRound, color: 'text-purple-600 dark:text-purple-400' },
  { value: 'Rentabilidad', description: 'Márgenes por actividad', icon: ChartNoAxesCombined, color: 'text-emerald-600 dark:text-emerald-400' },
  { value: 'Configuración', description: 'Reglas y personal', icon: Settings2, color: 'text-slate-600 dark:text-slate-400' },
] as const

type FinanceSection = (typeof sections)[number]['value']

function isEmptySummary(summary: NonNullable<ReturnType<typeof useAdminFinances>['summary']>) {
  const accruedValues = [summary.accrued.revenue, summary.accrued.directCosts, summary.accrued.grossProfit, summary.accrued.operatingExpenses, summary.accrued.payrollCost, summary.accrued.netProfit]
  const cashValues = [summary.cash.collected, summary.cash.paid, summary.cash.netCashFlow]
  const hasNoValues = accruedValues.every((value) => value === null || value === 0) && cashValues.every((value) => value === 0)
  const hasNoAlerts = summary.upcomingDue.length === 0 && summary.overdue.length === 0 && summary.coverageWarnings.length === 0
  return hasNoValues && hasNoAlerts && summary.complete
}

export function FinancesSystem() {
  const [activeTab, setActiveTab] = useState<FinanceSection>('Resumen')
  const [showQuickGuide, setShowQuickGuide] = useState(false)
  const finances = useAdminFinances()
  const selectedBranchId = finances.filters.branchId

  const summary = finances.summary
  const isProfitPositive = summary?.accrued?.netProfit !== null && (summary?.accrued?.netProfit ?? 0) >= 0

  return (
    <div className="space-y-6">
      {/* ── HEADER MODERNO CON INDICADORES EN VIVO ── */}
      <header className="rounded-2xl border border-border/70 bg-gradient-to-r from-card via-card to-primary/5 p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-xs shrink-0">
              <CircleDollarSign className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
                  Finanzas
                </h1>
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[11px] font-semibold">
                  Gestión Inteligente
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Tomá decisiones con una vista clara del negocio: cuánto ganás, qué dinero entró o salió y qué compromisos requieren atención.
              </p>
            </div>
          </div>

          {/* Botones de acción rápida y toggle de guía */}
          <div className="flex items-center gap-2 flex-wrap">
            {summary && summary.accrued && (
              <div className="hidden xl:flex items-center gap-3 border-r border-border/60 pr-3 mr-1 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block">Ganancia Neta</span>
                  <span className={`font-bold tabular-nums ${isProfitPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}>
                    {summary.accrued.netProfit === null ? 'Pendiente' : formatCurrency(summary.accrued.netProfit)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block">Flujo de Caja</span>
                  <span className={`font-bold tabular-nums ${(summary.cash.netCashFlow ?? 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}>
                    {formatCurrency(summary.cash.netCashFlow)}
                  </span>
                </div>
              </div>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowQuickGuide((prev) => !prev)}
              className="gap-1.5 text-xs font-semibold rounded-xl"
            >
              <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
              <span>{showQuickGuide ? 'Ocultar guía' : 'Guía rápida'}</span>
              {showQuickGuide ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>

        {/* ── GUÍA RÁPIDA INTERACTIVA DE CONCEPTOS FINANCIEROS ── */}
        {showQuickGuide && (
          <div className="mt-4 pt-4 border-t border-border/60 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-background/80 p-3.5 border border-border/60 space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-blue-700 dark:text-blue-300">
                <Landmark className="h-4 w-4" />
                <span>1. Resultado vs Caja Real</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                <strong>Devengado:</strong> Mide la ganancia contable según lo vendido en el período.  
                <strong>Caja:</strong> Mide el dinero real en efectivo o banco que entró y salió.
              </p>
            </div>

            <div className="rounded-xl bg-background/80 p-3.5 border border-border/60 space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                <TrendingUp className="h-4 w-4" />
                <span>2. Margen y Ganancia Neta</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                <strong>Margen Bruto:</strong> Ventas menos el costo de productos/repuestos.  
                <strong>Ganancia Neta:</strong> Lo que te queda después de pagar sueldos y gastos fijos.
              </p>
            </div>

            <div className="rounded-xl bg-background/80 p-3.5 border border-border/60 space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-700 dark:text-amber-300">
                <ReceiptText className="h-4 w-4" />
                <span>3. Gastos y Vencimientos</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Cargá todas tus facturas, alquileres y servicios con fecha de vencimiento para planificar los pagos antes de que generen recargos.
              </p>
            </div>
          </div>
        )}
      </header>

      {/* ── FILTROS DE PERÍODO Y SUCURSAL ── */}
      <FinanceFilters
        filters={finances.filters}
        isRefreshing={finances.isRefreshing ?? false}
        onDateRangeChange={finances.setDateRange}
        onRefresh={finances.refresh}
      />

      {/* ── PESTAÑAS PRINCIPALES DEL PANEL ── */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as FinanceSection)} className="space-y-5">
        <section aria-labelledby="finance-sections-heading" className="rounded-2xl border border-border/70 bg-card p-3 sm:p-4 shadow-xs">
          <div className="mb-3 px-1">
            <h2 id="finance-sections-heading" className="text-sm font-semibold">Qué querés administrar</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Elegí una sección. El período y la sucursal seleccionados se mantienen en toda la pantalla.</p>
          </div>
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1.5 bg-muted/40 p-1.5 md:grid-cols-5 rounded-xl" aria-label="Secciones de Finanzas">
            {sections.map(({ value, description, icon: Icon, color }) => {
              const isSelected = activeTab === value
              return (
                <TabsTrigger
                  key={value}
                  value={value}
                  className={`h-auto min-h-16 flex-col items-start justify-center gap-1 whitespace-normal px-3.5 py-2.5 text-left rounded-xl transition-all select-none ${
                    isSelected
                      ? 'bg-card text-foreground shadow-xs ring-1 ring-border font-bold'
                      : 'text-muted-foreground hover:text-foreground hover:bg-card/40'
                  }`}
                >
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    <Icon className={`h-4 w-4 shrink-0 ${isSelected ? 'text-primary' : color}`} aria-hidden="true" />
                    {value}
                  </span>
                  <span aria-hidden="true" className="text-left text-[11px] font-normal text-muted-foreground line-clamp-1">
                    {description}
                  </span>
                </TabsTrigger>
              )
            })}
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
