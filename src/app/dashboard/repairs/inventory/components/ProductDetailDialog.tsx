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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Package,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Calendar,
  Tag,
  Building2,
  AlertTriangle,
  Edit,
  History,
  BarChart3,
  X,
  Plus,
  Minus,
  RefreshCw
} from 'lucide-react'
import type { Product } from '@/types/product-unified'
import { useInventory } from '../context/InventoryContext'
import { toast } from 'sonner'

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
  const { updateStock } = useInventory()
  const [movements, setMovements] = useState<any[]>([])
  const [loadingMovements, setLoadingMovements] = useState(false)
  const [adjustmentQuantity, setAdjustmentQuantity] = useState('')
  const [adjustmentReason, setAdjustmentReason] = useState('')
  const [isAdjusting, setIsAdjusting] = useState(false)

  useEffect(() => {
    if (product && open) {
      loadMovements()
    }
  }, [product, open])

  const loadMovements = async () => {
    if (!product) return
    setLoadingMovements(true)
    // Aquí cargarías los movimientos del producto
    // Por ahora simulamos un delay
    setTimeout(() => {
      setMovements([])
      setLoadingMovements(false)
    }, 500)
  }

  const handleStockAdjustment = async () => {
    if (!product || !adjustmentQuantity) {
      toast.error('Por favor ingresa una cantidad')
      return
    }

    const quantity = parseInt(adjustmentQuantity)
    if (isNaN(quantity) || quantity === 0) {
      toast.error('Cantidad inválida')
      return
    }

    setIsAdjusting(true)
    try {
      await updateStock(product.id, quantity)
      setAdjustmentQuantity('')
      setAdjustmentReason('')
      loadMovements()
    } catch (error) {
      logger.error('Error adjusting stock', { error })
    } finally {
      setIsAdjusting(false)
    }
  }

  if (!product) return null

  const isLowStock = (product.stock_quantity || 0) <= (product.min_stock || 5)
  const isOutOfStock = (product.stock_quantity || 0) === 0
  const stockPercentage = product.max_stock 
    ? ((product.stock_quantity || 0) / product.max_stock) * 100 
    : 0
  const margin = (product.sale_price || 0) - (product.purchase_price || 0)
  const marginPercent = product.purchase_price 
    ? (margin / product.purchase_price) * 100 
    : 0
  const stockValue = (product.stock_quantity || 0) * (product.sale_price || 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                {product.name}
              </DialogTitle>
              <DialogDescription className="mt-2 flex items-center gap-2">
                <Badge variant="outline" className="font-mono">
                  SKU: {product.sku}
                </Badge>
                {product.category && (
                  <Badge variant="outline">
                    {product.category.name}
                  </Badge>
                )}
                {isOutOfStock ? (
                  <Badge className="bg-red-500 text-white">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Agotado
                  </Badge>
                ) : isLowStock ? (
                  <Badge className="bg-amber-500 text-white">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Stock Bajo
                  </Badge>
                ) : (
                  <Badge className="bg-green-500 text-white">
                    En Stock
                  </Badge>
                )}
              </DialogDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEdit?.(product)}
              className="hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950/20"
            >
              <Edit className="h-4 w-4 mr-2" />
              Editar
            </Button>
          </div>
        </DialogHeader>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">
              <Package className="h-4 w-4 mr-2" />
              Resumen
            </TabsTrigger>
            <TabsTrigger value="stock">
              <TrendingUp className="h-4 w-4 mr-2" />
              Stock
            </TabsTrigger>
            <TabsTrigger value="history">
              <History className="h-4 w-4 mr-2" />
              Historial
            </TabsTrigger>
          </TabsList>

          {/* TAB: RESUMEN */}
          <TabsContent value="overview" className="space-y-4">
            {/* Estadísticas Rápidas */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="border-l-4 border-l-blue-500">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Precio Venta
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    ${product.sale_price?.toFixed(2)}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-green-500">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Stock Actual
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${
                    isOutOfStock ? 'text-red-600' : 
                    isLowStock ? 'text-amber-600' : 
                    'text-green-600'
                  }`}>
                    {product.stock_quantity}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Min: {product.min_stock} | Max: {product.max_stock}
                  </p>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-purple-500">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Valor Stock
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                    ${stockValue.toFixed(2)}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-amber-500">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Margen
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${
                    marginPercent >= 50 ? 'text-green-600' :
                    marginPercent >= 30 ? 'text-blue-600' :
                    marginPercent >= 15 ? 'text-amber-600' :
                    'text-red-600'
                  }`}>
                    {marginPercent.toFixed(0)}%
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    ${margin.toFixed(2)} por unidad
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Información Detallada */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Información del Producto</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Precio Compra:</span>
                      <span className="font-semibold">${product.purchase_price?.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Precio Mayorista:</span>
                      <span className="font-semibold">
                        {product.wholesale_price ? `$${product.wholesale_price.toFixed(2)}` : '-'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Tag className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Categoría:</span>
                      <span className="font-semibold">{product.category?.name || '-'}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Proveedor:</span>
                      <span className="font-semibold">{product.supplier?.name || '-'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Unidad:</span>
                      <span className="font-semibold">{product.unit_measure || 'unidad'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Creado:</span>
                      <span className="font-semibold">
                        {new Date(product.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>

                {product.description && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="text-sm font-semibold mb-2">Descripción</h4>
                      <p className="text-sm text-muted-foreground">{product.description}</p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Barra de Stock Visual */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Nivel de Stock</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      {product.stock_quantity} / {product.max_stock} unidades
                    </span>
                    <span className="font-semibold">{stockPercentage.toFixed(0)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        isOutOfStock ? 'bg-red-500' :
                        isLowStock ? 'bg-amber-500' :
                        stockPercentage > 80 ? 'bg-blue-500' :
                        'bg-green-500'
                      }`}
                      style={{ width: `${Math.min(stockPercentage, 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Min: {product.min_stock}</span>
                    <span>Max: {product.max_stock}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB: STOCK */}
          <TabsContent value="stock" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Ajustar Stock</CardTitle>
                <DialogDescription>
                  Realiza ajustes manuales al inventario
                </DialogDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="quantity">Cantidad</Label>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setAdjustmentQuantity(String(parseInt(adjustmentQuantity || '0') - 1))}
                        disabled={isAdjusting}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <Input
                        id="quantity"
                        type="number"
                        placeholder="0"
                        value={adjustmentQuantity}
                        onChange={(e) => setAdjustmentQuantity(e.target.value)}
                        className="text-center"
                        disabled={isAdjusting}
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setAdjustmentQuantity(String(parseInt(adjustmentQuantity || '0') + 1))}
                        disabled={isAdjusting}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Usa números negativos para reducir stock
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="reason">Motivo (opcional)</Label>
                    <Input
                      id="reason"
                      placeholder="Ej: Ajuste de inventario"
                      value={adjustmentReason}
                      onChange={(e) => setAdjustmentReason(e.target.value)}
                      disabled={isAdjusting}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                  <div>
                    <p className="text-sm font-medium">Stock Actual</p>
                    <p className="text-2xl font-bold">{product.stock_quantity}</p>
                  </div>
                  <ArrowRight className="h-6 w-6 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Nuevo Stock</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {(product.stock_quantity || 0) + parseInt(adjustmentQuantity || '0')}
                    </p>
                  </div>
                </div>

                <Button
                  onClick={handleStockAdjustment}
                  disabled={isAdjusting || !adjustmentQuantity}
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                >
                  {isAdjusting ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Ajustando...
                    </>
                  ) : (
                    <>
                      <Package className="h-4 w-4 mr-2" />
                      Aplicar Ajuste
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Alertas de Stock */}
            {(isLowStock || isOutOfStock) && (
              <Card className="border-l-4 border-l-amber-500 bg-amber-50 dark:bg-amber-950/20">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2 text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="h-5 w-5" />
                    Alerta de Stock
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-amber-600 dark:text-amber-300">
                    {isOutOfStock 
                      ? 'Este producto está agotado. Considera realizar un pedido urgente.'
                      : 'El stock está por debajo del mínimo recomendado. Considera reabastecer pronto.'}
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* TAB: HISTORIAL */}
          <TabsContent value="history" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Movimientos Recientes</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadMovements}
                    disabled={loadingMovements}
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${loadingMovements ? 'animate-spin' : ''}`} />
                    Actualizar
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loadingMovements ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
                    Cargando movimientos...
                  </div>
                ) : movements.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <History className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No hay movimientos registrados para este producto</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Cantidad</TableHead>
                        <TableHead>Stock Final</TableHead>
                        <TableHead>Motivo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {movements.map((mov) => (
                        <TableRow key={mov.id}>
                          <TableCell className="text-sm">
                            {new Date(mov.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <Badge>
                              {mov.movement_type}
                            </Badge>
                          </TableCell>
                          <TableCell className={mov.quantity > 0 ? 'text-green-600' : 'text-red-600'}>
                            {mov.quantity > 0 ? '+' : ''}{mov.quantity}
                          </TableCell>
                          <TableCell>{mov.new_stock}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {mov.reason || '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

function ArrowRight({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  )
}
