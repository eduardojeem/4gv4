'use client'

import { useState } from 'react'
import { Loader2, Undo2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

type Props = {
  paymentId: string
  organizationName: string
  amountLabel: string
  onRefunded: () => void
}

/**
 * Registra el reembolso de un pago. La devolución de la plata se hace afuera
 * (panel de Pagopar o banco); este paso deja el registro y, si se marca, quita
 * el período que ese pago cubría.
 */
export function RefundPaymentButton({ paymentId, organizationName, amountLabel, onRefunded }: Props) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [revokeAccess, setRevokeAccess] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setSaving(true)
    setError(null)
    try {
      const response = await fetch(`/api/superadmin/payments/${encodeURIComponent(paymentId)}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim(), revokeAccess }),
      })
      const payload = await response.json().catch(() => null) as { error?: string; accessRevoked?: boolean } | null
      if (!response.ok) {
        setError(payload?.error || 'No se pudo registrar el reembolso.')
        return
      }
      toast.success(payload?.accessRevoked ? 'Reembolso registrado y período quitado.' : 'Reembolso registrado.')
      setOpen(false)
      setReason('')
      onRefunded()
    } catch {
      setError('No se pudo conectar para registrar el reembolso.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs text-rose-600 hover:text-rose-700" onClick={() => setOpen(true)}>
        <Undo2 className="h-3.5 w-3.5" />
        Reembolsar
      </Button>
      <Dialog open={open} onOpenChange={(next) => { if (!saving) setOpen(next) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reembolsar {amountLabel}</DialogTitle>
            <DialogDescription>
              {organizationName}. Devolvé la plata desde el panel de Pagopar o por banco; acá queda registrado.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor={`refund-reason-${paymentId}`}>Motivo</Label>
              <Textarea id={`refund-reason-${paymentId}`} value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} rows={3} disabled={saving} />
            </div>
            <label className="flex items-start gap-2 text-sm">
              <Checkbox checked={revokeAccess} onCheckedChange={(value) => setRevokeAccess(value === true)} disabled={saving} className="mt-0.5" />
              <span>
                Quitar el período que cubría este pago
                <span className="block text-xs text-muted-foreground">La cuenta pasa a pago pendiente y, si no paga en 7 días, al plan Gratuito.</span>
              </span>
            </label>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Volver</Button>
            <Button onClick={() => void submit()} disabled={saving || reason.trim().length < 3} className="bg-rose-600 text-white hover:bg-rose-700">
              {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Registrar reembolso
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
