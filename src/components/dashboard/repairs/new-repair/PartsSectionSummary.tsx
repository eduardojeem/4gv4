'use client'

import { Calculator, Package } from 'lucide-react'
import { formatCurrency } from '@/lib/currency'

interface PartsSectionSummaryProps {
  itemCount: number
  partsSubtotal: number
  laborCost: number
  referencePrice: number
}

export function PartsSectionSummary({
  itemCount,
  partsSubtotal,
  laborCost,
  referencePrice,
}: PartsSectionSummaryProps) {
  return (
    <div className="w-full space-y-2 lg:w-auto">
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-orange-200 bg-background px-3 py-2 dark:border-orange-900/70">
          <span className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
            <Package className="h-3.5 w-3.5 text-orange-600" />
            Subtotal de repuestos
          </span>
          <strong className="mt-0.5 block text-base tabular-nums text-orange-700 dark:text-orange-300">
            {formatCurrency(partsSubtotal)}
          </strong>
          <span className="text-[10px] text-muted-foreground">
            {itemCount} {itemCount === 1 ? 'repuesto' : 'repuestos'}
          </span>
        </div>

        <div className="rounded-lg border border-primary/25 bg-primary/5 px-3 py-2">
          <span className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
            <Calculator className="h-3.5 w-3.5 text-primary" />
            Precio de referencia
          </span>
          <strong className="mt-0.5 block text-base tabular-nums text-primary">
            {formatCurrency(referencePrice)}
          </strong>
          <span className="text-[10px] text-muted-foreground">
            Incluye {formatCurrency(laborCost)} de mano de obra
          </span>
        </div>
      </div>
      <p className="text-[10px] leading-relaxed text-muted-foreground lg:text-right">
        Referencia informativa antes de descuentos; el monto a cobrar se confirma en Costos.
      </p>
    </div>
  )
}
