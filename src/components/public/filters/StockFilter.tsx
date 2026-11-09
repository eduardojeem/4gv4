'use client'

import { Briefcase, Flame, Package } from 'lucide-react'
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
  offers?: boolean
  onOffersChange?: (checked: boolean) => void
  wholesale?: boolean
  onWholesaleChange?: (checked: boolean) => void
}

export function StockFilter({
  inStock,
  onChange,
  offers = false,
  onOffersChange,
  wholesale = false,
  onWholesaleChange,
}: StockFilterProps) {
  return (
    <AccordionItem value="stock" className="border-b border-border/50 px-2.5">
      <AccordionTrigger className="hover:no-underline py-2.5 text-xs font-semibold">
        <span className="flex items-center gap-1.5">
          <Package className="h-3.5 w-3.5 text-primary" />
          <span className="text-foreground font-semibold">Disponibilidad y Ofertas</span>
        </span>
      </AccordionTrigger>
      <AccordionContent className="pb-2.5 space-y-1.5">
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

        {onOffersChange && (
          <div className="flex items-center justify-between rounded-lg p-2 bg-muted/30 hover:bg-muted/50 transition-colors">
            <Label
              htmlFor="filter-offers"
              className="cursor-pointer text-xs font-medium flex items-center gap-1.5 text-rose-600 dark:text-rose-400"
            >
              <Flame className="h-3.5 w-3.5 shrink-0" />
              <span>Solo ofertas</span>
            </Label>
            <Switch
              id="filter-offers"
              checked={offers}
              onCheckedChange={onOffersChange}
              className="scale-90"
            />
          </div>
        )}

        {onWholesaleChange && (
          <div className="flex items-center justify-between rounded-lg p-2 bg-muted/30 hover:bg-muted/50 transition-colors">
            <Label
              htmlFor="filter-wholesale"
              className="cursor-pointer text-xs font-medium flex items-center gap-1.5 text-sky-600 dark:text-sky-400"
            >
              <Briefcase className="h-3.5 w-3.5 shrink-0" />
              <span>Precios mayoristas</span>
            </Label>
            <Switch
              id="filter-wholesale"
              checked={wholesale}
              onCheckedChange={onWholesaleChange}
              className="scale-90"
            />
          </div>
        )}
      </AccordionContent>
    </AccordionItem>
  )
}
