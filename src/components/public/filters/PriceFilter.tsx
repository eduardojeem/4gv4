'use client'

import { DollarSign } from 'lucide-react'
import { Slider } from '@/components/ui/slider'
import { formatPrice } from '@/lib/utils'
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

interface PriceFilterProps {
  priceRange: { min: number; max: number }
  localRange: number[]
  onChange: (values: number[]) => void
  onCommit: (values: number[]) => void
}

export function PriceFilter({ priceRange, localRange, onChange, onCommit }: PriceFilterProps) {
  return (
    <AccordionItem value="price" className="border-0 px-3">
      <AccordionTrigger className="hover:no-underline py-4 text-sm font-medium">
        <span className="flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-muted-foreground" />
          Rango de Precio
        </span>
      </AccordionTrigger>
      <AccordionContent className="pb-4">
        <div className="space-y-4 px-2">
          <Slider
            min={priceRange.min}
            max={priceRange.max}
            step={5000}
            value={localRange}
            onValueChange={onChange}
            onValueCommit={onCommit}
            className="w-full"
          />
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 rounded-lg bg-muted/30 px-3 py-2 text-center">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Mínimo</div>
              <div className="text-sm font-semibold">{formatPrice(localRange[0]!)}</div>
            </div>
            <div className="text-muted-foreground">—</div>
            <div className="flex-1 rounded-lg bg-muted/30 px-3 py-2 text-center">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Máximo</div>
              <div className="text-sm font-semibold">{formatPrice(localRange[1]!)}</div>
            </div>
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  )
}
