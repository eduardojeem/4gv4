'use client'

import * as React from 'react'

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'min' | 'max'> & {
  value: number
  onValueChange: (value: number) => void
  min?: number
  max?: number
  /** Permite decimales (interés 1,5 %). Sin esto, solo enteros. */
  decimals?: boolean
  /** Qué vale el campo si se deja vacío al salir. Por defecto, el mínimo (o 0). */
  emptyValue?: number
}

const clamp = (value: number, min?: number, max?: number) => Math.min(max ?? Infinity, Math.max(min ?? -Infinity, value))

/**
 * Un campo numérico que deja escribir. Los campos que forzaban el valor en
 * cada tecla (cuotas que saltaban a 1 al borrar, un 0 pegado adelante) no
 * dejaban tipear «12» desde cero: este guarda el texto mientras se escribe,
 * avisa los números válidos y recién al salir completa o recorta.
 */
export function DraftNumberInput({ value, onValueChange, min, max, decimals = false, emptyValue, onBlur, onFocus, ...props }: Props) {
  const [draft, setDraft] = React.useState<string | null>(null)
  const shown = draft ?? (Number.isFinite(value) ? String(value).replace('.', decimals ? ',' : '.') : '')

  const parse = (text: string) => {
    const normalized = text.replace(',', '.')
    const pattern = decimals ? /^\d*\.?\d*$/ : /^\d*$/
    if (!pattern.test(normalized)) return null
    if (normalized === '' || normalized === '.') return NaN
    return Number(normalized)
  }

  return (
    <input
      {...props}
      type="text"
      inputMode={decimals ? 'decimal' : 'numeric'}
      value={shown}
      onFocus={(event) => {
        event.target.select()
        onFocus?.(event)
      }}
      onChange={(event) => {
        const parsed = parse(event.target.value)
        if (parsed === null) return
        setDraft(event.target.value)
        // Mientras escribe se avisa solo lo que ya está dentro del rango: «1» camino a «12» no se recorta.
        if (Number.isFinite(parsed) && parsed >= (min ?? -Infinity) && parsed <= (max ?? Infinity)) onValueChange(parsed)
      }}
      onBlur={(event) => {
        // Entrar y salir sin escribir no cambia nada.
        if (draft !== null) {
          const parsed = parse(draft)
          const fallback = emptyValue ?? min ?? 0
          const next = parsed === null || !Number.isFinite(parsed) ? fallback : clamp(parsed, min, max)
          if (next !== value) onValueChange(next)
        }
        setDraft(null)
        onBlur?.(event)
      }}
    />
  )
}
