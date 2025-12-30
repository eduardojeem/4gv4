'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Package, Tag, DollarSign, Users, CalendarDays, Copy, Edit, X } from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import { resolveProductImageUrl } from '@/lib/images'
import { Product } from '@/types/products'
import { toast } from 'sonner'

interface ProductDetailsDialogProps {
  open: boolean
  product: Product | null
  onClose: () => void
  onEdit?: (product: Product) => void
  onQuickStockChange?: (productId: string, delta: number) => void
  onViewPriceHistory?: (productId: string) => void
}

export function ProductDetailsDialog({ open, product, onClose, onEdit, onQuickStockChange, onViewPriceHistory }: ProductDetailsDialogProps) {
  if (!product) return null

  const hasPurchase = product.purchase_price > 0
  const margin = hasPurchase ? product.sale_price - product.purchase_price : 0
  const marginPct = hasPurchase ? (margin / product.purchase_price) * 100 : 0
  const stockValue = product.sale_price * product.stock_quantity
  const stockStatus = product.stock_quantity === 0
    ? 'Sin Stock'
    : product.stock_quantity <= product.min_stock
      ? 'Stock Bajo'
      : 'En Stock'
  const stockPct = product.max_stock
    ? Math.min((product.stock_quantity / product.max_stock) * 100, 100)
    : Math.min((product.stock_quantity / (product.min_stock * 2)) * 100, 100)

  const copySku = async () => {
    try {
      await navigator.clipboard.writeText(product.sku)
      toast.success('SKU copiado')
    } catch {}
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden">
        <DialogHeader>
          <DialogTitle className="sr-only">{product.name}</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <div className="h-28 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600" />
          <div className="px-6 -mt-10">
            <div className="flex items-end gap-4">
              <Avatar className="h-20 w-20 ring-4 ring-white shadow-lg">
                <AvatarImage src={resolveProductImageUrl((product.images && product.images[0]) || '')} alt={product.name} />
                <AvatarFallback className="bg-muted">
                  <Package className="h-8 w-8" />
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 text-white">
                <h2 className="text-2xl font-bold drop-shadow-sm">{product.name}</h2>
                <div className="mt-1 flex items-center gap-2 text-sm opacity-90">
                  <Tag className="h-4 w-4" />
                  <code className="bg-white/10 px-2 py-0.5 rounded">{product.sku}</code>
                  <Badge variant="secondary" className="bg-white/25 text-white/95 border-white/40">
                    {product.category?.name || 'Sin categoría'}
                  </Badge>
                  {product.brand && (
                    <Badge variant="secondary" className="bg-white/25 text-white/95 border-white/40">{product.brand}</Badge>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 mb-1">
                <Button size="sm" variant="secondary" className="bg-white text-gray-900" onClick={copySku} aria-label="Copiar SKU">
                  <Copy className="h-4 w-4 mr-1" /> Copiar SKU
                </Button>
                {onEdit && (
                  <Button size="sm" variant="secondary" className="bg-white text-gray-900" onClick={() => onEdit(product)} aria-label="Editar producto">
                    <Edit className="h-4 w-4 mr-1" /> Editar
                  </Button>
                )}
                <Button size="sm" variant="ghost" className="text-white hover:bg-white/10" onClick={onClose} aria-label="Cerrar">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 pb-6 space-y-6">
          {/* Resumen y métricas */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-0 shadow-md">
              <CardContent className="p-4">
                <div className="text-sm text-muted-foreground">Precio Venta</div>
                <div className="text-2xl font-semibold">{formatCurrency(product.sale_price)}</div>
                <div className="mt-2 flex items-center gap-2 text-sm">
                  <div className="text-muted-foreground">Compra</div>
                  <div>{formatCurrency(product.purchase_price)}</div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-md">
              <CardContent className="p-4">
                <div className="text-sm text-muted-foreground">Margen</div>
                <div className="text-2xl font-semibold flex items-center gap-2">
                  <DollarSign className="h-5 w-5" /> {hasPurchase ? formatCurrency(margin) : 'N/D'}
                  <Badge variant="outline" className="ml-2">{hasPurchase ? `${marginPct.toFixed(1)}%` : 'N/D'}</Badge>
                </div>
                <div className="mt-2 text-sm text-muted-foreground">{hasPurchase ? 'Sobre precio de compra' : 'Sin precio de compra'}</div>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-md">
              <CardContent className="p-4">
                <div className="text-sm text-muted-foreground">Stock</div>
                <div className="flex items-center justify-between">
                  <div className="text-2xl font-semibold">{product.stock_quantity}</div>
                  <Badge variant="outline">{stockStatus}</Badge>
                </div>
                <Progress value={stockPct} className="h-2 mt-3" />
                <div className="mt-2 flex items-center justify-between text-sm text-muted-foreground">
                  <span>Min: {product.min_stock}</span>
                  {product.max_stock && <span>Max: {product.max_stock}</span>}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Información principal */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border-0 shadow-md">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <span className="text-sm">{product.supplier?.name || 'Sin proveedor'}</span>
                </div>
                <div className="text-sm text-muted-foreground leading-relaxed">
                  {product.description || 'Sin descripción'}
                </div>
                <div className="flex flex-wrap gap-2">
                  {product.tags?.map((t) => (
                    <Badge key={t} variant="secondary">{t}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-md">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CalendarDays className="h-4 w-4" />
                  Creado: {new Date(product.created_at).toLocaleString()}
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CalendarDays className="h-4 w-4" />
                  Actualizado: {new Date(product.updated_at).toLocaleString()}
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Package className="h-4 w-4" /> Unidad: {product.unit_measure}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Valor en stock */}
          <Card className="border-0 shadow-md">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="text-sm text-muted-foreground">Valor total en stock</div>
              <div className="text-xl font-semibold">{formatCurrency(stockValue)}</div>
            </CardContent>
          </Card>

          {/* Actividad reciente */}
          {product.recent_movements && product.recent_movements.length > 0 && (
            <Card className="border-0 shadow-md">
              <CardContent className="p-4 space-y-2">
                <div className="text-sm font-medium">Actividad reciente</div>
                <div className="space-y-2">
                  {product.recent_movements.slice(0, 3).map((m: any) => (
                    <div key={m.id} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{new Date(m.created_at).toLocaleString()}</span>
                      <span className="font-medium">{m.movement_type}</span>
                      <span>{m.quantity}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Acciones */}
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={copySku} aria-label="Copiar SKU">
              <Copy className="h-4 w-4 mr-1" /> Copiar SKU
            </Button>
            {onQuickStockChange && (
              <div className="flex items-center gap-2">
                <Button variant="secondary" onClick={() => onQuickStockChange(product.id, 1)} aria-label="Añadir una unidad">+1</Button>
                <Button variant="secondary" onClick={() => onQuickStockChange(product.id, -1)} aria-label="Remover una unidad">-1</Button>
              </div>
            )}
            {onViewPriceHistory && (
              <Button variant="outline" onClick={() => onViewPriceHistory(product.id)} aria-label="Ver historial de precios">Historial de precios</Button>
            )}
            {onEdit && (
              <Button variant="secondary" onClick={() => onEdit(product)} aria-label="Editar producto">
                <Edit className="h-4 w-4 mr-1" /> Editar
              </Button>
            )}
            <Button variant="ghost" onClick={onClose} aria-label="Cerrar">Cerrar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
