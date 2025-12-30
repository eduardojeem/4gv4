'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Package, Tag, DollarSign, Users, CalendarDays, Copy, Edit, X, 
  Printer, TrendingUp, Barcode, MapPin, Star, CheckCircle2, AlertCircle,
  ChevronLeft, ChevronRight, Minus, Plus
} from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import { resolveProductImageUrl } from '@/lib/images'
import { Product } from '@/types/products'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface ProductDetailsDialogProps {
  open: boolean
  product: Product | null
  onClose: () => void
  onEdit?: (product: Product) => void
  onQuickStockChange?: (productId: string, delta: number) => void
  onViewPriceHistory?: (productId: string) => void
}

export function ProductDetailsDialogV2({ 
  open, 
  product, 
  onClose, 
  onEdit, 
  onQuickStockChange, 
  onViewPriceHistory 
}: ProductDetailsDialogProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [stockAdjustment, setStockAdjustment] = useState('')
  const [activeTab, setActiveTab] = useState('general')

  if (!product) return null

  const images = product.images && product.images.length > 0 
    ? product.images 
    : ['/placeholder-product.png']
  
  const hasPurchase = product.purchase_price > 0
  const margin = hasPurchase ? product.sale_price - product.purchase_price : 0
  const marginPct = hasPurchase ? (margin / product.purchase_price) * 100 : 0
  const stockValue = product.sale_price * product.stock_quantity
  
  const stockStatus = product.stock_quantity === 0
    ? { label: 'Sin Stock', variant: 'destructive' as const, icon: AlertCircle }
    : product.stock_quantity <= product.min_stock
      ? { label: 'Stock Bajo', variant: 'secondary' as const, icon: AlertCircle }
      : { label: 'En Stock', variant: 'default' as const, icon: CheckCircle2 }
  
  const stockPct = product.max_stock
    ? Math.min((product.stock_quantity / product.max_stock) * 100, 100)
    : Math.min((product.stock_quantity / (product.min_stock * 2)) * 100, 100)

  const copySku = async () => {
    try {
      await navigator.clipboard.writeText(product.sku)
      toast.success('SKU copiado al portapapeles')
    } catch {
      toast.error('Error al copiar SKU')
    }
  }

  const copyBarcode = async () => {
    if (!product.barcode) return
    try {
      await navigator.clipboard.writeText(product.barcode)
      toast.success('Código de barras copiado')
    } catch {
      toast.error('Error al copiar código')
    }
  }

  const handlePrint = () => {
    toast.info('Función de impresión en desarrollo')
  }

  const handleStockAdjust = () => {
    const delta = parseInt(stockAdjustment)
    if (isNaN(delta) || delta === 0) {
      toast.error('Ingrese una cantidad válida')
      return
    }
    if (onQuickStockChange) {
      onQuickStockChange(product.id, delta)
      setStockAdjustment('')
      toast.success(`Stock ajustado: ${delta > 0 ? '+' : ''}${delta}`)
    }
  }

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % images.length)
  }

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length)
  }

  const StatusIcon = stockStatus.icon

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-6xl max-h-[92vh] p-0 overflow-hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>{product.name}</DialogTitle>
        </DialogHeader>
        
        {/* Header compacto */}
        <div className="relative bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 px-8 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <Avatar className="h-16 w-16 ring-4 ring-white/20 shadow-lg flex-shrink-0">
                <AvatarImage 
                  src={resolveProductImageUrl(images[currentImageIndex])} 
                  alt={product.name} 
                />
                <AvatarFallback className="bg-white/10 text-white">
                  <Package className="h-6 w-6" />
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-bold text-white truncate">{product.name}</h2>
                  {product.featured && (
                    <Star className="h-5 w-5 text-yellow-300 fill-yellow-300 flex-shrink-0" />
                  )}
                  {!product.is_active && (
                    <Badge variant="secondary" className="bg-red-500/20 text-white border-red-300">
                      Inactivo
                    </Badge>
                  )}
                </div>
                <div className="mt-1 flex items-center gap-2 text-sm text-white/90 flex-wrap">
                  <code className="bg-white/10 px-2 py-0.5 rounded font-mono text-xs">
                    {product.sku}
                  </code>
                  {product.category?.name && (
                    <Badge variant="secondary" className="bg-white/20 text-white border-white/30 text-xs">
                      {product.category.name}
                    </Badge>
                  )}
                  {product.brand && (
                    <Badge variant="secondary" className="bg-white/20 text-white border-white/30 text-xs">
                      {product.brand}
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Toolbar de acciones */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button 
                size="sm" 
                variant="secondary" 
                className="bg-white/90 hover:bg-white text-gray-900" 
                onClick={copySku}
              >
                <Copy className="h-4 w-4 mr-1" /> Copiar
              </Button>
              <Button 
                size="sm" 
                variant="secondary" 
                className="bg-white/90 hover:bg-white text-gray-900" 
                onClick={handlePrint}
              >
                <Printer className="h-4 w-4 mr-1" /> Imprimir
              </Button>
              {onEdit && (
                <Button 
                  size="sm" 
                  variant="secondary" 
                  className="bg-white/90 hover:bg-white text-gray-900" 
                  onClick={() => onEdit(product)}
                >
                  <Edit className="h-4 w-4 mr-1" /> Editar
                </Button>
              )}
              <Button 
                size="sm" 
                variant="ghost" 
                className="text-white hover:bg-white/10" 
                onClick={onClose}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Contenido con scroll */}
        <div className="overflow-y-auto max-h-[calc(92vh-90px)]">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="border-b px-8 bg-muted/30">
              <TabsList className="w-full justify-start bg-transparent h-auto p-0 gap-1">
                <TabsTrigger 
                  value="general" 
                  className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-background rounded-none px-6 py-3 font-medium"
                >
                  📋 General
                </TabsTrigger>
                <TabsTrigger 
                  value="precios" 
                  className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-background rounded-none px-6 py-3 font-medium"
                >
                  💰 Precios
                </TabsTrigger>
                <TabsTrigger 
                  value="stock" 
                  className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-background rounded-none px-6 py-3 font-medium"
                >
                  📦 Stock
                </TabsTrigger>
                <TabsTrigger 
                  value="historial" 
                  className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-background rounded-none px-6 py-3 font-medium"
                >
                  📊 Historial
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="px-8 py-8">
              {/* Tab: General */}
              <TabsContent value="general" className="mt-0 space-y-8">
                {/* Galería de imágenes */}
                {images.length > 0 && (
                  <Card className="shadow-sm">
                    <CardContent className="p-6">
                      <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
                        <img
                          src={resolveProductImageUrl(images[currentImageIndex])}
                          alt={`${product.name} - imagen ${currentImageIndex + 1}`}
                          className="w-full h-full object-contain"
                        />
                        {images.length > 1 && (
                          <>
                            <Button
                              size="icon"
                              variant="secondary"
                              className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white"
                              onClick={prevImage}
                            >
                              <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="secondary"
                              className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white"
                              onClick={nextImage}
                            >
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/50 text-white px-3 py-1 rounded-full text-sm">
                              {currentImageIndex + 1} / {images.length}
                            </div>
                          </>
                        )}
                      </div>
                      
                      {/* Thumbnails */}
                      {images.length > 1 && (
                        <div className="flex gap-2 mt-3 overflow-x-auto">
                          {images.map((img, idx) => (
                            <button
                              key={idx}
                              onClick={() => setCurrentImageIndex(idx)}
                              className={cn(
                                "flex-shrink-0 w-16 h-16 rounded border-2 overflow-hidden transition-all",
                                idx === currentImageIndex 
                                  ? "border-primary ring-2 ring-primary/20" 
                                  : "border-transparent hover:border-muted-foreground/30"
                              )}
                            >
                              <img
                                src={resolveProductImageUrl(img)}
                                alt={`Thumbnail ${idx + 1}`}
                                className="w-full h-full object-cover"
                              />
                            </button>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Métricas principales - Destacadas */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Card className="shadow-md border-2 hover:shadow-lg transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-3">
                        <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-lg">
                          <DollarSign className="h-6 w-6 text-green-600 dark:text-green-400" />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                          Precio de Venta
                        </div>
                        <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                          {formatCurrency(product.sale_price)}
                        </div>
                        <div className="text-xs text-muted-foreground pt-1">
                          Precio al público
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="shadow-md border-2 hover:shadow-lg transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-3">
                        <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                          <TrendingUp className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                          Margen de Ganancia
                        </div>
                        <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                          {hasPurchase ? formatCurrency(margin) : 'N/D'}
                        </div>
                        <div className="flex items-center gap-2 pt-1">
                          {hasPurchase && (
                            <Badge variant="outline" className="font-semibold">
                              {marginPct.toFixed(1)}% de margen
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className={cn(
                    "shadow-md border-2 hover:shadow-lg transition-shadow",
                    product.stock_quantity === 0 && "border-red-200 dark:border-red-900",
                    product.stock_quantity <= product.min_stock && product.stock_quantity > 0 && "border-yellow-200 dark:border-yellow-900"
                  )}>
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-3">
                        <div className={cn(
                          "p-3 rounded-lg",
                          product.stock_quantity === 0 && "bg-red-100 dark:bg-red-900/20",
                          product.stock_quantity <= product.min_stock && product.stock_quantity > 0 && "bg-yellow-100 dark:bg-yellow-900/20",
                          product.stock_quantity > product.min_stock && "bg-purple-100 dark:bg-purple-900/20"
                        )}>
                          <Package className={cn(
                            "h-6 w-6",
                            product.stock_quantity === 0 && "text-red-600 dark:text-red-400",
                            product.stock_quantity <= product.min_stock && product.stock_quantity > 0 && "text-yellow-600 dark:text-yellow-400",
                            product.stock_quantity > product.min_stock && "text-purple-600 dark:text-purple-400"
                          )} />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                          Stock Disponible
                        </div>
                        <div className="text-3xl font-bold">
                          {product.stock_quantity} <span className="text-lg text-muted-foreground">unidades</span>
                        </div>
                        <Badge 
                          variant={stockStatus.variant}
                          className="mt-2 font-semibold"
                        >
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {stockStatus.label}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Información detallada */}
                <div className="space-y-6">
                  {/* Descripción destacada */}
                  <Card className="shadow-sm">
                    <CardContent className="p-6">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="h-1 w-1 rounded-full bg-primary"></div>
                        <h3 className="text-base font-semibold">Descripción del Producto</h3>
                      </div>
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        {product.description || 'Sin descripción disponible'}
                      </p>
                    </CardContent>
                  </Card>

                  {/* Información técnica */}
                  <Card className="shadow-sm">
                    <CardContent className="p-6">
                      <div className="flex items-center gap-2 mb-4">
                        <div className="h-1 w-1 rounded-full bg-primary"></div>
                        <h3 className="text-base font-semibold">Información Técnica</h3>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <div className="flex items-start gap-3">
                            <div className="p-2 bg-muted rounded-lg mt-0.5">
                              <Users className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div className="flex-1">
                              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                                Proveedor
                              </div>
                              <div className="font-medium">{product.supplier?.name || 'Sin proveedor'}</div>
                            </div>
                          </div>

                          <div className="flex items-start gap-3">
                            <div className="p-2 bg-muted rounded-lg mt-0.5">
                              <Package className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div className="flex-1">
                              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                                Unidad de Medida
                              </div>
                              <div className="font-medium">{product.unit_measure}</div>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4">
                          {product.barcode && (
                            <div className="flex items-start gap-3">
                              <div className="p-2 bg-muted rounded-lg mt-0.5">
                                <Barcode className="h-4 w-4 text-muted-foreground" />
                              </div>
                              <div className="flex-1">
                                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                                  Código de Barras
                                </div>
                                <div className="flex items-center gap-2">
                                  <code className="font-mono text-sm bg-muted px-3 py-1 rounded">
                                    {product.barcode}
                                  </code>
                                  <Button size="sm" variant="ghost" onClick={copyBarcode} className="h-8 w-8 p-0">
                                    <Copy className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          )}

                          {product.location && (
                            <div className="flex items-start gap-3">
                              <div className="p-2 bg-muted rounded-lg mt-0.5">
                                <MapPin className="h-4 w-4 text-muted-foreground" />
                              </div>
                              <div className="flex-1">
                                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                                  Ubicación Física
                                </div>
                                <div className="font-medium">{product.location}</div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Etiquetas */}
                  {product.tags && product.tags.length > 0 && (
                    <Card className="shadow-sm">
                      <CardContent className="p-6">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="h-1 w-1 rounded-full bg-primary"></div>
                          <h3 className="text-base font-semibold">Etiquetas</h3>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {product.tags.map((tag) => (
                            <Badge key={tag} variant="secondary" className="px-3 py-1.5 text-sm">
                              <Tag className="h-3 w-3 mr-1.5" />
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </TabsContent>

              {/* Tab: Precios */}
              <TabsContent value="precios" className="mt-0 space-y-6">
                {/* Precios principales */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card className="shadow-md border-2 border-green-100 dark:border-green-900/30">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-lg">
                          <DollarSign className="h-6 w-6 text-green-600 dark:text-green-400" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          💵 Precio de Venta
                        </div>
                        <div className="text-4xl font-bold text-green-600 dark:text-green-400">
                          {formatCurrency(product.sale_price)}
                        </div>
                        <div className="text-sm text-muted-foreground pt-1">
                          Precio al público general
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="shadow-md border-2 border-blue-100 dark:border-blue-900/30">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                          <DollarSign className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          🏷️ Precio de Compra
                        </div>
                        <div className="text-4xl font-bold text-blue-600 dark:text-blue-400">
                          {formatCurrency(product.purchase_price)}
                        </div>
                        <div className="text-sm text-muted-foreground pt-1">
                          Costo de adquisición
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {product.wholesale_price && product.wholesale_price > 0 && (
                    <Card className="shadow-md border-2 border-purple-100 dark:border-purple-900/30">
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div className="p-3 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
                            <Users className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            📦 Precio Mayorista
                          </div>
                          <div className="text-4xl font-bold text-purple-600 dark:text-purple-400">
                            {formatCurrency(product.wholesale_price)}
                          </div>
                          <div className="text-sm text-muted-foreground pt-1">
                            Venta por mayor
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {(product as any).offer_price && (product as any).offer_price > 0 && (
                    <Card className="shadow-md border-2 border-orange-200 dark:border-orange-900/30 bg-gradient-to-br from-orange-50 to-white dark:from-orange-950/20 dark:to-background">
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                            <Tag className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                          </div>
                          <Badge variant="destructive" className="bg-orange-500">
                            ¡OFERTA!
                          </Badge>
                        </div>
                        <div className="space-y-2">
                          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            🔥 Precio de Oferta
                          </div>
                          <div className="text-4xl font-bold text-orange-600 dark:text-orange-400">
                            {formatCurrency((product as any).offer_price)}
                          </div>
                          <div className="text-sm text-muted-foreground pt-1">
                            Precio promocional especial
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>

                {/* Análisis de rentabilidad */}
                <Card className="shadow-md border-2">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-2 mb-6">
                      <div className="h-1 w-1 rounded-full bg-primary"></div>
                      <h3 className="text-lg font-semibold">📊 Análisis de Rentabilidad</h3>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="space-y-2">
                        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          Margen Bruto
                        </div>
                        <div className="text-3xl font-bold text-primary">
                          {formatCurrency(margin)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Ganancia por unidad
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          Porcentaje de Margen
                        </div>
                        <div className="flex items-baseline gap-2">
                          <div className="text-3xl font-bold text-primary">
                            {marginPct.toFixed(1)}%
                          </div>
                          <Badge variant="outline" className="text-sm">
                            {marginPct > 50 ? '🚀 Excelente' : marginPct > 30 ? '✅ Bueno' : '⚠️ Bajo'}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Sobre precio de compra
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          Valor Total en Stock
                        </div>
                        <div className="text-3xl font-bold text-primary">
                          {formatCurrency(stockValue)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {product.stock_quantity} unidades × precio venta
                        </div>
                      </div>
                    </div>

                    {/* Barra visual de margen */}
                    <div className="mt-6 pt-6 border-t">
                      <div className="flex items-center justify-between mb-2 text-sm">
                        <span className="text-muted-foreground">Distribución del precio</span>
                        <span className="font-medium">100%</span>
                      </div>
                      <div className="flex h-8 rounded-lg overflow-hidden border-2">
                        <div 
                          className="bg-blue-500 flex items-center justify-center text-white text-xs font-medium"
                          style={{ width: `${hasPurchase ? (product.purchase_price / product.sale_price * 100) : 50}%` }}
                        >
                          Costo
                        </div>
                        <div 
                          className="bg-green-500 flex items-center justify-center text-white text-xs font-medium"
                          style={{ width: `${hasPurchase ? (margin / product.sale_price * 100) : 50}%` }}
                        >
                          Ganancia
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {onViewPriceHistory && (
                  <Button 
                    variant="outline" 
                    size="lg"
                    className="w-full h-12 text-base font-medium" 
                    onClick={() => onViewPriceHistory(product.id)}
                  >
                    <TrendingUp className="h-5 w-5 mr-2" />
                    Ver Historial Completo de Precios
                  </Button>
                )}
              </TabsContent>

              {/* Tab: Stock */}
              <TabsContent value="stock" className="mt-0 space-y-6">
                {/* Stock actual - Visual destacado */}
                <Card className="shadow-md border-2">
                  <CardContent className="p-8">
                    <div className="text-center mb-8">
                      <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-primary/10 mb-4">
                        <Package className="h-12 w-12 text-primary" />
                      </div>
                      <div className="text-6xl font-bold mb-3 text-primary">
                        {product.stock_quantity}
                      </div>
                      <div className="text-lg text-muted-foreground font-medium">
                        unidades disponibles
                      </div>
                      <Badge 
                        variant={stockStatus.variant}
                        className="mt-4 px-4 py-2 text-base font-semibold"
                      >
                        <StatusIcon className="h-4 w-4 mr-2" />
                        {stockStatus.label}
                      </Badge>
                    </div>

                    {/* Barra de progreso mejorada */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm font-medium">
                        <span className="text-muted-foreground">Nivel de Stock</span>
                        <span className="text-primary">{stockPct.toFixed(0)}%</span>
                      </div>
                      <Progress value={stockPct} className="h-4" />
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-red-500"></div>
                          <span>Mínimo: {product.min_stock}</span>
                        </div>
                        {product.max_stock && (
                          <div className="flex items-center gap-2">
                            <span>Máximo: {product.max_stock}</span>
                            <div className="w-2 h-2 rounded-full bg-green-500"></div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Información de valor */}
                    <div className="mt-8 pt-6 border-t">
                      <div className="grid grid-cols-2 gap-6">
                        <div className="text-center p-4 bg-muted/50 rounded-lg">
                          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                            Valor Unitario
                          </div>
                          <div className="text-2xl font-bold text-primary">
                            {formatCurrency(product.sale_price)}
                          </div>
                        </div>
                        <div className="text-center p-4 bg-primary/5 rounded-lg border-2 border-primary/20">
                          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                            Valor Total en Stock
                          </div>
                          <div className="text-2xl font-bold text-primary">
                            {formatCurrency(stockValue)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Ajuste de stock mejorado */}
                {onQuickStockChange && (
                  <Card className="shadow-md">
                    <CardContent className="p-6">
                      <div className="flex items-center gap-2 mb-6">
                        <div className="h-1 w-1 rounded-full bg-primary"></div>
                        <h3 className="text-lg font-semibold">⚡ Ajuste Rápido de Stock</h3>
                      </div>
                      
                      {/* Botones rápidos */}
                      <div className="grid grid-cols-2 gap-3 mb-6">
                        <Button
                          variant="outline"
                          size="lg"
                          className="h-16 text-lg font-semibold"
                          onClick={() => onQuickStockChange(product.id, -1)}
                          disabled={product.stock_quantity === 0}
                        >
                          <Minus className="h-5 w-5 mr-2" />
                          Restar 1
                        </Button>
                        
                        <Button
                          variant="outline"
                          size="lg"
                          className="h-16 text-lg font-semibold"
                          onClick={() => onQuickStockChange(product.id, 1)}
                        >
                          <Plus className="h-5 w-5 mr-2" />
                          Sumar 1
                        </Button>
                      </div>

                      <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t"></div>
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                          <span className="bg-background px-2 text-muted-foreground">
                            O ajuste personalizado
                          </span>
                        </div>
                      </div>

                      {/* Input personalizado */}
                      <div className="mt-6 space-y-4">
                        <div>
                          <label className="text-sm font-medium mb-2 block">
                            Cantidad a ajustar
                          </label>
                          <Input
                            type="number"
                            placeholder="Ej: +10 o -5"
                            value={stockAdjustment}
                            onChange={(e) => setStockAdjustment(e.target.value)}
                            className="text-center text-lg h-12 font-semibold"
                          />
                          <div className="text-xs text-muted-foreground mt-2 text-center">
                            💡 Usa números positivos para agregar o negativos para restar
                          </div>
                        </div>

                        <Button 
                          size="lg"
                          className="w-full h-12 text-base font-semibold" 
                          onClick={handleStockAdjust}
                          disabled={!stockAdjustment}
                        >
                          Aplicar Ajuste
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Tab: Historial */}
              <TabsContent value="historial" className="mt-0 space-y-4">
                {product.recent_movements && product.recent_movements.length > 0 ? (
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-sm font-medium mb-3">Movimientos Recientes</div>
                      <div className="space-y-3">
                        {product.recent_movements.map((movement: any) => (
                          <div 
                            key={movement.id} 
                            className="flex items-center justify-between p-3 bg-muted rounded-lg"
                          >
                            <div>
                              <div className="font-medium text-sm">{movement.movement_type}</div>
                              <div className="text-xs text-muted-foreground">
                                {new Date(movement.created_at).toLocaleString('es-PY', {
                                  dateStyle: 'medium',
                                  timeStyle: 'short'
                                })}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className={cn(
                                "font-bold",
                                movement.quantity > 0 ? "text-green-600" : "text-red-600"
                              )}>
                                {movement.quantity > 0 ? '+' : ''}{movement.quantity}
                              </div>
                              {movement.unit_cost && (
                                <div className="text-xs text-muted-foreground">
                                  {formatCurrency(movement.unit_cost)}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardContent className="p-8 text-center">
                      <Package className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                      <div className="text-sm text-muted-foreground">
                        No hay movimientos recientes registrados
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardContent className="p-4">
                    <div className="text-sm font-medium mb-3">Información de Registro</div>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Fecha de creación</span>
                        <span className="font-medium">
                          {new Date(product.created_at).toLocaleString('es-PY', {
                            dateStyle: 'medium',
                            timeStyle: 'short'
                          })}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Última actualización</span>
                        <span className="font-medium">
                          {new Date(product.updated_at).toLocaleString('es-PY', {
                            dateStyle: 'medium',
                            timeStyle: 'short'
                          })}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  )
}
