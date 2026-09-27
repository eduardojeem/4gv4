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
    <AccordionItem value="price" className="border-0 px-2.5">
      <AccordionTrigger className="hover:no-underline py-2.5 text-xs font-semibold">
        <span className="flex items-center gap-1.5">
          <DollarSign className="h-3.5 w-3.5 text-primary" />
          <span className="text-foreground font-semibold">Rango de Precio</span>
        </span>
      </AccordionTrigger>
      <AccordionContent className="pb-2.5">
        <div className="space-y-3 px-1">
          <Slider
            min={priceRange.min}
            max={priceRange.max}
            step={5000}
            value={localRange}
            onValueChange={onChange}
            onValueCommit={onCommit}
            className="w-full py-1"
          />
          <div className="flex items-center justify-between gap-1.5">
            <div className="flex-1 rounded-lg bg-muted/40 px-2 py-1.5 text-center">
              <div className="text-[9px] text-muted-foreground uppercase tracking-wide">Mín</div>
              <div className="text-xs font-bold">{formatPrice(localRange[0]!)}</div>
            </div>
            <div className="text-muted-foreground text-xs">—</div>
            <div className="flex-1 rounded-lg bg-muted/40 px-2 py-1.5 text-center">
              <div className="text-[9px] text-muted-foreground uppercase tracking-wide">Máx</div>
              <div className="text-xs font-bold">{formatPrice(localRange[1]!)}</div>
            </div>
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  )
}
