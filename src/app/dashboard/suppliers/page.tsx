'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Download, LayoutGrid, List, Trash2, CheckCircle, XCircle, Clock, RefreshCw, FileUp, FileDown, X, Scale } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SupplierModal } from '@/components/dashboard/supplier-modal'
import { HeroHeader } from '@/components/suppliers/HeroHeader'
import { StatsGrid } from '@/components/suppliers/StatsCards'
import { SearchBar } from '@/components/suppliers/SearchBar'
import { FilterTags, type FilterTag } from '@/components/suppliers/FilterTags'
import { SupplierGrid } from '@/components/suppliers/SupplierGrid'
import { SupplierList } from '@/components/suppliers/SupplierList'
import { NoSuppliersFound, NoSearchResults } from '@/components/suppliers/EmptyState'
import { SupplierFilters } from '@/components/suppliers/SupplierFilters'
import { CommandPalette, useCommandPalette } from '@/components/suppliers/CommandPalette'
import { useSuppliers } from '@/hooks/use-suppliers'
import type { UISupplier } from '@/lib/types/supplier-ui'
import { useSupplierSystem } from '@/lib/integrations/inventory-suppliers'
import { exportSuppliers } from '@/lib/utils/export-suppliers'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Building2, TrendingUp, Package, DollarSign } from 'lucide-react'

export default function SuppliersPage() {
  const router = useRouter()
  const { suppliers, loading, stats, statsLoading, createSupplier, updateSupplier, deleteSupplier, bulkDeleteSuppliers, bulkUpdateStatus, refresh, pagination, setPage, setPageSize } = useSuppliers()
  const { loading: sysLoading, suppliers: availableIntegrations, syncAllSuppliers } = useSupplierSystem()

  // Command Palette
  const commandPalette = useCommandPalette()

  // View mode
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add')
  const [selectedSupplier, setSelectedSupplier] = useState<UISupplier | null>(null)

  // Filter state
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [businessTypeFilter, setBusinessTypeFilter] = useState('all')
  const [sortBy, setSortBy] = useState('name-asc')

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // Filtered and sorted suppliers
  const filteredSuppliers = useMemo(() => suppliers, [suppliers])

  // Active filter tags
  const filterTags = useMemo<FilterTag[]>(() => {
    const tags: FilterTag[] = []

    if (search) {
      tags.push({ id: 'search', label: 'Búsqueda', value: search, color: 'blue' })
    }
    if (statusFilter !== 'all') {
      tags.push({ id: 'status', label: 'Estado', value: statusFilter, color: 'green' })
    }
    if (businessTypeFilter !== 'all') {
      tags.push({ id: 'business_type', label: 'Tipo', value: businessTypeFilter, color: 'purple' })
    }

    return tags
  }, [search, statusFilter, businessTypeFilter])

  // Supplier name suggestions for search
  const searchSuggestions = useMemo(() => {
    return suppliers.map(s => s.name).slice(0, 10)
  }, [suppliers])

  useEffect(() => {
    setPage(0)
  }, [search, statusFilter, businessTypeFilter, sortBy, setPage])

  useEffect(() => {
    refresh({
      search,
      status: statusFilter,
      businessType: businessTypeFilter,
      sortBy,
      page: pagination.page,
      pageSize: pagination.pageSize,
    })
  }, [search, statusFilter, businessTypeFilter, sortBy, pagination.page, pagination.pageSize, refresh])

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 300)
    return () => clearTimeout(t)
  }, [searchInput])

  // Handlers
  const handleAddSupplier = useCallback(() => {
    setSelectedSupplier(null)
    setModalMode('add')
    setIsModalOpen(true)
  }, [])

  const handleEditSupplier = useCallback((supplier: UISupplier) => {
    setSelectedSupplier(supplier)
    setModalMode('edit')
    setIsModalOpen(true)
  }, [])

  const handleDeleteClick = (id: string) => {
    setDeleteId(id)
  }

  const handleConfirmDelete = async () => {
    if (!deleteId) return
    try {
      await deleteSupplier(deleteId)
      setDeleteId(null)
    } catch (error) {
      // Error handled in hook
    }
  }

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return
    if (confirm(`¿Estás seguro de que deseas eliminar ${selectedIds.length} proveedores?`)) {
      await bulkDeleteSuppliers(selectedIds)
      setSelectedIds([])
    }
  }

  const handleBulkStatusChange = async (status: string) => {
    if (selectedIds.length === 0) return
    await bulkUpdateStatus(selectedIds, status)
    setSelectedIds([])
  }

  const handleSaveSupplier = async (supplierData: Partial<UISupplier>) => {
    try {
      setIsSaving(true)
      if (modalMode === 'add') {
        await createSupplier(supplierData)
      } else if (selectedSupplier) {
        await updateSupplier(selectedSupplier.id, supplierData)
      }
      setIsModalOpen(false)
    } catch (error) {
      // Error handled in hook
    } finally {
      setIsSaving(false)
    }
  }

  const handleExport = useCallback(() => {
    exportSuppliers(filteredSuppliers, {
      format: 'csv',
      filename: `proveedores-${new Date().toISOString().split('T')[0]}`
    })
  }, [filteredSuppliers])

  const handleExportJSON = useCallback(() => {
    exportSuppliers(filteredSuppliers, {
      format: 'json',
      filename: `proveedores-${new Date().toISOString().split('T')[0]}`
    })
  }, [filteredSuppliers])

  const handleRemoveFilter = (id: string) => {
    if (id === 'search') setSearchInput('')
    if (id === 'status') setStatusFilter('all')
    if (id === 'business_type') setBusinessTypeFilter('all')
  }

  const handleClearAllFilters = useCallback(() => {
    setSearchInput('')
    setStatusFilter('all')
    setBusinessTypeFilter('all')
  }, [])

  // Command Palette Commands
  const commands = useMemo(() => [
    // Actions
    {
      id: 'add-supplier',
      label: 'Agregar Nuevo Proveedor',
      description: 'Crear un nuevo proveedor en el sistema',
      icon: Plus,
      action: handleAddSupplier,
      category: 'actions' as const,
      keywords: ['nuevo', 'crear', 'add']
    },
    {
      id: 'compare-prices',
      label: 'Comparar Precios',
      description: 'Comparar precios de productos entre proveedores',
      icon: Scale,
      action: () => router.push('/dashboard/suppliers/compare'),
      category: 'actions' as const,
      keywords: ['comparar', 'precios', 'compare', 'prices']
    },
    {
      id: 'export-csv',
      label: 'Exportar a CSV',
      description: 'Descargar proveedores en formato CSV',
      icon: FileDown,
      action: handleExport,
      category: 'actions' as const,
      keywords: ['exportar', 'descargar', 'csv']
    },
    {
      id: 'export-json',
      label: 'Exportar a JSON',
      description: 'Descargar proveedores en formato JSON',
      icon: FileDown,
      action: handleExportJSON,
      category: 'actions' as const,
      keywords: ['exportar', 'descargar', 'json']
    },
    {
      id: 'refresh',
      label: 'Actualizar Datos',
      description: 'Recargar la lista de proveedores',
      icon: RefreshCw,
      action: () => refresh({}),
      category: 'actions' as const,
      keywords: ['refresh', 'reload', 'actualizar']
    },
    // Filters
    {
      id: 'filter-active',
      label: 'Mostrar Solo Activos',
      description: 'Filtrar proveedores activos',
      icon: CheckCircle,
      action: () => setStatusFilter('active'),
      category: 'filters' as const,
      keywords: ['activo', 'active']
    },
    {
      id: 'filter-inactive',
      label: 'Mostrar Solo Inactivos',
      description: 'Filtrar proveedores inactivos',
      icon: XCircle,
      action: () => setStatusFilter('inactive'),
      category: 'filters' as const,
      keywords: ['inactivo', 'inactive']
    },
    {
      id: 'filter-clear',
      label: 'Limpiar Filtros',
      description: 'Remover todos los filtros activos',
      icon: X,
      action: handleClearAllFilters,
      category: 'filters' as const,
      keywords: ['limpiar', 'clear', 'reset']
    },
    // View
    {
      id: 'view-grid',
      label: 'Vista de Cards',
      description: 'Cambiar a vista de tarjetas',
      icon: LayoutGrid,
      action: () => setViewMode('grid'),
      category: 'settings' as const,
      keywords: ['grid', 'cards', 'tarjetas']
    },
    {
      id: 'view-list',
      label: 'Vista de Lista',
      description: 'Cambiar a vista de tabla',
      icon: List,
      action: () => setViewMode('list'),
      category: 'settings' as const,
      keywords: ['list', 'table', 'lista', 'tabla']
    }
  ], [handleAddSupplier, handleExport, handleExportJSON, refresh, handleClearAllFilters, router])

  const hasFilters = filterTags.length > 0

  return (
    <div className="space-y-6 p-6">
      {/* Hero Header */}
      <HeroHeader
        title="Gestión de Proveedores"
        subtitle="Optimiza tus relaciones comerciales y maximiza la eficiencia"
        stats={{
          total: stats.total_suppliers,
          active: stats.active_suppliers,
          totalOrders: stats.total_orders,
          totalAmount: stats.total_amount
        }}
        actions={
          <>
            {!sysLoading && availableIntegrations.length > 0 && (
              <Button
                onClick={async () => {
                  await syncAllSuppliers()
                  toast.success('Sincronización completada')
                }}
                variant="secondary"
                size="lg"
                className="bg-white/20 hover:bg-white/30 text-white border-white/30 backdrop-blur-sm"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Sincronizar
              </Button>
            )}
            <Button
              onClick={() => router.push('/dashboard/suppliers/compare')}
              variant="secondary"
              size="lg"
              className="bg-white/20 hover:bg-white/30 text-white border-white/30 backdrop-blur-sm"
            >
              <Scale className="h-4 w-4 mr-2" />
              Comparar Precios
            </Button>
            <Button
              onClick={handleExport}
              variant="secondary"
              size="lg"
              className="bg-white/20 hover:bg-white/30 text-white border-white/30 backdrop-blur-sm"
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
            <Button
              onClick={handleAddSupplier}
              size="lg"
              className="bg-white text-purple-600 hover:bg-gray-100 font-semibold shadow-lg hover:shadow-xl transition-all"
            >
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Proveedor
            </Button>
          </>
        }
      />

      {/* Stats Grid */}
      <StatsGrid
        loading={statsLoading}
        stats={[
          {
            icon: Building2,
            label: 'Total Proveedores',
            value: stats?.total_suppliers || 0,
            color: 'blue',
            onClick: () => setStatusFilter('all')
          },
          {
            icon: TrendingUp,
            label: 'Proveedores Activos',
            value: stats?.active_suppliers || 0,
            color: 'green',
            onClick: () => setStatusFilter('active')
          },
          {
            icon: Package,
            label: 'Total Órdenes',
            value: stats?.total_orders || 0,
            color: 'purple'
          },
          {
            icon: DollarSign,
            label: 'Monto Total',
            value: `$${(stats?.total_amount || 0).toLocaleString()}`,
            color: 'amber'
          }
        ]}
      />

      {/* Search and Filters */}
      <div className="space-y-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <SearchBar
              value={searchInput}
              onChange={setSearchInput}
              placeholder="Buscar proveedores por nombre, email o contacto..."
              suggestions={searchSuggestions}
              showCommandHint
            />
          </div>

          {/* View Toggle */}
          <div className="flex gap-2">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'outline'}
              size="lg"
              onClick={() => setViewMode('grid')}
              className="gap-2"
            >
              <LayoutGrid className="h-4 w-4" />
              <span className="hidden sm:inline">Cards</span>
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'outline'}
              size="lg"
              onClick={() => setViewMode('list')}
              className="gap-2"
            >
              <List className="h-4 w-4" />
              <span className="hidden sm:inline">Lista</span>
            </Button>
          </div>
        </div>

        {/* Filters */}
        <SupplierFilters
          search={searchInput}
          onSearchChange={setSearchInput}
          statusFilter={statusFilter}
          onStatusChange={setStatusFilter}
          businessTypeFilter={businessTypeFilter}
          onBusinessTypeChange={setBusinessTypeFilter}
          sortBy={sortBy}
          onSortChange={setSortBy}
        />

        {/* Filter Tags */}
        {hasFilters && (
          <FilterTags
            tags={filterTags}
            onRemove={handleRemoveFilter}
            onClearAll={handleClearAllFilters}
          />
        )}
      </div>

      {/* Bulk Actions Toolbar */}
      {selectedIds.length > 0 && (
        <Card className="p-4 bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <span className="font-medium text-blue-900 dark:text-blue-100">
                {selectedIds.length} proveedor{selectedIds.length > 1 ? 'es' : ''} seleccionado{selectedIds.length > 1 ? 's' : ''}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedIds([])}
                className="text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/50"
              >
                Deseleccionar
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBulkStatusChange('active')}
                className="text-green-700 dark:text-green-300 border-green-300 dark:border-green-700 hover:bg-green-50 dark:hover:bg-green-900/30"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Marcar Activos
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBulkStatusChange('inactive')}
                className="text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900/30"
              >
                <XCircle className="h-4 w-4 mr-2" />
                Marcar Inactivos
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBulkStatusChange('pending')}
                className="text-yellow-700 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700 hover:bg-yellow-50 dark:hover:bg-yellow-900/30"
              >
                <Clock className="h-4 w-4 mr-2" />
                Marcar Pendientes
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBulkDelete}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Eliminar
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Suppliers Display */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      ) : filteredSuppliers.length === 0 ? (
        hasFilters ? (
          <NoSearchResults onClearFilters={handleClearAllFilters} />
        ) : (
          <NoSuppliersFound onAddSupplier={handleAddSupplier} />
        )
      ) : viewMode === 'grid' ? (
        <SupplierGrid
          suppliers={filteredSuppliers}
          onEdit={handleEditSupplier}
          onDelete={handleDeleteClick}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
        />
      ) : (
        <SupplierList
          suppliers={filteredSuppliers}
          onEdit={handleEditSupplier}
          onDelete={handleDeleteClick}
          loading={loading}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
        />
      )}

      {/* Pagination */}
      {filteredSuppliers.length > 0 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Mostrando {pagination.page * pagination.pageSize + 1}-{Math.min((pagination.page + 1) * pagination.pageSize, pagination.total)} de {pagination.total}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(Math.max(0, pagination.page - 1))}
              disabled={pagination.page === 0 || loading}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(pagination.page + 1)}
              disabled={(pagination.page + 1) * pagination.pageSize >= pagination.total || loading}
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}

      {/* Modal */}
      <SupplierModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveSupplier}
        supplier={selectedSupplier}
        mode={modalMode}
        loading={isSaving}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Esto eliminará permanentemente al proveedor y todos sus datos asociados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-red-600 hover:bg-red-700">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Command Palette */}
      <CommandPalette
        isOpen={commandPalette.isOpen}
        onClose={commandPalette.close}
        commands={commands}
      />
    </div>
  )
}
