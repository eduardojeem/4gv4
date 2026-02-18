'use client'

import { useState, useEffect } from 'react'
import { Search, SlidersHorizontal, Loader2, X, ChevronLeft, ChevronRight } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ProductCard } from '@/components/public/ProductCard'
import { ProductFilters } from '@/components/public/ProductFilters'
import { Breadcrumbs } from '@/components/public/Breadcrumbs'
import { usePublicProducts, type ProductFiltersState } from '@/hooks/usePublicProducts'
import { usePublicCategories } from '@/hooks/usePublicCategories'
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
import useSWR from 'swr'

// Fetch all brands and price range from a lightweight endpoint
function useProductMeta() {
  const fetcher = async (url: string) => {
    const res = await fetch(url)
    if (!res.ok) return { brands: [], priceRange: { min: 0, max: 5000000 } }
    const body = await res.json()
    const products = body.data?.products ?? []
    const brands = Array.from(
      new Set(
        products
          .map((p: { brand?: string | null }) => p.brand)
          .filter((b: string | null | undefined): b is string => !!b)
      )
    ).sort() as string[]
    const prices = products.map((p: { sale_price: number }) => p.sale_price).filter((p: number) => p > 0)
    return {
      brands,
      priceRange: {
        min: prices.length > 0 ? Math.floor(Math.min(...prices) / 5000) * 5000 : 0,
        max: prices.length > 0 ? Math.ceil(Math.max(...prices) / 5000) * 5000 : 5000000,
      },
    }
  }
  const { data } = useSWR('/api/public/products?per_page=50&sort=name', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60000,
  })
  return {
    brands: data?.brands ?? [],
    priceRange: data?.priceRange ?? { min: 0, max: 5000000 },
  }
}

export default function ProductsPage() {
  const [searchRaw, setSearchRaw] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('name')
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState<ProductFiltersState>({
    category_id: '',
    brand: '',
    min_price: 0,
    max_price: 999999,
    in_stock: false,
  })
  const [page, setPage] = useState(1)
  const [hydrated, setHydrated] = useState(false)
  const [isSearching, setIsSearching] = useState(false)

  const { categories } = usePublicCategories()
  const { brands, priceRange } = useProductMeta()

  // Debounce search
  useEffect(() => {
    setIsSearching(true)
    const id = setTimeout(() => {
      setSearchQuery(searchRaw.trim())
      setIsSearching(false)
    }, 300)
    return () => clearTimeout(id)
  }, [searchRaw])

  useEffect(() => {
    setHydrated(true)
  }, [])

  // Reset page on filter/search change
  useEffect(() => {
    setPage(1)
  }, [searchQuery, sortBy, filters])

  const { products, total, totalPages, isLoading } = usePublicProducts({
    searchQuery,
    sortBy,
    filters,
    page,
    perPage: 12,
  })

  const showLoading = !hydrated || isLoading

  const activeFiltersCount = [
    filters.category_id !== '',
    filters.brand !== '',
    filters.in_stock,
    filters.min_price > 0 || filters.max_price < 999999,
  ].filter(Boolean).length

  const clearSearch = () => {
    setSearchRaw('')
    setSearchQuery('')
  }

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [page])

  return (
    <div className="min-h-screen bg-background">
      {/* Hero section */}
      <div className="border-b border-border/50 bg-muted/30">
        <div className="container py-8 lg:py-12">
          <Breadcrumbs items={[{ label: 'Productos' }]} />
          <h1 className="text-3xl font-bold tracking-tight text-foreground lg:text-4xl text-balance">
            Catalogo de Productos
          </h1>
          <p className="mt-2 text-muted-foreground max-w-lg">
            Accesorios, repuestos y dispositivos para celulares
          </p>

          {/* Search bar */}
          <div className="mt-6 flex gap-3 max-w-xl">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre, marca o SKU..."
                value={searchRaw}
                onChange={(e) => setSearchRaw(e.target.value)}
                className="pl-10 pr-10 h-11 rounded-xl bg-background"
                aria-label="Buscar productos"
              />
              {searchRaw && !isSearching && (
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
              {isSearching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="container py-6 lg:py-8">
        <div className="flex gap-8">
          {/* Sidebar - Desktop */}
          <aside className="hidden lg:block w-60 shrink-0">
            <div className="sticky top-6">
              <ProductFilters
                filters={filters}
                setFilters={setFilters}
                priceRange={priceRange}
                categories={categories}
                brands={brands}
              />
            </div>
          </aside>

          {/* Products area */}
          <div className="flex-1 min-w-0">
            {/* Toolbar */}
            <div className="flex items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                {/* Mobile filter trigger */}
                <Sheet open={showFilters} onOpenChange={setShowFilters}>
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
                      <SheetDescription>
                        Refina tu busqueda
                      </SheetDescription>
                    </SheetHeader>
                    <div className="mt-6">
                      <ProductFilters
                        filters={filters}
                        setFilters={setFilters}
                        priceRange={priceRange}
                        categories={categories}
                        brands={brands}
                      />
                    </div>
                  </SheetContent>
                </Sheet>

                {!showLoading && (
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">{total}</span>{' '}
                    {total === 1 ? 'producto' : 'productos'}
                    {searchQuery && (
                      <>
                        {' '}para{' '}
                        <span className="font-medium text-foreground">
                          &quot;{searchQuery}&quot;
                        </span>
                      </>
                    )}
                  </p>
                )}
              </div>

              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[160px] h-9 rounded-lg text-sm">
                  <SelectValue placeholder="Ordenar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Nombre A-Z</SelectItem>
                  <SelectItem value="price_asc">Menor precio</SelectItem>
                  <SelectItem value="price_desc">Mayor precio</SelectItem>
                  <SelectItem value="newest">Mas recientes</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Grid */}
            {showLoading ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="aspect-[3/4] animate-pulse rounded-2xl bg-muted"
                  />
                ))}
              </div>
            ) : products.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                  <Search className="h-7 w-7 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">
                  No se encontraron productos
                </h3>
                <p className="mt-1 text-sm text-muted-foreground max-w-sm">
                  {searchQuery
                    ? `Sin resultados para "${searchQuery}". Intenta con otros terminos.`
                    : 'No hay productos que coincidan con los filtros.'}
                </p>
                {(searchQuery || activeFiltersCount > 0) && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4 rounded-lg"
                    onClick={() => {
                      clearSearch()
                      setFilters({
                        category_id: '',
                        brand: '',
                        min_price: 0,
                        max_price: 999999,
                        in_stock: false,
                      })
                    }}
                  >
                    Limpiar busqueda y filtros
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {products.map((product, index) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    priority={index < 4}
                  />
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && !showLoading && (
              <div className="flex items-center justify-center gap-2 pt-10">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 rounded-lg"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  aria-label="Pagina anterior"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>

                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum: number
                  if (totalPages <= 5) {
                    pageNum = i + 1
                  } else if (page <= 3) {
                    pageNum = i + 1
                  } else if (page >= totalPages - 2) {
                    pageNum = totalPages - 4 + i
                  } else {
                    pageNum = page - 2 + i
                  }

                  return (
                    <Button
                      key={pageNum}
                      variant={page === pageNum ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setPage(pageNum)}
                      className={`h-9 w-9 rounded-lg text-sm ${
                        page === pageNum ? '' : 'text-muted-foreground'
                      }`}
                      aria-label={`Pagina ${pageNum}`}
                      aria-current={page === pageNum ? 'page' : undefined}
                    >
                      {pageNum}
                    </Button>
                  )
                })}

                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 rounded-lg"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  aria-label="Pagina siguiente"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
