"use client"

import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  Search,
  Trash2,
  AlertTriangle,
  LayoutGrid,
  List,
  Package,
  Plus,
  Minus,
  Eye,
  Pencil,
  TrendingUp,
} from 'lucide-react'
import { useInventory } from '../../context/InventoryContext'
import { InventoryTable } from '../InventoryTable'
import { ProductDetailDialog } from '../ProductDetailDialog'
import { ProductEditDialog } from '../ProductEditDialog'
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
import type { Product } from '@/types/product-unified'
import { formatPrice, cn } from '@/lib/utils'

export function InventoryTab() {
  const { inventory, categories, loading, deleteItem, updateStock } = useInventory()
  const [searchTerm, setSearchTerm] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [stockFilter, setStockFilter] = useState("all")
  const [viewType, setViewType] = useState<'table' | 'cards'>('table')
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [productToDelete, setProductToDelete] = useState<Product | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Local pagination
  const [page, setPage] = useState(1)
  const itemsPerPage = 20

  const isFiltered = searchTerm !== "" || categoryFilter !== "all" || stockFilter !== "all"

  const filteredInventory = useMemo(() => {
    return inventory.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           (p.sku && p.sku.toLowerCase().includes(searchTerm.toLowerCase()))
      const matchesCategory = categoryFilter === "all" || p.category_id === categoryFilter

      let matchesStock = true
      if (stockFilter === "low") matchesStock = (p.stock_quantity || 0) <= (p.min_stock || 5)
      if (stockFilter === "out") matchesStock = (p.stock_quantity || 0) === 0
      if (stockFilter === "in") matchesStock = (p.stock_quantity || 0) > 0

      return matchesSearch && matchesCategory && matchesStock
    })
  }, [inventory, searchTerm, categoryFilter, stockFilter])

  const displayedInventory = useMemo(() => {
    return filteredInventory.slice(0, page * itemsPerPage)
  }, [filteredInventory, page, itemsPerPage])

  useMemo(() => {
    setPage(1)
  }, [searchTerm, categoryFilter, stockFilter])

  const handleResetFilters = () => {
    setSearchTerm("")
    setCategoryFilter("all")
    setStockFilter("all")
  }

  const handleViewDetail = (product: Product) => {
    setSelectedProduct(product)
    setIsDetailOpen(true)
  }

  const handleEdit = (product: Product) => {
    setSelectedProduct(product)
    setIsEditOpen(true)
    setIsDetailOpen(false)
  }

  const handleDelete = (product: Product) => {
    setProductToDelete(product)
  }

  const handleStockAdjust = async (product: Product, delta: number) => {
    const currentStock = product.stock_quantity ?? 0
    const newStock = Math.max(0, currentStock + delta)
    if (newStock === currentStock) return

    try {
      await updateStock(
        product.id,
        newStock,
        delta > 0 ? 'Ajuste rápido (+1) en tarjeta' : 'Ajuste rápido (-1) en tarjeta'
      )
    } catch {
      // Manejado en context
    }
  }

  const confirmDelete = async () => {
    if (!productToDelete) return
    setIsDeleting(true)
    try {
      await deleteItem(productToDelete.id)
    } finally {
      setIsDeleting(false)
      setProductToDelete(null)
    }
  }

  const handleEditSuccess = () => {
    if (selectedProduct) {
      const updated = inventory.find(p => p.id === selectedProduct.id)
      if (updated) setSelectedProduct(updated)
    }
    setIsEditOpen(false)
  }

  return (
    <>
      <Card className="bg-background/50 backdrop-blur-xl border border-border/50 shadow-sm overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 pointer-events-none" />
        <CardHeader className="relative z-10 border-b border-border/30 pb-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <CardTitle className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent flex items-center gap-2">
                <span className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <Search className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </span>
                Inventario de Repuestos
              </CardTitle>
              <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-foreground">
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  Total catálogo: <strong className="text-blue-600 dark:text-blue-400 font-mono">{inventory.length}</strong>
                </span>
                <span>•</span>
                <span>
                  Coincidentes: <strong className="text-purple-600 dark:text-purple-400 font-mono">{filteredInventory.length}</strong>
                </span>
                {isFiltered && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleResetFilters}
                    className="h-5 px-1.5 text-[11px] text-amber-600 dark:text-amber-400 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                  >
                    ✕ Limpiar filtros
                  </Button>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto items-center">
              {/* Conmutador de Vista: Tabla vs Tarjetas */}
              <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-lg shrink-0">
                <ToggleGroup
                  type="single"
                  value={viewType}
                  onValueChange={(val) => val && setViewType(val as 'table' | 'cards')}
                >
                  <ToggleGroupItem value="table" size="sm" aria-label="Vista de Tabla" className="h-7 px-2.5">
                    <List className="h-4 w-4 mr-1.5" />
                    <span className="text-xs font-semibold">Tabla</span>
                  </ToggleGroupItem>
                  <ToggleGroupItem value="cards" size="sm" aria-label="Vista de Tarjetas" className="h-7 px-2.5">
                    <LayoutGrid className="h-4 w-4 mr-1.5" />
                    <span className="text-xs font-semibold">Tarjetas</span>
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>

              <div className="relative w-full sm:w-60">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar repuesto..."
                  className="pl-8 text-xs focus:ring-2 focus:ring-blue-500 transition-all"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full sm:w-[170px] text-xs focus:ring-2 focus:ring-purple-500">
                  <SelectValue placeholder="Categoría" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las categorías ({categories.length})</SelectItem>
                  {categories.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={stockFilter} onValueChange={setStockFilter}>
                <SelectTrigger className="w-full sm:w-[150px] text-xs focus:ring-2 focus:ring-green-500">
                  <SelectValue placeholder="Estado Stock" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="in">✓ En Stock</SelectItem>
                  <SelectItem value="low">⚠ Bajo Stock</SelectItem>
                  <SelectItem value="out">✗ Agotado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-4">
          {viewType === 'table' ? (
            <InventoryTable
              products={displayedInventory}
              totalCatalogCount={inventory.length}
              loading={loading}
              onViewDetail={handleViewDetail}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ) : (
            <InventoryCardsGrid
              products={displayedInventory}
              totalCatalogCount={inventory.length}
              loading={loading}
              onViewDetail={handleViewDetail}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onStockAdjust={handleStockAdjust}
            />
          )}

          {/* Load More Button */}
          {displayedInventory.length < filteredInventory.length && (
            <div className="flex justify-center mt-6 pb-2">
              <Button 
                variant="outline" 
                onClick={() => setPage(p => p + 1)}
                className="bg-white dark:bg-slate-900 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-400"
              >
                Mostrar más ({filteredInventory.length - displayedInventory.length} restantes)
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!productToDelete} onOpenChange={(open) => !open && setProductToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              ¿Eliminar repuesto?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Estás a punto de eliminar <strong className="text-foreground">"{productToDelete?.name}"</strong>.
              Esta acción no se puede deshacer y eliminará también todos los movimientos asociados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 text-white focus:ring-red-600"
            >
              {isDeleting ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Eliminando...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Trash2 className="h-4 w-4" />
                  Eliminar
                </span>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ProductDetailDialog
        product={selectedProduct}
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        onEdit={handleEdit}
      />

      <ProductEditDialog
        product={selectedProduct}
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        onSuccess={handleEditSuccess}
      />
    </>
  )
}

/**
 * Grid de Tarjetas de Repuestos con Paginación, Ajustes de Stock y Conteo Visual
 */
function InventoryCardsGrid({
  products,
  totalCatalogCount,
  loading,
  onViewDetail,
  onEdit,
  onDelete,
  onStockAdjust,
}: {
  products: Product[]
  totalCatalogCount?: number
  loading?: boolean
  onViewDetail: (p: Product) => void
  onEdit: (p: Product) => void
  onDelete: (p: Product) => void
  onStockAdjust: (p: Product, delta: number) => void
}) {
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(12)

  const totalPages = Math.ceil(products.length / pageSize) || 1
  const effectivePage = Math.min(Math.max(1, currentPage), totalPages)

  const paginatedProducts = useMemo(() => {
    const start = (effectivePage - 1) * pageSize
    return products.slice(start, start + pageSize)
  }, [products, effectivePage, pageSize])

  const startItem = products.length === 0 ? 0 : (effectivePage - 1) * pageSize + 1
  const endItem = Math.min(effectivePage * pageSize, products.length)

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-48 bg-slate-100 dark:bg-slate-900 rounded-2xl animate-pulse" />
        ))}
      </div>
    )
  }

  if (products.length === 0) {
    return (
      <div className="text-center py-16 px-4 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20">
        <Package className="h-8 w-8 text-blue-500 mx-auto mb-2" />
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">No hay repuestos registrados</h3>
        <p className="text-xs text-muted-foreground mt-1">Prueba cambiando los filtros de búsqueda.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Barra de Conteo en Modo Tarjetas */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-1 py-1.5 text-xs text-slate-600 dark:text-slate-400 bg-slate-50/70 dark:bg-slate-900/40 p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-800/60">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="font-bold text-xs bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/60">
            Mostrando {startItem}–{endItem} de {products.length} repuestos
          </Badge>

          {typeof totalCatalogCount === 'number' && totalCatalogCount !== products.length && (
            <Badge variant="outline" className="text-xs text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700">
              Total catálogo: {totalCatalogCount}
            </Badge>
          )}

          <Badge variant="outline" className="text-xs font-semibold bg-emerald-50/60 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800">
            👁️ {paginatedProducts.length} a la vista
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Por pág:</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value))
              setCurrentPage(1)
            }}
            className="h-7 px-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-semibold focus:ring-1 focus:ring-blue-500"
          >
            <option value={12}>12</option>
            <option value={24}>24</option>
            <option value={48}>48</option>
            <option value={96}>96</option>
          </select>
        </div>
      </div>

      {/* Grid de Tarjetas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
        {paginatedProducts.map((product) => {
          const stock = product.stock_quantity ?? 0
          const minStock = product.min_stock ?? 5
          const isLowStock = stock <= minStock && stock > 0
          const isOutOfStock = stock === 0

          const salePrice = product.sale_price ?? 0
          const costPrice = product.purchase_price ?? 0
          const profitMarginPercent = salePrice > 0 && costPrice > 0
            ? Math.round(((salePrice - costPrice) / salePrice) * 100)
            : null

          return (
            <Card
              key={product.id}
              onClick={() => onViewDetail(product)}
              className="group hover:border-blue-400 dark:hover:border-blue-700 transition-all duration-200 cursor-pointer bg-white/90 dark:bg-slate-950/70 border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md overflow-hidden flex flex-col justify-between rounded-2xl"
            >
              <CardContent className="p-4 space-y-3">
                {/* Header Badges */}
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="outline" className="text-[11px] font-normal border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 truncate max-w-[130px]">
                    {product.category?.name || 'Sin Categoría'}
                  </Badge>

                  {isOutOfStock ? (
                    <Badge variant="destructive" className="text-[10px] font-semibold bg-red-500 text-white rounded-full">
                      Agotado
                    </Badge>
                  ) : isLowStock ? (
                    <Badge className="text-[10px] font-semibold bg-amber-500 text-white rounded-full">
                      Bajo Stock ({stock})
                    </Badge>
                  ) : (
                    <Badge className="text-[10px] font-medium bg-emerald-500 text-white rounded-full">
                      ✓ En Stock
                    </Badge>
                  )}
                </div>

                {/* Nombre y SKU */}
                <div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-1">
                    {product.name}
                  </h4>
                  <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
                    SKU: {product.sku || 'SIN CÓDIGO'}
                  </p>
                </div>

                {/* Nivel de Stock y Ajustes Rápidos */}
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs" onClick={(e) => e.stopPropagation()}>
                  <span className="text-muted-foreground text-[11px] font-medium">Stock:</span>
                  <div className="flex items-center gap-1.5">
                    <span className={cn(
                      "font-black text-sm px-2 py-0.5 rounded font-mono",
                      isOutOfStock ? "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40" :
                      isLowStock ? "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40" :
                      "text-slate-900 dark:text-slate-100 bg-slate-100 dark:bg-slate-800"
                    )}>
                      {stock} u.
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-6 w-6 rounded-md text-slate-500 hover:text-red-600 hover:bg-red-50"
                      disabled={stock <= 0}
                      onClick={() => onStockAdjust(product, -1)}
                      title="Reducir 1 u."
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-6 w-6 rounded-md text-slate-500 hover:text-emerald-600 hover:bg-emerald-50"
                      onClick={() => onStockAdjust(product, 1)}
                      title="Aumentar 1 u."
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                {/* Precio y Margen */}
                <div className="flex items-center justify-between pt-1">
                  <div>
                    <span className="text-[10px] text-muted-foreground block">Precio Venta</span>
                    <span className="font-black text-base text-blue-600 dark:text-blue-400">
                      {formatPrice(salePrice)}
                    </span>
                  </div>
                  {profitMarginPercent !== null && (
                    <Badge variant="outline" className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 text-[10px] font-bold gap-1">
                      <TrendingUp className="h-3 w-3" /> {profitMarginPercent}% Margen
                    </Badge>
                  )}
                </div>
              </CardContent>

              {/* Footer Botones */}
              <div className="px-4 py-2 bg-slate-50/80 dark:bg-slate-900/80 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onViewDetail(product)}
                  className="text-xs h-7 text-slate-600 dark:text-slate-400 hover:text-blue-600 p-0"
                >
                  <Eye className="h-3.5 w-3.5 mr-1 text-emerald-500" /> Detalle
                </Button>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onEdit(product)}
                    className="h-7 w-7 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950"
                    title="Editar"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onDelete(product)}
                    className="h-7 w-7 text-red-500 hover:bg-red-50 dark:hover:bg-red-950"
                    title="Eliminar"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      {/* Paginación de Tarjetas */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2 px-1">
        <span className="text-xs text-muted-foreground">
          Página {effectivePage} de {totalPages} · Mostrando <strong>{paginatedProducts.length}</strong> de <strong>{products.length}</strong> repuestos filtrados
          {typeof totalCatalogCount === 'number' && totalCatalogCount !== products.length && ` (${totalCatalogCount} en catálogo)`}
        </span>
        {totalPages > 1 && (
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              disabled={effectivePage <= 1}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              className="h-8 text-xs rounded-xl"
            >
              Anterior
            </Button>

            <span className="text-xs px-2 font-mono font-bold text-slate-700 dark:text-slate-300">
              {effectivePage} / {totalPages}
            </span>

            <Button
              variant="outline"
              size="sm"
              disabled={effectivePage >= totalPages}
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              className="h-8 text-xs rounded-xl"
            >
              Siguiente
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
