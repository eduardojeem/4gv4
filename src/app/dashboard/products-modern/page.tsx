/**
 * Modern Products Dashboard Page
 * Redesigned products management interface
 */

'use client'

import React, { useState, useTransition } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useProductsSupabase } from '@/hooks/useProductsSupabase'
import { useProductsDashboard } from '@/hooks/useProductsDashboard'
import { ProductModal } from '@/components/dashboard/product-modal'
import { toast } from 'sonner'
import type { Product } from '@/types/product-unified'
import {
  MetricsGrid,
  SearchAndActionsBar,
  QuickFiltersBar,
  FilterPanel,
  ProductGrid,
  ProductTable,
  BulkActionsToolbar
} from '@/components/dashboard/products-modern'
import { exportProductsToCSV, downloadCSV } from '@/lib/products-dashboard-utils'

export default function ModernProductsPage() {
  const {
    products,
    categories,
    suppliers,
    alerts,
    loading,
    createProduct,
    updateProduct,
    deleteProduct,
    refreshData,
  } = useProductsSupabase()

  const {
    displayedProducts,
    metrics,
    viewMode,
    setViewMode,
    searchQuery,
    filters,
    sortConfig,
    selectedProductIds,
    isFilterPanelOpen,
    setIsFilterPanelOpen,
    handleSearch,
    handleFilterChange,
    handleQuickFilter,
    handleSort,
    handleSelectProduct,
    handleSelectAll,
    clearFilters,
    clearSelection
  } = useProductsDashboard({
    products,
    categories,
    suppliers,
    alerts
  })

  const [isPending, startTransition] = useTransition()
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [createModalOpen, setCreateModalOpen] = useState(false)

  // Handle product actions
  const handleProductEdit = (product: Product) => {
    setEditingProduct(product)
  }

  const handleProductDelete = async (product: Product) => {
    if (confirm(`¿Estás seguro de eliminar "${product.name}"?`)) {
      const result = await deleteProduct(product.id)
      if (result.success) {
        toast.success('Producto eliminado')
        clearSelection()
      } else {
        toast.error(result.error || 'Error al eliminar')
      }
    }
  }

  const handleProductDuplicate = async (product: Product) => {
    const duplicatedData = {
      ...product,
      sku: `DUP-${product.sku}`,
      name: `${product.name} (Copia)`
    }
    
    const result = await createProduct(duplicatedData)
    if (result.success) {
      toast.success('Producto duplicado')
    } else {
      toast.error(result.error || 'Error al duplicar')
    }
  }

  const handleProductViewDetails = (product: Product) => {
    // TODO: Navigate to product details page
    toast.info(`Ver detalles de: ${product.name}`)
  }

  // Handle export
  const handleExport = () => {
    startTransition(() => {
      const csv = exportProductsToCSV(displayedProducts)
      if (csv) {
        downloadCSV(csv, `productos-${new Date().toISOString().split('T')[0]}.csv`)
        toast.success(`${displayedProducts.length} productos exportados`)
      } else {
        toast.error('No hay productos para exportar')
      }
    })
  }

  // Handle refresh
  const handleRefresh = async () => {
    await refreshData()
    toast.success('Datos actualizados')
  }

  // Handle bulk operations
  const handleBulkDelete = async () => {
    const selectedProducts = products.filter(p => selectedProductIds.includes(p.id))
    
    let successCount = 0
    let errorCount = 0

    for (const product of selectedProducts) {
      const result = await deleteProduct(product.id)
      if (result.success) {
        successCount++
      } else {
        errorCount++
      }
    }

    if (successCount > 0) {
      toast.success(`${successCount} ${successCount === 1 ? 'producto eliminado' : 'productos eliminados'}`)
    }
    if (errorCount > 0) {
      toast.error(`Error al eliminar ${errorCount} ${errorCount === 1 ? 'producto' : 'productos'}`)
    }

    clearSelection()
  }

  const handleBulkActivate = async () => {
    const selectedProducts = products.filter(p => selectedProductIds.includes(p.id))
    
    let successCount = 0
    let errorCount = 0

    for (const product of selectedProducts) {
      const result = await updateProduct(product.id, { is_active: true })
      if (result.success) {
        successCount++
      } else {
        errorCount++
      }
    }

    if (successCount > 0) {
      toast.success(`${successCount} ${successCount === 1 ? 'producto activado' : 'productos activados'}`)
    }
    if (errorCount > 0) {
      toast.error(`Error al activar ${errorCount} ${errorCount === 1 ? 'producto' : 'productos'}`)
    }

    clearSelection()
  }

  const handleBulkDeactivate = async () => {
    const selectedProducts = products.filter(p => selectedProductIds.includes(p.id))
    
    let successCount = 0
    let errorCount = 0

    for (const product of selectedProducts) {
      const result = await updateProduct(product.id, { is_active: false })
      if (result.success) {
        successCount++
      } else {
        errorCount++
      }
    }

    if (successCount > 0) {
      toast.success(`${successCount} ${successCount === 1 ? 'producto desactivado' : 'productos desactivados'}`)
    }
    if (errorCount > 0) {
      toast.error(`Error al desactivar ${errorCount} ${errorCount === 1 ? 'producto' : 'productos'}`)
    }

    clearSelection()
  }

  const handleBulkExport = () => {
    const selectedProducts = products.filter(p => selectedProductIds.includes(p.id))
    startTransition(() => {
      const csv = exportProductsToCSV(selectedProducts)
      if (csv) {
        downloadCSV(csv, `productos-seleccionados-${new Date().toISOString().split('T')[0]}.csv`)
        toast.success(`${selectedProducts.length} productos exportados`)
      } else {
        toast.error('No hay productos para exportar')
      }
    })
  }

  // Handle metric click
  const handleMetricClick = (metric: 'all' | 'low_stock' | 'out_of_stock' | 'value') => {
    switch (metric) {
      case 'all':
        handleQuickFilter('all')
        toast.info(`Mostrando todos los productos (${products.length})`)
        break
      case 'low_stock':
        handleQuickFilter('low_stock')
        toast.info(`Mostrando productos con bajo stock`)
        break
      case 'out_of_stock':
        handleQuickFilter('out_of_stock')
        toast.warning(`Mostrando productos agotados`)
        break
      case 'value':
        handleQuickFilter('all')
        toast.info('Mostrando valor total del inventario')
        break
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50/50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-[1800px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-gray-900 via-gray-800 to-gray-700 bg-clip-text text-transparent">
              Gestión de Productos
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Dashboard moderno y funcional
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

        {/* Metrics Grid */}
        <MetricsGrid
          metrics={metrics}
          onMetricClick={handleMetricClick}
        />

        {/* Search and Actions Bar */}
        <SearchAndActionsBar
          searchQuery={searchQuery}
          onSearchChange={handleSearch}
          isFilterPanelOpen={isFilterPanelOpen}
          onToggleFilters={() => setIsFilterPanelOpen(!isFilterPanelOpen)}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onRefresh={handleRefresh}
          onExport={handleExport}
          isLoading={loading || isPending}
        />

        {/* Quick Filters Bar */}
        <QuickFiltersBar
          products={products}
          activeFilter={filters.quick_filter}
          onFilterClick={handleQuickFilter}
        />

        {/* Filter Panel (Collapsible) */}
        {isFilterPanelOpen && (
          <Card className="border-0 shadow-md">
            <div className="p-6">
              <FilterPanel
                isOpen={isFilterPanelOpen}
                products={products}
                categories={categories}
                suppliers={suppliers}
                filters={filters}
                onFiltersChange={handleFilterChange}
                onClearFilters={clearFilters}
              />
            </div>
          </Card>
        )}

        {/* Products Display */}
        <Card className="border-0 shadow-md">
          <div className="p-6">
            {viewMode === 'grid' ? (
              <ProductGrid
                products={displayedProducts}
                selectedProductIds={selectedProductIds}
                onProductSelect={handleSelectProduct}
                onProductEdit={handleProductEdit}
                onProductDelete={handleProductDelete}
                onProductDuplicate={handleProductDuplicate}
                onProductViewDetails={handleProductViewDetails}
                loading={loading || isPending}
              />
            ) : (
              <ProductTable
                products={displayedProducts}
                selectedProductIds={selectedProductIds}
                sortConfig={sortConfig}
                onSort={handleSort}
                onSelectAll={handleSelectAll}
                onSelect={handleSelectProduct}
                onEdit={handleProductEdit}
                onDelete={handleProductDelete}
                onDuplicate={handleProductDuplicate}
                onViewDetails={handleProductViewDetails}
                loading={loading || isPending}
              />
            )}
          </div>
        </Card>

        {/* Bulk Actions Toolbar */}
        <BulkActionsToolbar
          selectedCount={selectedProductIds.length}
          onClearSelection={clearSelection}
          onBulkDelete={handleBulkDelete}
          onBulkActivate={handleBulkActivate}
          onBulkDeactivate={handleBulkDeactivate}
          onBulkExport={handleBulkExport}
        />
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
          categories={categories as any}
          suppliers={suppliers as any}
          onSave={async (data) => {
            if (editingProduct) {
              const result = await updateProduct(editingProduct.id, data)
              if (result.success) {
                toast.success('Producto actualizado')
              } else {
                toast.error(result.error || 'Error al actualizar')
              }
            } else {
              const result = await createProduct(data)
              if (result.success) {
                toast.success('Producto creado')
              } else {
                toast.error(result.error || 'Error al crear')
              }
            }
            setEditingProduct(null)
            setCreateModalOpen(false)
          }}
        />
      )}
    </div>
  )
}
