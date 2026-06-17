'use client'

import { useState, useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FilterPanel } from '@/components/shared'
import { CreditCard, CalendarClock, CheckCircle, LayoutDashboard, Receipt, RefreshCw, Download, Users } from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import { useCredits, InstallmentRow, isInstallmentLate } from '@/hooks/use-credits'
import { CreditOverview } from '@/components/dashboard/credits/CreditOverview'
import { CreditList } from '@/components/dashboard/credits/CreditList'
import { UpcomingInstallments } from '@/components/dashboard/credits/UpcomingInstallments'
import { CreditPaymentDialog, PaymentMethod, PaymentConfirmResult } from '@/components/dashboard/credits/CreditPaymentDialog'
import { CreditDetailDialog } from '@/components/dashboard/credits/CreditDetailDialog'
import { PaymentsTimeline } from '@/components/dashboard/credits/PaymentsTimeline'
import { RouteGuard } from '@/components/auth/permission-guard'
import { PlanGate } from '@/components/admin/PlanGate'
import { formatDateInputLocal, formatDateOnlyDisplay, isSameLocalDate, startOfLocalDay } from '@/lib/date-only'
import { getCreditDisplayInfo, getInstallmentDisplayInfo } from '@/lib/credits/display'

export default function CreditsDashboardPage() {
  return (
    <PlanGate
      module="credits"
      requiredPlan="Pro"
      title="Módulo de créditos no incluido"
      description="Tu organización necesita habilitar Créditos y cuotas en su plan para gestionar financiación y cobranza."
    >
      <CreditsDashboardContent />
    </PlanGate>
  )
}

function CreditsDashboardContent() {
  const {
    loading,
    isPending,
    error,
    refreshData,
    credits,
    installments,
    payments,
    installmentsProgress,
    filterValues,
    setFilterValues,
    markInstallmentPaid,
    creditById,
    remainingByCredit,
    paidByCredit,
    getNextPendingInstallment,
    filteredInstallments,
    sales,
    saleItems
  } = useCredits()

  // Local UI State
  const [page, setPage] = useState(1)
  const pageSize = 10
  const [sortField] = useState<keyof InstallmentRow | null>(null)
  const [sortDirection] = useState<'asc' | 'desc'>('asc')
  const [activeTab, setActiveTab] = useState('overview')
  const [creditViewMode, setCreditViewMode] = useState<'cards' | 'list' | 'table'>('cards')

  // Sort y paginación de cuotas (memoizado para evitar computation en cada render)
  const sortedAndPagedInstallments = useMemo(() => {
    const sorted = [...filteredInstallments].sort((a, b) => {
      if (!sortField) return 0
      const av = a[sortField]
      const bv = b[sortField]
      if (av === bv) return 0
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDirection === 'asc' ? av - bv : bv - av
      }
      const as = String(av)
      const bs = String(bv)
      return sortDirection === 'asc' ? as.localeCompare(bs) : bs.localeCompare(as)
    })
    return sorted.slice((page - 1) * pageSize, page * pageSize)
  }, [filteredInstallments, sortField, sortDirection, page, pageSize])


  // Dialog State
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [dialogCreditId, setDialogCreditId] = useState<string | null>(null)
  const [dialogInstallmentId, setDialogInstallmentId] = useState<string | null>(null)
  const [dialogInitialAmount, setDialogInitialAmount] = useState<number>(0)
  const [dialogPaymentScope, setDialogPaymentScope] = useState<'installment' | 'credit'>('installment')

  // Detail Dialog State
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false)
  const [detailCreditId, setDetailCreditId] = useState<string | null>(null)

  // Quick filter counts
  const { overdueCount, dueTodayCount } = useMemo(() => {
    const now = new Date()
    const today = startOfLocalDay(now)

    const overdue = installments.filter(i =>
      isInstallmentLate(i)
    ).length

    const dueToday = installments.filter(i => {
      return (i.status === 'pending' || i.status === 'late') && isSameLocalDate(i.due_date, today)
    }).length

    return { overdueCount: overdue, dueTodayCount: dueToday }
  }, [installments])

  const { pendingCount, paidCount, lateCount } = useMemo(() => {
    const pending = installments.filter(i => i.status === 'pending').length
    const paid = installments.filter(i => i.status === 'paid').length
    const late = installments.filter(i => isInstallmentLate(i)).length
    return { pendingCount: pending, paidCount: paid, lateCount: late }
  }, [installments])
  const selectedDialogInstallment = useMemo(() => {
    if (!dialogInstallmentId) return null
    return installments.find(i => i.id === dialogInstallmentId) || null
  }, [dialogInstallmentId, installments])

  const selectedDialogCreditId = selectedDialogInstallment?.credit_id || dialogCreditId
  const recentPayments = useMemo(() => payments.slice(0, 50), [payments])
  const selectedDialogDisplay = useMemo(() => {
    if (!selectedDialogCreditId) return null
    return getCreditDisplayInfo(creditById[selectedDialogCreditId], installments, sales, saleItems)
  }, [selectedDialogCreditId, creditById, installments, sales, saleItems])

  const getInstallmentOutstanding = (installment: InstallmentRow): number => {
    const installmentAmount = Number(installment.amount || 0)
    const paidAmount = Math.max(0, Number(installment.amount_paid || 0))
    return Math.max(0, installmentAmount - paidAmount)
  }

  const getCreditOutstanding = (creditId: string): number => {
    return installments
      .filter((installment) => installment.credit_id === creditId)
      .reduce((sum, installment) => sum + getInstallmentOutstanding(installment), 0)
  }

  // Totales globales (no dependen del filtro) para el encabezado siempre visible.
  const portfolioTotals = useMemo(() => {
    let outstanding = 0
    let overdue = 0
    for (const installment of installments) {
      const amount = Number(installment.amount || 0)
      const paid = Math.max(0, Number(installment.amount_paid || 0))
      const open = Math.max(0, amount - paid)
      if (open <= 0) continue
      outstanding += open
      if (isInstallmentLate(installment)) overdue += open
    }
    return { outstanding, overdue }
  }, [installments])

  const collectionSummary = useMemo(() => {
    const now = new Date()
    const today = startOfLocalDay(now)

    let visibleOutstanding = 0
    let visibleOverdue = 0
    let visibleDueToday = 0
    let partialOpenCount = 0
    const visibleCustomers = new Set<string>()

    for (const installment of filteredInstallments) {
      const amount = Number(installment.amount || 0)
      const paidAmount = Math.max(0, Number(installment.amount_paid || 0))
      const outstanding = Math.max(0, amount - paidAmount)

      visibleCustomers.add(creditById[installment.credit_id]?.customer_name || installment.credit_id)
      visibleOutstanding += outstanding

      if (paidAmount > 0 && outstanding > 0) {
        partialOpenCount += 1
      }

      if (isInstallmentLate(installment)) {
        visibleOverdue += outstanding
      }

      if (
        outstanding > 0 &&
        isSameLocalDate(installment.due_date, today) &&
        (installment.status === 'pending' || installment.status === 'late')
      ) {
        visibleDueToday += outstanding
      }
    }

    return {
      visibleCustomers: visibleCustomers.size,
      visibleOutstanding,
      visibleOverdue,
      visibleDueToday,
      partialOpenCount,
    }
  }, [filteredInstallments, creditById])

  const openPaymentDialogForInstallment = (installment: InstallmentRow, scope: 'installment' | 'credit' = 'installment') => {
    const outstanding = getInstallmentOutstanding(installment)
    setDialogCreditId(installment.credit_id)
    setDialogInstallmentId(installment.id)
    setDialogPaymentScope(scope)
    setDialogInitialAmount(outstanding > 0 ? outstanding : Number(installment.amount))
    setIsDialogOpen(true)
  }

  // Handlers
  const handleOpenPaymentDialog = (creditId: string) => {
    const next = getNextPendingInstallment(creditId)
    if (!next) return
    openPaymentDialogForInstallment(next, 'credit')
  }

  const handleConfirmPayment = async (
    method: PaymentMethod,
    amount: number,
    reference?: string,
    notes?: string
  ): Promise<PaymentConfirmResult> => {
    if (!dialogInstallmentId || !selectedDialogCreditId) {
      return { success: false, error: 'No hay cuota seleccionada para cobrar.' }
    }

    const fullNotes = [
      reference ? `Ref: ${reference}` : null,
      notes
    ].filter(Boolean).join(' - ')

    if (dialogPaymentScope === 'credit') {
      const openInstallments = installments
        .filter((installment) => installment.credit_id === selectedDialogCreditId && getInstallmentOutstanding(installment) > 0)
        .sort((a, b) => (
          startOfLocalDay(a.due_date).getTime() - startOfLocalDay(b.due_date).getTime() ||
          a.installment_number - b.installment_number
        ))

      let remainingAmount = amount
      let appliedAmount = 0

      for (const installment of openInstallments) {
        if (remainingAmount <= 0) break

        const installmentOutstanding = getInstallmentOutstanding(installment)
        const amountForInstallment = Math.min(installmentOutstanding, remainingAmount)
        const result = await markInstallmentPaid(installment.id, method, amountForInstallment, fullNotes)

        if (result.success === false) {
          return { success: false, error: result.error }
        }

        appliedAmount += result.appliedAmount ?? amountForInstallment
        remainingAmount -= result.appliedAmount ?? amountForInstallment
      }

      if (appliedAmount <= 0) {
        return { success: false, error: 'No hay saldo abierto para cobrar en este credito.' }
      }

      return { success: true, appliedAmount }
    }

    const result = await markInstallmentPaid(dialogInstallmentId, method, amount, fullNotes)
    if (result.success === false) {
      return { success: false, error: result.error }
    }

    return { success: true, appliedAmount: result.appliedAmount }
  }

  const handlePaymentDialogOpenChange = (open: boolean) => {
    setIsDialogOpen(open)
    if (!open) {
      setDialogCreditId(null)
      setDialogInstallmentId(null)
      setDialogInitialAmount(0)
      setDialogPaymentScope('installment')
    }
  }

  // Abre el diálogo de pago para la cuota seleccionada en tabla
  const handleMarkInstallmentPaidDirectly = (installmentId: string) => {
    const inst = installments.find(i => i.id === installmentId)
    if (!inst) return
    openPaymentDialogForInstallment(inst)
  }

  // Pago directo desde el bloque de próximas cuotas (con método/monto elegidos inline)
  const handleQuickPayInstallment = async (installmentId: string, method: string, amount: number) => {
    const result = await markInstallmentPaid(installmentId, method, amount)
    if (result.success === false) {
      console.error('No se pudo registrar el pago:', result.error)
      return { success: false, error: result.error }
    }
    return { success: true }
  }

  const handleViewDetail = (creditId: string) => {
    setDetailCreditId(creditId)
    setIsDetailDialogOpen(true)
  }

  const csvEscape = (value: string | number) => {
    const text = String(value ?? '').replace(/\r?\n/g, ' ').trim()
    const escaped = text.replace(/"/g, '""')
    return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped
  }

  const exportInstallmentsCsv = () => {
    type CsvRow = { Cuota: number; Vence: string; Monto: number; Estado: string; Credito: string; Cliente: string }
    const rows: CsvRow[] = filteredInstallments.map(i => ({
      Cuota: i.installment_number,
      Vence: formatDateOnlyDisplay(i.due_date),
      Monto: i.amount,
      // Use the shared helper — consistent with all other places in the module
      Estado: isInstallmentLate(i) ? 'late' : i.status,
      Credito: String(i.credit_id),
      Cliente: creditById[i.credit_id]?.customer_name || ''
    }))
    const header: Array<keyof CsvRow> = ['Cuota', 'Vence', 'Monto', 'Estado', 'Credito', 'Cliente']
    const csv = [header.join(','), ...rows.map(r => header.map(h => csvEscape(r[h])).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'cuotas.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportPaymentsCsv = () => {
    type PaymentCsvRow = { Cliente: string; Credito: string; Cuota: number | ''; Fecha: string; Monto: number }
    const rows: PaymentCsvRow[] = payments.map(p => {
      const inst = installments.find(i => i.id === p.installment_id)
      return {
        Cliente: creditById[p.credit_id]?.customer_name || '',
        Credito: String(p.credit_id),
        Cuota: inst ? inst.installment_number : '',
        Fecha: p.created_at ? new Date(p.created_at).toLocaleDateString() : '',
        Monto: p.amount
      }
    })
    const header: Array<keyof PaymentCsvRow> = ['Cliente', 'Credito', 'Cuota', 'Fecha', 'Monto']
    const csv = [header.join(','), ...rows.map(r => header.map(h => csvEscape(r[h])).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'pagos.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleFilterOverdue = () => {
    setFilterValues({ ...filterValues, status: 'late', fromDate: '', toDate: '' })
    setPage(1)
    setActiveTab('cuotas')
  }

  const handleFilterDueToday = () => {
    const today = formatDateInputLocal()
    setFilterValues({
      ...filterValues,
      status: '',
      fromDate: today,
      toDate: today
    })
    setPage(1)
    setActiveTab('cuotas')
  }
  const handleFilterAll = () => {
    setFilterValues({ ...filterValues, status: '', fromDate: '', toDate: '' })
    setPage(1)
    setActiveTab('cuotas')
  }
  const handleFilterPending = () => {
    setFilterValues({ ...filterValues, status: 'pending', fromDate: '', toDate: '' })
    setPage(1)
    setActiveTab('cuotas')
  }
  const handleFilterPaid = () => {
    setFilterValues({ ...filterValues, status: 'paid', fromDate: '', toDate: '' })
    setPage(1)
    setActiveTab('cuotas')
  }

  return (
    <RouteGuard route="/dashboard/credits" redirectTo="/dashboard">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
            <CreditCard className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Créditos y Cuotas</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Gestión completa de créditos y pagos de clientes
            </p>
          </div>
        </div>

        {/* Headline KPIs + acciones (siempre visibles) */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-xl border border-border bg-card px-4 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Total por cobrar</p>
            <p className="text-xl font-bold tabular-nums text-foreground">{formatCurrency(portfolioTotals.outstanding)}</p>
          </div>
          <button
            type="button"
            onClick={handleFilterOverdue}
            className="rounded-xl border border-red-200 bg-red-50/70 px-4 py-2 text-left transition-colors hover:bg-red-100/70 dark:border-red-900/50 dark:bg-red-950/20 dark:hover:bg-red-950/40"
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-red-700 dark:text-red-300">Vencido</p>
            <p className="text-xl font-bold tabular-nums text-red-700 dark:text-red-300">{formatCurrency(portfolioTotals.overdue)}</p>
          </button>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-9" onClick={refreshData} disabled={loading || isPending}>
              <RefreshCw className={`h-4 w-4 mr-1.5 ${loading || isPending ? 'animate-spin' : ''}`} />
              Actualizar
            </Button>
            <Button variant="outline" size="sm" className="h-9" onClick={exportInstallmentsCsv}>
              <Download className="h-4 w-4 mr-1.5" />
              Exportar
            </Button>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive flex items-center gap-2">
          <span className="font-medium">Error al cargar los datos:</span> {error}
          <button
            className="ml-auto underline underline-offset-2 hover:no-underline text-xs"
            onClick={refreshData}
          >
            Reintentar
          </button>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 lg:w-auto lg:inline-grid gap-1.5 h-auto">
          <TabsTrigger value="overview" className="gap-2">
            <LayoutDashboard className="h-4 w-4" />
            Resumen
          </TabsTrigger>
          <TabsTrigger value="credits" className="gap-2">
            <Users className="h-4 w-4" />
            Clientes
          </TabsTrigger>
          <TabsTrigger value="cuotas" className="gap-2">
            <CalendarClock className="h-4 w-4" />
            Cobranza
            {(overdueCount + dueTodayCount) > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 min-w-5 p-0 px-1 text-xs">
                {overdueCount + dueTodayCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="pagos" className="gap-2">
            <Receipt className="h-4 w-4" />
            Historial
          </TabsTrigger>
        </TabsList>

        {/* Tab Content: Resumen */}
        <TabsContent value="overview" className="space-y-6">
          <CreditOverview
            credits={credits}
            installments={installments}
            creditById={creditById}
            remainingByCredit={remainingByCredit}
            onRegisterPayment={handleOpenPaymentDialog}
          />

          {/* Upcoming Installments */}
          <UpcomingInstallments
            installments={installments.filter(i => isInstallmentLate(i) || i.status === 'pending').slice(0, 15)}
            creditById={creditById}
            sales={sales}
            saleItems={saleItems}
            onMarkPaid={handleQuickPayInstallment}
          />
        </TabsContent>

        {/* Tab Content: Créditos Activos */}
        <TabsContent value="credits" className="space-y-6">
          <CreditList
            credits={credits.filter(c => c.status === 'active')}
            installments={installments}
            sales={sales}
            saleItems={saleItems}
            remainingByCredit={remainingByCredit}
            paidByCredit={paidByCredit}
            onRegisterPayment={handleOpenPaymentDialog}
            onViewDetail={handleViewDetail}
            viewMode={creditViewMode}
            onChangeViewMode={setCreditViewMode}
          />
        </TabsContent>

        {/* Tab Content: Cuotas */}
        <TabsContent value="cuotas" className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-slate-200/80 bg-white px-4 py-3 shadow-sm dark:border-white/10 dark:bg-white/[0.02]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Saldo visible
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
                {formatCurrency(collectionSummary.visibleOutstanding)}
              </p>
              <p className="text-xs text-muted-foreground">
                {filteredInstallments.length} cuota{filteredInstallments.length !== 1 ? 's' : ''} en {collectionSummary.visibleCustomers} cliente{collectionSummary.visibleCustomers !== 1 ? 's' : ''}
              </p>
            </div>

            <div className="rounded-xl border border-red-200/80 bg-red-50/70 px-4 py-3 shadow-sm dark:border-red-900/50 dark:bg-red-950/20">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-red-700 dark:text-red-300">
                Saldo vencido visible
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-red-700 dark:text-red-300">
                {formatCurrency(collectionSummary.visibleOverdue)}
              </p>
              <p className="text-xs text-red-700/80 dark:text-red-300/80">
                Prioridad alta de recuperacion
              </p>
            </div>

            <div className="rounded-xl border border-amber-200/80 bg-amber-50/70 px-4 py-3 shadow-sm dark:border-amber-900/50 dark:bg-amber-950/20">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-300">
                Vence hoy
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-amber-700 dark:text-amber-300">
                {formatCurrency(collectionSummary.visibleDueToday)}
              </p>
              <p className="text-xs text-amber-700/80 dark:text-amber-300/80">
                Cobranza inmediata del filtro actual
              </p>
            </div>

            <div className="rounded-xl border border-blue-200/80 bg-blue-50/70 px-4 py-3 shadow-sm dark:border-blue-900/50 dark:bg-blue-950/20">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-700 dark:text-blue-300">
                Pagos parciales abiertos
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-blue-700 dark:text-blue-300">
                {collectionSummary.partialOpenCount}
              </p>
              <p className="text-xs text-blue-700/80 dark:text-blue-300/80">
                Cuotas con saldo aun no cerrado
              </p>
            </div>
          </div>

          {/* Unified filter toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Quick status chips */}
            {(
              [
                { label: 'Todas',      value: '',        count: null,          variant: 'neutral' },
                { label: 'Pendientes', value: 'pending', count: pendingCount,  variant: 'amber' },
                { label: 'Atrasadas',  value: 'late',    count: lateCount,     variant: 'red' },
                { label: 'Hoy',        value: '__today', count: dueTodayCount, variant: 'orange' },
                { label: 'Pagadas',    value: 'paid',    count: paidCount,     variant: 'green' },
              ] as const
            ).map(chip => {
              const isToday = chip.value === '__today'
              const isTodayActive = isToday && filterValues.fromDate !== '' && filterValues.status === ''
              const isActive = isToday ? isTodayActive : filterValues.status === chip.value && !isTodayActive

              const colorMap = {
                neutral: isActive ? 'bg-foreground text-background border-foreground' : 'border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground',
                amber:   isActive ? 'bg-amber-500 text-white border-amber-500'   : 'border-amber-200 text-amber-700 dark:border-amber-800 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20',
                red:     isActive ? 'bg-red-500 text-white border-red-500'       : 'border-red-200 text-red-700 dark:border-red-800 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20',
                orange:  isActive ? 'bg-orange-500 text-white border-orange-500' : 'border-orange-200 text-orange-700 dark:border-orange-800 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20',
                green:   isActive ? 'bg-green-500 text-white border-green-500'   : 'border-green-200 text-green-700 dark:border-green-800 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20',
              }

              const handler = isToday ? handleFilterDueToday
                : chip.value === '' ? handleFilterAll
                : chip.value === 'pending' ? handleFilterPending
                : chip.value === 'late' ? handleFilterOverdue
                : handleFilterPaid

              return (
                <button
                  key={chip.value}
                  type="button"
                  onClick={handler}
                  className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full border text-xs font-medium transition-all duration-150 ${colorMap[chip.variant]}`}
                >
                  {chip.label}
                  {chip.count !== null && chip.count > 0 && (
                    <span className={`inline-flex items-center justify-center h-4 min-w-[1rem] px-1 rounded-full text-[10px] font-bold ${isActive ? 'bg-white/30 text-inherit' : 'bg-current/10'}`}>
                      {chip.count}
                    </span>
                  )}
                </button>
              )
            })}

            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs text-muted-foreground tabular-nums">
                {filteredInstallments.length} cuota{filteredInstallments.length !== 1 ? 's' : ''}
              </span>
              <Button variant="outline" size="sm" className="h-8" onClick={exportInstallmentsCsv}>
                Exportar CSV
              </Button>
            </div>
          </div>

          {/* Advanced filters (collapsible) */}
          <FilterPanel
            filters={[
              {
                key: 'status', label: 'Estado', type: 'select', options: [
                  { label: 'Todos', value: '' },
                  { label: 'Pendiente', value: 'pending' },
                  { label: 'Pagada', value: 'paid' },
                  { label: 'Atrasada', value: 'late' }
                ]
              },
              { key: 'customerName', label: 'Cliente', type: 'text', placeholder: 'Nombre del cliente' },
              { key: 'creditId', label: 'Crédito', type: 'text', placeholder: 'ID de crédito' },
              { key: 'minAmount', label: 'Monto mínimo', type: 'number', placeholder: '0' },
              { key: 'fromDate', label: 'Desde', type: 'date' },
              { key: 'toDate', label: 'Hasta', type: 'date' }
            ]}
            values={filterValues}
            onChange={(v) => { setPage(1); setFilterValues(v as typeof filterValues) }}
            onClear={() => {
              setPage(1)
              setFilterValues({ status: '', fromDate: '', toDate: '', creditId: '', minAmount: '', customerName: '' })
            }}
            collapsible={true}
            className="border-0"
          />

          {/* Installments list */}
          {(loading || isPending) ? (
            <div className="space-y-2 animate-pulse rounded-xl border border-border/50 overflow-hidden">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-5 py-4 bg-muted/20 border-b border-border/30 last:border-0">
                  <div className="h-8 w-8 rounded-full bg-muted shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-36 bg-muted rounded" />
                    <div className="h-2 w-24 bg-muted rounded" />
                  </div>
                  <div className="h-3 w-20 bg-muted rounded" />
                  <div className="h-3 w-16 bg-muted rounded" />
                  <div className="h-5 w-20 bg-muted rounded-full" />
                  <div className="h-7 w-7 bg-muted rounded" />
                </div>
              ))}
            </div>
          ) : sortedAndPagedInstallments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 rounded-xl border border-dashed border-border text-center">
              <div className="p-4 rounded-full bg-muted/50 mb-3">
                <CalendarClock className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">Sin cuotas</p>
              <p className="text-xs text-muted-foreground/70 mt-1">No hay cuotas que coincidan con los filtros aplicados</p>
            </div>
          ) : (
            <div className="rounded-xl border border-border/50 overflow-hidden">
              {/* Table header */}
              <div className="hidden md:grid grid-cols-[1.15fr_1.05fr_auto_auto_auto_120px_auto] items-center gap-4 px-5 py-2.5 bg-muted/40 border-b border-border/50 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                <span>Cliente</span>
                <span>Crédito / Origen</span>
                <span className="text-center w-16">Cuota</span>
                <span className="w-28">Vence</span>
                <span className="text-right w-24">Monto</span>
                <span>Progreso</span>
                <span className="text-center w-24">Acción</span>
              </div>

              {/* Rows */}
              {sortedAndPagedInstallments.map((row, idx) => {
                const effStatus = installmentsProgress[row.id]?.status_effective || (isInstallmentLate(row) ? 'late' : row.status)
                const paid = Number(row.amount_paid || 0)
                const amt = Number(row.amount || 0)
                const prog = installmentsProgress[row.id]?.progreso ?? (amt > 0 ? Math.min(100, Math.round((paid / amt) * 100)) : 0)
                const credit = creditById[row.credit_id]
                const customerName = credit?.customer_name || 'Cliente'
                const initials = customerName.split(' ').filter(Boolean).map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
                const display = getInstallmentDisplayInfo(row, credit, installments, sales, saleItems)

                // Due date helpers
                const dueDate = startOfLocalDay(row.due_date)
                const today = startOfLocalDay(new Date())
                const isToday = dueDate.getTime() === today.getTime()
                const daysOverdue = effStatus === 'late' ? Math.floor((today.getTime() - dueDate.getTime()) / 86400000) : 0

                // Row urgency styling
                const rowBg = effStatus === 'late'
                  ? 'bg-red-50/60 dark:bg-red-900/10 hover:bg-red-50 dark:hover:bg-red-900/20'
                  : isToday
                  ? 'bg-amber-50/60 dark:bg-amber-900/10 hover:bg-amber-50 dark:hover:bg-amber-900/20'
                  : idx % 2 === 0
                  ? 'bg-white dark:bg-white/[0.02] hover:bg-muted/30 dark:hover:bg-white/[0.04]'
                  : 'bg-slate-50/50 dark:bg-white/[0.01] hover:bg-muted/30 dark:hover:bg-white/[0.04]'

                // Status badge
                const statusStyle = {
                  late:    'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800',
                  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800',
                  paid:    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800',
                }[effStatus] ?? 'bg-muted text-muted-foreground border border-border'

                const statusLabel = { late: 'Atrasada', pending: isToday ? 'Vence hoy' : 'Pendiente', paid: 'Pagada' }[effStatus] ?? effStatus

                // Progress bar color
                const barColor = effStatus === 'late' ? 'bg-red-500' : effStatus === 'paid' ? 'bg-green-500' : 'bg-blue-500'

                return (
                    <div
                      key={row.id}
                      className={`group flex flex-col md:grid md:grid-cols-[1.15fr_1.05fr_auto_auto_auto_120px_auto] items-start md:items-center gap-3 md:gap-4 px-4 md:px-5 py-4 border-b border-border/30 last:border-0 transition-colors duration-100 ${rowBg}`}
                    >
                    {/* Customer */}
                    <div className="flex items-center gap-2.5 min-w-0 w-full md:w-auto">
                      <div className="flex-shrink-0 h-8 w-8 rounded-full bg-gradient-to-br from-slate-500 to-slate-700 flex items-center justify-center text-white text-[10px] font-bold select-none">
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate leading-tight">{customerName}</p>
                        {daysOverdue > 0 && (
                          <p className="text-[11px] text-red-600 dark:text-red-400 font-medium">{daysOverdue} día{daysOverdue > 1 ? 's' : ''} de atraso</p>
                        )}
                        {isToday && effStatus !== 'paid' && (
                          <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">Vence hoy</p>
                        )}
                      </div>
                    </div>

                    {/* Credit context */}
                    <div className="min-w-0 w-full md:w-auto">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-xs text-muted-foreground">{display.creditCode}</span>
                        <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300">
                          {display.originLabel}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-[11px] text-muted-foreground">
                        {display.saleCode ? `Ticket ${display.saleCode} · ` : ''}{display.productSummary}
                      </p>
                    </div>

                    {/* Cuota # */}
                    <div className="flex md:flex-col items-center gap-2 md:gap-0 w-16">
                      <span className="text-[10px] text-muted-foreground md:hidden">Cuota</span>
                      <span className="text-sm font-mono font-semibold text-center">#{row.installment_number}</span>
                    </div>

                    {/* Due date */}
                    <div className="hidden md:block w-28">
                      <p className="text-sm tabular-nums text-foreground">
                        {formatDateOnlyDisplay(row.due_date)}
                      </p>
                    </div>

                    {/* Amount */}
                    <div className="hidden md:block text-right w-24">
                      <p className="text-sm font-semibold tabular-nums">{formatCurrency(row.amount)}</p>
                      {paid > 0 && paid < amt && (
                        <p className="text-[11px] text-muted-foreground tabular-nums">{formatCurrency(paid)} pag.</p>
                      )}
                    </div>

                    {/* Progress bar */}
                    <div className="hidden md:block w-[120px] space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-muted-foreground">{prog}%</span>
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${statusStyle}`}>{statusLabel}</span>
                      </div>
                      <div className="h-1.5 w-full bg-muted/60 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${barColor} rounded-full transition-all duration-500`}
                          style={{ width: `${prog}%` }}
                        />
                      </div>
                    </div>

                    {/* Mobile: date + amount + status in one row */}
                    <div className="flex md:hidden items-center justify-between w-full gap-2 text-xs text-muted-foreground">
                      <span>{formatDateOnlyDisplay(row.due_date, 'es-AR', { day: '2-digit', month: 'short' })}</span>
                      <span className="font-semibold text-foreground tabular-nums">{formatCurrency(row.amount)}</span>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${statusStyle}`}>{statusLabel}</span>
                    </div>

                    {/* Action */}
                    <div className="flex md:justify-center w-full md:w-24">
                      {effStatus !== 'paid' ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 px-3 text-xs border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-900/20 w-full md:w-auto"
                          onClick={() => handleMarkInstallmentPaidDirectly(row.id)}
                        >
                          Cobrar
                        </Button>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400 font-medium">
                          <CheckCircle className="h-3.5 w-3.5" />
                          Pagada
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Pagination */}
          {filteredInstallments.length > pageSize && (
            <div className="flex items-center justify-between gap-2 pt-1">
              <p className="text-xs text-muted-foreground tabular-nums">
                Mostrando {Math.min((page - 1) * pageSize + 1, filteredInstallments.length)}–{Math.min(page * pageSize, filteredInstallments.length)} de {filteredInstallments.length}
              </p>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" className="h-8 px-3" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Anterior</Button>
                <span className="text-sm tabular-nums px-2 text-muted-foreground">
                  {page} / {Math.ceil(filteredInstallments.length / pageSize)}
                </span>
                <Button variant="outline" size="sm" className="h-8 px-3" disabled={filteredInstallments.length <= page * pageSize} onClick={() => setPage(p => p + 1)}>Siguiente →</Button>
              </div>
            </div>
          )}
        </TabsContent>


        {/* Tab Content: Pagos */}
        <TabsContent value="pagos" className="space-y-4">

          {/* Summary bar */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="rounded-xl border border-green-200 dark:border-green-800 bg-green-50/60 dark:bg-green-900/20 px-4 py-3 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/40">
                <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Cobrado (ultimos 50)</p>
                <p className="text-base font-bold text-green-700 dark:text-green-300">
                  {formatCurrency(recentPayments.reduce((acc, p) => acc + Number(p.amount || 0), 0))}
                </p>
              </div>
            </div>
            <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/60 dark:bg-blue-900/20 px-4 py-3 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/40">
                <Receipt className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Pagos visibles</p>
                <p className="text-base font-bold text-blue-700 dark:text-blue-300">{recentPayments.length}</p>
              </div>
            </div>
            <div className="rounded-xl border border-purple-200 dark:border-purple-800 bg-purple-50/60 dark:bg-purple-900/20 px-4 py-3 flex items-center gap-3 col-span-2 sm:col-span-1">
              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/40">
                <CreditCard className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Creditos visibles</p>
                <p className="text-base font-bold text-purple-700 dark:text-purple-300">
                  {new Set(recentPayments.map(p => p.credit_id)).size}
                </p>
              </div>
            </div>
          </div>

          {/* Timeline con búsqueda, skeleton y agrupado por fecha */}
          <PaymentsTimeline
            recentPayments={recentPayments}
            payments={payments}
            creditById={creditById}
            installments={installments}
          sales={sales}
          saleItems={saleItems}
            loading={loading}
            isPending={isPending}
            onExportCSV={exportPaymentsCsv}
          />
        </TabsContent>


      </Tabs>

      {/* Payment Dialog */}
      <CreditPaymentDialog
        open={isDialogOpen}
        onOpenChange={handlePaymentDialogOpenChange}
        onConfirm={handleConfirmPayment}
        initialAmount={dialogInitialAmount}
        maxPaymentAmount={
          dialogPaymentScope === 'credit' && selectedDialogCreditId
            ? getCreditOutstanding(selectedDialogCreditId)
            : selectedDialogInstallment
              ? getInstallmentOutstanding(selectedDialogInstallment)
              : undefined
        }
        allowFullDebtPayment={dialogPaymentScope === 'credit'}
        totalDebtAmount={selectedDialogCreditId ? getCreditOutstanding(selectedDialogCreditId) : undefined}
        creditInfo={selectedDialogCreditId ? {
          id: selectedDialogCreditId,
          customerName: creditById[selectedDialogCreditId]?.customer_name || 'Cliente',
          customerId: creditById[selectedDialogCreditId]?.customer_id || '',
          customerCode: creditById[selectedDialogCreditId]?.customer_code,
          principal: creditById[selectedDialogCreditId]?.principal || 0,
          interestRate: creditById[selectedDialogCreditId]?.interest_rate || 0,
          termMonths: creditById[selectedDialogCreditId]?.term_months || 0,
          remainingBalance: remainingByCredit[selectedDialogCreditId] || 0,
          nextInstallmentNumber: selectedDialogInstallment?.installment_number,
          nextDueDate: selectedDialogInstallment?.due_date,
          creditCode: selectedDialogDisplay?.creditCode,
          creditTypeLabel: selectedDialogDisplay?.creditTypeLabel,
          originLabel: selectedDialogDisplay?.originLabel,
          creditLabel: selectedDialogDisplay?.creditLabel,
          saleCode: selectedDialogDisplay?.saleCode,
          productSummary: selectedDialogDisplay?.productSummary,
        } : undefined}
      />

      {/* Credit Detail Dialog */}
      <CreditDetailDialog
        open={isDetailDialogOpen}
        onOpenChange={setIsDetailDialogOpen}
        credit={detailCreditId ? {
          ...creditById[detailCreditId],
          customer_name: creditById[detailCreditId]?.customer_name || 'Desconocido'
        } : null}
        installments={detailCreditId ? installments.filter(i => i.credit_id === detailCreditId) : []}
        payments={detailCreditId ? payments.filter(p => p.credit_id === detailCreditId).map(p => ({
          ...p,
          payment_method: p.payment_method || undefined
        })) : []}
        remainingBalance={detailCreditId ? remainingByCredit[detailCreditId] || 0 : 0}
        paidAmount={detailCreditId ? paidByCredit[detailCreditId] || 0 : 0}
        sales={sales}
        saleItems={saleItems}
        onPayInstallment={(installmentId) => {
          setIsDetailDialogOpen(false)
          handleMarkInstallmentPaidDirectly(installmentId)
        }}
      />

      </div>
    </RouteGuard>
  )
}
