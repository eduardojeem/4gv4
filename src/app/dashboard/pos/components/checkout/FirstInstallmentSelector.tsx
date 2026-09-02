'use client'

import { useId, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { FIRST_INSTALLMENT_LABELS, type CreditFrequency, type FirstInstallmentTiming } from '@/lib/credits/installments'

export function FirstInstallmentSelector({ value, onChange, frequency, disabled = false }: {
  value: FirstInstallmentTiming
  onChange: (value: FirstInstallmentTiming) => void
  frequency: CreditFrequency
  disabled?: boolean
}) {
  const id = useId()
  const [expanded, setExpanded] = useState(false)
  const cycle = frequency === 'weekly' ? '7 días' : frequency === 'biweekly' ? '15 días' : 'un mes calendario'
  return (
    <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
      <button type="button" aria-expanded={expanded} aria-controls={`${id}-options`} onClick={() => setExpanded(!expanded)} className="flex min-h-11 w-full items-center justify-between gap-2 rounded-lg p-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <span className="min-w-0 text-xs"><span className="block font-semibold text-amber-900 dark:text-amber-200">¿Cuándo vence la primera cuota?</span><span className="mt-0.5 block text-muted-foreground">{FIRST_INSTALLMENT_LABELS[value]}</span></span>
        <ChevronDown aria-hidden="true" className={`h-4 w-4 shrink-0 text-amber-800 dark:text-amber-200 ${expanded ? 'rotate-180' : ''}`} />
      </button>
    <fieldset id={`${id}-options`} hidden={!expanded} disabled={disabled} className="space-y-1.5 border-t border-amber-300 dark:border-amber-800 p-2.5" aria-describedby={`${id}-help`}>
      <legend className="sr-only">Inicio de cuotas</legend>
      {(['at_start', 'next_cycle'] as const).map(option => (
        <label key={option} className="flex min-h-11 cursor-pointer items-start gap-2 rounded-md border bg-background px-2.5 py-2 text-foreground has-[:checked]:border-primary has-[:checked]:bg-primary/5 has-[:disabled]:cursor-not-allowed">
          <input className="mt-1 h-4 w-4 accent-current" type="radio" name={id} value={option} checked={value === option} onChange={() => onChange(option)} />
          <span className="min-w-0 text-xs leading-relaxed">
            <span className="block font-medium">{FIRST_INSTALLMENT_LABELS[option]}{option === 'at_start' ? ' (predeterminado)' : ''}</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">{option === 'at_start'
              ? 'La primera cuota vence el día de inicio. Las siguientes vencen según la frecuencia elegida.'
              : `La primera cuota vence ${cycle} después del inicio. Se desplaza el calendario; no cambia el total ni la cantidad de cuotas.`}</span>
          </span>
        </label>
      ))}
      <p id={`${id}-help`} className="text-xs text-muted-foreground">Acordá esta opción con el cliente. Vencer hoy no significa estar pagada: la cuota queda pendiente hasta registrar el cobro, separado de la entrega inicial.</p>
    </fieldset>
    </div>
  )
}
