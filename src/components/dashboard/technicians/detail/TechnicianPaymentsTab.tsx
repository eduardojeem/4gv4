'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Wallet } from 'lucide-react'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/currency'
import { useBranch } from '@/contexts/branch-context'
import { useOptionalActiveOrganization } from '@/contexts/ActiveOrganizationContext'
import { useEffectiveModule } from '@/contexts/SubscriptionStatusContext'
import { useAuth } from '@/contexts/auth-context'
import { branchHeaders } from '@/lib/branches/client'
import { readTechnicianAttempt, persistTechnicianAttempt, clearTechnicianAttempt, type PendingTechnicianAttempt } from '@/lib/technician/pending-attempt'

interface Payment {
  id: string; period_from: string; period_to: string; amount: number
  method: string; status: 'pendiente' | 'pagado' | 'confirmado' | 'anulado'
  notes: string | null; paid_at: string | null; branch_id?: string | null
}
interface Summary { devengado: number; pagado: number; saldo: number; basis?: 'payroll' | 'estimate'; complete?: boolean }
type Action = 'confirmar' | 'confirmar_recibo' | 'anular'
type Form = { amount: number; method: string; status: string; notes: string }
const statusLabel = { pendiente: 'Pendiente de pago', pagado: 'Pagado', confirmado: 'Recibido por el técnico', anulado: 'Anulado' }

export function TechnicianPaymentsTab({ technicianId, canManage, canConfirmReceipt = false }: {
  technicianId: string; canManage: boolean; canConfirmReceipt?: boolean
}) {
  const { selectedBranchId } = useBranch()
  const organizationContext = useOptionalActiveOrganization()
  const organizationId = organizationContext?.organization?.id ?? ''
  const financeEnabled = useEffectiveModule('finances')
  const { hasPermission } = useAuth()
  // The existing organization bridge grants settings.read to owner/admin.
  // Finance APIs retain their own administrator and tenant checks.
  const financeAccess = financeEnabled && hasPermission('settings.read')
  const basicManagement = canManage && !financeEnabled
  const [month, setMonth] = useState(() => {
    const now = new Date()
    return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0')
  })
  const scope = [organizationId, technicianId, selectedBranchId ?? 'all', month].join(':')
  const currentScope = useRef(scope)
  currentScope.current = scope
  const requestSequence = useRef(0)
  const actionKeys = useRef(new Map<string, string>())
  const createAttempt = useRef<PendingTechnicianAttempt | null>(null)
  const mutationBusy = useRef(false)
  const [state, setState] = useState<{ scope: string; payments: Payment[]; summary: Summary | null; error: string | null }>({ scope: '', payments: [], summary: null, error: null })
  const [isLoading, setIsLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [form, setForm] = useState<Form>({ amount: 0, method: 'efectivo', status: 'pagado', notes: '' })
  const headers = useCallback(() => ({ ...branchHeaders(selectedBranchId), ...(organizationId ? { 'x-organization-id': organizationId } : {}) }), [selectedBranchId, organizationId])
  const load = useCallback(async () => {
    const sequence = ++requestSequence.current
    setIsLoading(true)
    try {
      const response = await fetch('/api/repairs/technicians/' + technicianId + '/payments?' + new URLSearchParams({ month }), { headers: headers(), cache: 'no-store' })
      if (!response.ok) throw new Error('No se pudieron cargar los pagos. Intentá nuevamente.')
      const data = await response.json()
      if (sequence !== requestSequence.current || currentScope.current !== scope) return
      setState({ scope, payments: data.payments, summary: data.summary, error: null })
    } catch (error) {
      if (sequence !== requestSequence.current || currentScope.current !== scope) return
      setState({ scope, payments: [], summary: null, error: error instanceof Error ? error.message : 'No se pudieron cargar los pagos.' })
    } finally {
      if (sequence === requestSequence.current && currentScope.current === scope) setIsLoading(false)
    }
  }, [scope, month, technicianId, headers])
  useEffect(() => {
    const cancelRequest = () => { ++requestSequence.current }
    createAttempt.current = null
    actionKeys.current.clear()
    setDialogOpen(false)
    void load()
    const invalidate = () => { ++requestSequence.current; setState({ scope: '', payments: [], summary: null, error: null }); setDialogOpen(false) }
    window.addEventListener('organization:changed', invalidate)
    return () => { cancelRequest(); window.removeEventListener('organization:changed', invalidate) }
  }, [load])
  const summary = state.scope === scope ? state.summary : null
  const payments = state.scope === scope ? state.payments : []
  const openDialog = () => {
    try {
      createAttempt.current ??= readTechnicianAttempt(scope, 'payment')
      if (createAttempt.current) {
        const saved = JSON.parse(createAttempt.current.body)
        if (typeof saved.amount !== 'number' || !Number.isFinite(saved.amount)
          || !['efectivo','transferencia','otro'].includes(saved.method)
          || !['pendiente','pagado'].includes(saved.status) || typeof saved.notes !== 'string') throw new Error('Revisá el historial: la solicitud pendiente no se puede recuperar.')
        setForm({ amount: saved.amount, method: saved.method, status: saved.status, notes: saved.notes })
      }
    } catch (error) { toast.error(error instanceof Error ? error.message : 'No se pudo recuperar la solicitud'); return }
    if (!createAttempt.current) setForm({ amount: summary?.complete === false ? 0 : Math.max(0, summary?.saldo ?? 0), method: 'efectivo', status: 'pagado', notes: '' })
    setDialogOpen(true)
  }
  const handleCreate = async () => {
    if (mutationBusy.current || !summary || !basicManagement) return
    if (form.amount <= 0) { toast.error('El monto debe ser mayor a 0'); return }
    const [year, m] = month.split('-').map(Number)
    const body = JSON.stringify({ ...form, period_from: month + '-01', period_to: new Date(Date.UTC(year, m, 0)).toISOString().slice(0, 10) })
    createAttempt.current ??= { key: crypto.randomUUID(), body, scope, fresh: true }
    const attempt = createAttempt.current
    if (attempt.scope !== scope) return
    mutationBusy.current = true
    setIsSaving(true)
    try {
      persistTechnicianAttempt(attempt, 'payment')
      const response = await fetch('/api/repairs/technicians/' + technicianId + '/payments', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...headers(), 'x-idempotency-key': attempt.key }, body: attempt.body,
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        if (response.status < 500 && attempt.fresh) {
          clearTechnicianAttempt(scope, 'payment'); createAttempt.current = null
        } else { attempt.fresh = false }
        throw new Error(data.message || 'No se pudo registrar. Reintentá esta misma solicitud.')
      }
      clearTechnicianAttempt(scope, 'payment')
      if (currentScope.current !== scope) return
      createAttempt.current = null
      toast.success('Pago registrado')
      setDialogOpen(false)
      await load()
    } catch (error) { attempt.fresh = false; if (currentScope.current === scope) toast.error(error instanceof Error ? error.message : 'No se pudo registrar el pago') }
    finally { mutationBusy.current = false; setIsSaving(false) }
  }
  const runAction = async (payment: Payment, action: Action) => {
    if (mutationBusy.current || !summary) return
    if (action === 'anular' && !window.confirm('¿Anular este pago? El efectivo se revertirá en una caja abierta de la misma sucursal.')) return
    const identity = scope + ':' + payment.id + ':' + action
    const key = actionKeys.current.get(identity) ?? crypto.randomUUID()
    actionKeys.current.set(identity, key)
    mutationBusy.current = true; setIsSaving(true)
    try {
      const response = await fetch('/api/repairs/technicians/' + technicianId + '/payments/' + payment.id, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json', ...headers(), 'x-idempotency-key': key }, body: JSON.stringify({ action }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.message || 'No se pudo actualizar el pago.')
      }
      if (currentScope.current !== scope) return
      actionKeys.current.delete(identity)
      toast.success('Pago actualizado'); await load()
    } catch (error) { if (currentScope.current === scope) toast.error(error instanceof Error ? error.message : 'No se pudo actualizar') }
    finally { mutationBusy.current = false; setIsSaving(false) }
  }
  const period = <div className="space-y-1.5"><Label htmlFor={'payment-period-' + technicianId}>Período</Label><Input id={'payment-period-' + technicianId} type="month" value={month} disabled={isSaving || Boolean(createAttempt.current)} onChange={event => { if (/^\d{4}-\d{2}$/.test(event.target.value)) setMonth(event.target.value) }} className="max-w-56 text-base" /></div>
  if (organizationContext?.isLoading || isLoading || state.scope !== scope) return <div className="space-y-4">{period}<Skeleton className="h-64 w-full rounded-lg" /></div>
  if (state.error || !summary) return <div className="space-y-4">{period}<div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-4"><p>{state.error || 'No hay un resumen verificable.'}</p><Button variant="outline" className="mt-3 min-h-11" onClick={() => void load()}>Reintentar</Button></div></div>
  const actions = (payment: Payment) => payment.branch_id === null ? null : <div className="flex flex-wrap gap-2">
    {basicManagement && payment.status === 'pendiente' && <Button variant="outline" disabled={isSaving} className="min-h-11" onClick={() => void runAction(payment, 'confirmar')}>Confirmar pago</Button>}
    {canConfirmReceipt && payment.status === 'pagado' && <Button variant="outline" disabled={isSaving} className="min-h-11" onClick={() => void runAction(payment, 'confirmar_recibo')}>Confirmar recepción</Button>}
    {basicManagement && ['pendiente', 'pagado'].includes(payment.status) && <Button variant="outline" disabled={isSaving} className="min-h-11 text-destructive" onClick={() => void runAction(payment, 'anular')}>Anular</Button>}
  </div>
  return <div className="space-y-4">
    <div className="flex flex-wrap items-end justify-between gap-3">{period}
      {canManage && financeAccess && <Button asChild variant="outline" className="min-h-11"><Link href="/admin/finances?section=payroll">Ver liquidación en Finanzas</Link></Button>}
    </div>
    <div className="grid gap-3 sm:grid-cols-3">
      {[[summary.basis === 'payroll' ? 'Liquidado en Nómina' : 'Generado (estimado)', summary.devengado], ['Pagado', summary.pagado], [summary.basis === 'payroll' ? 'Pendiente liquidado' : 'Pendiente estimado', summary.saldo]].map(([label, value]) => <div key={String(label)} className="rounded-lg border bg-card p-4"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-xl font-semibold tabular-nums">{formatCurrency(Number(value))}</p></div>)}
    </div>
    <p className="text-sm text-muted-foreground">El resumen incluye Nómina aprobada y pagos básicos, sin duplicar los importados. Los pendientes no cuentan como pagados. Este historial muestra el circuito básico; el detalle de Nómina está en Finanzas.</p>
    {summary.complete === false && <p role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">Hay pagos sin sucursal o sueldos de ámbito organización que no se atribuyen a esta sucursal. El saldo no es definitivo: revisá todas las sucursales y reconciliá el historial antes de pagar.</p>}
    {financeEnabled && !financeAccess && canManage && <p role="status" className="rounded-lg border p-3 text-sm">Tu organización utiliza Finanzas. Pedí acceso a Nómina al administrador para gestionar pagos.</p>}
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-2 text-base"><Wallet className="h-4 w-4" />Historial de pagos</CardTitle>
        {basicManagement && <Button className="min-h-11" onClick={openDialog} disabled={isSaving}>Registrar pago</Button>}
      </CardHeader>
      <CardContent className="space-y-3">
        {!payments.length && <p className="py-6 text-center text-sm text-muted-foreground">Sin pagos registrados.</p>}
        {payments.map(payment => <article key={payment.id} className="rounded-lg border p-4">
          <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-lg font-semibold tabular-nums">{formatCurrency(payment.amount)}</p><p className="text-sm text-muted-foreground">{payment.period_from} al {payment.period_to} · {payment.method}</p></div><Badge variant="outline">{statusLabel[payment.status]}</Badge></div>
          <p className="mt-2 text-xs text-muted-foreground">{payment.paid_at ? 'Pagado: ' + new Date(payment.paid_at).toLocaleDateString('es-PY') : 'Todavía sin desembolso'}</p>
          {payment.branch_id === null && <p className="mt-2 text-xs text-amber-700">Sucursal histórica pendiente de reconciliar.</p>}
          {payment.notes && <p className="my-2 break-words text-sm">{payment.notes}</p>}
          <div className="mt-3">{actions(payment)}</div>
        </article>)}
      </CardContent>
    </Card>
    <Dialog open={dialogOpen} onOpenChange={open => { if (!isSaving) setDialogOpen(open) }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader><DialogTitle>Registrar pago al técnico</DialogTitle><DialogDescription>Período: {month}. Se registrará en la sucursal seleccionada.</DialogDescription></DialogHeader>
        <fieldset disabled={isSaving || Boolean(createAttempt.current)} className="space-y-4">
          <div className="space-y-1.5"><Label htmlFor="technician-amount">Monto a pagar</Label><Input id="technician-amount" type="number" inputMode="decimal" min={0} step="0.01" className="text-base" value={form.amount} onChange={event => setForm({ ...form, amount: Number(event.target.value) })} /><p className="text-xs text-muted-foreground">Pendiente estimado: {formatCurrency(summary.saldo)}</p></div>
          <div className="space-y-1.5"><Label>Método</Label><Select value={form.method} disabled={isSaving || Boolean(createAttempt.current)} onValueChange={method => setForm({ ...form, method })}><SelectTrigger aria-label="Método" className="min-h-11"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="efectivo">Efectivo</SelectItem><SelectItem value="transferencia">Transferencia</SelectItem><SelectItem value="otro">Otro</SelectItem></SelectContent></Select></div>
          <div className="space-y-1.5"><Label>Estado</Label><Select value={form.status} disabled={isSaving || Boolean(createAttempt.current)} onValueChange={status => setForm({ ...form, status })}><SelectTrigger aria-label="Estado" className="min-h-11"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="pagado">Pagado</SelectItem><SelectItem value="pendiente">Pendiente de pago</SelectItem></SelectContent></Select></div>
          <div className="space-y-1.5"><Label htmlFor="technician-notes">Notas</Label><Textarea id="technician-notes" className="text-base" maxLength={500} value={form.notes} onChange={event => setForm({ ...form, notes: event.target.value })} /></div>
        </fieldset>
        <p className="text-sm text-muted-foreground">Para pagar en efectivo debe haber una caja abierta en esta sucursal. Si la conexión falla, reintentá la misma solicitud; no registres otro pago.</p>
        <DialogFooter><Button variant="outline" disabled={isSaving} onClick={() => setDialogOpen(false)}>Cerrar</Button><Button className="min-h-11" disabled={isSaving} onClick={() => void handleCreate()}>{isSaving ? 'Guardando…' : createAttempt.current ? 'Reintentar misma solicitud' : 'Registrar'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
}
