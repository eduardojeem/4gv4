'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { SlidersHorizontal } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { ProductFilters } from '@/components/public/ProductFilters'
import type { Category } from '@/types/public'

interface MobileFiltersProps {
  activeFiltersCount: number
  priceRange: { min: number; max: number }
  categories: Category[]
  brands: string[]
  branches?: Array<{ id: string; name: string; city: string | null }>
}

export function MobileFilters({ activeFiltersCount, ...props }: MobileFiltersProps) {
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="lg:hidden gap-2 rounded-lg border-border/70 bg-background"
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filtros
          {activeFiltersCount > 0 && (
            <Badge
              variant="secondary"
              className="ml-0.5 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
            >
              {activeFiltersCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="flex w-[92vw] max-w-sm flex-col overflow-hidden">
        <SheetHeader>
          <SheetTitle>Filtros</SheetTitle>
          <SheetDescription>Elegí los criterios para encontrar productos más rápido.</SheetDescription>
        </SheetHeader>
        <div className="mt-5 flex-1 overflow-y-auto pr-1">
          <ProductFilters {...props} hideHeader />
        </div>
        <div className="border-t border-border pt-4">
          <Button type="button" className="w-full rounded-md" onClick={() => setOpen(false)}>
            Ver productos
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
