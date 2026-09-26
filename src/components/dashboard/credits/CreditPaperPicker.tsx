'use client'

import { CREDIT_PAPER_FORMATS, CREDIT_PAPER_LABELS, type CreditPaperFormat } from '@/lib/credits/paper'
import { cn } from '@/lib/utils'

/**
 * Selector de papel para los documentos de creditos.
 *
 * El sistema ya tenia esta eleccion en reparaciones, pero creditos imprimia
 * siempre en 80 mm: un comercio con impresora de 58 mm recibia el documento
 * cortado por los costados y uno con laser A4 recibia una tira angosta en una
 * esquina de la hoja. Se repite el mismo control para que el comerciante no
 * tenga que aprender dos formas distintas de hacer lo mismo.
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
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span className="text-[11px] font-medium text-muted-foreground shrink-0">{label}</span>
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
                'rounded-md px-2 py-1 text-[11px] font-semibold transition-colors',
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
    </div>
  )
}
