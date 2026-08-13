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

      <div className="overflow-x-auto">
        <table className="w-full min-w-[42rem] text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="p-2">Concepto</th>
              <th className="p-2">Estado</th>
              <th className="p-2">Importe</th>
              <th className="p-2">Pendiente</th>
              <th className="p-2"><span className="sr-only">Acciones</span></th>
            </tr>
          </thead>
          <tbody>
            {obligations.map((item) => (
              <tr key={item.id} className="border-b">
                <td className="p-2">
                  <p>{item.concept ?? item.finance_categories?.name ?? 'Gasto'}</p>
                  <p className="text-xs text-muted-foreground">Vence: {item.due_date ?? 'Sin vencimiento'}</p>
                </td>
                <td className="p-2">{item.status}</td>
                <td className="p-2">{formatCurrency(Number(item.amount))}</td>
                <td className="p-2">{formatCurrency(Number(item.outstanding_amount))}</td>
                <td className="p-2 text-right">
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
            ))}
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
