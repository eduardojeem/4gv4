'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from '@/components/ui/motion'
import {
  Plus, Download, LayoutGrid, List, Trash2,
  CheckCircle, XCircle, RefreshCw, FolderTree,
  MoreHorizontal, AlertTriangle, FolderOpen, Layers,
  Tag, Search, SlidersHorizontal, X
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { RouteGuard } from '@/components/auth/permission-guard'
import { cn } from '@/lib/utils'

// Hooks & Utils
import { useCategories, type Category } from '@/hooks/useCategories'
import { computeCategoryStats } from '@/hooks/use-category-stats'
import { exportCategories } from '@/lib/utils/export-categories'

// Components
import { SectionGuideButton } from '@/components/dashboard/common/SectionGuideButton'
import { CATEGORIES_GUIDE } from '@/components/dashboard/common/section-guides-data'
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
  const {
    categories,
    capabilities,
    loading,
    error,
    filters,
    setFilters,
    fetchCategories,
    createCategory,
    updateCategory,
    deleteCategory
  } = useCategories()

  const canCreate = capabilities.canCreate
  const canUpdate = capabilities.canUpdate
  const canDelete = capabilities.canDelete
  const canBulkSelect = canUpdate || canDelete

  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'tree'>('grid')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | undefined>(undefined)
  const [initialParentId, setInitialParentId] = useState<string | null>(null)
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all')
  const [searchValue, setSearchValue] = useState('')
  const [showGuide, setShowGuide] = useState(true)

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
    if (!canUpdate) return
    setEditingCategory(category)
    setInitialParentId(null)
    setIsModalOpen(true)
  }

  const handleDeleteClick = (id: string) => {
    if (!canDelete) return
    setDeleteDialog({ isOpen: true, id, isBulk: false })
  }

  const handleBulkDelete = () => {
    if (!canDelete) return
    setDeleteDialog({ isOpen: true, id: null, isBulk: true })
  }

  const handleConfirmDelete = async () => {
    if (!canDelete) return
    setDeleteDialog(prev => ({ ...prev, isOpen: false }))

    if (deleteDialog.isBulk) {
      let successCount = 0, failCount = 0
      for (const id of selectedIds) {
        const res = await deleteCategory(id)
        if (res.success) {
          successCount += 1
        } else {
          failCount += 1
        }
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
    if (!canUpdate) return
    const res = await updateCategory(id, { is_active: !isActive })
    if (res.success) {
      toast.success(`Categoría ${!isActive ? 'activada' : 'desactivada'}`)
    } else {
      toast.error(res.error)
    }
  }

  const handleBulkToggle = async (active: boolean) => {
    if (!canUpdate) return
    let successCount = 0, failCount = 0
    for (const id of selectedIds) {
      const res = await updateCategory(id, { is_active: active })
      if (res.success) {
        successCount += 1
      } else {
        failCount += 1
      }
    }
    if (successCount > 0) { toast.success(`${successCount} categorías actualizadas`); setSelectedIds([]) }
    if (failCount > 0) toast.error(`No se pudieron actualizar ${failCount} categorías`)
  }

  const handleModalSubmit = async (data: any) => {
    if ((editingCategory && !canUpdate) || (!editingCategory && !canCreate)) return Promise.reject()
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
    if (!canCreate) return
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

        {/* ─── HEADER EJECUTIVO ─── */}
        <div className="relative overflow-hidden rounded-3xl border border-border/70 bg-gradient-to-br from-card via-card to-muted/30 p-6 sm:p-8 shadow-xs">
          {/* Ambient lighting glow */}
          <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl dark:bg-indigo-500/15" />
          <div className="pointer-events-none absolute -bottom-16 -left-16 h-64 w-64 rounded-full bg-purple-500/10 blur-3xl dark:bg-purple-500/15" />

          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="flex items-start sm:items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-500/20">
                <FolderOpen className="h-6 w-6" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                    Categorías
                  </h1>
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs font-semibold">
                    Catálogo de Productos
                  </Badge>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                  Estructurá el árbol de categorías, subniveles y visibilidad para la tienda y el punto de venta.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              <SectionGuideButton guide={CATEGORIES_GUIDE} />

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 gap-1.5 rounded-xl text-xs font-semibold border-border/80 hover:bg-muted">
                    <Download className="h-3.5 w-3.5" />
                    <span>Exportar</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleExport('csv')}>Exportar a CSV</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport('json')}>Exportar a JSON</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {canCreate && (
                <Button
                  onClick={openCreateModal}
                  size="sm"
                  className="h-9 gap-1.5 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm shadow-primary/20"
                >
                  <Plus className="h-4 w-4" />
                  Nueva Categoría
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* ─── QUICK STATS KPI PANEL (4-Card System) ─── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Card 1: Total */}
          <Card className="border-border/70 bg-card shadow-2xs hover:shadow-xs transition-shadow">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total Categorías</p>
                <div className="text-2xl sm:text-3xl font-extrabold text-foreground mt-1 tabular-nums">
                  {loading ? <Skeleton className="h-8 w-14 rounded-lg" /> : stats.total_categories}
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">En catálogo de tienda</p>
              </div>
              <div className="h-11 w-11 rounded-2xl bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/20">
                <Tag className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Activas */}
          <Card className="border-border/70 bg-card shadow-2xs hover:shadow-xs transition-shadow">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Activas</p>
                <div className="text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums">
                  {loading ? <Skeleton className="h-8 w-14 rounded-lg" /> : stats.active_categories}
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">Visibles en catálogo</p>
              </div>
              <div className="h-11 w-11 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20">
                <CheckCircle className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          {/* Card 3: Subcategorías */}
          <Card className="border-border/70 bg-card shadow-2xs hover:shadow-xs transition-shadow">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Subcategorías</p>
                <div className="text-2xl sm:text-3xl font-extrabold text-purple-600 dark:text-purple-400 mt-1 tabular-nums">
                  {loading ? <Skeleton className="h-8 w-14 rounded-lg" /> : subCount}
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">Estructura multinivel</p>
              </div>
              <div className="h-11 w-11 rounded-2xl bg-purple-500/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 border border-purple-500/20">
                <Layers className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          {/* Card 4: Con Productos */}
          <Card className="border-border/70 bg-card shadow-2xs hover:shadow-xs transition-shadow">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Con Productos</p>
                <div className="text-2xl sm:text-3xl font-extrabold text-amber-600 dark:text-amber-400 mt-1 tabular-nums">
                  {loading ? <Skeleton className="h-8 w-14 rounded-lg" /> : withProducts}
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">Con stock / catálogo</p>
              </div>
              <div className="h-11 w-11 rounded-2xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/20">
                <FolderOpen className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
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
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchValue}
                onChange={e => setSearchValue(e.target.value)}
                placeholder="Buscar categorías por nombre o descripción..."
                className="pl-9 pr-8 h-10 rounded-xl bg-card border-border/80 text-sm"
              />
              {searchValue && (
                <button
                  type="button"
                  onClick={() => setSearchValue('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Right controls */}
            <div className="flex items-center gap-2">
              {selectedIds.length > 0 && canBulkSelect && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-10 gap-1.5 rounded-xl border-border/80 text-xs font-semibold">
                      <MoreHorizontal className="h-4 w-4" />
                      {selectedIds.length} seleccionados
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {canUpdate && (
                      <>
                        <DropdownMenuItem onClick={() => handleBulkToggle(true)}>
                          <CheckCircle className="mr-2 h-4 w-4" /> Activar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleBulkToggle(false)}>
                          <XCircle className="mr-2 h-4 w-4" /> Desactivar
                        </DropdownMenuItem>
                      </>
                    )}
                    {canUpdate && canDelete && <DropdownMenuSeparator />}
                    {canDelete && (
                      <DropdownMenuItem onClick={handleBulkDelete} className="text-red-600">
                        <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchCategories()}
                className="h-10 px-3 rounded-xl border-border/80 text-xs font-semibold gap-1.5"
                title="Actualizar"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
                <span className="hidden sm:inline">Actualizar</span>
              </Button>
            </div>
          </div>

          {/* Quick Filters */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
            <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            {quickFilterConfig.map(f => (
              <button
                key={f.id}
                onClick={() => setQuickFilter(f.id)}
                className={cn(
                  "flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all duration-150 border shrink-0",
                  quickFilter === f.id
                    ? "bg-primary text-primary-foreground border-primary shadow-xs"
                    : "bg-card hover:bg-muted text-muted-foreground border-border/80"
                )}
              >
                {f.label}
                <span className={cn(
                  "rounded-full px-1.5 py-0 text-[10px] font-bold tabular-nums",
                  quickFilter === f.id ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
                )}>
                  {f.count}
                </span>
              </button>
            ))}
            <span className="ml-auto text-xs text-muted-foreground font-medium shrink-0">
              {filteredCategories.length} resultado{filteredCategories.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* ─── VIEWS ─── */}
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)} className="space-y-4">
          <TabsList className="h-10 bg-muted/60 p-1 rounded-xl border border-border/60">
            <TabsTrigger value="grid" className="gap-1.5 text-xs rounded-lg font-semibold data-[state=active]:bg-card data-[state=active]:shadow-xs">
              <LayoutGrid className="h-3.5 w-3.5" /> Grid
            </TabsTrigger>
            <TabsTrigger value="list" className="gap-1.5 text-xs rounded-lg font-semibold data-[state=active]:bg-card data-[state=active]:shadow-xs">
              <List className="h-3.5 w-3.5" /> Lista
            </TabsTrigger>
            <TabsTrigger value="tree" className="gap-1.5 text-xs rounded-lg font-semibold data-[state=active]:bg-card data-[state=active]:shadow-xs">
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
                  {canCreate && (
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
                    onEdit={canUpdate ? handleEdit : undefined}
                    onDelete={canDelete ? handleDeleteClick : undefined}
                    onToggleActive={canUpdate ? handleToggleActive : undefined}
                    onAddChild={canCreate ? (parentId) => {
                      setEditingCategory(undefined)
                      setInitialParentId(parentId)
                      setIsModalOpen(true)
                    } : undefined}
                    selectedIds={canBulkSelect ? selectedIds : []}
                    onSelectionChange={canBulkSelect ? setSelectedIds : undefined}
                    getCategoryName={(id) => categories.find(c => c.id === id)?.name || 'Desconocida'}
                  />
                </TabsContent>

                <TabsContent value="list" className="mt-0">
                  <CategoryListView
                    categories={filteredCategories}
                    onEdit={canUpdate ? handleEdit : undefined}
                    onDelete={canDelete ? handleDeleteClick : undefined}
                    onToggleActive={canUpdate ? handleToggleActive : undefined}
                    selectedIds={canBulkSelect ? selectedIds : []}
                    onSelectionChange={canBulkSelect ? setSelectedIds : undefined}
                    getCategoryName={(id) => categories.find(c => c.id === id)?.name || 'Desconocida'}
                    onAddChild={canCreate ? (parentId) => {
                      setEditingCategory(undefined)
                      setInitialParentId(parentId)
                      setIsModalOpen(true)
                    } : undefined}
                  />
                </TabsContent>

                <TabsContent value="tree" className="mt-0">
                  <CategoryTreeViewImproved
                    categories={filteredCategories}
                    onEdit={canUpdate ? handleEdit : undefined}
                    onDelete={canDelete ? handleDeleteClick : undefined}
                    onToggleActive={canUpdate ? handleToggleActive : undefined}
                    selectedIds={canBulkSelect ? selectedIds : []}
                    onSelectionChange={canBulkSelect ? setSelectedIds : undefined}
                    onAddChild={canCreate ? (parentId) => {
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
