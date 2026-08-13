'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

type PayrollFilters = { startDate: string; endDate: string }
type Preview = { totals: { netPay: number }; entries: Array<{ employeeId: string; role: string; salary: number; earnedCommissions: number; netPay: number }> }
export type ApprovedPayrollEntry = { id: string; employeeId: string; employeeName: string; netPay: number }
const money = (value: number) => `₲ ${Math.round(value).toLocaleString('es-PY')}`

export function PayrollRunDialog({ open, onOpenChange, organizationId, branchId, filters, onSaved, onApprove, approvedEntries = [] }: {
  open: boolean; onOpenChange: (open: boolean) => void; organizationId: string; branchId: string | null | undefined; filters: PayrollFilters; onSaved: () => unknown | Promise<unknown>; onApprove?: () => void | Promise<void>; approvedEntries?: ApprovedPayrollEntry[]
}) {
  const [periodFrom, setPeriodFrom] = useState(filters.startDate)
  const [periodTo, setPeriodTo] = useState(filters.endDate)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showApproval, setShowApproval] = useState(false)

  const query = new URLSearchParams({ organizationId, periodFrom, periodTo })
  if (branchId) query.set('branchId', branchId)
  async function loadPreview() {
    setIsLoadingPreview(true); setError(null)
    const response = await fetch(`/api/admin/finances/payroll?${query.toString()}`)
    const payload = await response.json().catch(() => null) as { preview?: Preview; error?: string } | null
    setIsLoadingPreview(false)
    if (!response.ok || !payload?.preview) { setError(payload?.error ?? 'No se pudo generar la vista previa.'); return }
    setPreview(payload.preview)
  }
  async function createRun() {
    if (!branchId || isSubmitting) return
    setIsSubmitting(true); setError(null)
    const response = await fetch(`/api/admin/finances/payroll?organizationId=${organizationId}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-idempotency-key': `payroll-${Date.now()}-${Math.random().toString(36).slice(2)}` }, body: JSON.stringify({ periodFrom, periodTo, branchId }) })
    const payload = await response.json().catch(() => null) as { error?: string } | null
    setIsSubmitting(false)
    if (!response.ok) { setError(payload?.error ?? 'No se pudo crear la nómina.'); return }
    await onSaved()
  }
  async function confirmApproval() { if (isSubmitting) return; setIsSubmitting(true); try { await onApprove?.() } finally { setIsSubmitting(false); setShowApproval(false) } }
  return <><Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Preparar nómina</DialogTitle><DialogDescription>Revisa los importes devengados por el servidor antes de crear o aprobar una corrida.</DialogDescription></DialogHeader><div className="grid gap-4"><div className="grid gap-4 sm:grid-cols-2"><label className="grid gap-1 text-sm font-medium">Desde<input type="date" value={periodFrom} onChange={(event) => setPeriodFrom(event.target.value)} className="rounded-md border bg-background px-3 py-2" /></label><label className="grid gap-1 text-sm font-medium">Hasta<input type="date" value={periodTo} onChange={(event) => setPeriodTo(event.target.value)} className="rounded-md border bg-background px-3 py-2" /></label></div><Button type="button" variant="outline" onClick={loadPreview} disabled={isLoadingPreview}>{isLoadingPreview ? 'Calculando…' : 'Ver vista previa'}</Button>{preview ? <section aria-live="polite" className="rounded-md border p-3"><p className="font-medium">Total neto: {money(preview.totals.netPay)}</p><ul className="mt-2 divide-y">{preview.entries.map((entry) => <li key={entry.employeeId} className="flex justify-between gap-3 py-2 text-sm"><span>{entry.employeeId} · {entry.role}</span><span>{money(entry.netPay)}</span></li>)}</ul></section> : null}{approvedEntries.length ? <section className="rounded-md border p-3"><p className="mb-2 text-sm font-medium">Importes aprobados</p>{approvedEntries.map((entry) => <label key={entry.id} className="grid gap-1 text-sm font-medium">{entry.employeeName}<input aria-label={`Monto aprobado de ${entry.employeeName}`} value={money(entry.netPay)} readOnly className="rounded-md border bg-muted px-3 py-2" /></label>)}</section> : null}<p className="text-sm text-muted-foreground">Las excepciones individuales del empleado prevalecen sobre las reglas de rol.</p>{error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}</div><DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button><Button type="button" onClick={createRun} disabled={!branchId || !preview || isSubmitting}>{isSubmitting ? 'Creando…' : 'Crear nómina'}</Button><Button type="button" onClick={() => setShowApproval(true)} disabled={isSubmitting || !onApprove}>Aprobar nómina</Button></DialogFooter></DialogContent></Dialog><AlertDialog open={showApproval} onOpenChange={setShowApproval}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>¿Aprobar nómina?</AlertDialogTitle><AlertDialogDescription>Al aprobarla, los importes no se podrán modificar. Confirma que la vista previa está revisada.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={confirmApproval} disabled={isSubmitting}>Confirmar aprobación</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></>
}
