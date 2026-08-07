"use client"

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Package,
  DollarSign,
  Calendar,
  Tag,
  Building2,
  AlertTriangle,
  Edit,
  History,
  RefreshCw,
  ShieldAlert,
  Info,
} from 'lucide-react'
import type { Product, ProductMovement } from '@/types/product-unified'
import { useInventory } from '../context/InventoryContext'
import { toast } from 'sonner'
import { logger } from '@/lib/logger'
import { formatMovementType } from '../lib/movement-format'
import { formatPrice, cn } from '@/lib/utils'

interface ProductDetailDialogProps {
  product: Product | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onEdit?: (product: Product) => void
}

export function ProductDetailDialog({
  product,
  open,
  onOpenChange,
  onEdit
}: ProductDetailDialogProps) {
  const { getProductMovements } = useInventory()
  const [movements, setMovements] = useState<ProductMovement[]>([])
  const [loadingMovements, setLoadingMovements] = useState(false)

  useEffect(() => {
    if (product && open) {
      loadMovements()
    }
  }, [product, open])

  const loadMovements = async () => {
    if (!product) return
    setLoadingMovements(true)
    try {
      const result = await getProductMovements(product.id)
      setMovements(result?.data || [])
    } catch (error) {
      logger.error('Error loading movements', { error })
      toast.error('Error al cargar historial de movimientos')
    } finally {
      setLoadingMovements(false)
    }
  }

  if (!product) return null

  const stock = product.stock_quantity ?? 0
  const minStock = product.min_stock ?? 5
  const maxStock = product.max_stock ?? (minStock * 4)
  const isLowStock = stock <= minStock && stock > 0
  const isOutOfStock = stock === 0
  const stockPercentage = maxStock > 0 ? (stock / maxStock) * 100 : 0

  const salePrice = product.sale_price ?? 0
  const costPrice = product.purchase_price ?? 0
  const margin = salePrice - costPrice
  const marginPercent = salePrice > 0 && costPrice > 0 ? Math.round((margin / salePrice) * 100) : 0
  const stockValuation = stock * salePrice

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] p-0 overflow-hidden bg-white/95 dark:bg-slate-950/95 backdrop-blur-2xl border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl max-h-[90vh] flex flex-col">
        {/* Banner de Encabezado Premium */}
        <div className="bg-gradient-to-r from-blue-600/10 via-indigo-600/10 to-purple-600/10 dark:from-blue-950/40 dark:via-indigo-950/40 dark:to-purple-950/40 p-6 pb-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <DialogHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/20 shrink-0">
                  <Package className="h-6 w-6" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
                    {product.name}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground flex flex-wrap items-center gap-2 mt-1">
                    <span className="inline-flex items-center gap-1 font-mono bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-[11px] font-semibold text-slate-800 dark:text-slate-200">
                      <Tag className="h-3 w-3 text-blue-500" />
                      SKU: {product.sku || 'SIN SKU'}
                    </span>
                    <span>•</span>
                    <Badge variant="outline" className="text-[11px] font-normal border-blue-200 text-blue-700 dark:border-blue-800 dark:text-blue-300">
                      {product.category?.name || 'Sin Categoría'}
                    </Badge>
                    <span>•</span>
                    {isOutOfStock ? (
                      <Badge variant="destructive" className="bg-red-500 text-white text-[10px]">
                        <ShieldAlert className="h-3 w-3 mr-1" /> Agotado
                      </Badge>
                    ) : isLowStock ? (
                      <Badge className="bg-amber-500 text-white text-[10px]">
                        <AlertTriangle className="h-3 w-3 mr-1" /> Bajo Stock
                      </Badge>
                    ) : (
                      <Badge className="bg-emerald-500 text-white text-[10px]">
                        ✓ En Stock
                      </Badge>
                    )}
                  </DialogDescription>
                </div>
              </div>

              <Button
                variant="default"
                size="sm"
                onClick={() => {
                  onOpenChange(false)
                  onEdit?.(product)
                }}
                className="rounded-xl text-xs gap-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md"
              >
                <Edit className="h-3.5 w-3.5" /> Editar Repuesto
              </Button>
            </div>
          </DialogHeader>
        </div>

        {/* Pestañas Modulares (Lectura e Historial) */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <Tabs defaultValue="overview" className="w-full space-y-4">
            <TabsList className="grid w-full grid-cols-2 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl">
              <TabsTrigger value="overview" className="text-xs font-semibold rounded-lg gap-1.5">
                <Package className="h-3.5 w-3.5" /> Resumen del Producto
              </TabsTrigger>
              <TabsTrigger value="history" className="text-xs font-semibold rounded-lg gap-1.5">
                <History className="h-3.5 w-3.5" /> Historial de Movimientos
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: RESUMEN GENERAL */}
            <TabsContent value="overview" className="space-y-4">
              {/* Tarjetas de Métricas Rápidas */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-blue-50/50 dark:bg-blue-950/20 p-3.5 rounded-2xl border border-blue-100 dark:border-blue-900/40">
                  <span className="text-[11px] font-medium text-blue-600 dark:text-blue-400 block mb-1">
                    Precio Venta
                  </span>
                  <span className="text-xl font-extrabold text-blue-900 dark:text-blue-100">
                    {formatPrice(salePrice)}
                  </span>
                </div>

                <div className="bg-emerald-50/50 dark:bg-emerald-950/20 p-3.5 rounded-2xl border border-emerald-100 dark:border-emerald-900/40">
                  <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 block mb-1">
                    Stock Disponible
                  </span>
                  <span className={cn(
                    "text-xl font-extrabold",
                    isOutOfStock ? 'text-red-600 dark:text-red-400' :
                    isLowStock ? 'text-amber-600 dark:text-amber-400' :
                    'text-emerald-900 dark:text-emerald-100'
                  )}>
                    {stock} u.
                  </span>
                </div>

                <div className="bg-purple-50/50 dark:bg-purple-950/20 p-3.5 rounded-2xl border border-purple-100 dark:border-purple-900/40">
                  <span className="text-[11px] font-medium text-purple-600 dark:text-purple-400 block mb-1">
                    Valorización
                  </span>
                  <span className="text-xl font-extrabold text-purple-900 dark:text-purple-100">
                    {formatPrice(stockValuation)}
                  </span>
                </div>

                <div className="bg-indigo-50/50 dark:bg-indigo-950/20 p-3.5 rounded-2xl border border-indigo-100 dark:border-indigo-900/40">
                  <span className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400 block mb-1">
                    Margen Ganancia
                  </span>
                  <span className="text-xl font-extrabold text-indigo-900 dark:text-indigo-100">
                    +{marginPercent}%
                  </span>
                </div>
              </div>

              {/* Ficha de Detalles del Repuesto */}
              <Card className="border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
                <CardHeader className="pb-3 pt-4">
                  <CardTitle className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <Info className="h-4 w-4 text-blue-500" /> Ficha Técnica y Clasificación
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 pt-0 text-xs">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800">
                        <span className="text-muted-foreground flex items-center gap-1.5">
                          <DollarSign className="h-3.5 w-3.5 text-slate-400" /> Precio de Compra:
                        </span>
                        <strong className="text-slate-900 dark:text-slate-100 font-mono">{formatPrice(costPrice)}</strong>
                      </div>

                      <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800">
                        <span className="text-muted-foreground flex items-center gap-1.5">
                          <DollarSign className="h-3.5 w-3.5 text-slate-400" /> Precio Mayorista:
                        </span>
                        <strong className="text-slate-900 dark:text-slate-100 font-mono">
                          {product.wholesale_price ? formatPrice(product.wholesale_price) : 'No asignado'}
                        </strong>
                      </div>

                      <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800">
                        <span className="text-muted-foreground flex items-center gap-1.5">
                          <Tag className="h-3.5 w-3.5 text-slate-400" /> Categoría:
                        </span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {product.category?.name || 'Sin Categoría'}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800">
                        <span className="text-muted-foreground flex items-center gap-1.5">
                          <Building2 className="h-3.5 w-3.5 text-slate-400" /> Proveedor:
                        </span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[140px]">
                          {product.supplier?.name || 'Inventario Local'}
                        </span>
                      </div>

                      <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800">
                        <span className="text-muted-foreground flex items-center gap-1.5">
                          <Package className="h-3.5 w-3.5 text-slate-400" /> Unidad Medida:
                        </span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200 capitalize">
                          {product.unit_measure || 'Unidad'}
                        </span>
                      </div>

                      <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800">
                        <span className="text-muted-foreground flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-slate-400" /> Registrado:
                        </span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {new Date(product.created_at || Date.now()).toLocaleDateString('es-PY')}
                        </span>
                      </div>
                    </div>
                  </div>

                  {product.description && (
                    <div className="pt-2">
                      <span className="font-semibold text-slate-900 dark:text-slate-100 block mb-1">Notas / Descripción:</span>
                      <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl text-muted-foreground leading-relaxed">
                        {product.description}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Nivel de Capacidad de Depósito */}
              <Card className="border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
                <CardHeader className="pb-2 pt-4">
                  <div className="flex items-center justify-between text-xs">
                    <CardTitle className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      Capacidad del Stock en Depósito
                    </CardTitle>
                    <span className="font-semibold text-muted-foreground">
                      {stock} / {maxStock} u. ({stockPercentage.toFixed(0)}%)
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 space-y-2">
                  <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden">
                    <div
                      className={cn(
                        'h-full transition-all duration-500 rounded-full',
                        isOutOfStock ? 'w-0' :
                        isLowStock ? 'bg-amber-500' :
                        'bg-emerald-500'
                      )}
                      style={{ width: `${Math.min(100, Math.max(0, stockPercentage))}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] text-muted-foreground">
                    <span>Mínimo alerta: <strong>{minStock} u.</strong></span>
                    <span>Máximo recomendado: <strong>{maxStock} u.</strong></span>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB 2: HISTORIAL DE MOVIMIENTOS */}
            <TabsContent value="history" className="space-y-4">
              <Card className="border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <History className="h-4 w-4 text-purple-500" />
                    Auditoría e Historial de Entradas y Salidas
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {loadingMovements ? (
                    <div className="py-12 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                      <RefreshCw className="h-4 w-4 animate-spin text-purple-500" />
                      Cargando historial de movimientos...
                    </div>
                  ) : movements.length === 0 ? (
                    <div className="py-12 text-center text-xs text-muted-foreground">
                      No hay registros de movimientos recientes para este repuesto.
                    </div>
                  ) : (
                    <Table>
                      <TableHeader className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                        <TableRow>
                          <TableHead className="text-xs py-2.5">Fecha</TableHead>
                          <TableHead className="text-xs py-2.5">Tipo</TableHead>
                          <TableHead className="text-xs py-2.5 text-right">Cantidad</TableHead>
                          <TableHead className="text-xs py-2.5">Motivo / Nota</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {movements.map((mov) => {
                          const { label, className } = formatMovementType(mov.movement_type)
                          return (
                            <TableRow key={mov.id} className="text-xs border-b border-slate-100 dark:border-slate-800/80">
                              <TableCell className="py-2.5 font-mono text-[11px]">
                                {new Date(mov.created_at).toLocaleString('es-PY')}
                              </TableCell>
                              <TableCell className="py-2.5">
                                <Badge variant="outline" className={cn("text-[10px] px-2 py-0.2 font-semibold border-none text-white", className)}>
                                  {label}
                                </Badge>
                              </TableCell>
                              <TableCell className="py-2.5 text-right font-bold font-mono">
                                {mov.quantity > 0 ? `+${mov.quantity}` : mov.quantity}
                              </TableCell>
                              <TableCell className="py-2.5 text-muted-foreground truncate max-w-[200px]">
                                {mov.notes || '-'}
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Footer Conmutador */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex justify-end gap-2 shrink-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-xl text-xs"
          >
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
