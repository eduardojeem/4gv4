'use client'

import { useId } from 'react'
import type { FirstInstallmentPayment } from '@/lib/credits/first-payment'

export function FirstInstallmentPaymentFields({ payment, onChange, amount, available, formatCurrency, disabled }: {
  payment?: FirstInstallmentPayment
  onChange: (payment: FirstInstallmentPayment | undefined) => void
  amount: number
  available: boolean
  formatCurrency: (value: number) => string
  disabled: boolean
}) {
  const id = useId()
  return <fieldset disabled={disabled} className="space-y-3 rounded-lg border-2 border-primary/40 bg-primary/5 p-3 sm:p-4">
    <legend className="rounded-md border border-primary/20 bg-background px-2 py-1 text-sm font-bold text-primary">Cobro al generar el crédito</legend>
    <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-md border border-primary/20 bg-background p-3 text-sm has-[:checked]:border-primary has-[:disabled]:cursor-not-allowed">
      <input type="checkbox" className="mt-1 h-4 w-4" checked={available && !!payment} disabled={!available} onChange={e => onChange(e.target.checked ? { method: 'cash', cashReceived: amount } : undefined)} />
      <span><span className="font-medium">Cobrar primera cuota ahora</span><span className="mt-1 block text-xs text-muted-foreground">{available ? 'Cancela la cuota 1, no agrega un anticipo ni modifica las cuotas restantes.' : 'Disponible si las cuotas comienzan desde el inicio del crédito.'}</span></span>
    </label>
    {available && payment && <>
      <p className="rounded-md bg-primary/10 px-3 py-2 text-sm font-semibold text-primary">Primera cuota a cobrar: {formatCurrency(amount)}</p>
      <label htmlFor={`${id}-method`} className="block text-sm">Medio de cobro de la cuota</label>
      <select id={`${id}-method`} className="h-10 w-full rounded-md border bg-background px-2" value={payment.method} onChange={e => onChange(e.target.value === 'cash' ? { method: 'cash', cashReceived: amount } : { method: 'transfer', bank: '', reference: '' })}>
        <option value="cash">Efectivo</option><option value="transfer">Transferencia</option>
      </select>
      {payment.method === 'cash' ? <>
        <label className="block text-sm" htmlFor={`${id}-received`}>Efectivo recibido para la cuota</label>
        <input id={`${id}-received`} className="h-10 w-full rounded-md border bg-background px-2" type="number" inputMode="decimal" min={0} value={payment.cashReceived ?? ''} onChange={e => onChange({ ...payment, cashReceived: Number(e.target.value) })} />
        <p className="text-sm">Vuelto de la cuota: {formatCurrency(Math.max(0, (payment.cashReceived ?? 0) - amount))}</p>
      </> : <>
        <label className="block text-sm" htmlFor={`${id}-bank`}>Banco o cuenta receptora</label>
        <input id={`${id}-bank`} className="h-10 w-full rounded-md border bg-background px-2" maxLength={120} value={payment.bank ?? ''} onChange={e => onChange({ ...payment, bank: e.target.value })} />
        <label className="block text-sm" htmlFor={`${id}-ref`}>Referencia de transferencia</label>
        <input id={`${id}-ref`} className="h-10 w-full rounded-md border bg-background px-2" maxLength={120} value={payment.reference ?? ''} onChange={e => onChange({ ...payment, reference: e.target.value })} />
      </>}
    </>}
  </fieldset>
}
