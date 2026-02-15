'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { Search, SlidersHorizontal } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ProductCard } from '@/components/public/ProductCard'
import { ProductFilters } from '@/components/public/ProductFilters'
import { usePublicProducts } from '@/hooks/usePublicProducts'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

// Note: metadata debe estar en un componente de servidor
// Para páginas client, el SEO se manejará dinámicamente

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

  // Debounce de 300ms para la búsqueda
  useEffect(() => {
    const id = setTimeout(() => setSearchQuery(searchRaw.trim()), 300)
    return () => clearTimeout(id)
  }, [searchRaw])

  // Garantizar contenido idéntico SSR/CSR durante la hidratación
  useEffect(() => {
    setHydrated(true)
  }, [])

  const { products, totalPages, isLoading } = usePublicProducts({
    searchQuery,
    sortBy,
    filters,
    page,
    perPage: 12
  })
  const showLoading = !hydrated || isLoading

  return (
    <div className="container py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Catálogo de Productos</h1>
        <p className="mt-2 text-muted-foreground">
          Encuentra accesorios, repuestos y dispositivos
        </p>
      </div>

      {/* Search and Controls */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar productos..."
            value={searchRaw}
            onChange={(e) => setSearchRaw(e.target.value)}
            className="pl-10"
          />
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

          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowFilters(!showFilters)}
            className="sm:hidden"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Filters (Mobile Accordion / Desktop Sidebar) */}
      {showFilters && (
        <div className="mb-6 sm:hidden">
          <ProductFilters filters={filters} setFilters={setFilters} />
        </div>
      )}

      {/* Products Grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {showLoading ? (
          // Skeleton loading
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-80 animate-pulse rounded-lg bg-muted" />
          ))
        ) : products.length === 0 ? (
          <div className="col-span-full py-12 text-center">
            <p className="text-muted-foreground">No se encontraron productos</p>
          </div>
        ) : (
          products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-8 flex justify-center gap-2">
          <Button
            variant="outline"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Anterior
          </Button>
          <div className="flex items-center px-4">
            Página {page} de {totalPages}
          </div>
          <Button
            variant="outline"
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            Siguiente
          </Button>
        </div>
      )}
    </div>
  )
}
