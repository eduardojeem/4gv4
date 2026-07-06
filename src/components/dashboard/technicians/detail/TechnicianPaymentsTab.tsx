'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Wallet, Plus, Check, X, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/currency'
import { useBranch } from '@/contexts/branch-context'
import { branchHeaders } from '@/lib/branches/client'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface Payment {
  id: string
  technician_id: string
  period_from: string
  period_to: string
  amount: number
  method: string
  status: 'pendiente' | 'pagado' | 'confirmado' | 'anulado'
  notes: string | null
  paid_at: string | null
  approved_at: string | null
  confirmed_at: string | null
  confirmed_by: string | null
}

interface Summary {
  devengado: number
  pagado: number
  saldo: number
}

const STATUS_BADGE: Record<Payment['status'], string> = {
  pendiente: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  pagado: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  confirmado: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  anulado: 'bg-gray-100 text-gray-500 line-through dark:bg-gray-800 dark:text-gray-400',
}

export function TechnicianPaymentsTab({ technicianId, canManage }: { technicianId: string; canManage: boolean }) {
  const { selectedBranchId } = useBranch()
  const [payments, setPayments] = useState<Payment[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [form, setForm] = useState({ amount: 0, method: 'efectivo', status: 'pagado', notes: '' })

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/repairs/technicians/${technicianId}/payments`, {
        headers: branchHeaders(selectedBranchId),
      })
      if (!res.ok) throw new Error(`Error ${res.status}`)
      const data = await res.json()
      setPayments(data.payments)
      setSummary(data.summary)
    } catch (err) {
      console.error('[payments] load', err)
    } finally {
      setIsLoading(false)
    }
  }, [technicianId, selectedBranchId])

  useEffect(() => { void load() }, [load])

  const openDialog = () => {
    setForm({ amount: Math.max(0, summary?.saldo ?? 0), method: 'efectivo', status: 'pagado', notes: '' })
    setDialogOpen(true)
  }

  const handleCreate = async () => {
    if (form.amount <= 0) { toast.error('El monto debe ser mayor a 0'); return }
    setIsSaving(true)
    try {
      const now = new Date()
      const period_from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
      const period_to = now.toISOString().slice(0, 10)
      const res = await fetch(`/api/repairs/technicians/${technicianId}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...branchHeaders(selectedBranchId) },
        body: JSON.stringify({ ...form, period_from, period_to }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Error ${res.status}`)
      }
      toast.success('Pago registrado')
      setDialogOpen(false)
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo registrar el pago')
    } finally {
      setIsSaving(false)
    }
  }

  const runAction = async (paymentId: string, action: 'confirmar' | 'confirmar_recibo' | 'anular') => {
    try {
      const res = await fetch(`/api/repairs/technicians/${technicianId}/payments/${paymentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...branchHeaders(selectedBranchId) },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Error ${res.status}`)
      }
      toast.success(action === 'anular' ? 'Pago anulado' : 'Pago actualizado')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo actualizar')
    }
  }

  if (isLoading) return <Skeleton className="h-96 w-full rounded-lg" />

  return (
    <div className="space-y-6">
      {/* Resumen */}
      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard label="Devengado (mes)" value={formatCurrency(summary?.devengado ?? 0)} />
        <SummaryCard label="Pagado" value={formatCurrency(summary?.pagado ?? 0)} />
        <SummaryCard label="A pagar (saldo)" value={formatCurrency(summary?.saldo ?? 0)} highlight />
      </div>

      <Card className="border border-border/60 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Wallet className="h-4 w-4 text-emerald-500" />
            Pagos
          </CardTitle>
          {canManage && (
            <Button size="sm" className="gap-1.5" onClick={openDialog}>
              <Plus className="h-3.5 w-3.5" /> Registrar pago
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Sin pagos registrados.</p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Período</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead>Método</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="text-sm">
                        {p.paid_at ? format(new Date(p.paid_at), 'dd MMM yy', { locale: es }) : '—'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(new Date(p.period_from), 'dd/MM', { locale: es })}–{format(new Date(p.period_to), 'dd/MM/yy', { locale: es })}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{formatCurrency(p.amount)}</TableCell>
                      <TableCell className="text-sm capitalize">{p.method}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={STATUS_BADGE[p.status]}>{p.status}</Badge>
                        <div className="mt-1 space-y-0.5 text-[10px] leading-tight text-muted-foreground">
                          {p.approved_at && (
                            <div>Aprob. {format(new Date(p.approved_at), 'dd/MM/yy', { locale: es })}</div>
                          )}
                          {p.confirmed_at && (
                            <div>
                              Recibo {format(new Date(p.confirmed_at), 'dd/MM/yy', { locale: es })}
                              {' · '}
                              {p.confirmed_by === p.technician_id ? 'técnico' : 'admin'}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {canManage && p.status !== 'anulado' && p.status !== 'confirmado' && (
                          <div className="flex justify-end gap-1">
                            {p.status === 'pendiente' && (
                              <Button variant="ghost" size="sm" className="h-7 gap-1 text-blue-600" onClick={() => runAction(p.id, 'confirmar')}>
                                <Check className="h-3.5 w-3.5" /> Confirmar
                              </Button>
                            )}
                            {p.status === 'pagado' && (
                              <Button variant="ghost" size="sm" className="h-7 gap-1 text-green-600" onClick={() => runAction(p.id, 'confirmar_recibo')} title="Acusar recibo del técnico">
                                <CheckCircle2 className="h-3.5 w-3.5" /> Acuse recibo
                              </Button>
                            )}
                            <Button variant="ghost" size="sm" className="h-7 gap-1 text-red-500" onClick={() => runAction(p.id, 'anular')}>
                              <X className="h-3.5 w-3.5" /> Anular
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Diálogo registrar pago */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar pago</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Monto a pagar (Gs.)</Label>
              <Input type="number" min={0} value={form.amount}
                onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} />
              <p className="text-[11px] text-muted-foreground">Saldo pendiente: {formatCurrency(summary?.saldo ?? 0)}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Método</Label>
                <Select value={form.method} onValueChange={(v) => setForm({ ...form, method: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="efectivo">Efectivo</SelectItem>
                    <SelectItem value="transferencia">Transferencia</SelectItem>
                    <SelectItem value="otro">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Estado</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pagado">Pagado</SelectItem>
                    <SelectItem value="pendiente">Pendiente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Notas (opcional)</Label>
              <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            {form.method === 'efectivo' && form.status === 'pagado' && (
              <p className="text-[11px] text-muted-foreground">Si hay caja abierta, se registrará como egreso automáticamente.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={isSaving}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={isSaving}>{isSaving ? 'Guardando…' : 'Registrar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function SummaryCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${highlight ? 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/50 dark:bg-emerald-950/20' : 'border-border/60'}`}>
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 text-xl font-bold tabular-nums ${highlight ? 'text-emerald-700 dark:text-emerald-300' : 'text-foreground'}`}>{value}</p>
    </div>
  )
}
