'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DataTable, FilterPanel } from '@/components/shared'
import { CreditCard, CalendarClock, CheckCircle, LayoutDashboard, Receipt } from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import { useCredits, CreditRow, InstallmentRow } from '@/hooks/use-credits'
import { CreditStats } from '@/components/dashboard/credits/CreditStats'
import { CreditList } from '@/components/dashboard/credits/CreditList'
import { UpcomingInstallments } from '@/components/dashboard/credits/UpcomingInstallments'
import { CreditPaymentDialog, PaymentMethod } from '@/components/dashboard/credits/CreditPaymentDialog'
import { CreditQuickActions } from '@/components/dashboard/credits/CreditQuickActions'
import { CreditDetailDialog } from '@/components/dashboard/credits/CreditDetailDialog'

export default function CreditsDashboardPage() {
  const {
    loading,
    isPending,
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
  const [pageSize, setPageSize] = useState(10)
  const [sortField, setSortField] = useState<keyof InstallmentRow | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [activeTab, setActiveTab] = useState('cuotas')

  // Dialog State
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [dialogCreditId, setDialogCreditId] = useState<string | null>(null)
  const [dialogInitialAmount, setDialogInitialAmount] = useState<number>(0)

  // Detail Dialog State
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false)
  const [detailCreditId, setDetailCreditId] = useState<string | null>(null)

  // Quick filter counts
  const { overdueCount, dueTodayCount } = useMemo(() => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    const overdue = installments.filter(i =>
      (i.status === 'pending' || i.status === 'late') && new Date(i.due_date) < today
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
    const late = installments.filter(i => i.status === 'late' || (i.status === 'pending' && new Date(i.due_date) < new Date())).length
    return { pendingCount: pending, paidCount: paid, lateCount: late }
  }, [installments])

  // Handlers
  const handleOpenPaymentDialog = (creditId: string) => {
    const next = getNextPendingInstallment(creditId)
    if (next) {
      setDialogCreditId(creditId)
      setDialogInitialAmount(Number(next.amount))
      setIsDialogOpen(true)
    }
  }

  const handleConfirmPayment = (method: PaymentMethod, amount: number, reference?: string, notes?: string) => {
    if (!dialogCreditId) return
    const next = getNextPendingInstallment(dialogCreditId)
    if (next) {
      const fullNotes = [
        reference ? `Ref: ${reference}` : null,
        notes
      ].filter(Boolean).join(' - ')
      
      markInstallmentPaid(next.id, method, amount, fullNotes)
    }
  }

  const handleMarkInstallmentPaidDirectly = (installmentId: string, method: string, amount: number) => {
    markInstallmentPaid(installmentId, method, amount)
  }

  const handleViewDetail = (creditId: string) => {
    setDetailCreditId(creditId)
    setIsDetailDialogOpen(true)
  }

  const exportInstallmentsCsv = () => {
    const isLate = (i: InstallmentRow) => i.status === 'pending' && new Date(i.due_date) < new Date()
    type CsvRow = { Cuota: number; Vence: string; Monto: number; Estado: string; Credito: string; Cliente: string }
    const rows: CsvRow[] = filteredInstallments.map(i => ({
      Cuota: i.installment_number,
      Vence: new Date(i.due_date).toLocaleDateString(),
      Monto: i.amount,
      Estado: isLate(i) ? 'late' : i.status,
      Credito: String(i.credit_id),
      Cliente: creditById[i.credit_id]?.customer_name || ''
    }))
    const header: Array<keyof CsvRow> = ['Cuota', 'Vence', 'Monto', 'Estado', 'Credito', 'Cliente']
    const csv = [header.join(','), ...rows.map(r => header.map(h => String(r[h]).replace(/,/g, '')).join(','))].join('\n')
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
    const csv = [header.join(','), ...rows.map(r => header.map(h => String(r[h]).replace(/,/g, '')).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'pagos.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleFilterOverdue = () => {
    setFilterValues({ ...filterValues, status: 'late' })
    setActiveTab('cuotas')
  }

  const handleFilterDueToday = () => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    setFilterValues({
      ...filterValues,
      fromDate: today.toISOString().split('T')[0],
      toDate: today.toISOString().split('T')[0]
    })
    setActiveTab('cuotas')
  }
  const handleFilterAll = () => {
    setFilterValues({ ...filterValues, status: '' })
    setActiveTab('cuotas')
  }
  const handleFilterPending = () => {
    setFilterValues({ ...filterValues, status: 'pending' })
    setActiveTab('cuotas')
  }
  const handleFilterPaid = () => {
    setFilterValues({ ...filterValues, status: 'paid' })
    setActiveTab('cuotas')
  }

  return (
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

      {/* Stats */}
      <CreditStats credits={credits} installments={installments} />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
          <TabsTrigger value="resumen" className="gap-2">
            <LayoutDashboard className="h-4 w-4" />
            Resumen
          </TabsTrigger>
          <TabsTrigger value="cuotas" className="gap-2">
            <CalendarClock className="h-4 w-4" />
            Cuotas
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
        <TabsContent value="resumen" className="space-y-6">
          {/* Active Credits List */}
          <CreditList
            credits={credits}
            remainingByCredit={remainingByCredit}
            paidByCredit={paidByCredit}
            onRegisterPayment={handleOpenPaymentDialog}
            onViewDetail={handleViewDetail}
          />

          {/* Upcoming Installments */}
          <UpcomingInstallments
            installments={installments.filter(i => i.status === 'pending' || i.status === 'late').slice(0, 15)}
            creditById={creditById}
            onMarkPaid={handleMarkInstallmentPaidDirectly}
          />
        </TabsContent>

        {/* Tab Content: Cuotas */}
        <TabsContent value="cuotas" className="space-y-6">
          <Card className="border-0">
            <CardContent className="pt-6">
              <div className="flex flex-wrap items-center gap-2">
                <Button variant={filterValues.status === '' ? 'default' : 'outline'} size="sm" onClick={handleFilterAll}>
                  Todos
                </Button>
                <Button variant={filterValues.status === 'pending' ? 'default' : 'outline'} size="sm" onClick={handleFilterPending}>
                  Pendientes
                  <Badge variant="secondary" className="ml-2">{pendingCount}</Badge>
                </Button>
                <Button variant={filterValues.status === 'late' ? 'default' : 'outline'} size="sm" onClick={handleFilterOverdue}>
                  Atrasadas
                  <Badge variant="destructive" className="ml-2">{lateCount}</Badge>
                </Button>
                <Button variant="outline" size="sm" onClick={handleFilterDueToday}>
                  Hoy
                  <Badge variant="secondary" className="ml-2">{dueTodayCount}</Badge>
                </Button>
                <Button variant={filterValues.status === 'paid' ? 'default' : 'outline'} size="sm" onClick={handleFilterPaid}>
                  Pagadas
                  <Badge variant="secondary" className="ml-2">{paidCount}</Badge>
                </Button>
              </div>
            </CardContent>
          </Card>
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
              { key: 'creditId', label: 'Crédito', type: 'text', placeholder: 'ID de crédito' },
              { key: 'customerName', label: 'Cliente', type: 'text', placeholder: 'Nombre del cliente' },
              { key: 'minAmount', label: 'Monto mínimo', type: 'number', placeholder: '0' },
              { key: 'fromDate', label: 'Desde', type: 'date' },
              { key: 'toDate', label: 'Hasta', type: 'date' }
            ]}
            values={filterValues}
            onChange={(v) => { setPage(1); setFilterValues(v as any) }}
            onClear={() => {
              setPage(1);
              setFilterValues({ status: '', fromDate: '', toDate: '', creditId: '', minAmount: '', customerName: '' })
            }}
            collapsible={true}
            className="border-0"
          />

          {/* Full Installments Table */}
          <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-gray-50/50 dark:from-gray-900 dark:to-gray-800/50">
            <CardHeader className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <CalendarClock className="h-5 w-5 text-orange-600" />
                Todas las Cuotas
                <Badge variant="secondary" className="ml-2">{filteredInstallments.length}</Badge>
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={exportInstallmentsCsv}>Exportar CSV</Button>
              </div>
            </CardHeader>
            <CardContent>
              <DataTable
                data={[...filteredInstallments].sort((a, b) => {
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
                }).slice((page - 1) * pageSize, page * pageSize)}
                columns={[
                  { key: 'customer_name', header: 'Cliente', cell: (row) => creditById[row.credit_id]?.customer_name || '', width: '200px' },
                  { key: 'installment_number', header: 'Cuota', accessor: 'installment_number', sortable: true, width: '100px' },
                  { key: 'due_date', header: 'Vence', cell: (row) => new Date(row.due_date).toLocaleDateString(), sortable: true, width: '160px' },
                  { key: 'amount', header: 'Monto', cell: (row) => formatCurrency(row.amount), align: 'right', sortable: true, width: '140px' },
                  {
                    key: 'progress', header: 'Progreso', cell: (row) => {
                      const prog = installmentsProgress[row.id]?.progreso
                      if (typeof prog === 'number') {
                        return <span className="text-xs">{prog}%</span>
                      }
                      const paid = Number(row.amount_paid || 0)
                      const amt = Number(row.amount || 0)
                      const pct = amt > 0 ? Math.min(100, Math.round((paid / amt) * 100)) : 0
                      return <span className="text-xs">{pct}%</span>
                    }, width: '100px'
                  },
                  {
                    key: 'status', header: 'Estado', cell: (row) => {
                      const eff = installmentsProgress[row.id]?.status_effective
                      if (eff) {
                        return <Badge variant="outline">{eff}</Badge>
                      }
                      const isLate = row.status === 'pending' && new Date(row.due_date) < new Date()
                      return <Badge variant="outline">{isLate ? 'late' : row.status}</Badge>
                    }, sortable: true, width: '140px'
                  },
                  {
                    key: 'actions', header: 'Acción', cell: (row) => {
                      const disabled = row.status === 'paid'
                      return (
                        <Button
                          variant="default"
                          size="sm"
                          disabled={disabled}
                          onClick={() => handleMarkInstallmentPaidDirectly(row.id, 'cash', Number(row.amount))}
                        >
                          Pagar
                        </Button>
                      )
                    }, width: '120px'
                  },
                ]}
                loading={loading || isPending}
                sorting={{
                  field: sortField,
                  direction: sortDirection,
                  onSort: (field) => {
                    if (sortField === field) {
                      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
                    } else {
                      setSortField(field)
                      setSortDirection('asc')
                    }
                  }
                }}
              />
              {/* Pagination */}
              <div className="flex items-center justify-end gap-2 mt-4">
                <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Anterior</Button>
                <span className="text-sm">Página {page}</span>
                <Button variant="outline" size="sm" disabled={filteredInstallments.length <= page * pageSize} onClick={() => setPage(p => p + 1)}>Siguiente</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Content: Pagos */}
        <TabsContent value="pagos" className="space-y-6">
          <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-gray-50/50 dark:from-gray-900 dark:to-gray-800/50">
            <CardHeader className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                Historial de Pagos
                <Badge variant="secondary" className="ml-2">{payments.length}</Badge>
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={exportPaymentsCsv}>
                  Exportar CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 mb-4">
                <div className="text-sm text-muted-foreground">Total Pagado</div>
                <div className="text-lg font-semibold">
                  {formatCurrency(payments.reduce((acc, p) => acc + Number(p.amount || 0), 0))}
                </div>
              </div>
              <DataTable
                data={payments.slice(0, 50)}
                columns={[
                  { key: 'customer', header: 'Cliente', cell: (row) => creditById[row.credit_id]?.customer_name || '', width: '200px' },
                  { key: 'credit', header: 'Crédito', cell: (row) => row.credit_id, width: '160px' },
                  {
                    key: 'installment_number', header: 'Cuota', cell: (row) => {
                      const inst = installments.find(i => i.id === row.installment_id)
                      return inst ? inst.installment_number : ''
                    }, width: '100px'
                  },
                  { key: 'created_at', header: 'Fecha de pago', cell: (row) => row.created_at ? new Date(row.created_at).toLocaleDateString() : '', width: '140px' },
                  { key: 'payment_method', header: 'Método', cell: (row) => row.payment_method || '', width: '120px' },
                  { key: 'amount', header: 'Monto pagado', cell: (row) => formatCurrency(row.amount), align: 'right', width: '160px' }
                ]}
                loading={loading || isPending}
                emptyMessage="No hay pagos registrados"
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Payment Dialog */}
      <CreditPaymentDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onConfirm={handleConfirmPayment}
        initialAmount={dialogInitialAmount}
        creditInfo={dialogCreditId ? {
          id: dialogCreditId,
          customerName: creditById[dialogCreditId]?.customer_name || 'Cliente',
          customerId: creditById[dialogCreditId]?.customer_id || '',
          principal: creditById[dialogCreditId]?.principal || 0,
          interestRate: creditById[dialogCreditId]?.interest_rate || 0,
          termMonths: creditById[dialogCreditId]?.term_months || 0,
          remainingBalance: remainingByCredit[dialogCreditId] || 0,
          nextInstallmentNumber: getNextPendingInstallment(dialogCreditId)?.installment_number,
          nextDueDate: getNextPendingInstallment(dialogCreditId)?.due_date
        } : undefined}
      />

      {/* Credit Detail Dialog */}
      <CreditDetailDialog
        open={isDetailDialogOpen}
        onOpenChange={setIsDetailDialogOpen}
        credit={detailCreditId ? {
          ...creditById[detailCreditId],
          customer_name: creditById[detailCreditId].customer_name || 'Desconocido'
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
  )
}
