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
      <SheetContent side="left" className="w-[92vw] max-w-sm overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Filtros</SheetTitle>
          <SheetDescription>Refina tu busqueda</SheetDescription>
        </SheetHeader>
        <div className="mt-6">
          <ProductFilters {...props} />
        </div>
      </SheetContent>
    </Sheet>
  )
}
