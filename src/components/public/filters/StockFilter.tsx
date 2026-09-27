'use client'

import { Package } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

interface StockFilterProps {
  inStock: boolean
  onChange: (checked: boolean) => void
}

export function StockFilter({ inStock, onChange }: StockFilterProps) {
  return (
    <AccordionItem value="stock" className="border-b border-border/50 px-2.5">
      <AccordionTrigger className="hover:no-underline py-2.5 text-xs font-semibold">
        <span className="flex items-center gap-1.5">
          <Package className="h-3.5 w-3.5 text-primary" />
          <span className="text-foreground font-semibold">Disponibilidad</span>
        </span>
      </AccordionTrigger>
      <AccordionContent className="pb-2.5">
        <div className="flex items-center justify-between rounded-lg p-2 bg-muted/30 hover:bg-muted/50 transition-colors">
          <Label
            htmlFor="in-stock"
            className="cursor-pointer text-xs font-medium flex items-center gap-1.5"
          >
            <span className={`w-1.5 h-1.5 rounded-full ${inStock ? 'bg-emerald-500' : 'bg-muted-foreground/40'}`} />
            <span>En stock</span>
          </Label>
          <Switch
            id="in-stock"
            checked={inStock}
            onCheckedChange={onChange}
            className="scale-90"
          />
        </div>
      </AccordionContent>
    </AccordionItem>
  )
}
