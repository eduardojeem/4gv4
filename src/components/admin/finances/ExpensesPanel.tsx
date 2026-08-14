'use client'

/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useState } from 'react'

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import type { AdminFinanceFilters } from '@/hooks/use-admin-finances'
import { formatCurrency } from '@/lib/currency'
import { ExpenseDialog, type FinanceCategory } from './ExpenseDialog'
import { PaymentDialog } from './PaymentDialog'

type Obligation = {
  id: string
  concept: string | null
  amount: number
  outstanding_amount: number
  requires_cash_session_on_void: boolean
  due_date: string | null
  status: string
  finance_categories?: { name?: string } | null
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
  const [obligations, setObligations] = useState<Obligation[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [expenseOpen, setExpenseOpen] = useState(false)
  const [paying, setPaying] = useState<Obligation | null>(null)
  const [voiding, setVoiding] = useState<Obligation | null>(null)
  const [isVoiding, setIsVoiding] = useState(false)
  const [voidReason, setVoidReason] = useState('')
  const [voidCashSessionId, setVoidCashSessionId] = useState('')

  const load = useCallback(async (currentPage = page) => {
    const params = new URLSearchParams({
      organizationId,
      startDate: filters.startDate,
      endDate: filters.endDate,
      pageSize: String(PAGE_SIZE),
      page: String(currentPage),
    })
    if (branchId) params.set('branchId', branchId)

    const [categoryResponse, obligationResponse] = await Promise.all([
      fetch(`/api/admin/finances/categories?organizationId=${organizationId}`),
      fetch(`/api/admin/finances/obligations?${params.toString()}`),
    ])

    const categoriesPayload = await categoryResponse.json().catch(() => null) as { categories?: FinanceCategory[]; error?: string } | null
    const obligationsPayload = await obligationResponse.json().catch(() => null) as { obligations?: Obligation[]; total?: number; error?: string } | null

    if (!categoryResponse.ok || !obligationResponse.ok) {
      setError(categoriesPayload?.error ?? obligationsPayload?.error ?? 'No se pudieron cargar los gastos.')
      return
    }

    setError(null)
    setCategories(categoriesPayload?.categories ?? [])
    setObligations(obligationsPayload?.obligations ?? [])
    setTotalCount(obligationsPayload?.total ?? (obligationsPayload?.obligations?.length ?? 0))
  }, [organizationId, branchId, filters.startDate, filters.endDate, page])

  // This effect synchronizes the local list with the selected finance scope.
  useEffect(() => {
    void load()
  }, [load])

  // Reset to page 1 when filters change.
  useEffect(() => {
    setPage(1)
  }, [organizationId, branchId, filters.startDate, filters.endDate])

  async function changed() {
    await load()
    await onChanged()
  }

  async function voidExpense() {
    if (!voiding || !branchId || isVoiding || !voidReason.trim()) return
    if (voiding.requires_cash_session_on_void && !voidCashSessionId.trim()) return

    setIsVoiding(true)
    const response = await fetch(`/api/admin/finances/obligations/${voiding.id}?organizationId=${organizationId}`, {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        branchId,
        reason: voidReason,
        cashSessionId: voiding.requires_cash_session_on_void ? voidCashSessionId : undefined,
      }),
    })
    const payload = await response.json().catch(() => null) as { error?: string } | null
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

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const hasMore = totalCount > PAGE_SIZE
  const pageAmount = obligations.reduce((total, item) => total + Number(item.amount), 0)
  const pageOutstanding = obligations.reduce((total, item) => total + Number(item.outstanding_amount), 0)

  return (
    <section className="space-y-4 rounded-lg border p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-semibold">Gastos y obligaciones</h2>
          <p className="text-sm text-muted-foreground">
            Registra obligaciones, recurrencias y pagos parciales sin alterar los totales locales.
          </p>
        </div>
        <Button onClick={() => setExpenseOpen(true)} disabled={!branchId}>
          Nuevo gasto
        </Button>
      </div>

      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}

      {obligations.length > 0 ? (
        <div className="grid gap-3 rounded-lg border bg-muted/20 p-3 sm:grid-cols-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Registros</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">{totalCount}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Importe de esta página</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">{formatCurrency(pageAmount)}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Pendiente de pago</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-amber-700 dark:text-amber-300">{formatCurrency(pageOutstanding)}</p>
          </div>
        </div>
      ) : null}

      <div className="hidden overflow-hidden rounded-lg border md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/60 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3">Concepto y vencimiento</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3 text-right">Importe</th>
              <th className="px-4 py-3 text-right">Pendiente de pago</th>
              <th className="px-4 py-3"><span className="sr-only">Acciones</span></th>
            </tr>
          </thead>
          <tbody>
            {obligations.map((item) => {
              const status = getExpenseStatus(item.status)
              return (
              <tr key={item.id} className="border-b last:border-0 transition-colors hover:bg-muted/40">
                <td className="px-4 py-3">
                  <p className="font-medium text-foreground">{item.concept ?? item.finance_categories?.name ?? 'Gasto'}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Vence: {item.due_date ?? 'Sin vencimiento'}</p>
                </td>
                <td className="px-4 py-3"><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${status.className}`}>{status.label}</span></td>
                <td className="px-4 py-3 text-right font-medium tabular-nums">{formatCurrency(Number(item.amount))}</td>
                <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatCurrency(Number(item.outstanding_amount))}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
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
                      disabled={['paid', 'voided'].includes(item.status)}
                    >
                      Anular
                    </Button>
                  </div>
                </td>
              </tr>
              )
            })}
            {obligations.length === 0 && !error ? (
              <tr>
                <td colSpan={5} className="p-4 text-center text-sm text-muted-foreground">
                  No hay gastos para este período.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 md:hidden">
        {obligations.map((item) => {
          const status = getExpenseStatus(item.status)
          return (
            <article key={item.id} className="rounded-lg border bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-medium text-foreground">{item.concept ?? item.finance_categories?.name ?? 'Gasto'}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">Vence: {item.due_date ?? 'Sin vencimiento'}</p>
                </div>
                <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium ${status.className}`}>{status.label}</span>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3 border-y py-3 text-sm">
                <div><dt className="text-xs text-muted-foreground">Importe</dt><dd className="mt-1 font-medium tabular-nums">{formatCurrency(Number(item.amount))}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Pendiente de pago</dt><dd className="mt-1 font-semibold tabular-nums">{formatCurrency(Number(item.outstanding_amount))}</dd></div>
              </dl>
              <div className="mt-3 flex justify-end gap-2">
                <Button size="sm" variant="outline" onClick={() => setPaying(item)} disabled={['paid', 'voided'].includes(item.status)}>Pagar</Button>
                <Button size="sm" variant="ghost" onClick={() => setVoiding(item)} disabled={['paid', 'voided'].includes(item.status)}>Anular</Button>
              </div>
            </article>
          )
        })}
        {obligations.length === 0 && !error ? (
          <p className="rounded-lg border p-4 text-center text-sm text-muted-foreground">No hay gastos para este período.</p>
        ) : null}
      </div>

      {hasMore ? (
        <div className="flex items-center justify-between gap-2 border-t pt-3">
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
        categories={categories}
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
      <AlertDialog open={Boolean(voiding)} onOpenChange={(open) => !open && setVoiding(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Anular este gasto?</AlertDialogTitle>
            <AlertDialogDescription>
              La anulación queda auditada y no se puede deshacer desde esta pantalla.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <label className="grid gap-1 text-sm font-medium">
            Motivo
            <textarea
              value={voidReason}
              onChange={(event) => setVoidReason(event.target.value)}
              required
              className="rounded-md border bg-background px-3 py-2"
            />
          </label>
          {voiding?.requires_cash_session_on_void ? (
            <label className="grid gap-1 text-sm font-medium">
              Sesión de caja abierta
              <input
                aria-label="Sesión de caja abierta"
                value={voidCashSessionId}
                onChange={(event) => setVoidCashSessionId(event.target.value)}
                required
                className="rounded-md border bg-background px-3 py-2"
              />
            </label>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={voidExpense}
              disabled={isVoiding || !voidReason.trim() || Boolean(voiding?.requires_cash_session_on_void && !voidCashSessionId.trim())}
            >
              {isVoiding ? 'Anulando…' : 'Confirmar anulación'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
