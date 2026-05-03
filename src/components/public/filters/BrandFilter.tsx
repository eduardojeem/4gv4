'use client'

import { Tag } from 'lucide-react'
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

interface BrandFilterProps {
  brands: string[]
  selectedBrand: string
  onSelect: (brand: string | null) => void
}

export function BrandFilter({ brands, selectedBrand, onSelect }: BrandFilterProps) {
  if (brands.length === 0) return null

  return (
    <AccordionItem value="brand" className="border-b border-border/50 px-3">
      <AccordionTrigger className="hover:no-underline py-4 text-sm font-medium">
        <span className="flex items-center gap-2">
          <Tag className="h-4 w-4 text-muted-foreground" />
          Marcas
        </span>
      </AccordionTrigger>
      <AccordionContent className="pb-4">
        <div className="space-y-1 max-h-64 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
          {brands.map((brandName) => {
            const isSelected = selectedBrand === brandName
            return (
              <button
                key={brandName}
                className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-all text-left group ${
                  isSelected
                    ? 'bg-primary text-primary-foreground shadow-sm font-medium'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
                onClick={() => onSelect(selectedBrand === brandName ? null : brandName)}
              >
                <span className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  isSelected ? 'bg-primary-foreground' : 'bg-muted-foreground/40 group-hover:bg-muted-foreground'
                }`} />
                {brandName}
              </button>
            )
          })}
        </div>
      </AccordionContent>
    </AccordionItem>
  )
}
