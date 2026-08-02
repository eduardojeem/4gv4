'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertCircle, CheckCircle2, CreditCard, Loader2, RefreshCcw, Search, WalletCards } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useBranch } from '@/contexts/branch-context'
import { branchHeaders } from '@/lib/branches/client'
import { formatCurrency } from '@/lib/currency'

type ReconciliationStatus = 'pending' | 'confirmed' | 'rejected' | 'refunded' | 'disputed'

type ElectronicPayment = {
  id: string
  sale_id: string
  payment_method: 'card' | 'transfer'
  amount: number
  reference: string | null
  card_last4: string | null
  channel: 'card_terminal' | 'bank_transfer' | 'qr' | 'other' | null
  provider: string | null
  institution: string | null
  terminal_id: string | null
  reconciliation_status: ReconciliationStatus
  fee_amount: number
  net_amount: number
  settled_at: string | null
  reconciled_at: string | null
  reconciliation_notes: string | null
  created_at: string
  sales: { code?: string; created_at?: string } | Array<{ code?: string; created_at?: string }> | null
}

const statusLabels: Record<ReconciliationStatus, string> = {
  pending: 'Pendiente',
  confirmed: 'Acreditado',
  rejected: 'Rechazado',
  refunded: 'Reembolsado',
  disputed: 'Contracargo',
}

const statusStyles: Record<ReconciliationStatus, string> = {
  pending: 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300',
  confirmed: 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300',
  rejected: 'border-red-300 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300',
  refunded: 'border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300',
  disputed: 'border-orange-300 bg-orange-50 text-orange-800 dark:border-orange-900 dark:bg-orange-950/30 dark:text-orange-300',
}

function saleCode(payment: ElectronicPayment) {
  const sale = Array.isArray(payment.sales) ? payment.sales[0] : payment.sales
  return sale?.code || payment.sale_id.slice(0, 8).toUpperCase()
}

function toLocalDateTime(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

export function ElectronicPaymentsPanel() {
  const { selectedBranchId } = useBranch()
  const [payments, setPayments] = useState<ElectronicPayment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [methodFilter, setMethodFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<ElectronicPayment | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    status: 'pending' as ReconciliationStatus,
    feeAmount: '0',
    provider: '',
    institution: '',
    channel: 'other',
    terminalId: '',
    settledAt: '',
    notes: '',
  })

  const fetchPayments = useCallback(async () => {
    if (!selectedBranchId || selectedBranchId === 'all') {
      setPayments([])
      setLoading(false)
      setError('Selecciona una sucursal para consultar cobros.')
      return
    }

    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (methodFilter !== 'all') params.set('method', methodFilter)
      if (search.trim()) params.set('q', search.trim())
      const response = await fetch(`/api/pos/electronic-payments?${params.toString()}`, {
        headers: branchHeaders(selectedBranchId),
      })
      const payload = await response.json() as { success?: boolean; error?: string; data?: ElectronicPayment[] }
      if (!response.ok || !payload.success || !Array.isArray(payload.data)) {
        throw new Error(payload.error || 'No se pudieron cargar los cobros.')
      }
      setPayments(payload.data)
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'No se pudieron cargar los cobros.')
    } finally {
      setLoading(false)
    }
  }, [methodFilter, search, selectedBranchId, statusFilter])

  useEffect(() => {
    const timer = window.setTimeout(() => { void fetchPayments() }, 250)
    return () => window.clearTimeout(timer)
  }, [fetchPayments])

  const totals = useMemo(() => payments.reduce((summary, payment) => {
    summary.gross += Number(payment.amount || 0)
    summary.fees += Number(payment.fee_amount || 0)
    summary.net += Number(payment.net_amount || payment.amount || 0)
    if (payment.reconciliation_status === 'pending') summary.pending += 1
    return summary
  }, { gross: 0, fees: 0, net: 0, pending: 0 }), [payments])

  const openEditor = (payment: ElectronicPayment) => {
    setEditing(payment)
    setForm({
      status: payment.reconciliation_status,
      feeAmount: String(payment.fee_amount || 0),
      provider: payment.provider || '',
      institution: payment.institution || '',
      channel: payment.channel || (payment.payment_method === 'card' ? 'card_terminal' : 'bank_transfer'),
      terminalId: payment.terminal_id || '',
      settledAt: toLocalDateTime(payment.settled_at),
      notes: payment.reconciliation_notes || '',
    })
  }

  const saveReconciliation = async () => {
    if (!editing || !selectedBranchId || selectedBranchId === 'all') return
    const feeAmount = Number(form.feeAmount)
    if (!Number.isFinite(feeAmount) || feeAmount < 0 || feeAmount > editing.amount) {
      toast.error('La comisión debe estar entre 0 y el monto cobrado.')
      return
    }

    setSaving(true)
    try {
      const response = await fetch('/api/pos/electronic-payments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...branchHeaders(selectedBranchId) },
        body: JSON.stringify({
          paymentId: editing.id,
          branchId: selectedBranchId,
          status: form.status,
          feeAmount,
          provider: form.provider,
          institution: form.institution,
          channel: form.channel,
          terminalId: form.terminalId,
          settledAt: form.settledAt ? new Date(form.settledAt).toISOString() : null,
          notes: form.notes,
        }),
      })
      const payload = await response.json() as { success?: boolean; error?: string }
      if (!response.ok || !payload.success) throw new Error(payload.error || 'No se pudo actualizar el cobro.')
      toast.success('Conciliación actualizada')
      setEditing(null)
      await fetchPayments()
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : 'No se pudo actualizar el cobro.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Cobrado</p><p className="mt-1 text-xl font-semibold tabular-nums">{formatCurrency(totals.gross)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Comisiones</p><p className="mt-1 text-xl font-semibold tabular-nums text-rose-600">{formatCurrency(totals.fees)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Neto</p><p className="mt-1 text-xl font-semibold tabular-nums text-emerald-600">{formatCurrency(totals.net)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Pendientes</p><p className="mt-1 text-xl font-semibold tabular-nums">{totals.pending}</p></CardContent></Card>
      </div>

      <div className="flex flex-col gap-3 border-y py-4 lg:flex-row lg:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Referencia, proveedor o banco" className="pl-9" />
        </div>
        <Select value={methodFilter} onValueChange={setMethodFilter}>
          <SelectTrigger className="w-full lg:w-44"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">Todos los métodos</SelectItem><SelectItem value="card">Tarjetas</SelectItem><SelectItem value="transfer">Transferencias / QR</SelectItem></SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full lg:w-44"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">Todos los estados</SelectItem>{Object.entries(statusLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={() => void fetchPayments()} disabled={loading} aria-label="Actualizar cobros">
          <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {loading ? (
        <div className="flex min-h-48 items-center justify-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Cargando cobros...</div>
      ) : error ? (
        <div className="flex min-h-40 flex-col items-center justify-center gap-3 border border-dashed p-6 text-center"><AlertCircle className="h-7 w-7 text-amber-600" /><p className="text-sm text-muted-foreground">{error}</p><Button variant="outline" size="sm" onClick={() => void fetchPayments()}>Reintentar</Button></div>
      ) : payments.length === 0 ? (
        <div className="flex min-h-48 flex-col items-center justify-center gap-2 border border-dashed p-6 text-center"><WalletCards className="h-8 w-8 text-muted-foreground" /><p className="font-medium">No hay cobros electrónicos</p><p className="text-sm text-muted-foreground">Los pagos con tarjeta, transferencia o QR aparecerán aquí.</p></div>
      ) : (
        <div className="overflow-hidden border">
          <div className="hidden grid-cols-[1.2fr_1fr_1fr_1fr_1fr_auto] gap-3 border-b bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground lg:grid">
            <span>Venta</span><span>Método</span><span>Proveedor</span><span>Bruto / neto</span><span>Estado</span><span className="sr-only">Acción</span>
          </div>
          <div className="divide-y">
            {payments.map(payment => (
              <div key={payment.id} className="grid gap-3 p-4 lg:grid-cols-[1.2fr_1fr_1fr_1fr_1fr_auto] lg:items-center">
                <div><p className="font-medium">{saleCode(payment)}</p><p className="text-xs text-muted-foreground">{new Date(payment.created_at).toLocaleString('es-PY')}</p></div>
                <div className="flex items-center gap-2"><CreditCard className="h-4 w-4 text-muted-foreground" /><span className="text-sm">{payment.channel === 'qr' ? 'QR' : payment.payment_method === 'card' ? `Tarjeta ${payment.card_last4 ? `•••• ${payment.card_last4}` : ''}` : 'Transferencia'}</span></div>
                <div><p className="text-sm">{payment.provider || 'Sin proveedor'}</p><p className="text-xs text-muted-foreground">{payment.institution || payment.reference || 'Sin referencia'}</p></div>
                <div><p className="text-sm font-medium tabular-nums">{formatCurrency(payment.amount)}</p><p className="text-xs text-muted-foreground">Neto {formatCurrency(payment.net_amount)}</p></div>
                <Badge variant="outline" className={`w-fit ${statusStyles[payment.reconciliation_status]}`}>{statusLabels[payment.reconciliation_status]}</Badge>
                <Button variant="outline" size="sm" onClick={() => openEditor(payment)}>{payment.reconciliation_status === 'pending' ? 'Conciliar' : 'Editar'}</Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <Dialog open={Boolean(editing)} onOpenChange={(open) => { if (!open && !saving) setEditing(null) }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader><DialogTitle>Conciliar cobro</DialogTitle><DialogDescription>{editing ? `${saleCode(editing)} · ${formatCurrency(editing.amount)}` : ''}</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-2 sm:grid-cols-2">
            <div className="space-y-2"><Label>Estado</Label><Select value={form.status} onValueChange={(value) => setForm(current => ({ ...current, status: value as ReconciliationStatus }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(statusLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label htmlFor="electronic-channel">Canal</Label><Select value={form.channel} onValueChange={(value) => setForm(current => ({ ...current, channel: value }))}><SelectTrigger id="electronic-channel"><SelectValue /></SelectTrigger><SelectContent>{editing?.payment_method === 'card' ? <SelectItem value="card_terminal">Terminal POS</SelectItem> : <><SelectItem value="bank_transfer">Transferencia bancaria</SelectItem><SelectItem value="qr">QR</SelectItem></>}<SelectItem value="other">Otro</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label htmlFor="electronic-provider">Proveedor</Label><Input id="electronic-provider" value={form.provider} onChange={(event) => setForm(current => ({ ...current, provider: event.target.value }))} placeholder="Bancard, Pagopar..." /></div>
            <div className="space-y-2"><Label htmlFor="electronic-institution">Banco o entidad</Label><Input id="electronic-institution" value={form.institution} onChange={(event) => setForm(current => ({ ...current, institution: event.target.value }))} placeholder="Banco receptor" /></div>
            <div className="space-y-2"><Label htmlFor="electronic-terminal">Terminal</Label><Input id="electronic-terminal" value={form.terminalId} onChange={(event) => setForm(current => ({ ...current, terminalId: event.target.value }))} placeholder="POS-01" /></div>
            <div className="space-y-2"><Label htmlFor="electronic-fee">Comisión</Label><Input id="electronic-fee" type="number" min="0" max={editing?.amount} value={form.feeAmount} onChange={(event) => setForm(current => ({ ...current, feeAmount: event.target.value }))} /></div>
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="electronic-settled">Fecha de acreditación</Label><Input id="electronic-settled" type="datetime-local" value={form.settledAt} onChange={(event) => setForm(current => ({ ...current, settledAt: event.target.value }))} /></div>
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="electronic-notes">Observación</Label><Textarea id="electronic-notes" value={form.notes} onChange={(event) => setForm(current => ({ ...current, notes: event.target.value }))} placeholder="Detalle de la conciliación" maxLength={1000} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>Cancelar</Button><Button onClick={() => void saveReconciliation()} disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}{saving ? 'Guardando...' : 'Guardar conciliación'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
