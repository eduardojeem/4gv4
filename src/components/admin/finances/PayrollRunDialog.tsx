'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

type PayrollFilters = { startDate: string; endDate: string }
type Preview = { totals: { netPay: number }; entries: Array<{ employeeId: string; role: string; salary: number; earnedCommissions: number; netPay: number }> }
const money = (value: number) => `₲ ${Math.round(value).toLocaleString('es-PY')}`

export function PayrollRunDialog({ open, onOpenChange, organizationId, branchId, filters, onSaved }: {
  open: boolean; onOpenChange: (open: boolean) => void; organizationId: string; branchId: string | null | undefined; filters: PayrollFilters; onSaved: () => unknown | Promise<unknown>
}) {
  const [periodFrom, setPeriodFrom] = useState(filters.startDate)
  const [periodTo, setPeriodTo] = useState(filters.endDate)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const idempotencyKeyRef = useRef<string | null>(null)

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
    idempotencyKeyRef.current ??= `payroll-${crypto.randomUUID()}`
    const response = await fetch(`/api/admin/finances/payroll?organizationId=${organizationId}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-idempotency-key': idempotencyKeyRef.current }, body: JSON.stringify({ periodFrom, periodTo, branchId }) })
    const payload = await response.json().catch(() => null) as { error?: string } | null
    setIsSubmitting(false)
    if (!response.ok) { setError(payload?.error ?? 'No se pudo crear la nómina.'); return }
    await onSaved(); idempotencyKeyRef.current = null; onOpenChange(false)
  }
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Preparar nómina</DialogTitle><DialogDescription>Revisa los importes devengados por el servidor antes de crear una corrida. La aprobación se confirma desde la corrida creada.</DialogDescription></DialogHeader><div className="grid gap-4"><div className="grid gap-4 sm:grid-cols-2"><label className="grid gap-1 text-sm font-medium">Desde<input type="date" value={periodFrom} onChange={(event) => setPeriodFrom(event.target.value)} className="rounded-md border bg-background px-3 py-2" /></label><label className="grid gap-1 text-sm font-medium">Hasta<input type="date" value={periodTo} onChange={(event) => setPeriodTo(event.target.value)} className="rounded-md border bg-background px-3 py-2" /></label></div><Button type="button" variant="outline" onClick={loadPreview} disabled={isLoadingPreview}>{isLoadingPreview ? 'Calculando…' : 'Ver vista previa'}</Button>{preview ? <section aria-live="polite" className="rounded-md border p-3"><p className="font-medium">Total neto: {money(preview.totals.netPay)}</p><ul className="mt-2 divide-y">{preview.entries.map((entry) => <li key={entry.employeeId} className="flex justify-between gap-3 py-2 text-sm"><span>{entry.employeeId} · {entry.role}</span><span>{money(entry.netPay)}</span></li>)}</ul></section> : null}<p className="text-sm text-muted-foreground">Las excepciones individuales del empleado prevalecen sobre las reglas de rol.</p>{error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}</div><DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button><Button type="button" onClick={createRun} disabled={!branchId || !preview || isSubmitting}>{isSubmitting ? 'Creando…' : 'Crear nómina'}</Button></DialogFooter></DialogContent></Dialog>
}
