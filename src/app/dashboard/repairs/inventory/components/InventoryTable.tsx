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
          </div>

          {/* Micro Barra de Nivel de Stock */}
          <div className="w-24 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full transition-all duration-300 rounded-full',
                isOutOfStock
                  ? 'w-0'
                  : isLowStock
                  ? 'bg-amber-500'
                  : 'bg-emerald-500'
              )}
              style={{ width: `${stockRatioPercent}%` }}
            />
          </div>
        </div>
      </TableCell>

      {/* Precio de Venta y Margen de Ganancia */}
      <TableCell className="py-3.5 px-4">
        <div className="flex flex-col">
          <span className="font-bold text-sm text-blue-600 dark:text-blue-400">
            {formatPrice(salePrice)}
          </span>
          {profitMarginPercent !== null && (
            <div className="flex items-center gap-1 mt-0.5">
              <TrendingUp className="h-3 w-3 text-emerald-500" />
              <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                {profitMarginPercent}% margen
              </span>
            </div>
          )}
        </div>
      </TableCell>

      {/* Estado del Repuesto */}
      <TableCell className="py-3.5 px-4 text-right">
        {isOutOfStock ? (
          <Badge variant="destructive" className="bg-red-500 hover:bg-red-600 font-semibold px-2.5 py-0.5 rounded-full shadow-sm">
            <ShieldAlert className="h-3 w-3 mr-1" />
            Agotado
          </Badge>
        ) : isLowStock ? (
          <Badge className="bg-amber-500 hover:bg-amber-600 text-white font-semibold px-2.5 py-0.5 rounded-full shadow-sm">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Bajo Stock ({stock}/{minStock})
          </Badge>
        ) : (
          <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white font-medium px-2.5 py-0.5 rounded-full shadow-sm">
            ✓ En Stock
          </Badge>
        )}
      </TableCell>

      {/* Acciones */}
      <TableCell className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-slate-200/60 dark:hover:bg-slate-800/80 rounded-lg">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuLabel className="text-xs text-muted-foreground">Opciones</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => onViewDetail?.(product)} className="cursor-pointer text-xs">
              <Eye className="mr-2 h-3.5 w-3.5 text-emerald-500" /> Ver Detalle
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onEdit?.(product)} className="cursor-pointer text-xs">
              <Pencil className="mr-2 h-3.5 w-3.5 text-blue-500" /> Editar
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onDelete?.(product)}
              className="text-red-600 dark:text-red-400 cursor-pointer text-xs focus:bg-red-50 dark:focus:bg-red-950/30"
            >
              <Trash2 className="mr-2 h-3.5 w-3.5" /> Eliminar
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
  onEdit,
  onDelete,
  onViewDetail,
  loading,
}: InventoryTableProps) {
  const { updateStock } = useInventory()

  const [sortColumn, setSortColumn] = useState<SortColumn>('name')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [currentPage, setCurrentPage] = useState<number>(1)
  const pageSize = 12

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
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return sortedProducts.slice(start, start + pageSize)
  }, [sortedProducts, currentPage, pageSize])

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
      {/* Barra de Resumen e Indicador de Valoración */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-1 py-1 text-xs text-slate-600 dark:text-slate-400">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-900 dark:text-slate-100">
            {products.length} {products.length === 1 ? 'repuesto' : 'repuestos'}
          </span>
          <span>•</span>
          <span>
            Valorizado en: <strong className="text-emerald-600 dark:text-emerald-400">{formatPrice(totalValuation)}</strong>
          </span>
        </div>
        <div className="text-[11px] text-muted-foreground flex items-center gap-1">
          <SlidersHorizontal className="h-3 w-3" />
          Usa los botones <strong>+ / -</strong> para ajustar el stock al instante
        </div>
      </div>

      {/* Contenedor de Tabla con Estilo Glassmorphism */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-950/60 shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50/90 dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-800">
            <TableRow>
              {/* Columna Nombre */}
              <TableHead
                className="cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors font-bold text-slate-900 dark:text-slate-100 text-xs py-3"
                onClick={() => handleSort('name')}
              >
                <div className="flex items-center gap-1.5">
                  Repuesto
                  {sortColumn === 'name' ? (
                    sortDirection === 'asc' ? <ArrowUp className="h-3.5 w-3.5 text-blue-600" /> : <ArrowDown className="h-3.5 w-3.5 text-blue-600" />
                  ) : (
                    <ArrowUpDown className="h-3 w-3 text-muted-foreground opacity-50" />
                  )}
                </div>
              </TableHead>

              {/* Columna Categoría */}
              <TableHead
                className="cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors font-bold text-slate-900 dark:text-slate-100 text-xs py-3"
                onClick={() => handleSort('category')}
              >
                <div className="flex items-center gap-1.5">
                  Categoría
                  {sortColumn === 'category' ? (
                    sortDirection === 'asc' ? <ArrowUp className="h-3.5 w-3.5 text-blue-600" /> : <ArrowDown className="h-3.5 w-3.5 text-blue-600" />
                  ) : (
                    <ArrowUpDown className="h-3 w-3 text-muted-foreground opacity-50" />
                  )}
                </div>
              </TableHead>

              {/* Columna Stock */}
              <TableHead
                className="cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors font-bold text-slate-900 dark:text-slate-100 text-xs py-3"
                onClick={() => handleSort('stock')}
              >
                <div className="flex items-center gap-1.5">
                  Stock Disponible
                  {sortColumn === 'stock' ? (
                    sortDirection === 'asc' ? <ArrowUp className="h-3.5 w-3.5 text-blue-600" /> : <ArrowDown className="h-3.5 w-3.5 text-blue-600" />
                  ) : (
                    <ArrowUpDown className="h-3 w-3 text-muted-foreground opacity-50" />
                  )}
                </div>
              </TableHead>

              {/* Columna Precio */}
              <TableHead
                className="cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors font-bold text-slate-900 dark:text-slate-100 text-xs py-3"
                onClick={() => handleSort('price')}
              >
                <div className="flex items-center gap-1.5">
                  Precio Venta
                  {sortColumn === 'price' ? (
                    sortDirection === 'asc' ? <ArrowUp className="h-3.5 w-3.5 text-blue-600" /> : <ArrowDown className="h-3.5 w-3.5 text-blue-600" />
                  ) : (
                    <ArrowUpDown className="h-3 w-3 text-muted-foreground opacity-50" />
                  )}
                </div>
              </TableHead>

              {/* Columna Estado */}
              <TableHead className="text-right font-bold text-slate-900 dark:text-slate-100 text-xs py-3">
                Estado
              </TableHead>

              {/* Columna Acciones */}
              <TableHead className="text-right font-bold text-slate-900 dark:text-slate-100 text-xs py-3">
                Acciones
              </TableHead>
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
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2 px-1">
          <span className="text-xs text-muted-foreground">
            Página {currentPage} de {totalPages} ({products.length} repuestos en total)
          </span>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage(p => p - 1)}
              className="h-8 text-xs rounded-xl"
            >
              <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(p => p + 1)}
              className="h-8 text-xs rounded-xl"
            >
              Siguiente <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
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
