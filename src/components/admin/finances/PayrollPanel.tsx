'use client'

/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useRef, useState } from 'react'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import type { AdminFinanceFilters } from '@/hooks/use-admin-finances'
import { formatCurrency } from '@/lib/currency'
import { PaymentDialog } from './PaymentDialog'
import { PayrollRunDialog } from './PayrollRunDialog'

type PayrollEntry = {
  id: string
  employee_id: string
  employee_display_name: string
  employee_role: string
  net_amount: number
  paid_amount: number
  outstanding_amount: number
  payment_status: string
}
type PayrollRun = {
  id: string
  status: 'draft' | 'approved' | 'voided'
  period_from: string
  period_to: string
  entries: PayrollEntry[]
}

export function PayrollPanel({
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
  const [open, setOpen] = useState(false)
  const [runs, setRuns] = useState<PayrollRun[]>([])
  const [paying, setPaying] = useState<PayrollEntry | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [confirmingRunId, setConfirmingRunId] = useState<string | null>(null)
  const [isOrganizationWide, setIsOrganizationWide] = useState(false)
  // Keep a ref to detect branchId changes and reset org-wide toggle
  const prevBranchIdRef = useRef(branchId)

  // Reset org-wide toggle when the selected branch changes.
  useEffect(() => {
    if (prevBranchIdRef.current !== branchId) {
      prevBranchIdRef.current = branchId
      setIsOrganizationWide(false)
    }
  }, [branchId])

  const activeBranchId = isOrganizationWide ? null : branchId

  const loadRuns = useCallback(async () => {
    const params = new URLSearchParams({ organizationId, periodFrom: filters.startDate, periodTo: filters.endDate })
    if (activeBranchId) params.set('branchId', activeBranchId)
    const response = await fetch(`/api/admin/finances/payroll/runs?${params.toString()}`)
    const payload = await response.json().catch(() => null) as { runs?: PayrollRun[]; error?: string } | null
    if (!response.ok) {
      setError(payload?.error ?? 'No se pudieron cargar las nóminas.')
      return
    }
    setError(null)
    setRuns(payload?.runs ?? [])
  }, [activeBranchId, filters.endDate, filters.startDate, organizationId])

  useEffect(() => { void loadRuns() }, [loadRuns])

  async function changed() {
    await loadRuns()
    await onChanged()
  }

  async function approve(runId: string) {
    if (approvingId) return false
    setApprovingId(runId)
    const response = await fetch(`/api/admin/finances/payroll/${runId}/approve?organizationId=${organizationId}`, { method: 'POST' })
    const payload = await response.json().catch(() => null) as { error?: string } | null
    setApprovingId(null)
    if (!response.ok) {
      setError(payload?.error ?? 'No se pudo aprobar la nómina.')
      return false
    }
    await changed()
    return true
  }

  async function confirmApproval() {
    if (!confirmingRunId) return
    if (await approve(confirmingRunId)) setConfirmingRunId(null)
  }

  return (
    <section className="space-y-4 rounded-lg border p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-semibold">Nómina</h2>
          <p className="text-sm text-muted-foreground">
            La vista previa refleja salarios y comisiones devengadas por el servidor. Los pagos parciales usan el saldo autorizado de cada entrada.
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>Preparar nómina</Button>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-md border p-3">
        <div>
          <label htmlFor="payroll-organization-wide" className="text-sm font-medium">
            Toda la organización
          </label>
          <p className="text-xs text-muted-foreground">
            {isOrganizationWide ? 'Incluye todas las sucursales.' : 'Usa la sucursal seleccionada actualmente.'}
          </p>
        </div>
        <Switch
          id="payroll-organization-wide"
          checked={isOrganizationWide}
          onCheckedChange={setIsOrganizationWide}
        />
      </div>

      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}

      <div className="space-y-3">
        {runs.map((run) => (
          <article key={run.id} className="rounded-md border p-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium">{run.period_from} a {run.period_to}</p>
                <p className="text-sm text-muted-foreground">Estado: {run.status}</p>
              </div>
              {run.status === 'draft' ? (
                <Button
                  size="sm"
                  onClick={() => setConfirmingRunId(run.id)}
                  disabled={approvingId === run.id}
                >
                  {approvingId === run.id ? 'Aprobando…' : 'Aprobar nómina'}
                </Button>
              ) : null}
            </div>
            <ul className="mt-3 divide-y">
              {run.entries.map((entry) => (
                <li key={entry.id} className="flex flex-col gap-2 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <span>{entry.employee_display_name} · {entry.employee_role}</span>
                  <span>
                    Autorizado: {formatCurrency(Number(entry.net_amount))} · Pendiente: {formatCurrency(Number(entry.outstanding_amount))}
                  </span>
                  {run.status === 'approved' && entry.outstanding_amount > 0 ? (
                    <Button size="sm" variant="outline" onClick={() => setPaying(entry)}>
                      Pago parcial
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          </article>
        ))}
        {!runs.length && !error ? (
          <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            No hay corridas de nómina para este período.
          </p>
        ) : null}
      </div>

      <PayrollRunDialog
        open={open}
        onOpenChange={setOpen}
        organizationId={organizationId}
        branchId={activeBranchId}
        filters={filters}
        onSaved={changed}
      />
      <PaymentDialog
        open={Boolean(paying)}
        onOpenChange={(nextOpen) => !nextOpen && setPaying(null)}
        organizationId={organizationId}
        payrollEntryId={paying?.id}
        branchId={activeBranchId}
        outstandingAmount={paying?.outstanding_amount}
        onSaved={changed}
      />
      <AlertDialog
        open={Boolean(confirmingRunId)}
        onOpenChange={(nextOpen) => { if (!nextOpen && !approvingId) setConfirmingRunId(null) }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Aprobar nómina de forma definitiva?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción autoriza los importes de la corrida y no se puede deshacer. Revisa el período y los montos antes de continuar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(approvingId)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => { event.preventDefault(); void confirmApproval() }}
              disabled={Boolean(approvingId)}
            >
              {approvingId ? 'Aprobando…' : 'Sí, aprobar nómina'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
