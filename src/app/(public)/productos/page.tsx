'use client'

import { useState, useEffect, useMemo } from 'react'
import { Search, SlidersHorizontal, Loader2, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ProductCard } from '@/components/public/ProductCard'
import { ProductFilters } from '@/components/public/ProductFilters'
import { Breadcrumbs } from '@/components/public/Breadcrumbs'
import { usePublicProducts } from '@/hooks/usePublicProducts'
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

export default function ProductsPage() {
  const [searchRaw, setSearchRaw] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('name')
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState({
    category_id: '',
    min_price: 0,
    max_price: 999999,
    in_stock: false
  })
  const [page, setPage] = useState(1)
  const [hydrated, setHydrated] = useState(false)
  const [isSearching, setIsSearching] = useState(false)

  const { categories } = usePublicCategories()

  // Debounce de 300ms para la búsqueda
  useEffect(() => {
    setIsSearching(true)
    const id = setTimeout(() => {
      setSearchQuery(searchRaw.trim())
      setIsSearching(false)
    }, 300)
    return () => clearTimeout(id)
  }, [searchRaw])

  // Garantizar contenido idéntico SSR/CSR durante la hidratación
  useEffect(() => {
    setHydrated(true)
  }, [])

  // Reset page cuando cambian filtros o búsqueda
  useEffect(() => {
    setPage(1)
  }, [searchQuery, sortBy, filters])

  const { products, totalPages, isLoading, error } = usePublicProducts({
    searchQuery,
    sortBy,
    filters,
    page,
    perPage: 12
  })

  const showLoading = !hydrated || isLoading

  // Calcular rango de precios de productos
  const priceRange = useMemo(() => {
    if (products.length === 0) return { min: 0, max: 1000000 }
    const prices = products.map(p => p.sale_price)
    return {
      min: Math.floor(Math.min(...prices) / 1000) * 1000,
      max: Math.ceil(Math.max(...prices) / 1000) * 1000
    }
  }, [products])

  // Extraer marcas únicas
  const brands = useMemo(() => {
    const uniqueBrands = new Set(
      products
        .map(p => p.brand)
        .filter((brand): brand is string => !!brand)
    )
    return Array.from(uniqueBrands).sort()
  }, [products])

  // Contar filtros activos
  const activeFiltersCount = [
    filters.category_id !== '',
    filters.in_stock,
    filters.min_price !== 0 || filters.max_price !== 999999,
  ].filter(Boolean).length

  const clearSearch = () => {
    setSearchRaw('')
    setSearchQuery('')
  }

  // Scroll to top al cambiar página
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [page])

  return (
    <div className="container py-8">
      {/* Breadcrumbs */}
      <Breadcrumbs items={[{ label: 'Productos' }]} />

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
          Catálogo de Productos
        </h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Encuentra accesorios, repuestos y dispositivos para celulares
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        {/* Sidebar Filters - Desktop */}
        <aside className="hidden lg:block">
          <div className="sticky top-8">
            <ProductFilters 
              filters={filters} 
              setFilters={setFilters}
              totalProducts={products.length}
              priceRange={priceRange}
              categories={categories}
              brands={brands}
            />
          </div>
        </aside>

        {/* Main Content */}
        <div className="space-y-6">
          {/* Search and Controls */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar productos..."
                value={searchRaw}
                onChange={(e) => setSearchRaw(e.target.value)}
                className="pl-10 pr-10"
                aria-label="Buscar productos"
              />
              {searchRaw && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                  onClick={clearSearch}
                  aria-label="Limpiar búsqueda"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
              {isSearching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>

            {/* Sort and Filter */}
            <div className="flex gap-2">
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Ordenar por" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Nombre A-Z</SelectItem>
                  <SelectItem value="price_asc">Menor precio</SelectItem>
                  <SelectItem value="price_desc">Mayor precio</SelectItem>
                  <SelectItem value="newest">Más recientes</SelectItem>
                </SelectContent>
              </Select>

              {/* Mobile Filter Button */}
              <Sheet open={showFilters} onOpenChange={setShowFilters}>
                <SheetTrigger asChild>
                  <Button variant="outline" className="lg:hidden gap-2">
                    <SlidersHorizontal className="h-4 w-4" />
                    Filtros
                    {activeFiltersCount > 0 && (
                      <Badge variant="secondary" className="ml-1">
                        {activeFiltersCount}
                      </Badge>
                    )}
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[300px] overflow-y-auto">
                  <SheetHeader>
                    <SheetTitle>Filtros</SheetTitle>
                    <SheetDescription>
                      Refina tu búsqueda de productos
                    </SheetDescription>
                  </SheetHeader>
                  <div className="mt-6">
                    <ProductFilters 
                      filters={filters} 
                      setFilters={setFilters}
                      totalProducts={products.length}
                      priceRange={priceRange}
                      categories={categories}
                      brands={brands}
                    />
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>

          {/* Results Info */}
          {!showLoading && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <p>
                Mostrando <span className="font-semibold text-foreground">{products.length}</span> productos
                {searchQuery && (
                  <span> para &quot;<span className="font-semibold text-foreground">{searchQuery}</span>&quot;</span>
                )}
              </p>
              {totalPages > 1 && (
                <p>
                  Página <span className="font-semibold text-foreground">{page}</span> de{' '}
                  <span className="font-semibold text-foreground">{totalPages}</span>
                </p>
              )}
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center">
              <p className="text-sm text-destructive">
                Error al cargar productos. Por favor, intenta nuevamente.
              </p>
            </div>
          )}

          {/* Products Grid */}
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
            {showLoading ? (
              // Skeleton loading
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-[400px] animate-pulse rounded-xl bg-muted" />
              ))
            ) : products.length === 0 ? (
              <div className="col-span-full py-16 text-center">
                <div className="mx-auto max-w-md space-y-4">
                  <div className="mx-auto h-24 w-24 rounded-full bg-muted flex items-center justify-center">
                    <Search className="h-12 w-12 text-muted-foreground" />
                  </div>
                  <h3 className="text-xl font-semibold">No se encontraron productos</h3>
                  <p className="text-muted-foreground">
                    {searchQuery 
                      ? `No hay resultados para "${searchQuery}". Intenta con otros términos.`
                      : 'No hay productos que coincidan con los filtros seleccionados.'
                    }
                  </p>
                  {(searchQuery || activeFiltersCount > 0) && (
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        clearSearch()
                        setFilters({
                          category_id: '',
                          min_price: 0,
                          max_price: 999999,
                          in_stock: false
                        })
                      }}
                    >
                      Limpiar búsqueda y filtros
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              products.map((product, index) => (
                <ProductCard 
                  key={product.id} 
                  product={product}
                  priority={index < 4} // Priorizar primeras 4 imágenes
                />
              ))
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && !showLoading && (
            <div className="flex flex-col items-center gap-4 pt-8">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => setPage(1)}
                  disabled={page === 1}
                  aria-label="Primera página"
                >
                  Primera
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  aria-label="Página anterior"
                >
                  Anterior
                </Button>
                
                {/* Page Numbers */}
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum
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
                        variant={page === pageNum ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setPage(pageNum)}
                        className="w-10"
                        aria-label={`Página ${pageNum}`}
                        aria-current={page === pageNum ? 'page' : undefined}
                      >
                        {pageNum}
                      </Button>
                    )
                  })}
                </div>

                <Button
                  variant="outline"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  aria-label="Página siguiente"
                >
                  Siguiente
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setPage(totalPages)}
                  disabled={page === totalPages}
                  aria-label="Última página"
                >
                  Última
                </Button>
              </div>
              
              <p className="text-sm text-muted-foreground">
                Página {page} de {totalPages}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
