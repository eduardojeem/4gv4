'use client'

import { useState, useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FilterPanel } from '@/components/shared'
import { CreditCard, CalendarClock, CheckCircle, LayoutDashboard, Receipt, Search } from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import { useCredits, InstallmentRow, isInstallmentLate } from '@/hooks/use-credits'
import { CreditOverview } from '@/components/dashboard/credits/CreditOverview'
import { CreditList } from '@/components/dashboard/credits/CreditList'
import { UpcomingInstallments } from '@/components/dashboard/credits/UpcomingInstallments'
import { CreditPaymentDialog, PaymentMethod, PaymentConfirmResult } from '@/components/dashboard/credits/CreditPaymentDialog'
import { CreditQuickActions } from '@/components/dashboard/credits/CreditQuickActions'
import { CreditDetailDialog } from '@/components/dashboard/credits/CreditDetailDialog'
import { RouteGuard } from '@/components/auth/permission-guard'

export default function CreditsDashboardPage() {
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
    filteredInstallments
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

  // Detail Dialog State
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false)
  const [detailCreditId, setDetailCreditId] = useState<string | null>(null)

  // Quick filter counts
  const { overdueCount, dueTodayCount } = useMemo(() => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    const overdue = installments.filter(i =>
      isInstallmentLate(i)
    ).length

    const dueToday = installments.filter(i => {
      const dueDate = new Date(i.due_date)
      dueDate.setHours(0, 0, 0, 0)
      return (i.status === 'pending' || i.status === 'late') && dueDate.getTime() === today.getTime()
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

  const getInstallmentOutstanding = (installment: InstallmentRow): number => {
    const installmentAmount = Number(installment.amount || 0)
    const paidAmount = Math.max(0, Number(installment.amount_paid || 0))
    return Math.max(0, installmentAmount - paidAmount)
  }

  const collectionSummary = useMemo(() => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

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

      const dueDate = new Date(installment.due_date)
      dueDate.setHours(0, 0, 0, 0)

      if (
        outstanding > 0 &&
        dueDate.getTime() === today.getTime() &&
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

  const openPaymentDialogForInstallment = (installment: InstallmentRow) => {
    const outstanding = getInstallmentOutstanding(installment)
    setDialogCreditId(installment.credit_id)
    setDialogInstallmentId(installment.id)
    setDialogInitialAmount(outstanding > 0 ? outstanding : Number(installment.amount))
    setIsDialogOpen(true)
  }

  // Handlers
  const handleOpenPaymentDialog = (creditId: string) => {
    const next = getNextPendingInstallment(creditId)
    if (!next) return
    openPaymentDialogForInstallment(next)
  }

  const handleConfirmPayment = async (
    method: PaymentMethod,
    amount: number,
    reference?: string,
    notes?: string
  ): Promise<PaymentConfirmResult> => {
    if (!dialogInstallmentId) {
      return { success: false, error: 'No hay cuota seleccionada para cobrar.' }
    }

    const fullNotes = [
      reference ? `Ref: ${reference}` : null,
      notes
    ].filter(Boolean).join(' - ')

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
    }
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
      Vence: new Date(i.due_date).toLocaleDateString(),
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
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    setFilterValues({
      ...filterValues,
      status: '',
      fromDate: today.toISOString().split('T')[0],
      toDate: today.toISOString().split('T')[0]
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
      <div>
        <div className="flex items-center justify-between mb-2">
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

      {/* Quick Actions */}
      <CreditQuickActions
        onRefresh={refreshData}
        onExportCSV={exportInstallmentsCsv}
        onFilterOverdue={handleFilterOverdue}
        onFilterDueToday={handleFilterDueToday}
        loading={loading || isPending}
        overdueCount={overdueCount}
        dueTodayCount={dueTodayCount}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
          <TabsTrigger value="overview" className="gap-2">
            <LayoutDashboard className="h-4 w-4" />
            Resumen
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
          {/* Active Credits List — view toggle embedded in component header */}
          <CreditOverview
            credits={credits}
            installments={installments}
            creditById={creditById}
            remainingByCredit={remainingByCredit}
          />

          <CreditList
            credits={credits.filter(c => c.status === 'active')}
            remainingByCredit={remainingByCredit}
            paidByCredit={paidByCredit}
            onRegisterPayment={handleOpenPaymentDialog}
            onViewDetail={handleViewDetail}
            viewMode={creditViewMode}
            onChangeViewMode={setCreditViewMode}
          />

          {/* Upcoming Installments */}
          <UpcomingInstallments
            installments={installments.filter(i => isInstallmentLate(i) || i.status === 'pending').slice(0, 15)}
            creditById={creditById}
            onMarkPaid={handleQuickPayInstallment}
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
              <div className="hidden md:grid grid-cols-[1fr_auto_auto_auto_120px_auto] items-center gap-4 px-5 py-2.5 bg-muted/40 border-b border-border/50 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                <span>Cliente</span>
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
                const customerName = creditById[row.credit_id]?.customer_name || 'Cliente'
                const initials = customerName.split(' ').filter(Boolean).map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()

                // Due date helpers
                const dueDate = new Date(row.due_date)
                const today = new Date(); today.setHours(0,0,0,0)
                dueDate.setHours(0,0,0,0)
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
                    className={`group flex flex-col md:grid md:grid-cols-[1fr_auto_auto_auto_120px_auto] items-start md:items-center gap-3 md:gap-4 px-4 md:px-5 py-4 border-b border-border/30 last:border-0 transition-colors duration-100 ${rowBg}`}
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

                    {/* Cuota # */}
                    <div className="flex md:flex-col items-center gap-2 md:gap-0 w-16">
                      <span className="text-[10px] text-muted-foreground md:hidden">Cuota</span>
                      <span className="text-sm font-mono font-semibold text-center">#{row.installment_number}</span>
                    </div>

                    {/* Due date */}
                    <div className="hidden md:block w-28">
                      <p className="text-sm tabular-nums text-foreground">
                        {new Date(row.due_date).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}
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
                      <span>{new Date(row.due_date).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}</span>
                      <span className="font-semibold text-foreground tabular-nums">{formatCurrency(row.amount)}</span>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${statusStyle}`}>{statusLabel}</span>
                    </div>

                    {/* Action */}
                    <div className="flex md:justify-center w-full md:w-24">
                      {row.status !== 'paid' ? (
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

          {/* Timeline with search, skeleton and date grouping */}
          {(() => {
            const methodConfig: Record<string, { label: string; color: string; dot: string }> = {
              cash:     { label: 'Efectivo',       color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',     dot: 'bg-green-500' },
              card:     { label: 'Tarjeta',         color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',         dot: 'bg-blue-500' },
              transfer: { label: 'Transferencia',   color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400', dot: 'bg-purple-500' },
            }
            const avatarGradients = [
              'from-blue-500 to-blue-700', 'from-violet-500 to-violet-700',
              'from-emerald-500 to-emerald-700', 'from-rose-500 to-rose-700',
              'from-amber-500 to-amber-700', 'from-cyan-500 to-cyan-700',
              'from-indigo-500 to-indigo-700', 'from-fuchsia-500 to-fuchsia-700',
            ]
            const getGradient = (name: string) => {
              let h = 0; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff
              return avatarGradients[Math.abs(h) % avatarGradients.length]
            }
            const getDateLabel = (iso?: string) => {
              if (!iso) return 'Sin fecha'
              const d = new Date(iso); d.setHours(0,0,0,0)
              const today = new Date(); today.setHours(0,0,0,0)
              const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1)
              if (d.getTime() === today.getTime()) return 'Hoy'
              if (d.getTime() === yesterday.getTime()) return 'Ayer'
              return new Date(iso).toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
            }

            // Inner component to allow local useState for search
            function Timeline() {
              const [search, setSearch] = useState('')
              const filtered = search.trim()
                ? recentPayments.filter(p => {
                    const n = (creditById[p.credit_id]?.customer_name || '').toLowerCase()
                    const m = (p.payment_method || '').toLowerCase()
                    const q = search.toLowerCase()
                    return n.includes(q) || m.includes(q)
                  })
                : recentPayments

              const groups = filtered.reduce<Record<string, typeof recentPayments>>((acc, p) => {
                const k = getDateLabel(p.created_at)
                if (!acc[k]) acc[k] = []
                acc[k].push(p)
                return acc
              }, {})

              return (
                <>
                  {/* Toolbar */}
                  <div className="flex items-center gap-3">
                    <div className="relative flex-1 max-w-xs">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                      <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Buscar cliente o método..."
                        className="w-full h-8 pl-8 pr-7 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring/40 transition-all"
                      />
                      {search && (
                        <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground">✕</button>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground ml-auto shrink-0">
                      {filtered.length !== recentPayments.length
                        ? `${filtered.length} de ${recentPayments.length}`
                        : payments.length > 300 ? `Últimos 300 de ${payments.length}` : `${recentPayments.length} pagos`}
                    </p>
                    <Button variant="outline" size="sm" onClick={exportPaymentsCsv} className="h-8 gap-1.5 shrink-0">
                      <CheckCircle className="h-3.5 w-3.5" />
                      Exportar CSV
                    </Button>
                  </div>

                  {/* Skeleton */}
                  {(loading || isPending) && (
                    <div className="space-y-2 animate-pulse">
                      {[...Array(5)].map((_, i) => (
                        <div key={i} className="flex items-center gap-3 rounded-xl px-4 py-3 border border-border/60 bg-muted/20">
                          <div className="h-9 w-9 rounded-full bg-muted" />
                          <div className="flex-1 space-y-2">
                            <div className="h-3 w-28 bg-muted rounded" />
                            <div className="h-2.5 w-16 bg-muted rounded" />
                          </div>
                          <div className="h-4 w-14 bg-muted rounded" />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Timeline */}
                  {!loading && !isPending && (
                    filtered.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-16 text-center rounded-xl border border-dashed border-border">
                        <div className="p-4 rounded-full bg-muted/50 mb-3">
                          <Receipt className="h-8 w-8 text-muted-foreground/50" />
                        </div>
                        <p className="text-sm font-medium text-muted-foreground">
                          {search ? 'Sin resultados' : 'Sin pagos registrados'}
                        </p>
                        <p className="text-xs text-muted-foreground/70 mt-1">
                          {search ? 'Intentá con otro término' : 'Los pagos aparecerán aquí cuando se registren'}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {Object.entries(groups).map(([label, rows]) => {
                          const dayTotal = rows.reduce((s, p) => s + Number(p.amount || 0), 0)
                          return (
                            <div key={label}>
                              {/* Date separator + subtotal */}
                              <div className="flex items-center gap-3 mb-3">
                                <div className="h-px flex-1 bg-border" />
                                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-muted/60 border border-border/40">
                                  <span className="text-xs font-semibold text-foreground capitalize">{label}</span>
                                  <span className="text-[10px] text-muted-foreground">·</span>
                                  <span className="text-xs font-bold text-green-600 dark:text-green-400 tabular-nums">{formatCurrency(dayTotal)}</span>
                                </div>
                                <div className="h-px flex-1 bg-border" />
                              </div>
                              {/* Rows */}
                              <div className="space-y-1.5">
                                {rows.map(p => {
                                  const name = creditById[p.credit_id]?.customer_name || 'Cliente'
                                  const initials = name.split(' ').filter(Boolean).map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
                                  const inst = installments.find(i => i.id === p.installment_id)
                                  const method = methodConfig[p.payment_method || ''] ?? { label: p.payment_method || 'Otro', color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400', dot: 'bg-slate-400' }
                                  return (
                                    <div key={p.id} className="group flex items-center gap-3 rounded-xl px-4 py-3 bg-white dark:bg-white/[0.03] border border-border/50 dark:border-white/[0.05] hover:border-green-300 dark:hover:border-green-800 hover:shadow-sm hover:bg-green-50/20 dark:hover:bg-green-900/10 transition-all duration-150 cursor-default">
                                      <div className={`flex-shrink-0 h-9 w-9 rounded-full bg-gradient-to-br ${getGradient(name)} flex items-center justify-center text-white text-xs font-bold shadow-sm select-none`}>
                                        {initials}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-foreground truncate leading-tight">{name}</p>
                                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                          {inst && <span className="text-[11px] text-muted-foreground font-mono bg-muted/50 rounded px-1.5 py-0.5 leading-none">Cuota #{inst.installment_number}</span>}
                                          <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full leading-none ${method.color}`}>
                                            <span className={`h-1.5 w-1.5 rounded-full ${method.dot} opacity-80`} />
                                            {method.label}
                                          </span>
                                        </div>
                                      </div>
                                      <div className="hidden sm:block text-right shrink-0">
                                        <p className="text-xs text-muted-foreground tabular-nums">
                                          {p.created_at ? new Date(p.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : ''}
                                        </p>
                                      </div>
                                      <div className="text-right shrink-0 min-w-[80px]">
                                        <p className="text-sm font-bold text-green-600 dark:text-green-400 tabular-nums">+{formatCurrency(p.amount)}</p>
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )
                  )}
                </>
              )
            }
            return <Timeline />
          })()}
        </TabsContent>


      </Tabs>

      {/* Payment Dialog */}
      <CreditPaymentDialog
        open={isDialogOpen}
        onOpenChange={handlePaymentDialogOpenChange}
        onConfirm={handleConfirmPayment}
        initialAmount={dialogInitialAmount}
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
          nextDueDate: selectedDialogInstallment?.due_date
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
      />

      </div>
    </RouteGuard>
  )
}


