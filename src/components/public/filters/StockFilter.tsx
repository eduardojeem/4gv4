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
    <AccordionItem value="stock" className="border-b border-border/50 px-3">
      <AccordionTrigger className="hover:no-underline py-4 text-sm font-medium">
        <span className="flex items-center gap-2">
          <Package className="h-4 w-4 text-muted-foreground" />
          Disponibilidad
        </span>
      </AccordionTrigger>
      <AccordionContent className="pb-4">
        <div className="flex items-center justify-between rounded-lg p-3 bg-muted/30 hover:bg-muted/50 transition-colors">
          <Label
            htmlFor="in-stock"
            className="cursor-pointer text-sm font-medium flex items-center gap-2"
          >
            <span className={`w-2 h-2 rounded-full ${inStock ? 'bg-green-500' : 'bg-muted-foreground/40'}`} />
            Solo productos en stock
          </Label>
          <Switch
            id="in-stock"
            checked={inStock}
            onCheckedChange={onChange}
          />
        </div>
      </AccordionContent>
    </AccordionItem>
  )
}
