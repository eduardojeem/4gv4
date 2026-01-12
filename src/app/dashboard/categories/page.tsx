'use client'

import React, { useState, useMemo, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from '@/components/ui/motion'
import {
  Plus, Download, LayoutGrid, List, Trash2,
  CheckCircle, XCircle, RefreshCw, FolderTree,
  MoreHorizontal, AlertTriangle
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { RouteGuard } from '@/components/auth/permission-guard'
import { usePermissions } from '@/hooks/use-permissions'

// Hooks & Utils
import { useCategories, type Category } from '@/hooks/useCategories'
import { computeCategoryStats } from '@/hooks/use-category-stats'
import { exportCategories } from '@/lib/utils/export-categories'

// Components
import { HeroHeader } from '@/components/suppliers/HeroHeader'
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
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

export default function CategoriesPage() {
  console.log('CategoriesPage rendering...')
  
  // Permissions
  const { hasPermission } = usePermissions()
  const canManage = hasPermission('products.manage')

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

  // Delete Confirmation State
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    id: string | null;
    isBulk: boolean;
  }>({ isOpen: false, id: null, isBulk: false })

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

  // Handlers
  const handleEdit = (category: Category) => {
    setEditingCategory(category)
    setInitialParentId(null)
    setIsModalOpen(true)
  }

  const handleDeleteClick = (id: string) => {
    setDeleteDialog({ isOpen: true, id, isBulk: false })
  }

  const handleBulkDelete = () => {
    setDeleteDialog({ isOpen: true, id: null, isBulk: true })
  }

  const handleConfirmDelete = async () => {
    setDeleteDialog(prev => ({ ...prev, isOpen: false }))

    if (deleteDialog.isBulk) {
      let successCount = 0
      for (const id of selectedIds) {
        const res = await deleteCategory(id)
        if (res.success) successCount++
      }

      if (successCount > 0) {
        toast.success(`${successCount} categorías eliminadas`)
        setSelectedIds([])
      }
    } else if (deleteDialog.id) {
      const res = await deleteCategory(deleteDialog.id)
      if (res.success) {
        toast.success('Categoría eliminada')
        if (selectedIds.includes(deleteDialog.id)) {
          setSelectedIds(prev => prev.filter(i => i !== deleteDialog.id))
        }
      } else {
        toast.error(res.error)
      }
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

  const handleExport = useCallback((format: 'csv' | 'json') => {
    exportCategories(categories, { format })
    toast.info(`Exportando categorías a ${format.toUpperCase()}...`)
  }, [categories])

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
  ], [handleExport])

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
            canManage && (
              <Button onClick={() => { setIsModalOpen(true); setEditingCategory(undefined); setInitialParentId(null) }} className="gap-2">
                <Plus className="h-4 w-4" />
                Nueva Categoría
              </Button>
            )
          }
        />

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

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
              {selectedIds.length > 0 && canManage && (
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
                    <DropdownMenuItem onClick={handleBulkDeleteClick} className="text-red-600">
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
            onClearAll={() => setFilters({ isActive: undefined, search: '' })}
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
              {loading && categories.length === 0 ? (
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
                    onClick: () => setFilters({ isActive: undefined, search: '' }),
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
                      onDelete={handleDeleteClick}
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
                      onDelete={handleDeleteClick}
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
                      onDelete={handleDeleteClick}
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

        <AlertDialog open={deleteDialog.isOpen} onOpenChange={(open) => !open && setDeleteDialog(prev => ({ ...prev, isOpen: false }))}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
              <AlertDialogDescription>
                {deleteDialog.isBulk 
                  ? `Se eliminarán ${selectedIds.length} categorías seleccionadas. Esta acción no se puede deshacer.`
                  : "Esta acción no se puede deshacer. La categoría se eliminará permanentemente."
                }
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </RouteGuard>
  )
}
