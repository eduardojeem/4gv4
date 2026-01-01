'use client'

import { useState, useCallback, useMemo, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Plus, Download, RefreshCw, AlertTriangle, Search, Filter, LayoutGrid, LayoutList, Package2 } from 'lucide-react'
import { useProductsSupabase } from '@/hooks/useProductsSupabase'
import { ProductModal } from '@/components/dashboard/product-modal'
import { ProductDetailsDialogV2 } from '@/components/dashboard/product-details-dialog-v2'
import { toast } from 'sonner'
import { ProductFilters } from '@/components/dashboard/product-filters'
import { ProductTable } from '@/components/dashboard/products-modern/ProductTable'
import { ProductGrid } from '@/components/dashboard/products-modern/ProductGrid'
import { ProductStats } from '@/components/dashboard/products/product-stats'
import { ProductQuickActions } from '@/components/dashboard/products/product-quick-actions'
import { ProductAlerts } from '@/components/dashboard/products/product-alerts'
import { Product, Category, Supplier } from '@/types/products'
import { SortConfig } from '@/types/products-dashboard'
import type { Database } from '@/lib/supabase/types'
type Json = Database['public']['Tables']['products']['Row']['dimensions']
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'

export default function ProductsPage() {
  const { user, loading: authLoading } = useAuth()
  const {
    products,
    categories,
    suppliers,
    alerts,
    loading,
    error,
    createProduct,
    updateProduct,
    deleteProduct,
    refreshData,
    exportToCSV,
    updateStock
  } = useProductsSupabase({ enabled: !!user && !authLoading })

  const router = useRouter()

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login')
    }
  }, [authLoading, user, router])

  const [isPending, startTransition] = useTransition()
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table')
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([])
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [viewProduct, setViewProduct] = useState<Product | null>(null)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [sortConfig, setSortConfig] = useState<SortConfig>({ field: 'name', direction: 'asc' })

  // Initialize filtered products
  useEffect(() => {
    if (products) {
      // Preserve current filter if just refreshing data
      if (filteredProducts.length === 0 && searchQuery === '') {
        setFilteredProducts(products)
      }
    }
  }, [products])

  // Handler for filter changes
  const handleFiltersChange = useCallback((filtered: Product[]) => {
    setFilteredProducts(filtered)
  }, [])

  // Apply search filtering
  const searchFilteredProducts = useMemo(() => {
    let result = filteredProducts

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      result = result.filter(product =>
        product.name.toLowerCase().includes(query) ||
        product.sku?.toLowerCase().includes(query) ||
        product.description?.toLowerCase().includes(query)
      )
    }

    // Apply sorting
    return [...result].sort((a, b) => {
      const aValue = a[sortConfig.field as keyof Product]
      const bValue = b[sortConfig.field as keyof Product]

      if (aValue === bValue) return 0

      // Handle null/undefined values
      if (aValue == null && bValue == null) return 0
      if (aValue == null) return 1
      if (bValue == null) return -1

      const comparison = aValue > bValue ? 1 : -1
      return sortConfig.direction === 'asc' ? comparison : -comparison
    })
  }, [filteredProducts, searchQuery, sortConfig])

  const handleSort = (field: SortConfig['field']) => {
    setSortConfig(current => ({
      field,
      direction: current.field === field && current.direction === 'asc' ? 'desc' : 'asc'
    }))
  }

  const handleProductEdit = (product: Product) => {
    setEditingProduct(product)
  }

  const handleProductDelete = async (product: Product) => {
    if (confirm('¿Estás seguro de eliminar este producto?')) {
      await deleteProduct(product.id)
      toast.success('Producto eliminado')
    }
  }

  const handleProductDuplicate = async (product: Product) => {
    const { id, created_at, updated_at, ...rest } = product
    const duplicateData = {
      ...rest,
      name: `${product.name} (Copia)`,
      sku: `${product.sku}-COPY`,
      dimensions: product.dimensions as Json | null
    }
    await createProduct(duplicateData)
    toast.success('Producto duplicado')
  }

  const handleViewDetails = (product: Product) => {
    setViewProduct(product)
  }

  const handleQuickStockChange = async (productId: string, delta: number) => {
    const res = await updateStock(productId, delta, 'adjustment', 'Cambio rápido desde detalles')
    if (res.success) {
      toast.success('Stock actualizado')
    } else {
      toast.error(res.error || 'Error actualizando stock')
    }
  }

  const handleExport = async () => {
    const result = await exportToCSV()
    if (result.success) {
      toast.success('Productos exportados correctamente')
    } else {
      toast.error(result.error || 'Error al exportar')
    }
  }

  const handleSelectAll = (selected: boolean) => {
    setSelectedProducts(selected ? searchFilteredProducts.map(p => p.id) : [])
  }

  const handleSelect = (id: string) => {
    setSelectedProducts(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    )
  }

  if (authLoading || !user) return null

  if (error) {
    return (
      <div className="p-8 text-center">
        <Card className="max-w-md mx-auto border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="mb-4 flex justify-center">
              <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
            </div>
            <h3 className="text-lg font-semibold text-red-900 mb-2">Error cargando productos</h3>
            <p className="text-sm text-red-700 mb-4">{error}</p>
            <Button onClick={refreshData} variant="outline" className="border-red-200 text-red-700 hover:bg-red-100">
              <RefreshCw className="mr-2 h-4 w-4" />
              Intentar de nuevo
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50/50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-[1800px] mx-auto space-y-6">
        {/* Modern Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-gray-900 via-gray-800 to-gray-700 bg-clip-text text-transparent">
              Gestión de Productos
            </h1>
            <p className="text-sm text-gray-600 mt-1 flex items-center gap-2">
              <Package2 className="h-4 w-4" />
              {products.length} productos en inventario
            </p>
          </div>

          <Button
            size="lg"
            onClick={() => setCreateModalOpen(true)}
            className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-lg shadow-blue-500/30 transition-all duration-200"
          >
            <Plus className="h-5 w-5 mr-2" />
            Nuevo Producto
          </Button>
        </div>

        {/* Search and Actions Bar */}
        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Buscar por nombre, SKU o marca..."
                  value={searchQuery}
                  onChange={(e) => startTransition(() => setSearchQuery(e.target.value))}
                  className="pl-10 h-11 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="default"
                  onClick={() => setFiltersOpen(!filtersOpen)}
                  className={filtersOpen ? 'bg-blue-50 border-blue-200' : ''}
                >
                  <Filter className="h-4 w-4 mr-2" />
                  Filtros
                </Button>

                <div className="flex items-center gap-1 border rounded-lg p-1 bg-gray-50">
                  <Button
                    variant={viewMode === 'table' ? 'secondary' : 'ghost'}
                    size="icon"
                    onClick={() => setViewMode('table')}
                    title="Vista de tabla"
                  >
                    <LayoutList className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                    size="icon"
                    onClick={() => setViewMode('grid')}
                    title="Vista de cuadrícula"
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </Button>
                </div>

                <Button
                  variant="outline"
                  size="icon"
                  onClick={refreshData}
                  disabled={loading || isPending}
                  title="Actualizar"
                >
                  <RefreshCw className={`h-4 w-4 ${(loading || isPending) ? 'animate-spin' : ''}`} />
                </Button>

                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleExport}
                  title="Exportar"
                >
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Modular Components */}
        <ProductStats products={products} />

        <ProductAlerts
          alerts={alerts}
          products={products}
          onFilterChange={setFilteredProducts}
        />

        <ProductQuickActions
          products={products}
          onFilterChange={setFilteredProducts}
        />

        {/* Product List Container */}
        <div className="space-y-4">
          {/* Collapsible Filters */}
          {filtersOpen && (
            <Card className="border-0 shadow-md">
              <CardContent className="p-6">
                <ProductFilters
                  products={products}
                  onFiltersChange={handleFiltersChange}
                />
              </CardContent>
            </Card>
          )}

          {/* Product Views */}
          {viewMode === 'table' ? (
            <ProductTable
              products={searchFilteredProducts}
              selectedProductIds={selectedProducts}
              sortConfig={sortConfig}
              onSort={handleSort}
              onSelectAll={handleSelectAll}
              onSelect={handleSelect}
              onEdit={handleProductEdit}
              onDelete={handleProductDelete}
              onDuplicate={handleProductDuplicate}
              onViewDetails={handleViewDetails}
              loading={loading || isPending}
            />
          ) : (
            <ProductGrid
              products={searchFilteredProducts}
              selectedProductIds={selectedProducts}
              onProductSelect={handleSelect}
              onProductEdit={handleProductEdit}
              onProductDelete={handleProductDelete}
              onProductDuplicate={handleProductDuplicate}
              onProductViewDetails={handleViewDetails}
              loading={loading || isPending}
            />
          )}
        </div>
      </div>

      {/* Product Modal */}
      {(editingProduct || createModalOpen) && (
        <ProductModal
          isOpen={true}
          onClose={() => {
            setEditingProduct(null)
            setCreateModalOpen(false)
          }}
          product={editingProduct}
          categories={categories as unknown as Category[]}
          suppliers={suppliers as unknown as Supplier[]}
          onSave={async (data) => {
            if (editingProduct) {
              // Convertir ProductFormData a formato compatible con Supabase
              const supabaseData: Database['public']['Tables']['products']['Update'] = {
                ...data,
                dimensions: data.dimensions as Json | null
              }
              await updateProduct(editingProduct.id, supabaseData)
              toast.success('Producto actualizado')
            } else {
              // Convertir ProductFormData a formato compatible con Supabase para crear
              const supabaseData = {
                ...data,
                dimensions: data.dimensions as Json | null
              }
              await createProduct(supabaseData)
              toast.success('Producto creado')
            }
            setEditingProduct(null)
            setCreateModalOpen(false)
          }}
        />
      )}

      {viewProduct && (
        <ProductDetailsDialogV2
          open={!!viewProduct}
          product={viewProduct}
          onClose={() => setViewProduct(null)}
          onEdit={(p) => {
            setViewProduct(null)
            setEditingProduct(p)
          }}
          onQuickStockChange={handleQuickStockChange}
        />
      )}
    </div>
  )
}
