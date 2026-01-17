/**
 * Tabla de inventario optimizada con memoización
 * 
 * Características:
 * - Memoización de filas
 * - Ordenamiento y filtrado eficiente
 * - Skeleton loaders
 */

"use client"

import { memo } from 'react'
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
import { AlertTriangle, MoreHorizontal, Pencil, Trash2, Eye } from 'lucide-react'
import type { Product } from '@/types/product-unified'

interface InventoryTableProps {
  products: Product[]
  onEdit?: (product: Product) => void
  onDelete?: (product: Product) => void
  onViewDetail?: (product: Product) => void
  loading?: boolean
}

/**
 * Componente de fila memoizado para evitar re-renders innecesarios
 */
const InventoryRow = memo(({ 
  product, 
  onEdit, 
  onDelete,
  onViewDetail 
}: { 
  product: Product
  onEdit?: (product: Product) => void
  onDelete?: (product: Product) => void
  onViewDetail?: (product: Product) => void
}) => {
  const isLowStock = (product.stock_quantity || 0) <= (product.min_stock || 5)
  const isOutOfStock = (product.stock_quantity || 0) === 0

  return (
    <TableRow className="hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => onViewDetail?.(product)}>
      <TableCell className="font-medium">
        <div className="flex flex-col">
          <span className="text-sm hover:text-blue-600 transition-colors">{product.name}</span>
          <span className="text-xs text-muted-foreground font-mono">{product.sku}</span>
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className="font-normal">
          {product.category?.name || "Sin categoría"}
        </Badge>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <span className={`font-semibold ${
            isOutOfStock ? 'text-red-600 dark:text-red-400' : 
            isLowStock ? 'text-amber-600 dark:text-amber-400' : 
            'text-green-600 dark:text-green-400'
          }`}>
            {product.stock_quantity}
          </span>
          {isLowStock && !isOutOfStock && (
            <AlertTriangle className="h-3 w-3 text-amber-500 animate-pulse" />
          )}
          {isOutOfStock && (
            <AlertTriangle className="h-3 w-3 text-red-500 animate-pulse" />
          )}
        </div>
      </TableCell>
      <TableCell>
        <span className="font-semibold text-blue-600 dark:text-blue-400">
          ${product.sale_price?.toFixed(2)}
        </span>
      </TableCell>
      <TableCell>
        <span className="text-sm text-muted-foreground">
          {product.supplier?.name || "-"}
        </span>
      </TableCell>
      <TableCell className="text-right">
        {isOutOfStock ? (
          <Badge variant="destructive" className="bg-red-500 hover:bg-red-600">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Agotado
          </Badge>
        ) : isLowStock ? (
          <Badge className="bg-amber-500 hover:bg-amber-600 text-white">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Stock Bajo
          </Badge>
        ) : (
          <Badge className="bg-green-500 hover:bg-green-600 text-white">
            En Stock
          </Badge>
        )}
      </TableCell>
      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-muted">
              <span className="sr-only">Abrir menú</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Acciones</DropdownMenuLabel>
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onViewDetail?.(product); }} className="cursor-pointer">
              <Eye className="mr-2 h-4 w-4 text-green-500" /> Ver Detalle
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit?.(product); }} className="cursor-pointer">
              <Pencil className="mr-2 h-4 w-4 text-blue-500" /> Editar
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              className="text-red-600 cursor-pointer focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/20" 
              onClick={(e) => { e.stopPropagation(); onDelete?.(product); }}
            >
              <Trash2 className="mr-2 h-4 w-4" /> Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  )
})

InventoryRow.displayName = 'InventoryRow'

/**
 * Tabla principal optimizada
 */
export function InventoryTable({ 
  products, 
  onEdit, 
  onDelete,
  onViewDetail,
  loading 
}: InventoryTableProps) {
  if (loading) {
    return <TableSkeleton />
  }

  if (products.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No se encontraron productos
      </div>
    )
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Producto</TableHead>
            <TableHead>Categoría</TableHead>
            <TableHead>Stock</TableHead>
            <TableHead>Precio Venta</TableHead>
            <TableHead>Proveedor</TableHead>
            <TableHead className="text-right">Estado</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((product) => (
            <InventoryRow
              key={product.id}
              product={product}
              onEdit={onEdit}
              onDelete={onDelete}
              onViewDetail={onViewDetail}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

/**
 * Skeleton loader para estado de carga
 */
function TableSkeleton() {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Producto</TableHead>
            <TableHead>Categoría</TableHead>
            <TableHead>Stock</TableHead>
            <TableHead>Precio Venta</TableHead>
            <TableHead>Proveedor</TableHead>
            <TableHead className="text-right">Estado</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 10 }).map((_, i) => (
            <TableRow key={i}>
              <TableCell>
                <div className="h-4 bg-muted animate-pulse rounded w-32" />
              </TableCell>
              <TableCell>
                <div className="h-4 bg-muted animate-pulse rounded w-24" />
              </TableCell>
              <TableCell>
                <div className="h-4 bg-muted animate-pulse rounded w-12" />
              </TableCell>
              <TableCell>
                <div className="h-4 bg-muted animate-pulse rounded w-16" />
              </TableCell>
              <TableCell>
                <div className="h-4 bg-muted animate-pulse rounded w-20" />
              </TableCell>
              <TableCell className="text-right">
                <div className="h-6 bg-muted animate-pulse rounded w-16 ml-auto" />
              </TableCell>
              <TableCell className="text-right">
                <div className="h-8 bg-muted animate-pulse rounded w-8 ml-auto" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
