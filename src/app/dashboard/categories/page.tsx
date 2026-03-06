'use client'

import React, { useState, useMemo, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from '@/components/ui/motion'
import {
  Plus, Download, LayoutGrid, List, Trash2,
  CheckCircle, XCircle, RefreshCw, FolderTree,
  MoreHorizontal, AlertTriangle, FolderOpen, Layers,
  Tag, Search, SlidersHorizontal
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { RouteGuard } from '@/components/auth/permission-guard'
import { usePermissions } from '@/hooks/use-permissions'
import { cn } from '@/lib/utils'

// Hooks & Utils
import { useCategories, type Category } from '@/hooks/useCategories'
import { computeCategoryStats } from '@/hooks/use-category-stats'
import { exportCategories } from '@/lib/utils/export-categories'

// Components
import { CategoryGrid } from '@/components/categories/CategoryCard'
import { CategoryListView } from '@/components/categories/CategoryListView'
import { CategoryTreeViewImproved } from '@/components/categories/CategoryTreeViewImproved'
import { CategoryModal } from '@/components/categories/CategoryModal'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
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

// Quick filter types
type QuickFilter = 'all' | 'active' | 'inactive' | 'root' | 'sub'

export default function CategoriesPage() {
  const { hasPermission } = usePermissions()
  const canManage = hasPermission('products.manage')

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

  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'tree'>('grid')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | undefined>(undefined)
  const [initialParentId, setInitialParentId] = useState<string | null>(null)
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all')
  const [searchValue, setSearchValue] = useState('')

  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean; id: string | null; isBulk: boolean
  }>({ isOpen: false, id: null, isBulk: false })

  // Sync search with filter (debounced)
  useEffect(() => {
    const timeout = setTimeout(() => {
      setFilters(prev => ({ ...prev, search: searchValue }))
    }, 250)
    return () => clearTimeout(timeout)
  }, [searchValue, setFilters])

  // Stats
  const stats = useMemo(() => computeCategoryStats(categories), [categories])
  const rootCount = useMemo(() => categories.filter(c => !c.parent_id).length, [categories])
  const subCount = useMemo(() => categories.filter(c => !!c.parent_id).length, [categories])
  const withProducts = useMemo(
    () =>
      categories.filter((c) => (((c as any).products_count ?? c.stats?.product_count ?? 0) > 0)).length,
    [categories]
  )

  // Filter categories by quick filter
  const filteredCategories = useMemo(() => {
    const term = (filters.search || '').toLowerCase()
    return categories.filter(c => {
      const matchesSearch = !term ||
        c.name.toLowerCase().includes(term) ||
        (c.description || '').toLowerCase().includes(term)

      const matchesQuick =
        quickFilter === 'all' ||
        (quickFilter === 'active' && c.is_active) ||
        (quickFilter === 'inactive' && !c.is_active) ||
        (quickFilter === 'root' && !c.parent_id) ||
        (quickFilter === 'sub' && !!c.parent_id)

      return matchesSearch && matchesQuick
    })
  }, [categories, filters.search, quickFilter])

  // Handlers
  const handleEdit = (category: Category) => {
    if (!canManage) return
    setEditingCategory(category)
    setInitialParentId(null)
    setIsModalOpen(true)
  }

  const handleDeleteClick = (id: string) => {
    if (!canManage) return
    setDeleteDialog({ isOpen: true, id, isBulk: false })
  }

  const handleBulkDelete = () => {
    if (!canManage) return
    setDeleteDialog({ isOpen: true, id: null, isBulk: true })
  }

  const handleConfirmDelete = async () => {
    if (!canManage) return
    setDeleteDialog(prev => ({ ...prev, isOpen: false }))

    if (deleteDialog.isBulk) {
      let successCount = 0, failCount = 0
      for (const id of selectedIds) {
        const res = await deleteCategory(id)
        res.success ? successCount++ : failCount++
      }
      if (successCount > 0) { toast.success(`${successCount} categorías eliminadas`); setSelectedIds([]) }
      if (failCount > 0) toast.error(`No se pudieron eliminar ${failCount} categorías`)
    } else if (deleteDialog.id) {
      const res = await deleteCategory(deleteDialog.id)
      if (res.success) {
        toast.success('Categoría eliminada')
        setSelectedIds(prev => prev.filter(i => i !== deleteDialog.id))
      } else {
        toast.error(res.error)
      }
    }
  }

  const handleToggleActive = async (id: string, isActive: boolean) => {
    if (!canManage) return
    const res = await updateCategory(id, { is_active: !isActive })
    if (res.success) {
      toast.success(`Categoría ${!isActive ? 'activada' : 'desactivada'}`)
    } else {
      toast.error(res.error)
    }
  }

  const handleBulkToggle = async (active: boolean) => {
    if (!canManage) return
    let successCount = 0, failCount = 0
    for (const id of selectedIds) {
      const res = await updateCategory(id, { is_active: active })
      res.success ? successCount++ : failCount++
    }
    if (successCount > 0) { toast.success(`${successCount} categorías actualizadas`); setSelectedIds([]) }
    if (failCount > 0) toast.error(`No se pudieron actualizar ${failCount} categorías`)
  }

  const handleModalSubmit = async (data: any) => {
    if (!canManage) return Promise.reject()
    if (editingCategory) {
      const res = await updateCategory(editingCategory.id, data)
      if (res.success) { toast.success('Categoría actualizada'); return }
      toast.error(res.error); throw new Error(res.error)
    } else {
      const res = await createCategory(data)
      if (res.success) { toast.success('Categoría creada'); return }
      toast.error(res.error); throw new Error(res.error)
    }
  }

  const handleExport = useCallback((format: 'csv' | 'json') => {
    exportCategories(categories, { format })
    toast.info(`Exportando a ${format.toUpperCase()}...`)
  }, [categories])

  const openCreateModal = () => {
    setEditingCategory(undefined)
    setInitialParentId(null)
    setIsModalOpen(true)
  }

  const quickFilterConfig: { id: QuickFilter; label: string; count: number }[] = [
    { id: 'all', label: 'Todas', count: categories.length },
    { id: 'active', label: 'Activas', count: stats.active_categories },
    { id: 'inactive', label: 'Inactivas', count: categories.length - stats.active_categories },
    { id: 'root', label: 'Raíz', count: rootCount },
    { id: 'sub', label: 'Sub', count: subCount },
  ]

  return (
    <RouteGuard route="/dashboard/categories">
      <div className="space-y-6 pb-8">

        {/* ─── HEADER ─── */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700">
          <div className="absolute inset-0 bg-black/10" />
          {/* Decorative orbs */}
          <div className="absolute -top-12 -right-12 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-purple-300/20 blur-2xl" />

          <div className="relative z-10 p-8">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 mb-8">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="rounded-xl bg-white/15 p-2.5">
                    <FolderOpen className="h-7 w-7 text-white" />
                  </div>
                  <h1 className="text-3xl lg:text-4xl font-extrabold text-white tracking-tight">
                    Categorías
                  </h1>
                </div>
                <p className="text-white/80 text-sm ml-[52px]">
                  Organizá y administrá el catálogo de productos
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="secondary" className="bg-white/15 border-white/20 text-white hover:bg-white/25 gap-2 border">
                      <Download className="h-4 w-4" />
                      Exportar
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleExport('csv')}>CSV</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleExport('json')}>JSON</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {canManage && (
                  <Button
                    onClick={openCreateModal}
                    className="bg-white text-purple-700 hover:bg-white/90 gap-2 font-semibold shadow-lg"
                  >
                    <Plus className="h-4 w-4" />
                    Nueva Categoría
                  </Button>
                )}
              </div>
            </div>

            {/* Stats cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { icon: Tag, label: 'Total', value: stats.total_categories, color: 'text-white' },
                { icon: CheckCircle, label: 'Activas', value: stats.active_categories, color: 'text-green-300' },
                { icon: Layers, label: 'Subcategorías', value: subCount, color: 'text-blue-300' },
                { icon: FolderOpen, label: 'Con productos', value: withProducts, color: 'text-amber-300' },
              ].map((stat, i) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 * i }}
                  className="group rounded-xl bg-white/10 backdrop-blur-sm border border-white/15 p-4 hover:bg-white/15 transition-all duration-200"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-white/60 mb-1">{stat.label}</p>
                      <p className="text-2xl font-bold text-white">
                        {loading && categories.length === 0 ? '—' : stat.value}
                      </p>
                    </div>
                    <stat.icon className={cn("h-5 w-5 opacity-80", stat.color)} />
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* ─── CONTROLS ─── */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchValue}
                onChange={e => setSearchValue(e.target.value)}
                placeholder="Buscar categorías..."
                className="pl-9 h-9"
              />
            </div>

            {/* Right controls */}
            <div className="flex items-center gap-2">
              {selectedIds.length > 0 && canManage && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1.5">
                      <MoreHorizontal className="h-4 w-4" />
                      {selectedIds.length} seleccionados
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleBulkToggle(true)}>
                      <CheckCircle className="mr-2 h-4 w-4" /> Activar
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleBulkToggle(false)}>
                      <XCircle className="mr-2 h-4 w-4" /> Desactivar
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleBulkDelete} className="text-red-600">
                      <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchCategories()}
                className="gap-1.5"
                title="Actualizar"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
              </Button>
            </div>
          </div>

          {/* Quick Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            {quickFilterConfig.map(f => (
              <button
                key={f.id}
                onClick={() => setQuickFilter(f.id)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all duration-150",
                  quickFilter === f.id
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                )}
              >
                {f.label}
                <span className={cn(
                  "rounded-full px-1.5 py-0 text-[10px] font-semibold",
                  quickFilter === f.id ? "bg-white/25" : "bg-background/60"
                )}>
                  {f.count}
                </span>
              </button>
            ))}
            <span className="ml-auto text-xs text-muted-foreground">
              {filteredCategories.length} resultado{filteredCategories.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* ─── VIEWS ─── */}
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)} className="space-y-4">
          <TabsList className="h-9">
            <TabsTrigger value="grid" className="gap-1.5 text-xs">
              <LayoutGrid className="h-3.5 w-3.5" /> Grid
            </TabsTrigger>
            <TabsTrigger value="list" className="gap-1.5 text-xs">
              <List className="h-3.5 w-3.5" /> Lista
            </TabsTrigger>
            <TabsTrigger value="tree" className="gap-1.5 text-xs">
              <FolderTree className="h-3.5 w-3.5" /> Árbol
            </TabsTrigger>
          </TabsList>

          <AnimatePresence mode="wait">
            {/* Skeleton loading */}
            {loading && categories.length === 0 ? (
              <motion.div
                key="skeleton"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
              >
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="rounded-2xl border bg-card overflow-hidden">
                    <Skeleton className="h-1.5 w-full" />
                    <div className="p-5 space-y-3">
                      <div className="flex items-start gap-3">
                        <Skeleton className="h-10 w-10 rounded-xl" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-3/4" />
                          <Skeleton className="h-3 w-full" />
                        </div>
                      </div>
                      <Skeleton className="h-px w-full" />
                      <div className="flex justify-between">
                        <Skeleton className="h-3 w-20" />
                        <Skeleton className="h-5 w-16 rounded-full" />
                      </div>
                    </div>
                  </div>
                ))}
              </motion.div>
            ) : filteredCategories.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-20 text-center"
              >
                <div className="rounded-2xl bg-muted/50 p-6 mb-4">
                  <FolderOpen className="h-12 w-12 text-muted-foreground mx-auto" />
                </div>
                <h3 className="font-semibold text-lg mb-1">Sin resultados</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  No se encontraron categorías con los filtros actuales
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setSearchValue(''); setQuickFilter('all') }}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Limpiar filtros
                  </Button>
                  {canManage && (
                    <Button size="sm" onClick={openCreateModal}>
                      <Plus className="h-4 w-4 mr-2" />
                      Crear categoría
                    </Button>
                  )}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key={viewMode}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.18 }}
              >
                <TabsContent value="grid" className="mt-0">
                  <CategoryGrid
                    categories={filteredCategories}
                    onEdit={canManage ? handleEdit : undefined}
                    onDelete={canManage ? handleDeleteClick : undefined}
                    onToggleActive={canManage ? handleToggleActive : undefined}
                    onAddChild={canManage ? (parentId) => {
                      setEditingCategory(undefined)
                      setInitialParentId(parentId)
                      setIsModalOpen(true)
                    } : undefined}
                    selectedIds={canManage ? selectedIds : []}
                    onSelectionChange={canManage ? setSelectedIds : undefined}
                    getCategoryName={(id) => categories.find(c => c.id === id)?.name || 'Desconocida'}
                  />
                </TabsContent>

                <TabsContent value="list" className="mt-0">
                  <CategoryListView
                    categories={filteredCategories}
                    onEdit={canManage ? handleEdit : undefined}
                    onDelete={canManage ? handleDeleteClick : undefined}
                    onToggleActive={canManage ? handleToggleActive : undefined}
                    selectedIds={canManage ? selectedIds : []}
                    onSelectionChange={canManage ? setSelectedIds : undefined}
                    getCategoryName={(id) => categories.find(c => c.id === id)?.name || 'Desconocida'}
                    onAddChild={canManage ? (parentId) => {
                      setEditingCategory(undefined)
                      setInitialParentId(parentId)
                      setIsModalOpen(true)
                    } : undefined}
                  />
                </TabsContent>

                <TabsContent value="tree" className="mt-0">
                  <CategoryTreeViewImproved
                    categories={filteredCategories}
                    onEdit={canManage ? handleEdit : undefined}
                    onDelete={canManage ? handleDeleteClick : undefined}
                    onToggleActive={canManage ? handleToggleActive : undefined}
                    selectedIds={canManage ? selectedIds : []}
                    onSelectionChange={canManage ? setSelectedIds : undefined}
                    onAddChild={canManage ? (parentId) => {
                      setEditingCategory(undefined)
                      setInitialParentId(parentId)
                      setIsModalOpen(true)
                    } : undefined}
                  />
                </TabsContent>
              </motion.div>
            )}
          </AnimatePresence>
        </Tabs>

        {/* Modals */}
        <CategoryModal
          isOpen={isModalOpen}
          onClose={() => { setIsModalOpen(false); setInitialParentId(null) }}
          onSubmit={handleModalSubmit}
          category={editingCategory}
          categories={categories}
          initialParentId={initialParentId}
        />

        <AlertDialog
          open={deleteDialog.isOpen}
          onOpenChange={(open) => !open && setDeleteDialog(prev => ({ ...prev, isOpen: false }))}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar categoría?</AlertDialogTitle>
              <AlertDialogDescription>
                {deleteDialog.isBulk
                  ? `Se eliminarán ${selectedIds.length} categorías. Esta acción no se puede deshacer.`
                  : 'Esta categoría se eliminará permanentemente.'
                }
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </RouteGuard>
  )
}
