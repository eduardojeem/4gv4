'use client'

import { useState } from 'react'
import { Loader2, Undo2, Wallet, HandCoins } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatCurrency } from '@/lib/currency'
import { branchHeaders } from '@/lib/branches/client'
import type { Repair } from '@/types/repairs'

type Kind = 'refund' | 'store_credit' | 'retain'

const newKey = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`

/** La reparación cancelada todavía tiene una seña sin resolver. */
export function hasPendingCancelledDeposit(repair: Pick<Repair, 'status' | 'paidAmount' | 'closeout'>) {
  return repair.status === 'cancelado' && Number(repair.paidAmount ?? 0) > 0 && !repair.closeout
}

/**
 * Seña de una reparación cancelada: se devuelve, queda como saldo a favor o
 * el comercio se la queda. Antes no había salida: si se devolvía con un retiro
 * de caja, Finanzas seguía contando la plata como entrada.
 */
export function CancelledDepositPanel({
  repair,
  branchId,
  onSettled,
}: {
  repair: Repair
  branchId: string | null
  onSettled: (repair: Repair) => void
}) {
  const deposit = Number(repair.paidAmount ?? 0)
  const [kind, setKind] = useState<Kind>('refund')
  const [method, setMethod] = useState<'cash' | 'transfer'>('cash')
  const [reference, setReference] = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [key, setKey] = useState(newKey)

  const problem =
    kind === 'refund' && method === 'transfer' && !reference.trim()
      ? 'Anotá la referencia de la transferencia.'
      : kind === 'retain' && reason.trim().length < 3
        ? 'Contá por qué se retiene la seña.'
        : null

  const submit = async () => {
    if (problem || saving) return
    setSaving(true)
    try {
      const response = await fetch(`/api/repairs/${repair.id}/deposit-settlement`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...branchHeaders(branchId) },
        body: JSON.stringify({
          kind,
          ...(kind === 'refund' ? { method, reference: reference.trim() || undefined } : {}),
          reason: reason.trim() || undefined,
          idempotencyKey: key,
        }),
      })
      const payload = await response.json().catch(() => null) as { repair?: Repair; error?: string } | null
      if (!response.ok || !payload?.repair) throw new Error(payload?.error || 'No se pudo resolver la seña.')
      toast.success(
        kind === 'refund' ? `Seña de ${formatCurrency(deposit)} devuelta`
          : kind === 'store_credit' ? `Seña de ${formatCurrency(deposit)} pasada a saldo a favor`
            : `Seña de ${formatCurrency(deposit)} retenida como cargo`,
      )
      setKey(newKey())
      onSettled(payload.repair)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo resolver la seña.')
    } finally {
      setSaving(false)
    }
  }

  const options: Array<{ value: Kind; label: string; hint: string; Icon: typeof Undo2 }> = [
    { value: 'refund', label: 'Devolver', hint: 'Sale de la caja o por transferencia', Icon: Undo2 },
    { value: 'store_credit', label: 'Saldo a favor', hint: 'Lo usa en otra compra', Icon: Wallet },
    { value: 'retain', label: 'Retener', hint: 'Cargo por cancelación', Icon: HandCoins },
  ]

  return (
    <section aria-labelledby="cancelled-deposit-title" className="space-y-3 border-b border-amber-200 bg-amber-50 px-3 py-3 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100 sm:px-6">
      <div>
        <h3 id="cancelled-deposit-title" className="text-sm font-semibold">
          La reparación se canceló con una seña de {formatCurrency(deposit)}
        </h3>
        <p className="text-xs opacity-80">Elegí qué pasa con esa plata. Se registra en la caja y en Finanzas.</p>
      </div>
      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Qué hacer con la seña">
        {options.map(({ value, label, hint, Icon }) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={kind === value}
            onClick={() => setKind(value)}
            disabled={saving || (value === 'store_credit' && !repair.customer?.id)}
            className={`flex min-h-11 flex-col items-center gap-0.5 rounded-lg border p-2 text-center text-xs transition-colors disabled:opacity-50 ${
              kind === value ? 'border-amber-600 bg-white font-semibold dark:bg-amber-900/40' : 'border-amber-200 bg-transparent dark:border-amber-900/60'
            }`}
          >
            <Icon className="h-4 w-4" />
            <span>{label}</span>
            <span className="text-[10px] font-normal opacity-75">{hint}</span>
          </button>
        ))}
      </div>
      {kind === 'refund' && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <label className="flex items-center gap-1"><input type="radio" checked={method === 'cash'} onChange={() => setMethod('cash')} disabled={saving} /> Efectivo</label>
          <label className="flex items-center gap-1"><input type="radio" checked={method === 'transfer'} onChange={() => setMethod('transfer')} disabled={saving} /> Transferencia</label>
          {method === 'transfer' && (
            <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Referencia" className="h-9 w-40 bg-white text-xs dark:bg-background" disabled={saving} />
          )}
        </div>
      )}
      <Input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder={kind === 'retain' ? 'Motivo (obligatorio): ej. cliente desistió con el repuesto pedido' : 'Motivo (opcional)'}
        className="h-9 bg-white text-xs dark:bg-background"
        disabled={saving}
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs opacity-80">{problem ?? ''}</span>
        <Button type="button" size="sm" onClick={submit} disabled={Boolean(problem) || saving} className="min-h-9">
          {saving ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
          Confirmar
        </Button>
      </div>
    </section>
  )
}
