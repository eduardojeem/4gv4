'use client'

/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { format, isValid, parseISO } from 'date-fns'
import { Coins, Hash, Loader2, ReceiptText, RefreshCw, Search, Wallet, X } from 'lucide-react'

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type { AdminFinanceFilters } from '@/hooks/use-admin-finances'
import { formatCurrency } from '@/lib/currency'
import { cn } from '@/lib/utils'
import { CashSessionSelect, type OpenCashSession } from './CashSessionSelect'
import { EditExpenseDialog, ExpenseDialog, type EditableObligation, type FinanceCategory } from './ExpenseDialog'
import { PaymentDialog } from './PaymentDialog'

type Obligation = {
  id: string
  concept: string | null
  amount: number
  paid_amount?: number
  outstanding_amount: number
  requires_cash_session_on_void: boolean
  category_id?: string | null
  accounting_date?: string | null
  due_date: string | null
  vendor?: string | null
  notes?: string | null
  status: string
  finance_categories?: { id?: string; name?: string } | null
}
const PAGE_SIZE = 50

const expenseStatus: Record<string, { label: string; className: string }> = {
  draft: { label: 'Borrador', className: 'border-muted-foreground/30 bg-muted text-muted-foreground' },
  pending: { label: 'Pendiente', className: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200' },
  partially_paid: { label: 'Pago parcial', className: 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-200' },
  paid: { label: 'Pagado', className: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200' },
  overdue: { label: 'Vencido', className: 'border-destructive/30 bg-destructive/10 text-destructive' },
  voided: { label: 'Anulado', className: 'border-muted-foreground/30 bg-muted text-muted-foreground' },
}

function getExpenseStatus(status: string) {
  return expenseStatus[status] ?? { label: status, className: 'border-muted-foreground/30 bg-muted text-muted-foreground' }
}

/** Anular está permitido para cualquier estado salvo uno ya anulado: el backend
 *  revierte el pago (y su movimiento de caja) automáticamente cuando corresponde. */
function canVoid(status: string) {
  return status !== 'voided'
}

function formatDate(dateStr?: string | null) {
  if (!dateStr) return null
  const parsed = parseISO(dateStr)
  return isValid(parsed) ? format(parsed, 'dd/MM/yyyy') : dateStr
}

export function ExpensesPanel({
  organizationId,
  branchId,
  filters,
  onChanged,
}: {
  organizationId: string
  branchId: string | null | undefined
  filters: AdminFinanceFilters
  onChanged: () => unknown | Promise<unknown>
}) {
  const [categories, setCategories] = useState<FinanceCategory[]>([])
  const categoriesLoadedRef = useRef(false)
  const [obligations, setObligations] = useState<Obligation[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [expenseOpen, setExpenseOpen] = useState(false)
  const [editing, setEditing] = useState<EditableObligation | null>(null)
  const [paying, setPaying] = useState<Obligation | null>(null)
  const [voiding, setVoiding] = useState<Obligation | null>(null)
  const [isVoiding, setIsVoiding] = useState(false)
  const [voidReason, setVoidReason] = useState('')
  const [voidCashSessionId, setVoidCashSessionId] = useState('')
  const [voidOpenCashSessions, setVoidOpenCashSessions] = useState<OpenCashSession[] | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const loadSeqRef = useRef(0)

  const load = useCallback(
    async (currentPage = page, currentStatus = statusFilter, currentCategory = categoryFilter) => {
      const requestId = ++loadSeqRef.current
      setIsLoading(true)
      const params = new URLSearchParams({
        organizationId,
        startDate: filters.startDate,
        endDate: filters.endDate,
        pageSize: String(PAGE_SIZE),
        page: String(currentPage),
      })
      if (branchId) params.set('branchId', branchId)
      if (currentStatus !== 'all') params.set('status', currentStatus)
      if (currentCategory !== 'all') params.set('categoryId', currentCategory)

      try {
        // Categorías son datos estáticos: sólo se cargan una vez por montaje
        // de organización. Los refreshes y cambios de filtro sólo recargan obligaciones.
        const shouldLoadCategories = !categoriesLoadedRef.current
        const [categoryResponse, obligationResponse] = await Promise.all([
          shouldLoadCategories
            ? fetch(`/api/admin/finances/categories?organizationId=${organizationId}`, { cache: 'no-store' })
            : Promise.resolve(null),
          fetch(`/api/admin/finances/obligations?${params.toString()}`, { cache: 'no-store' }),
        ])

        const categoriesPayload = categoryResponse
          ? ((await categoryResponse.json().catch(() => null)) as {
              categories?: FinanceCategory[]
              error?: string
            } | null)
          : null
        const obligationsPayload = (await obligationResponse.json().catch(() => null)) as {
          obligations?: Obligation[]
          pagination?: { totalItems?: number; totalPages?: number }
          total?: number
          error?: string
        } | null

        // Una respuesta más lenta de un fetch anterior no debe pisar el estado
        // de un fetch más nuevo (ej. el usuario cambió de filtro/página rápido).
        if (requestId !== loadSeqRef.current) return

        if ((categoryResponse && !categoryResponse.ok) || !obligationResponse.ok) {
          setError(
            categoriesPayload?.error ?? obligationsPayload?.error ?? 'No se pudieron cargar los gastos.',
          )
          return
        }

        setError(null)
        if (categoriesPayload?.categories) {
          setCategories(categoriesPayload.categories)
          categoriesLoadedRef.current = true
        }
        setObligations(obligationsPayload?.obligations ?? [])
        setTotalCount(
          obligationsPayload?.pagination?.totalItems ??
            obligationsPayload?.total ??
            (obligationsPayload?.obligations?.length ?? 0),
        )
      } finally {
        if (requestId === loadSeqRef.current) setIsLoading(false)
      }
    },
    [organizationId, branchId, filters.startDate, filters.endDate, statusFilter, categoryFilter],
  )

  useEffect(() => {
    void load(page)
  }, [load, page])

  // Reset to page 1 when global filters or local criteria change.
  useEffect(() => {
    setPage(1)
  }, [organizationId, branchId, filters.startDate, filters.endDate, statusFilter, categoryFilter])

  // Recargar categorías cuando cambia la organización
  useEffect(() => {
    categoriesLoadedRef.current = false
  }, [organizationId])

  async function changed() {
    await load()
    await onChanged()
  }

  async function handleExpenseSaved(createdObligation?: unknown) {
    setPage(1)
    setSearchQuery('')
    if (statusFilter === 'paid' || statusFilter === 'voided') {
      setStatusFilter('all')
    }
    await load(1, 'all', categoryFilter)
    await onChanged()
  }

  async function voidExpense() {
    if (!voiding || !branchId || isVoiding || !voidReason.trim()) return
    if (voiding.requires_cash_session_on_void && !voidCashSessionId) return

    setIsVoiding(true)
    const response = await fetch(
      `/api/admin/finances/obligations/${voiding.id}?organizationId=${organizationId}`,
      {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          branchId,
          reason: voidReason,
          cashSessionId: voiding.requires_cash_session_on_void ? voidCashSessionId : undefined,
        }),
      },
    )
    const payload = (await response.json().catch(() => null)) as { error?: string } | null
    setIsVoiding(false)

    if (!response.ok) {
      setError(payload?.error ?? 'No se pudo anular el gasto.')
      return
    }
    setVoiding(null)
    setVoidReason('')
    setVoidCashSessionId('')
    await changed()
  }

  const filteredObligations = useMemo(() => {
    if (!searchQuery.trim()) return obligations
    const q = searchQuery.toLowerCase().trim()
    return obligations.filter(
      (item) =>
        (item.concept && item.concept.toLowerCase().includes(q)) ||
        (item.vendor && item.vendor.toLowerCase().includes(q)) ||
        (item.finance_categories?.name && item.finance_categories.name.toLowerCase().includes(q)),
    )
  }, [obligations, searchQuery])

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const hasMore = totalCount > PAGE_SIZE

  // Excluir gastos anulados (voided) de los importes y saldos pendientes
  const activeObligations = filteredObligations.filter((item) => item.status !== 'voided')
  const pageAmount = activeObligations.reduce((total, item) => total + Number(item.amount), 0)
  const pageOutstanding = activeObligations.reduce(
    (total, item) => total + Number(item.outstanding_amount),
    0,
  )

  const hasActiveLocalFilters = statusFilter !== 'all' || categoryFilter !== 'all' || searchQuery !== ''

  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-4 rounded-xl border border-border/70 bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ReceiptText className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold tracking-tight">Gastos y obligaciones</h2>
              {totalCount > 0 && (
                <Badge variant="secondary" className="text-xs font-semibold">
                  {totalCount} {totalCount === 1 ? 'registro' : 'registros'}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Registra obligaciones, recurrencias y pagos parciales sin alterar los totales locales.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void load()}
            disabled={isLoading}
            className="h-9 gap-1.5 shadow-xs"
            title="Actualizar lista de gastos"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <RefreshCw className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="hidden sm:inline">Actualizar</span>
          </Button>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={!branchId ? 0 : -1} className="inline-flex">
                  <Button onClick={() => setExpenseOpen(true)} disabled={!branchId} className="gap-1.5 shadow-sm">
                    Nuevo gasto
                  </Button>
                </span>
              </TooltipTrigger>
              {!branchId && (
                <TooltipContent side="left" className="max-w-[200px] text-center text-xs">
                  Seleccioná una sucursal para registrar gastos.
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </div>
      </section>

      {error ? (
        <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {/* Barra de filtros locales (búsqueda, estado, categoría) */}
      <section aria-labelledby="expenses-filters-heading" className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
        <h3 id="expenses-filters-heading" className="sr-only">
          Filtros de gastos
        </h3>
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              type="search"
              placeholder="Buscar por concepto o proveedor…"
              aria-label="Buscar por concepto o proveedor"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-8"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Limpiar búsqueda"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger aria-label="Filtrar por estado" className="h-9 w-auto min-w-[160px] text-xs font-medium">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="pending">Pendientes</SelectItem>
              <SelectItem value="overdue">Vencidos</SelectItem>
              <SelectItem value="partially_paid">Pago parcial</SelectItem>
              <SelectItem value="paid">Pagados</SelectItem>
              <SelectItem value="voided">Anulados</SelectItem>
              <SelectItem value="draft">Borradores</SelectItem>
            </SelectContent>
          </Select>

          {categories.length > 0 ? (
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger aria-label="Filtrar por categoría" className="h-9 w-auto min-w-[180px] max-w-[220px] text-xs font-medium">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las categorías</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}

          {hasActiveLocalFilters ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setStatusFilter('all')
                setCategoryFilter('all')
                setSearchQuery('')
              }}
              className="h-9 text-xs text-muted-foreground hover:text-foreground"
            >
              Limpiar
            </Button>
          ) : null}
        </div>
      </section>

      {filteredObligations.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <Card className="border-l-4 border-l-primary border-border/70 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-1 pt-3 px-4">
              <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Registros {searchQuery ? '(filtrados)' : ''}
              </CardTitle>
              <Hash className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <p className="text-xl font-bold tracking-tight tabular-nums">{filteredObligations.length}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">En esta página</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-slate-400 border-border/70 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-1 pt-3 px-4">
              <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Importe de esta página
              </CardTitle>
              <Coins className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <p className="text-xl font-bold tracking-tight tabular-nums">{formatCurrency(pageAmount)}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Excluye gastos anulados</p>
            </CardContent>
          </Card>

          <Card
            className={cn(
              'border-l-4 border-border/70 shadow-sm',
              pageOutstanding > 0 ? 'border-l-amber-500' : 'border-l-border/60',
            )}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-1 pt-3 px-4">
              <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Pendiente de pago
              </CardTitle>
              <Wallet className={cn('h-4 w-4', pageOutstanding > 0 ? 'text-amber-500' : 'text-muted-foreground')} />
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <p
                className={cn(
                  'text-xl font-bold tracking-tight tabular-nums',
                  pageOutstanding > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-foreground',
                )}
              >
                {formatCurrency(pageOutstanding)}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Sobre los gastos activos</p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <div className="hidden overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/70 bg-muted/50 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3">Concepto y detalles</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3 text-right">Importe</th>
              <th className="px-4 py-3 text-right">Pendiente de pago</th>
              <th className="px-4 py-3">
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredObligations.map((item) => {
              const status = getExpenseStatus(item.status)
              const dueDateFormatted = formatDate(item.due_date)
              const accountingDateFormatted = formatDate(item.accounting_date)
              const isEditable =
                ['draft', 'pending', 'overdue'].includes(item.status) &&
                Number(item.paid_amount ?? 0) === 0

              return (
                <tr
                  key={item.id}
                  className="border-b border-border/60 last:border-0 transition-colors hover:bg-muted/40"
                >
                  <td className="px-4 py-3">
                    <div className="space-y-0.5">
                      <p className="font-medium text-foreground">
                        {item.concept ?? item.finance_categories?.name ?? 'Gasto'}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                        {item.vendor ? (
                          <span className="font-medium text-foreground/80">
                            Proveedor: {item.vendor}
                          </span>
                        ) : null}
                        {item.vendor && (accountingDateFormatted || dueDateFormatted) ? (
                          <span>·</span>
                        ) : null}
                        {accountingDateFormatted ? (
                          <span>Contable: {accountingDateFormatted}</span>
                        ) : null}
                        {accountingDateFormatted && dueDateFormatted ? <span>·</span> : null}
                        <span>Vence: {dueDateFormatted ?? 'Sin vencimiento'}</span>
                      </div>
                      {item.notes ? (
                        <p className="text-xs text-muted-foreground/80 italic line-clamp-1">
                          Nota: {item.notes}
                        </p>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${status.className}`}
                    >
                      {status.label}
                    </span>
                  </td>
                  <td className={cn("px-4 py-3 text-right font-medium tabular-nums", item.status === 'voided' && "line-through text-muted-foreground")}>
                    {formatCurrency(Number(item.amount))}
                  </td>
                  <td className={cn("px-4 py-3 text-right font-semibold tabular-nums", item.status === 'voided' && "text-muted-foreground")}>
                    {item.status === 'voided' ? '—' : formatCurrency(Number(item.outstanding_amount))}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1.5">
                      {isEditable ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditing(item)}
                          title="Editar gasto"
                        >
                          Editar
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setPaying(item)}
                        disabled={['paid', 'voided'].includes(item.status)}
                      >
                        Pagar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setVoiding(item)}
                        disabled={!canVoid(item.status)}
                        title={item.status === 'paid' ? 'Anular revertirá el pago ya registrado' : undefined}
                      >
                        Anular
                      </Button>
                    </div>
                  </td>
                </tr>
              )
            })}
            {filteredObligations.length === 0 && !error ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-sm text-muted-foreground">
                  {hasActiveLocalFilters
                    ? 'No hay gastos que coincidan con los filtros aplicados.'
                    : 'No hay gastos para este período.'}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 md:hidden">
        {filteredObligations.map((item) => {
          const status = getExpenseStatus(item.status)
          const dueDateFormatted = formatDate(item.due_date)
          const accountingDateFormatted = formatDate(item.accounting_date)
          const isEditable =
            ['draft', 'pending', 'overdue'].includes(item.status) &&
            Number(item.paid_amount ?? 0) === 0

          return (
            <article key={item.id} className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-medium text-foreground">
                    {item.concept ?? item.finance_categories?.name ?? 'Gasto'}
                  </h3>
                  {item.vendor ? (
                    <p className="text-xs text-foreground/80 font-medium mt-0.5">
                      Proveedor: {item.vendor}
                    </p>
                  ) : null}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {accountingDateFormatted ? `Contable: ${accountingDateFormatted} · ` : ''}
                    Vence: {dueDateFormatted ?? 'Sin vencimiento'}
                  </p>
                  {item.notes ? (
                    <p className="mt-1 text-xs text-muted-foreground/80 italic">
                      Nota: {item.notes}
                    </p>
                  ) : null}
                </div>
                <span
                  className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium ${status.className}`}
                >
                  {status.label}
                </span>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3 border-y py-3 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Importe</dt>
                  <dd className={cn("mt-1 font-medium tabular-nums", item.status === 'voided' && "line-through text-muted-foreground")}>
                    {formatCurrency(Number(item.amount))}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Pendiente de pago</dt>
                  <dd className={cn("mt-1 font-semibold tabular-nums", item.status === 'voided' && "text-muted-foreground")}>
                    {item.status === 'voided' ? '—' : formatCurrency(Number(item.outstanding_amount))}
                  </dd>
                </div>
              </dl>
              <div className="mt-3 flex justify-end gap-2">
                {isEditable ? (
                  <Button size="sm" variant="ghost" onClick={() => setEditing(item)}>
                    Editar
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPaying(item)}
                  disabled={['paid', 'voided'].includes(item.status)}
                >
                  Pagar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setVoiding(item)}
                  disabled={!canVoid(item.status)}
                  title={item.status === 'paid' ? 'Anular revertirá el pago ya registrado' : undefined}
                >
                  Anular
                </Button>
              </div>
            </article>
          )
        })}
        {filteredObligations.length === 0 && !error ? (
          <p className="rounded-xl border border-dashed border-border/70 p-6 text-center text-sm text-muted-foreground">
            {hasActiveLocalFilters
              ? 'No hay gastos que coincidan con los filtros aplicados.'
              : 'No hay gastos para este período.'}
          </p>
        ) : null}
      </div>

      {hasMore ? (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-border/70 bg-card p-3 shadow-sm">
          <p className="text-xs text-muted-foreground">
            Página {page} de {totalPages} · {totalCount} gastos en total
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Anterior
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Siguiente
            </Button>
          </div>
        </div>
      ) : null}

      <ExpenseDialog
        open={expenseOpen}
        onOpenChange={setExpenseOpen}
        organizationId={organizationId}
        branchId={branchId}
        filters={filters}
        categories={categories}
        onSaved={handleExpenseSaved}
      />
      <EditExpenseDialog
        open={Boolean(editing)}
        onOpenChange={(nextOpen) => !nextOpen && setEditing(null)}
        organizationId={organizationId}
        branchId={branchId}
        categories={categories}
        expense={editing}
        onSaved={changed}
      />
      <PaymentDialog
        open={Boolean(paying)}
        onOpenChange={(open) => !open && setPaying(null)}
        organizationId={organizationId}
        obligationId={paying?.id}
        branchId={branchId}
        outstandingAmount={paying?.outstanding_amount}
        onSaved={changed}
      />
      <AlertDialog
        open={Boolean(voiding)}
        onOpenChange={(open) => {
          if (!open) {
            setVoiding(null)
            setVoidReason('')
            setVoidCashSessionId('')
            setVoidOpenCashSessions(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Anular este gasto?</AlertDialogTitle>
            <AlertDialogDescription>
              {voiding?.status === 'paid'
                ? 'Este gasto ya tiene un pago registrado: al anularlo, el pago se revierte automáticamente. La anulación queda auditada y no se puede deshacer desde esta pantalla.'
                : 'La anulación queda auditada y no se puede deshacer desde esta pantalla.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <label className="grid gap-1 text-sm font-medium">
            Motivo
            <textarea
              value={voidReason}
              onChange={(event) => setVoidReason(event.target.value)}
              required
              className="rounded-md border bg-background px-3 py-2 text-sm"
            />
          </label>
          {voiding?.requires_cash_session_on_void ? (
            <div className="grid gap-1">
              <label className="text-sm font-medium" htmlFor="void-cash-session-id">
                Caja donde se revertirá el efectivo
              </label>
              <CashSessionSelect
                id="void-cash-session-id"
                organizationId={organizationId}
                branchId={branchId}
                value={voidCashSessionId}
                onChange={setVoidCashSessionId}
                onSessionsLoaded={setVoidOpenCashSessions}
                refreshKey={voiding?.id ?? null}
              />
            </div>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={voidExpense}
              disabled={
                isVoiding ||
                !voidReason.trim() ||
                Boolean(
                  voiding?.requires_cash_session_on_void &&
                    (!voidCashSessionId || voidOpenCashSessions?.length === 0),
                )
              }
            >
              {isVoiding ? 'Anulando…' : 'Confirmar anulación'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
