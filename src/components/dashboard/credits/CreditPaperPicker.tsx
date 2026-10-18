'use client'

import { useState } from 'react'
import {
  CREDIT_PAPER_FORMATS,
  CREDIT_PAPER_LABELS,
  CREDIT_PRINTABLE_FIT_LABELS,
  CREDIT_PRINTABLE_FITS,
  isCreditPrintableFit,
  readCreditPrintableFit,
  writeCreditPrintableFit,
  type CreditPaperFormat,
  type CreditPrintableFit,
} from '@/lib/credits/paper'
import { cn } from '@/lib/utils'

/**
 * Selector de papel para los documentos de creditos.
 *
 * El sistema ya tenia esta eleccion en reparaciones, pero creditos imprimia
 * siempre en 80 mm: un comercio con impresora de 58 mm recibia el documento
 * cortado por los costados y uno con laser A4 recibia una tira angosta en una
 * esquina de la hoja. Se repite el mismo control para que el comerciante no
 * tenga que aprender dos formas distintas de hacer lo mismo.
 *
 * En rollo suma «Ajuste»: cada térmica imprime un ancho distinto, y si el texto
 * sale cortado a los costados se angosta el contenido. Se recuerda en este
 * equipo, como el papel, y lo leen los generadores al imprimir.
 */
export function CreditPaperPicker({
  value,
  onChange,
  className,
  label = 'Papel',
}: {
  value: CreditPaperFormat
  onChange: (format: CreditPaperFormat) => void
  className?: string
  label?: string
}) {
  const [fit, setFit] = useState<CreditPrintableFit>(() => readCreditPrintableFit())

  const changeFit = (next: string) => {
    if (!isCreditPrintableFit(next)) return
    setFit(next)
    writeCreditPrintableFit(next)
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <span className="text-xs font-medium text-muted-foreground shrink-0">{label}</span>
      <div
        role="radiogroup"
        aria-label="Formato de papel"
        className="inline-flex items-center gap-0.5 rounded-lg bg-muted/60 p-0.5"
      >
        {CREDIT_PAPER_FORMATS.map((format) => {
          const activo = format === value
          return (
            <button
              key={format}
              type="button"
              role="radio"
              aria-checked={activo}
              onClick={() => onChange(format)}
              title={CREDIT_PAPER_LABELS[format]}
              className={cn(
                'rounded-md px-2 py-1 text-xs font-semibold transition-colors',
                'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                activo
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {format}
            </button>
          )
        })}
      </div>
      {value !== 'A4' && (
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground" title="Si el ticket sale cortado a los costados, elegí uno más angosto">
          Ajuste
          <select
            value={fit}
            onChange={(event) => changeFit(event.target.value)}
            className="h-7 rounded-md border bg-background px-1.5 text-xs font-medium text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Ajuste del ancho a la impresora"
          >
            {CREDIT_PRINTABLE_FITS.map((option) => (
              <option key={option} value={option}>{CREDIT_PRINTABLE_FIT_LABELS[option]}</option>
            ))}
          </select>
        </label>
      )}
    </div>
  )
}
