'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence  } from '../../../components/ui/motion'
import {
  Plus, Download, LayoutGrid, List, Trash2,
  CheckCircle, XCircle, RefreshCw, FolderTree,
  MoreHorizontal
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { RouteGuard } from '@/components/auth/permission-guard'

// Hooks & Utils
import { useCategories, type Category } from '@/hooks/useCategories'
import { computeCategoryStats } from '@/hooks/use-category-stats'
import { exportCategories } from '@/lib/utils/export-categories'

// Components
import { HeroHeader } from '@/components/suppliers/HeroHeader'
import { StatsGrid } from '@/components/suppliers/StatsCards'
import { SearchBar } from '@/components/suppliers/SearchBar'
import { FilterTags } from '@/components/suppliers/FilterTags'
import { EmptyState } from '@/components/suppliers/EmptyState'
import { CommandPalette } from '@/components/suppliers/CommandPalette'
import { CategoryGrid } from '@/components/categories/CategoryCard'
import { CategoryListView } from '@/components/categories/CategoryListView'
import { CategoryTreeViewImproved } from '@/components/categories/CategoryTreeViewImproved'
import { CategoryModal } from '@/components/categories/CategoryModal'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export default function CategoriesPage() {
  // Hooks
  const {
    categories,
    loading,
    error,
    filters,
    setFilters,
    fetchCategories,
    createCategory,
    updateCategory,
    deleteCategory
  } = useCategories()

  // Local State
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'tree'>('grid')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | undefined>(undefined)
  const [initialParentId, setInitialParentId] = useState<string | null>(null)
  const [isCommandOpen, setIsCommandOpen] = useState(false)

  // Derived State
  const stats = useMemo(() => computeCategoryStats(categories), [categories])

  const filteredCategories = useMemo(() => {
    const term = (filters.search || '').toLowerCase()
    return categories.filter(c => {
      const matchesSearch = !term ||
        c.name.toLowerCase().includes(term) ||
        (c.description || '').toLowerCase().includes(term)

      const matchesStatus = filters.isActive === undefined || c.is_active === filters.isActive

      return matchesSearch && matchesStatus
    })
  }, [categories, filters])

  // Stats Cards Data
  const statCards = useMemo(() => [
    {
      icon: LayoutGrid,
      label: 'Total Categorías',
      value: stats.total_categories,
      color: 'blue' as const,
      trend: { value: 12, isPositive: true } // Placeholder trend
    },
    {
      icon: CheckCircle,
      label: 'Activas',
      value: stats.active_categories,
      color: 'green' as const,
      trend: { value: 5, isPositive: true }
    },
    {
      icon: XCircle,
      label: 'Inactivas',
      value: stats.inactive_categories,
      color: 'red' as const,
      trend: { value: -2, isPositive: false }
    },
    {
      icon: FolderTree,
      label: 'Subcategorías',
      value: stats.total_subcategories,
      color: 'purple' as const
    }
  ], [stats])

  // Handlers
  const handleEdit = (category: Category) => {
    setEditingCategory(category)
    setInitialParentId(null)
    setIsModalOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar esta categoría?')) return

    const res = await deleteCategory(id)
    if (res.success) {
      toast.success('Categoría eliminada')
      if (selectedIds.includes(id)) {
        setSelectedIds(prev => prev.filter(i => i !== id))
      }
    } else {
      toast.error(res.error)
    }
  }

  const handleToggleActive = async (id: string, isActive: boolean) => {
    const res = await updateCategory(id, { is_active: !isActive })
    if (res.success) {
      toast.success(`Categoría ${!isActive ? 'activada' : 'desactivada'}`)
    } else {
      toast.error(res.error)
    }
  }

  const handleBulkDelete = async () => {
    if (!confirm(`¿Eliminar ${selectedIds.length} categorías seleccionadas?`)) return

    let successCount = 0
    for (const id of selectedIds) {
      const res = await deleteCategory(id)
      if (res.success) successCount++
    }

    if (successCount > 0) {
      toast.success(`${successCount} categorías eliminadas`)
      setSelectedIds([])
    }
  }

  const handleBulkToggle = async (active: boolean) => {
    let successCount = 0
    for (const id of selectedIds) {
      const res = await updateCategory(id, { is_active: active })
      if (res.success) successCount++
    }

    if (successCount > 0) {
      toast.success(`${successCount} categorías actualizadas`)
      setSelectedIds([])
    }
  }

  const handleModalSubmit = async (data: any) => {
    if (editingCategory) {
      const res = await updateCategory(editingCategory.id, data)
      if (res.success) {
        toast.success('Categoría actualizada')
        return Promise.resolve()
      } else {
        toast.error(res.error)
        return Promise.reject()
      }
    } else {
      const res = await createCategory(data)
      if (res.success) {
        toast.success('Categoría creada')
        return Promise.resolve()
      } else {
        toast.error(res.error)
        return Promise.reject()
      }
    }
  }

  const handleExport = (format: 'csv' | 'json') => {
    exportCategories(categories, { format })
    toast.info(`Exportando categorías a ${format.toUpperCase()}...`)
  }

  // Command Palette Configuration
  const commands = useMemo(() => [
    {
      id: 'new-category',
      label: 'Nueva Categoría',
      icon: Plus,
      action: () => {
        setEditingCategory(undefined)
        setIsModalOpen(true)
      },
      category: 'actions' as const,
      keywords: ['crear', 'agregar', 'nueva']
    },
    {
      id: 'export-csv',
      label: 'Exportar CSV',
      icon: Download,
      action: () => handleExport('csv'),
      category: 'actions' as const,
      keywords: ['descargar', 'csv', 'excel']
    },
    {
      id: 'export-json',
      label: 'Exportar JSON',
      icon: Download,
      action: () => handleExport('json'),
      category: 'actions' as const,
      keywords: ['descargar', 'json']
    },
    {
      id: 'view-grid',
      label: 'Vista Cuadrícula',
      icon: LayoutGrid,
      action: () => setViewMode('grid'),
      category: 'navigation' as const,
      keywords: ['vista', 'cuadrícula', 'grid']
    },
    {
      id: 'view-list',
      label: 'Vista Lista',
      icon: List,
      action: () => setViewMode('list'),
      category: 'navigation' as const,
      keywords: ['vista', 'lista', 'list']
    },
    {
      id: 'view-tree',
      label: 'Vista Árbol',
      icon: FolderTree,
      action: () => setViewMode('tree'),
      category: 'navigation' as const,
      keywords: ['vista', 'árbol', 'tree']
    }
  ], [categories, handleExport])

  // Keyboard Shortcuts
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setIsCommandOpen((open: boolean) => !open)
      }
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  return (
    <RouteGuard route="/dashboard/categories">
      <div className="space-y-8 pb-8">
        {/* Hero Header */}
        <HeroHeader
          title="Gestión de Categorías"
          subtitle="Organiza y administra el catálogo de productos"
          stats={{
            total: stats.total_categories,
            active: stats.active_categories
          }}
          actions={
            <Button onClick={() => { setIsModalOpen(true); setEditingCategory(undefined); setInitialParentId(null) }} className="gap-2">
              <Plus className="h-4 w-4" />
              Nueva Categoría
            </Button>
          }
        />

        {/* Main Content */}
        <div className="space-y-6">
          {/* Controls */}
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex-1 min-w-0 max-w-2xl">
              <SearchBar
                value={filters.search || ''}
                onChange={(val) => setFilters(prev => ({ ...prev, search: val }))}
                placeholder="Buscar por nombre o descripción..."
                suggestions={categories.map(c => c.name)}
              />
            </div>

            <div className="flex items-center gap-2">
              {selectedIds.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline">
                      <MoreHorizontal className="mr-2 h-4 w-4" />
                      {selectedIds.length} seleccionados
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleBulkToggle(true)}>
                      <CheckCircle className="mr-2 h-4 w-4" /> Activar seleccionados
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleBulkToggle(false)}>
                      <XCircle className="mr-2 h-4 w-4" /> Desactivar seleccionados
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleBulkDelete} className="text-red-600">
                      <Trash2 className="mr-2 h-4 w-4" /> Eliminar seleccionados
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              <Button
                variant="outline"
                size="icon"
                onClick={() => fetchCategories()}
                title="Actualizar"
              >
                <RefreshCw className={loading ? 'animate-spin' : ''} />
              </Button>
            </div>
          </div>

          {/* Active Filters */}
          <FilterTags
            tags={[
              ...(filters.isActive !== undefined ? [{
                id: 'status',
                label: 'Estado',
                value: filters.isActive ? 'Activas' : 'Inactivas'
              }] : [])
            ]}
            onRemove={(id) => {
              if (id === 'status') setFilters(prev => ({ ...prev, isActive: undefined }))
            }}
            onClearAll={() => setFilters({})}
          />

          {/* Views */}
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)} className="space-y-6">
            <div className="flex items-center justify-between">
              <TabsList>
                <TabsTrigger value="grid" className="gap-2">
                  <LayoutGrid className="h-4 w-4" /> Grid
                </TabsTrigger>
                <TabsTrigger value="list" className="gap-2">
                  <List className="h-4 w-4" /> Lista
                </TabsTrigger>
                <TabsTrigger value="tree" className="gap-2">
                  <FolderTree className="h-4 w-4" /> Árbol
                </TabsTrigger>
              </TabsList>

              <div className="text-sm text-muted-foreground">
                {filteredCategories.length} categorías encontradas
              </div>
            </div>

            <AnimatePresence mode="wait">
              {loading ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex justify-center py-12"
                >
                  <RefreshCw className="h-8 w-8 animate-spin text-primary" />
                </motion.div>
              ) : filteredCategories.length === 0 ? (
                <EmptyState
                  title="No se encontraron categorías"
                  description="Intenta ajustar los filtros o crea una nueva categoría"
                  action={{
                    label: 'Limpiar filtros',
                    onClick: () => setFilters({}),
                    icon: XCircle
                  }}
                />
              ) : (
                <motion.div
                  key={viewMode}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.2 }}
                >
                  <TabsContent value="grid" className="mt-0">
                    <CategoryGrid
                      categories={filteredCategories}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      onToggleActive={handleToggleActive}
                      selectedIds={selectedIds}
                      onSelectionChange={setSelectedIds}
                      getCategoryName={(id) => categories.find(c => c.id === id)?.name || 'Desconocida'}
                    />
                  </TabsContent>

                  <TabsContent value="list" className="mt-0">
                    <CategoryListView
                      categories={filteredCategories}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      onToggleActive={handleToggleActive}
                      selectedIds={selectedIds}
                      onSelectionChange={setSelectedIds}
                      getCategoryName={(id) => categories.find(c => c.id === id)?.name || 'Desconocida'}
                      onAddChild={(parentId) => {
                        setEditingCategory(undefined)
                        setInitialParentId(parentId)
                        setIsModalOpen(true)
                      }}
                    />
                  </TabsContent>

                  <TabsContent value="tree" className="mt-0">
                    <CategoryTreeViewImproved
                      categories={filteredCategories}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      onToggleActive={handleToggleActive}
                      selectedIds={selectedIds}
                      onSelectionChange={setSelectedIds}
                      onAddChild={(parentId) => {
                        setEditingCategory(undefined)
                        setInitialParentId(parentId)
                        setIsModalOpen(true)
                      }}
                    />
                  </TabsContent>
                </motion.div>
              )}
            </AnimatePresence>
          </Tabs>
        </div>

        {/* Modals */}
        <CategoryModal
          isOpen={isModalOpen}
          onClose={() => { setIsModalOpen(false); setInitialParentId(null) }}
          onSubmit={handleModalSubmit}
          category={editingCategory}
          categories={categories}
          loading={loading}
          initialParentId={initialParentId}
        />

        <CommandPalette
          isOpen={isCommandOpen}
          onClose={() => setIsCommandOpen(false)}
          commands={commands}
        />
      </div>
    </RouteGuard>
  )
}
