'use client'

import { AlertTriangle, PackageCheck } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatCurrency } from '@/lib/currency'
import { cn } from '@/lib/utils'
import { getUnrepairedCloseoutPreview, type UnrepairedCloseoutRequest } from '@/lib/repairs/unrepaired-closeout'
import type { Repair } from '@/types/repairs'

export type UnrepairedCloseoutDraft = Omit<UnrepairedCloseoutRequest, 'outcome' | 'idempotencyKey' | 'note'>

type Props = {
  repair: Repair
  value: UnrepairedCloseoutDraft | null
  onChange: (value: UnrepairedCloseoutDraft) => void
  disabled?: boolean
}

function initialDraft(repair: Repair): UnrepairedCloseoutDraft {
  return {
    charge: { mode: 'none' },
    parts: [],
    settlement: (repair.paidAmount ?? 0) > 0 ? { kind: 'store_credit' } : { kind: 'none' },
  }
}

export function isUnrepairedCloseoutDraftComplete(repair: Repair, draft: UnrepairedCloseoutDraft) {
  if (draft.parts.length !== (repair.parts ?? []).length) return false
  if (draft.charge.mode === 'exceptional' && !draft.reason?.trim()) return false
  const preview = getPreview(repair, draft)
  if (preview.difference > 0 && !['payment', 'outstanding'].includes(draft.settlement.kind)) return false
  if (preview.difference === 0 && draft.settlement.kind !== 'none') return false
  if (preview.difference < 0 && !['refund', 'store_credit'].includes(draft.settlement.kind)) return false
  if ((draft.settlement.kind === 'payment' || draft.settlement.kind === 'refund')
      && draft.settlement.method === 'transfer' && !draft.settlement.reference?.trim()) return false
  return true
}

function getPreview(repair: Repair, draft: UnrepairedCloseoutDraft) {
  return getUnrepairedCloseoutPreview({
    chargeMode: draft.charge.mode,
    laborAmount: 'laborAmount' in draft.charge ? draft.charge.laborAmount : 0,
    exceptionalAmount: 'amount' in draft.charge ? draft.charge.amount : 0,
    paidAmount: repair.paidAmount ?? 0,
    parts: (repair.parts ?? []).map((part) => ({
      disposition: draft.parts.find((item) => item.repairPartId === String(part.id))?.disposition ?? 'restocked',
      quantity: part.quantity,
      unitPrice: part.cost,
    })),
  })
}

export function UnrepairedCloseoutPanel({ repair, value, onChange, disabled }: Props) {
  const draft = value ?? initialDraft(repair)
  const preview = getPreview(repair, draft)
  const repairParts = repair.parts ?? []
  const unresolved = repairParts.length - draft.parts.length

  const updateCharge = (mode: UnrepairedCloseoutRequest['charge']['mode']) => {
    const charge = mode === 'none' ? { mode } as const
      : mode === 'exceptional' ? { mode, amount: 0 } as const
        : { mode, laborAmount: 0 } as const
    const next = { ...draft, charge }
    onChange({ ...next, settlement: settlementForDifference(getPreview(repair, next).difference) })
  }

  const updatePart = (repairPartId: string, disposition: 'consumed' | 'restocked') => {
    const parts = [...draft.parts.filter((item) => item.repairPartId !== repairPartId), { repairPartId, disposition }]
    const next = { ...draft, parts }
    onChange({ ...next, settlement: settlementForDifference(getPreview(repair, next).difference) })
  }

  return (
    <section className="space-y-4" aria-labelledby="unrepaired-closeout-title">
      <div>
        <h3 id="unrepaired-closeout-title" className="text-sm font-semibold">Definí el cargo real</h3>
        <p className="text-xs text-muted-foreground">El presupuesto anterior no se cobrará automáticamente.</p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {([
          ['none', 'Sin cargo'], ['labor', 'Solo diagnóstico o trabajo'],
          ['labor_and_consumed_parts', 'Trabajo y repuestos consumidos'], ['exceptional', 'Importe excepcional'],
        ] as const).map(([mode, label]) => (
          <label key={mode} className={cn('flex cursor-pointer items-start gap-2 rounded-md border p-2.5 text-xs', draft.charge.mode === mode && 'border-primary bg-primary/5')}>
            <input type="radio" name="charge-mode" checked={draft.charge.mode === mode} onChange={() => updateCharge(mode)} disabled={disabled} />
            <span className="font-medium">{label}</span>
          </label>
        ))}
      </div>

      {(draft.charge.mode === 'labor' || draft.charge.mode === 'labor_and_consumed_parts') && (
        <div className="space-y-1.5">
          <Label htmlFor="unrepaired-labor">Importe de diagnóstico o trabajo</Label>
          <Input id="unrepaired-labor" type="number" min="0" value={draft.charge.laborAmount}
            onChange={(event) => {
              const next = { ...draft, charge: { ...draft.charge, laborAmount: Number(event.target.value) || 0 } }
              onChange({ ...next, settlement: settlementForDifference(getPreview(repair, next).difference) })
            }} disabled={disabled} />
        </div>
      )}
      {draft.charge.mode === 'exceptional' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5"><Label htmlFor="unrepaired-exceptional">Importe acordado</Label><Input id="unrepaired-exceptional" type="number" min="0" value={draft.charge.amount} onChange={(event) => {
            const next = { ...draft, charge: { mode: 'exceptional' as const, amount: Number(event.target.value) || 0 } }
            onChange({ ...next, settlement: settlementForDifference(getPreview(repair, next).difference) })
          }} disabled={disabled} /></div>
          <div className="space-y-1.5"><Label htmlFor="unrepaired-reason">Motivo del importe excepcional</Label><Input id="unrepaired-reason" required value={draft.reason ?? ''} onChange={(event) => onChange({ ...draft, reason: event.target.value })} disabled={disabled} /></div>
        </div>
      )}

      {repairParts.length > 0 && <div className="space-y-2">
        <h3 className="text-sm font-semibold">Resolvé los repuestos</h3>
        {repairParts.map((part) => {
          const disposition = draft.parts.find((item) => item.repairPartId === String(part.id))?.disposition
          return <div key={String(part.id)} className="rounded-md border p-3">
            <div className="mb-2 flex justify-between gap-2 text-sm"><span className="font-medium">{part.name} × {part.quantity}</span><span>{formatCurrency(part.cost * part.quantity)}</span></div>
            <div className="flex flex-wrap gap-3 text-xs">
              <label><input type="radio" name={`part-${part.id}`} checked={disposition === 'consumed'} onChange={() => updatePart(String(part.id), 'consumed')} disabled={disabled} /> Consumido o no recuperable</label>
              <label><input type="radio" name={`part-${part.id}`} checked={disposition === 'restocked'} onChange={() => updatePart(String(part.id), 'restocked')} disabled={disabled} /> Volver a inventario</label>
            </div>
            {!part.productId && disposition === 'restocked' && <p className="mt-2 text-xs text-amber-700">Quedará auditado, pero no suma stock porque no está vinculado a un producto.</p>}
          </div>
        })}
        {unresolved > 0 && <div role="alert" className="flex gap-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800"><AlertTriangle className="h-4 w-4" />Resolvé todos los repuestos ({unresolved} pendiente{unresolved === 1 ? '' : 's'}).</div>}
      </div>}

      <div className="grid grid-cols-2 gap-2 rounded-md bg-muted/40 p-3 text-xs sm:grid-cols-4">
        <Summary label="Costo anterior" value={repair.finalCost ?? repair.estimatedCost} />
        <Summary label="Adelantado" value={preview.paidAmount} />
        <Summary label="Cargo final" value={preview.finalCharge} />
        <Summary label={preview.difference < 0 ? 'A favor del cliente' : 'Pendiente'} value={Math.abs(preview.difference)} />
      </div>

      <SettlementFields draft={draft} difference={preview.difference} onChange={onChange} disabled={disabled} />
    </section>
  )
}

function settlementForDifference(difference: number): UnrepairedCloseoutDraft['settlement'] {
  if (difference > 0) return { kind: 'outstanding' }
  if (difference < 0) return { kind: 'store_credit' }
  return { kind: 'none' }
}

function Summary({ label, value }: { label: string; value: number }) {
  return <div><span className="block text-muted-foreground">{label}</span><strong>{formatCurrency(value)}</strong></div>
}

function SettlementFields({ draft, difference, onChange, disabled }: {
  draft: UnrepairedCloseoutDraft; difference: number; onChange: (value: UnrepairedCloseoutDraft) => void; disabled?: boolean
}) {
  if (difference === 0) return <div className="flex items-center gap-2 text-sm text-emerald-700"><PackageCheck className="h-4 w-4" />El cierre queda saldado.</div>
  const options = difference > 0
    ? ([['outstanding', 'Dejar saldo pendiente'], ['payment', 'Cobrar ahora']] as const)
    : ([['store_credit', 'Saldo a favor'], ['refund', 'Devolver ahora']] as const)
  return <div className="space-y-3">
    <div className="flex flex-wrap gap-3 text-sm">{options.map(([kind, label]) => <label key={kind}><input type="radio" name="settlement-kind" checked={draft.settlement.kind === kind} onChange={() => onChange({ ...draft, settlement: kind === 'payment' ? { kind, method: 'cash', amount: difference } : kind === 'refund' ? { kind, method: 'cash' } : { kind } })} disabled={disabled} /> {label}</label>)}</div>
    {(draft.settlement.kind === 'payment' || draft.settlement.kind === 'refund') && <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5"><Label htmlFor="unrepaired-method">Método</Label><select id="unrepaired-method" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={draft.settlement.method} onChange={(event) => {
        const method = event.target.value as 'cash' | 'card' | 'transfer'
        onChange({ ...draft, settlement: draft.settlement.kind === 'payment' ? { kind: 'payment', method, amount: difference, reference: '' } : { kind: 'refund', method: method === 'card' ? 'cash' : method, reference: '' } })
      }} disabled={disabled}><option value="cash">Efectivo</option>{draft.settlement.kind === 'payment' && <option value="card">Tarjeta</option>}<option value="transfer">Transferencia</option></select></div>
      {draft.settlement.method === 'transfer' && <div className="space-y-1.5"><Label htmlFor="unrepaired-reference">Referencia de transferencia</Label><Input id="unrepaired-reference" value={draft.settlement.reference ?? ''} onChange={(event) => onChange({
        ...draft,
        settlement: draft.settlement.kind === 'payment'
          ? { kind: 'payment', method: 'transfer', amount: difference, reference: event.target.value }
          : { kind: 'refund', method: 'transfer', reference: event.target.value },
      })} disabled={disabled} /></div>}
    </div>}
  </div>
}
