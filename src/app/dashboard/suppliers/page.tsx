'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, Download, LayoutGrid, List, Trash2, CheckCircle, XCircle, Clock, RefreshCw, FileDown, X, Scale, Truck, Info, Shield, ArrowLeft, Loader2 } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { SupplierModal } from '@/components/dashboard/supplier-modal'
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
import { Card, CardContent } from '@/components/ui/card'
import { SectionGuideButton } from '@/components/dashboard/common/SectionGuideButton'
import { SUPPLIERS_GUIDE } from '@/components/dashboard/common/section-guides-data'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Building2, TrendingUp, Package, DollarSign } from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Hero metric
// ---------------------------------------------------------------------------

type Tone = 'indigo' | 'emerald' | 'violet' | 'amber'

const toneClasses: Record<Tone, { wrap: string; iconBg: string }> = {
  indigo:  { wrap: 'from-indigo-500/10 to-transparent border-indigo-200/50 dark:border-indigo-900/50',     iconBg: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400' },
  emerald: { wrap: 'from-emerald-500/10 to-transparent border-emerald-200/50 dark:border-emerald-900/50', iconBg: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
  violet:  { wrap: 'from-violet-500/10 to-transparent border-violet-200/50 dark:border-violet-900/50',    iconBg: 'bg-violet-500/15 text-violet-600 dark:text-violet-400' },
  amber:   { wrap: 'from-amber-500/10 to-transparent border-amber-200/50 dark:border-amber-900/50',       iconBg: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' },
}

function MetricCard({
  label, value, sub, icon: Icon, tone, onClick, loading,
}: {
  label: string
  value: string | number
  sub: string
  icon: React.ComponentType<{ className?: string }>
  tone: Tone
  onClick?: () => void
  loading?: boolean
}) {
  const t = toneClasses[tone]
  const Wrapper = onClick ? 'button' : 'div'
  return (
    <Wrapper
      onClick={onClick}
      className={cn(
        'overflow-hidden rounded-2xl border bg-gradient-to-br p-5 text-left transition-all',
        t.wrap,
        onClick && 'hover:shadow-md cursor-pointer'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</p>
          {loading ? (
            <div className="mt-2 h-8 w-24 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
          ) : (
            <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-50 truncate">{value}</p>
          )}
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 truncate">{sub}</p>
        </div>
        <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', t.iconBg)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Wrapper>
  )
}

export default function SuppliersPage() {
  const router = useRouter()
  const { user, isAdmin, loading: authLoading } = useAuth()
  const canAccess = Boolean(isAdmin || user?.role === 'admin' || user?.role === 'super_admin')

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

  // Los guards van DESPUES de todos los hooks: si cortan antes, el primer
  // render (authLoading) ejecuta menos hooks que el ya resuelto y React tira
  // "Rendered more hooks than during the previous render".
  if (authLoading) {
    return (
      <div className="mx-auto flex max-w-[1480px] flex-col items-center justify-center gap-3 py-24">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
        <p className="text-sm text-slate-500">Verificando permisos de acceso...</p>
      </div>
    )
  }

  if (!canAccess) {
    return (
      <div className="flex items-center justify-center min-h-[70vh] p-6">
        <div className="max-w-md w-full text-center space-y-4 bg-card p-8 rounded-2xl border border-border shadow-lg">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
            <Shield className="h-8 w-8 text-rose-600 dark:text-rose-400" />
          </div>
          <div className="space-y-1">
            <h1 className="text-xl font-bold text-foreground">Acceso Restringido</h1>
            <p className="text-xs text-muted-foreground">
              La gestión de proveedores y costos de compra está reservada para usuarios administradores.
            </p>
          </div>
          <Button asChild className="gap-2 text-xs font-semibold rounded-xl mt-2" size="sm">
            <Link href="/dashboard">
              <ArrowLeft className="h-4 w-4" />
              Volver al Inicio
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-[1480px] flex-col gap-6">
      {/* Header */}
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400">
            <Truck className="h-3.5 w-3.5" />
            Inventario
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">Proveedores</h1>
          <p className="max-w-2xl text-sm text-slate-500 dark:text-slate-400">
            Gestión de proveedores, órdenes de compra, integraciones y comparación de precios.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!sysLoading && availableIntegrations.length > 0 && (
            <Button
              onClick={async () => {
                await syncAllSuppliers()
                toast.success('Sincronización completada')
              }}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Sincronizar
            </Button>
          )}
          <SectionGuideButton guide={SUPPLIERS_GUIDE} />
          <Button
            onClick={() => router.push('/dashboard/suppliers/compare')}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <Scale className="h-3.5 w-3.5" />
            Comparar precios
          </Button>
          <Button onClick={handleExport} variant="outline" size="sm" className="gap-2">
            <Download className="h-3.5 w-3.5" />
            Exportar
          </Button>
          <Button onClick={handleAddSupplier} size="sm" className="gap-2">
            <Plus className="h-3.5 w-3.5" />
            Nuevo proveedor
          </Button>
        </div>
      </header>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Total proveedores"
          value={stats?.total_suppliers || 0}
          sub="en el sistema"
          icon={Building2}
          tone="indigo"
          onClick={() => setStatusFilter('all')}
          loading={statsLoading}
        />
        <MetricCard
          label="Activos"
          value={stats?.active_suppliers || 0}
          sub="con operaciones recientes"
          icon={TrendingUp}
          tone="emerald"
          onClick={() => setStatusFilter('active')}
          loading={statsLoading}
        />
        <MetricCard
          label="Órdenes de compra"
          value={stats?.total_orders || 0}
          sub="histórico total"
          icon={Package}
          tone="violet"
          loading={statsLoading}
        />
        <MetricCard
          label="Monto total"
          value={formatCurrency(stats?.total_amount || 0)}
          sub="facturado a proveedores"
          icon={DollarSign}
          tone="amber"
          loading={statsLoading}
        />
      </div>

      {/* Search and Filters */}
      <div className="space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row">
          <div className="flex-1">
            <SearchBar
              value={searchInput}
              onChange={setSearchInput}
              placeholder="Buscar proveedores por nombre, email o contacto..."
              suggestions={searchSuggestions}
              showCommandHint
            />
          </div>

          {/* View Toggle como segmented control */}
          <div className="flex items-center gap-1 rounded-lg border bg-muted/30 p-1">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={cn(
                'flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors',
                viewMode === 'grid'
                  ? 'bg-background shadow-sm text-slate-900 dark:text-slate-50'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              )}
            >
              <LayoutGrid className="h-4 w-4" />
              <span className="hidden sm:inline">Cards</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={cn(
                'flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors',
                viewMode === 'list'
                  ? 'bg-background shadow-sm text-slate-900 dark:text-slate-50'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              )}
            >
              <List className="h-4 w-4" />
              <span className="hidden sm:inline">Lista</span>
            </button>
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
        <Card className="border-indigo-200 bg-indigo-50/60 p-4 dark:border-indigo-900/60 dark:bg-indigo-950/20">
          <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-full bg-indigo-100 px-3 py-1 text-xs font-bold text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-indigo-500 text-[10px] text-white">
                  {selectedIds.length}
                </span>
                seleccionado{selectedIds.length > 1 ? 's' : ''}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedIds([])}
                className="h-7 text-xs text-slate-500 hover:text-slate-700"
              >
                Limpiar
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBulkStatusChange('active')}
                className="h-8 gap-1.5 text-xs"
              >
                <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                Activos
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBulkStatusChange('inactive')}
                className="h-8 gap-1.5 text-xs"
              >
                <XCircle className="h-3.5 w-3.5 text-slate-500" />
                Inactivos
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBulkStatusChange('pending')}
                className="h-8 gap-1.5 text-xs"
              >
                <Clock className="h-3.5 w-3.5 text-amber-600" />
                Pendientes
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBulkDelete}
                className="h-8 gap-1.5 text-xs"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Eliminar
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Suppliers Display */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="flex items-center gap-3 text-slate-400">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-500 border-r-transparent" />
            <span className="text-sm">Cargando proveedores...</span>
          </div>
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
