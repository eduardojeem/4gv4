'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search, X, Loader2, SlidersHorizontal, ChevronLeft, ChevronRight } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { ProductFilters } from '@/components/public/ProductFilters'

export function ProductSearch() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  
  const initialQuery = searchParams.get('query') || ''
  const [value, setValue] = useState(initialQuery)

  // Sync with URL if it changes externally (e.g. clear filters)
  useEffect(() => {
    setValue(searchParams.get('query') || '')
  }, [searchParams])

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (value === initialQuery) return

      const params = new URLSearchParams(searchParams.toString())
      if (value) {
        params.set('query', value)
      } else {
        params.delete('query')
      }
      params.set('page', '1') // Reset page on search

      startTransition(() => {
        router.push(`?${params.toString()}`, { scroll: false })
      })
    }, 300)

    return () => clearTimeout(timeout)
  }, [value, initialQuery, router, searchParams])

  const clearSearch = () => {
    setValue('')
    // useEffect will handle the URL update
  }

  return (
    <div className="relative w-full max-w-sm">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        placeholder="Buscar productos..."
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="pl-10 pr-10 h-10 rounded-lg bg-background"
        aria-label="Buscar productos"
      />
      {value && !isPending && (
        <Button
          variant="ghost"
          size="sm"
          className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
          onClick={clearSearch}
          aria-label="Limpiar busqueda"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
      {isPending && (
        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
      )}
    </div>
  )
}

export function ProductSort() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  
  const sort = searchParams.get('sort') || 'name'

  const handleSortChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('sort', value)
    params.set('page', '1')

    startTransition(() => {
      router.push(`?${params.toString()}`, { scroll: false })
    })
  }

  return (
    <Select value={sort} onValueChange={handleSortChange}>
      <SelectTrigger className="w-[150px] h-9 rounded-lg text-sm">
        <SelectValue placeholder="Ordenar" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="name">Nombre A-Z</SelectItem>
        <SelectItem value="price_asc">Menor precio</SelectItem>
        <SelectItem value="price_desc">Mayor precio</SelectItem>
        <SelectItem value="newest">Mas recientes</SelectItem>
      </SelectContent>
    </Select>
  )
}

interface PaginationProps {
  currentPage: number
  totalPages: number
}

export function ProductPagination({ currentPage, totalPages }: PaginationProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', page.toString())

    startTransition(() => {
      router.push(`?${params.toString()}`, { scroll: true })
    })
  }

  if (totalPages <= 1) return null

  return (
    <nav className={`flex items-center justify-center gap-1 pt-10 ${isPending ? 'opacity-60 pointer-events-none' : ''}`} aria-label="Paginacion">
      <Button
        variant="outline"
        size="icon"
        className="h-9 w-9 rounded-lg"
        onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
        disabled={currentPage === 1}
        aria-label="Pagina anterior"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
        let pageNum: number
        if (totalPages <= 5) {
          pageNum = i + 1
        } else if (currentPage <= 3) {
          pageNum = i + 1
        } else if (currentPage >= totalPages - 2) {
          pageNum = totalPages - 4 + i
        } else {
          pageNum = currentPage - 2 + i
        }

        return (
          <Button
            key={pageNum}
            variant={currentPage === pageNum ? 'default' : 'ghost'}
            size="sm"
            onClick={() => handlePageChange(pageNum)}
            className={`h-9 w-9 rounded-lg text-sm ${
              currentPage === pageNum ? '' : 'text-muted-foreground'
            }`}
            aria-label={`Pagina ${pageNum}`}
            aria-current={currentPage === pageNum ? 'page' : undefined}
          >
            {pageNum}
          </Button>
        )
      })}

      <Button
        variant="outline"
        size="icon"
        className="h-9 w-9 rounded-lg"
        onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
        disabled={currentPage === totalPages}
        aria-label="Pagina siguiente"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </nav>
  )
}

interface MobileFiltersProps {
  activeFiltersCount: number
  // Props passed down to ProductFilters
  priceRange: { min: number; max: number }
  categories: any[]
  brands: string[]
}

export function MobileFilters({ activeFiltersCount, ...props }: MobileFiltersProps) {
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="lg:hidden gap-2 rounded-lg"
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
      <SheetContent side="left" className="w-[300px] overflow-y-auto">
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

export function FilterBadges({ categories }: { categories: any[] }) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [isPending, startTransition] = useTransition()
  
    const categoryId = searchParams.get('category_id')
    const brand = searchParams.get('brand')
    
    // We only show simple badges here for common filters to avoid complexity
    // Sync with ProductFilters logic for full cleanup
    const removeFilter = (key: string) => {
        const params = new URLSearchParams(searchParams.toString())
        params.delete(key)
        params.set('page', '1')
        startTransition(() => {
            router.push(`?${params.toString()}`, { scroll: false })
        })
    }

    const clearAll = () => {
        const params = new URLSearchParams(searchParams.toString())
        params.delete('category_id')
        params.delete('brand')
        params.delete('min_price')
        params.delete('max_price')
        params.delete('in_stock')
        params.delete('query')
        params.set('page', '1')
        startTransition(() => {
            router.push(`?${params.toString()}`, { scroll: false })
        })
    }

    const hasActiveFilters = categoryId || brand // simplified check for this component

    if (!hasActiveFilters) return null

    return (
        <div className="hidden sm:flex items-center gap-1.5">
        {categoryId && (
            <Badge variant="secondary" className="gap-1 text-xs font-normal rounded-full">
            {categories.find((c) => c.id === categoryId)?.name}
            <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => removeFilter('category_id')}
            />
            </Badge>
        )}
        {brand && (
            <Badge variant="secondary" className="gap-1 text-xs font-normal rounded-full">
            {brand}
            <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => removeFilter('brand')}
            />
            </Badge>
        )}
        <button
            onClick={clearAll}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors ml-1"
        >
            Limpiar
        </button>
        </div>
    )
}
