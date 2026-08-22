/**
 * Tabla de Inventario de Repuestos - Diseño Premium y Funcionalidad Avanzada
 * 
 * Mejoras implementadas:
 * - Diseño UI de alto impacto (glassmorphism, animaciones, badges de margen de ganancia)
 * - Ordenamiento interactivo por columnas (Nombre, Categoría, Stock, Precio Venta, Margen)
 * - Ajuste de stock rápido e in-line (+1 / -1) sin abrir modales
 * - Barra de progreso visual de nivel de stock según mínimo requerido
 * - Paginación y contador dinámico de valorización de inventario
 * - Búsqueda y filtrado memoizado de alto rendimiento
 */

"use client"

import { useState, useMemo, memo } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertTriangle,
  MoreHorizontal,
  Pencil,
  Trash2,
  Eye,
  Plus,
  Minus,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Package,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  SlidersHorizontal,
} from 'lucide-react'
import type { Product } from '@/types/product-unified'
import { formatPrice } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { useInventory } from '../context/InventoryContext'

interface InventoryTableProps {
  products: Product[]
  totalCatalogCount?: number
  onEdit?: (product: Product) => void
  onDelete?: (product: Product) => void
  onViewDetail?: (product: Product) => void
  loading?: boolean
}

type SortColumn = 'name' | 'category' | 'stock' | 'price' | 'margin'
type SortDirection = 'asc' | 'desc'

/**
 * Componente de Fila Memoizado con Atajos Rápidos de Stock y Badges de Ganancia
 */
const InventoryRow = memo(({
  product,
  onEdit,
  onDelete,
  onViewDetail,
  onStockAdjust,
}: {
  product: Product
  onEdit?: (product: Product) => void
  onDelete?: (product: Product) => void
  onViewDetail?: (product: Product) => void
  onStockAdjust: (product: Product, delta: number) => void
}) => {
  const stock = product.stock_quantity ?? 0
  const minStock = product.min_stock ?? 5
  const isLowStock = stock <= minStock && stock > 0
  const isOutOfStock = stock === 0

  // Cálculo del margen de ganancia %
  const salePrice = product.sale_price ?? 0
  const costPrice = product.purchase_price ?? 0
  const profitMarginPercent = salePrice > 0 && costPrice > 0
    ? Math.round(((salePrice - costPrice) / salePrice) * 100)
    : null

  // Porcentaje visual de stock respecto al mínimo recomendado
  const stockRatioPercent = minStock > 0 ? Math.min(100, Math.round((stock / (minStock * 2)) * 100)) : 100

  return (
    <TableRow
      className="group hover:bg-slate-100/60 dark:hover:bg-slate-900/60 transition-all duration-200 cursor-pointer border-b border-slate-100 dark:border-slate-800/80"
      onClick={() => onViewDetail?.(product)}
    >
      {/* Nombre y SKU del Repuesto */}
      <TableCell className="py-3.5 px-4 font-medium">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500/10 to-indigo-500/10 dark:from-blue-500/20 dark:to-indigo-500/20 flex items-center justify-center border border-blue-200/50 dark:border-blue-800/50 shrink-0 group-hover:scale-105 transition-transform">
            <Package className="h-4.5 w-4.5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors truncate">
              {product.name}
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[11px] text-muted-foreground font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 rounded border border-slate-200 dark:border-slate-700">
                {product.sku || 'SIN SKU'}
              </span>
              {product.supplier?.name && (
                <span className="text-[10px] text-slate-500 truncate max-w-[120px]">
                  • {product.supplier.name}
                </span>
              )}
            </div>
          </div>
        </div>
      </TableCell>

      {/* Categoría */}
      <TableCell className="py-3.5 px-4">
        <Badge
          variant="outline"
          className="font-normal text-xs bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 px-2.5 py-0.5 rounded-full"
        >
          {product.category?.name || 'Sin Categoría'}
        </Badge>
      </TableCell>

      {/* Stock en Depósito */}
      <TableCell className="py-3.5 px-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                'font-extrabold text-sm px-2 py-0.5 rounded-md transition-colors font-mono',
                isOutOfStock
                  ? 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40'
                  : isLowStock
                  ? 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40'
                  : 'text-slate-900 dark:text-slate-100 bg-slate-100 dark:bg-slate-800/80'
              )}
            >
              {stock} u.
            </span>
            {isOutOfStock ? (
              <Badge variant="destructive" className="text-[10px] font-bold px-1.5 py-0 h-4.5 rounded-md">
                AGOTADO
              </Badge>
            ) : isLowStock ? (
              <Badge className="text-[10px] font-bold px-1.5 py-0 h-4.5 rounded-md bg-amber-500 text-white hover:bg-amber-600 gap-1">
                <AlertTriangle className="h-2.5 w-2.5" /> BAJO
              </Badge>
            ) : (
              <Badge className="text-[10px] font-medium px-1.5 py-0 h-4.5 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                OK
              </Badge>
            )}
          </div>

          {/* Micro Barra de Nivel de Stock */}
          <div className="w-24 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full transition-all duration-300 rounded-full',
                isOutOfStock
                  ? 'bg-red-500 w-full opacity-40'
                  : isLowStock
                  ? 'bg-amber-500'
                  : 'bg-emerald-500'
              )}
              style={{ width: isOutOfStock ? '100%' : `${stockRatioPercent}%` }}
            />
          </div>
        </div>
      </TableCell>

      {/* Precio de Venta y Margen de Ganancia */}
      <TableCell className="py-3.5 px-4">
        <div className="flex flex-col">
          <span className="font-extrabold text-sm text-slate-900 dark:text-slate-100 font-mono">
            {formatPrice(salePrice)}
          </span>
          {costPrice > 0 && (
            <span className="text-[11px] text-muted-foreground font-mono">
              Costo: {formatPrice(costPrice)}
            </span>
          )}
        </div>
      </TableCell>

      {/* Margen de Ganancia */}
      <TableCell className="py-3.5 px-4">
        {profitMarginPercent !== null ? (
          <div className="flex flex-col gap-0.5">
            <Badge
              variant="outline"
              className={cn(
                'font-bold text-[11px] px-2 py-0.5 rounded-md border w-fit gap-1',
                profitMarginPercent >= 40
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                  : profitMarginPercent >= 20
                  ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                  : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
              )}
            >
              <TrendingUp className="h-3 w-3" />
              {profitMarginPercent}%
            </Badge>
            <span className="text-[10px] text-slate-500 font-mono">
              +{formatPrice(salePrice - costPrice)}
            </span>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">-</span>
        )}
      </TableCell>

      {/* Ajuste Rápido de Stock (+1 / -1) */}
      <TableCell className="py-3.5 px-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-7 w-7 rounded-lg text-slate-600 hover:text-red-600 hover:bg-red-50 hover:border-red-200 dark:text-slate-400 dark:hover:bg-red-950/30 transition-colors"
            disabled={stock <= 0}
            onClick={() => onStockAdjust(product, -1)}
            title="Reducir 1 unidad"
          >
            <Minus className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-7 w-7 rounded-lg text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 hover:border-emerald-200 dark:text-slate-400 dark:hover:bg-emerald-950/30 transition-colors"
            onClick={() => onStockAdjust(product, 1)}
            title="Aumentar 1 unidad"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </TableCell>

      {/* Acciones */}
      <TableCell className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 rounded-xl shadow-lg border-slate-200 dark:border-slate-800">
            <DropdownMenuLabel className="text-xs text-muted-foreground">Acciones de Repuesto</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onViewDetail?.(product)} className="cursor-pointer gap-2 text-xs">
              <Eye className="h-3.5 w-3.5 text-blue-600" /> Ver Ficha Técnica
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onEdit?.(product)} className="cursor-pointer gap-2 text-xs">
              <Pencil className="h-3.5 w-3.5 text-amber-600" /> Editar Información
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onDelete?.(product)}
              className="cursor-pointer gap-2 text-xs text-red-600 dark:text-red-400 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/30"
            >
              <Trash2 className="h-3.5 w-3.5" /> Eliminar Repuesto
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  )
})

InventoryRow.displayName = 'InventoryRow'

/**
 * Tabla Principal con Ordenamiento, Paginación y Resumen de Valorización
 */
export function InventoryTable({
  products,
  totalCatalogCount,
  onEdit,
  onDelete,
  onViewDetail,
  loading,
}: InventoryTableProps) {
  const { updateStock } = useInventory()

  const [sortColumn, setSortColumn] = useState<SortColumn>('name')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(12)

  // Manejador de ordenamiento al hacer clic en columnas
  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortColumn(column)
      setSortDirection('asc')
    }
  }

  // Lista ordenada de repuestos
  const sortedProducts = useMemo(() => {
    return [...products].sort((a, b) => {
      let valueA: any = ''
      let valueB: any = ''

      switch (sortColumn) {
        case 'name':
          valueA = a.name.toLowerCase()
          valueB = b.name.toLowerCase()
          break
        case 'category':
          valueA = (a.category?.name || '').toLowerCase()
          valueB = (b.category?.name || '').toLowerCase()
          break
        case 'stock':
          valueA = a.stock_quantity ?? 0
          valueB = b.stock_quantity ?? 0
          break
        case 'price':
          valueA = a.sale_price ?? 0
          valueB = b.sale_price ?? 0
          break
        case 'margin':
          valueA = a.sale_price && a.purchase_price ? (a.sale_price - a.purchase_price) : 0
          valueB = b.sale_price && b.purchase_price ? (b.sale_price - b.purchase_price) : 0
          break
      }

      if (valueA < valueB) return sortDirection === 'asc' ? -1 : 1
      if (valueA > valueB) return sortDirection === 'asc' ? 1 : -1
      return 0
    })
  }, [products, sortColumn, sortDirection])

  // Paginación de la tabla
  const totalPages = Math.ceil(sortedProducts.length / pageSize) || 1
  const effectivePage = Math.min(Math.max(1, currentPage), totalPages)

  const paginatedProducts = useMemo(() => {
    const start = (effectivePage - 1) * pageSize
    return sortedProducts.slice(start, start + pageSize)
  }, [sortedProducts, effectivePage, pageSize])

  const startItem = sortedProducts.length === 0 ? 0 : (effectivePage - 1) * pageSize + 1
  const endItem = Math.min(effectivePage * pageSize, sortedProducts.length)

  // Resumen financiero del inventario filtrado
  const totalValuation = useMemo(() => {
    return products.reduce((acc, p) => acc + ((p.sale_price || 0) * (p.stock_quantity || 0)), 0)
  }, [products])

  const handleStockAdjust = async (product: Product, delta: number) => {
    const currentStock = product.stock_quantity ?? 0
    const newStock = Math.max(0, currentStock + delta)
    if (newStock === currentStock) return

    try {
      await updateStock(
        product.id,
        newStock,
        delta > 0 ? 'Ajuste rápido (+1) en tabla' : 'Ajuste rápido (-1) en tabla'
      )
    } catch {
      // Manejado por context toast
    }
  }

  if (loading) {
    return <TableSkeleton />
  }

  if (products.length === 0) {
    return (
      <div className="text-center py-16 px-4 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20">
        <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto mb-4 shadow-sm">
          <Package className="h-8 w-8" />
        </div>
        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">No se encontraron repuestos</h3>
        <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
          Prueba cambiando el término de búsqueda o limpia los filtros para ver todos los repuestos registrados.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Barra de Resumen, Conteo y Valoración */}
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

          <span className="hidden md:inline text-slate-300 dark:text-slate-700">|</span>

          <span className="hidden md:inline">
            Valorizado en: <strong className="text-emerald-600 dark:text-emerald-400 font-mono">{formatPrice(totalValuation)}</strong>
          </span>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-muted-foreground whitespace-nowrap">Por pág:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value))
                setCurrentPage(1)
              }}
              className="h-7 px-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-semibold focus:ring-1 focus:ring-blue-500"
            >
              <option value={10}>10</option>
              <option value={12}>12</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>

          <div className="text-[11px] text-muted-foreground hidden lg:flex items-center gap-1">
            <SlidersHorizontal className="h-3 w-3" />
            Stock: <strong>+ / -</strong>
          </div>
        </div>
      </div>

      {/* Contenedor de Tabla con Estilo Glassmorphism */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-950/60 shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50/90 dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-800">
            <TableRow>
              <TableHead className="cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors font-bold text-slate-900 dark:text-slate-100 text-xs py-3" onClick={() => handleSort('name')}>
                <div className="flex items-center gap-1.5">
                  Repuesto
                  {sortColumn === 'name' ? (sortDirection === 'asc' ? <ArrowUp className="h-3.5 w-3.5 text-blue-600" /> : <ArrowDown className="h-3.5 w-3.5 text-blue-600" />) : <ArrowUpDown className="h-3 w-3 text-muted-foreground opacity-50" />}
                </div>
              </TableHead>
              <TableHead className="cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors font-bold text-slate-900 dark:text-slate-100 text-xs py-3" onClick={() => handleSort('category')}>
                <div className="flex items-center gap-1.5">
                  Categoría
                  {sortColumn === 'category' ? (sortDirection === 'asc' ? <ArrowUp className="h-3.5 w-3.5 text-blue-600" /> : <ArrowDown className="h-3.5 w-3.5 text-blue-600" />) : <ArrowUpDown className="h-3 w-3 text-muted-foreground opacity-50" />}
                </div>
              </TableHead>
              <TableHead className="cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors font-bold text-slate-900 dark:text-slate-100 text-xs py-3" onClick={() => handleSort('stock')}>
                <div className="flex items-center gap-1.5">
                  Stock Disponible
                  {sortColumn === 'stock' ? (sortDirection === 'asc' ? <ArrowUp className="h-3.5 w-3.5 text-blue-600" /> : <ArrowDown className="h-3.5 w-3.5 text-blue-600" />) : <ArrowUpDown className="h-3 w-3 text-muted-foreground opacity-50" />}
                </div>
              </TableHead>
              <TableHead className="cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors font-bold text-slate-900 dark:text-slate-100 text-xs py-3" onClick={() => handleSort('price')}>
                <div className="flex items-center gap-1.5">
                  Precio Venta
                  {sortColumn === 'price' ? (sortDirection === 'asc' ? <ArrowUp className="h-3.5 w-3.5 text-blue-600" /> : <ArrowDown className="h-3.5 w-3.5 text-blue-600" />) : <ArrowUpDown className="h-3 w-3 text-muted-foreground opacity-50" />}
                </div>
              </TableHead>
              <TableHead className="cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors font-bold text-slate-900 dark:text-slate-100 text-xs py-3" onClick={() => handleSort('margin')}>
                <div className="flex items-center gap-1.5">
                  Margen Estimado
                  {sortColumn === 'margin' ? (sortDirection === 'asc' ? <ArrowUp className="h-3.5 w-3.5 text-blue-600" /> : <ArrowDown className="h-3.5 w-3.5 text-blue-600" />) : <ArrowUpDown className="h-3 w-3 text-muted-foreground opacity-50" />}
                </div>
              </TableHead>
              <TableHead className="font-bold text-slate-900 dark:text-slate-100 text-xs py-3">Ajuste Stock</TableHead>
              <TableHead className="text-right font-bold text-slate-900 dark:text-slate-100 text-xs py-3">Acciones</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {paginatedProducts.map((product) => (
              <InventoryRow
                key={product.id}
                product={product}
                onEdit={onEdit}
                onDelete={onDelete}
                onViewDetail={onViewDetail}
                onStockAdjust={handleStockAdjust}
              />
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Paginador */}
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
              <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
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
              Siguiente <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Skeleton Loader Visual
 */
function TableSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4 space-y-4">
      <div className="h-6 bg-slate-100 dark:bg-slate-900 rounded-lg animate-pulse w-1/4" />
      <div className="space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-12 bg-slate-100/70 dark:bg-slate-900/60 rounded-xl animate-pulse" />
        ))}
      </div>
    </div>
  )
}
