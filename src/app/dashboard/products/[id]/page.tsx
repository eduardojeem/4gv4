'use client'

import { useState, useEffect, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion  } from '../../../../components/ui/motion'
import { 
  ArrowLeft, 
  Edit, 
  Trash2, 
  Package, 
  AlertTriangle,
  TrendingUp,
  Download,
  Upload,
  BarChart3,
  History,
  Copy,
  Check,
  Share2,
  Clock,
  Image as ImageIcon,
  DollarSign,
  Zap
} from 'lucide-react'
import { GSIcon } from '@/components/ui/standardized-components'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/use-toast'
import { useProductsSupabase } from '@/hooks/useProductsSupabase'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/types'
type Json = Database['public']['Tables']['products']['Row']['dimensions']
import { ProductModal } from '@/components/dashboard/product-modal'
import Image from 'next/image'
import { resolveProductImageUrl } from '@/lib/images'

interface ProductImage {
  id: string
  url: string
  alt: string
  isPrimary: boolean
}

interface StockMovement {
  id: string
  type: 'entrada' | 'salida' | 'ajuste' | 'transferencia'
  quantity: number
  previousStock: number
  newStock: number
  reason: string
  date: string
  user: string
}

export default function ProductDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const productId = params.id as string

  const {
    categories,
    suppliers,
    updateProduct,
    deleteProduct
  } = useProductsSupabase()

  const [product, setProduct] = useState<Product | null>(null)
  const [loadingProduct, setLoadingProduct] = useState(true)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  const [activeTab, setActiveTab] = useState('overview')

  // Cargar el producto individualmente
  useEffect(() => {
    const loadProduct = async () => {
      setLoadingProduct(true)
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from('products')
          .select(`
            *,
            category:categories(id, name, description),
            supplier:suppliers(id, name, email, phone, address)
          `)
          .eq('id', productId)
          .single()
        
        if (error) throw error
        setProduct(data as unknown as Product)
      } catch (e) {
        console.error('Error cargando producto:', e)
        toast({
          title: "Error",
          description: "No se pudo cargar la información del producto.",
          variant: "destructive"
        })
      } finally {
        setLoadingProduct(false)
      }
    }
    loadProduct()
  }, [productId, toast])

  const normalizedCategories = useMemo(() => {
    return (categories || []).map(c => ({
      id: c.id,
      name: c.name,
      description: c.description || null,
      parent_id: null,
      is_active: c.is_active,
      created_at: c.created_at,
      updated_at: c.updated_at
    }))
  }, [categories])

  const normalizedSuppliers = useMemo(() => {
    return (suppliers || []).map(s => ({
      id: s.id,
      name: s.name,
      contact_name: s.contact_name || null,
      contact_email: s.contact_email || null,
      phone: s.phone || null,
      address: s.address || null,
      tax_id: s.tax_id || null,
      is_active: s.is_active,
      created_at: s.created_at,
      updated_at: s.updated_at
    }))
  }, [suppliers])

  const [stockMovements, setStockMovements] = useState<StockMovement[]>([])
  type PriceHistoryEntry = {
    id: string
    type: 'purchase' | 'sale' | 'wholesale'
    old_price: number
    new_price: number
    change_reason?: string | null
    created_at: string
    currency?: string | null
  }
  const [priceHistory, setPriceHistory] = useState<PriceHistoryEntry[]>([])

  // Imágenes mock del producto
  const productImages: ProductImage[] = useMemo(() => {
    const urls = (product?.images || []).filter(Boolean) as string[]
    const uniq = Array.from(new Set(urls))
    if (uniq.length === 0) {
      return [{ id: '1', url: '/placeholder-product.jpg', alt: product?.name || 'Producto', isPrimary: true }]
    }
    return uniq.map((u, i) => ({ id: `${i + 1}`, url: resolveProductImageUrl(u), alt: product?.name || 'Producto', isPrimary: i === 0 }))
  }, [product?.images, product?.name])

  useEffect(() => {
    if (!loadingProduct && !product) {
      toast({
        title: "Producto no encontrado",
        description: "El producto que buscas no existe o ha sido eliminado.",
        variant: "destructive"
      })
      router.push('/dashboard/products')
    }
  }, [product, loadingProduct, router, toast])

  useEffect(() => {
    const fetchMovements = async () => {
      if (!productId) return
      const supabase = createClient()
      try {
        const { data, error } = await supabase
          .from('product_movements')
          .select('*')
          .eq('product_id', productId)
          .order('created_at', { ascending: false })
        if (error) throw error
        type MovementRow = Database['public']['Tables']['product_movements']['Row'] & { notes?: string; reason?: string }
        const mapped: StockMovement[] = ((data || []) as MovementRow[]).map((m) => ({
          id: m.id,
          type: m.movement_type === 'in' ? 'entrada' : m.movement_type === 'out' ? 'salida' : m.movement_type === 'adjustment' ? 'ajuste' : 'transferencia',
          quantity: m.quantity,
          previousStock: m.previous_stock,
          newStock: m.new_stock,
          reason: m.notes || m.reason || '',
          date: m.created_at,
          user: m.user_id || 'Sistema'
        }))
        setStockMovements(mapped)
      } catch (e) {
        console.log('Error cargando movimientos:', e)
      }
    }
    fetchMovements()
    const fetchPriceHistory = async () => {
      if (!productId) return
      const supabase = createClient()
      try {
        const { data, error } = await supabase
          .from('product_price_history')
          .select('*')
          .eq('product_id', productId)
          .order('created_at', { ascending: false })
        if (error) throw error
        type PriceHistoryRow = {
          id: string
          product_id: string
          price_type: 'purchase' | 'sale' | 'wholesale'
          old_price?: number
          new_price: number
          change_reason?: string | null
          currency?: string | null
          user_id?: string | null
          created_at: string
        }
        const rows = ((data || []) as PriceHistoryRow[])
        const mapped: PriceHistoryEntry[] = rows.map((row) => ({
          id: row.id,
          type: row.price_type,
          old_price: row.old_price ?? 0,
          new_price: row.new_price,
          change_reason: row.change_reason ?? null,
          currency: row.currency ?? 'PYG',
          created_at: row.created_at
        }))
        setPriceHistory(mapped)
      } catch (e) {
        console.log('Error cargando historial de precios:', e)
      }
    }
    fetchPriceHistory()
  }, [productId])

  const handleEdit = () => {
    setEditModalOpen(true)
  }

  const handleDelete = async () => {
    if (!product) return
    
    try {
      await deleteProduct(product.id)
      toast({
        title: "Producto eliminado",
        description: "El producto ha sido eliminado exitosamente."
      })
      router.push('/dashboard/products')
    } catch (_) {
      toast({
        title: "Error",
        description: "No se pudo eliminar el producto.",
        variant: "destructive"
      })
    }
  }

  const handleCopyId = () => {
    navigator.clipboard.writeText(product?.id || '')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast({
      title: "ID copiado",
      description: "El ID del producto ha sido copiado al portapapeles."
    })
  }

  const handleShare = () => {
    const url = window.location.href
    navigator.clipboard.writeText(url)
    toast({
      title: "Enlace copiado",
      description: "El enlace del producto ha sido copiado al portapapeles."
    })
  }

  const getStockStatusColor = (status: string) => {
    switch (status) {
      case 'in_stock': return 'bg-green-100 text-green-800'
      case 'low_stock': return 'bg-yellow-100 text-yellow-800'
      case 'out_of_stock': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStockStatusLabel = (status: string) => {
    switch (status) {
      case 'in_stock': return 'En Stock'
      case 'low_stock': return 'Stock Bajo'
      case 'out_of_stock': return 'Agotado'
      default: return 'Desconocido'
    }
  }

  const formatCurrency = (amount: number) => {
    const formatted = new Intl.NumberFormat('es-PY', {
      minimumFractionDigits: 0
    }).format(amount)
    return `Gs. ${formatted}`
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loadingProduct) {
    return (
      <div className="min-h-screen bg-gray-50/50 dark:bg-gray-900 p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Skeleton className="h-96 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
            <div className="space-y-6">
              <Skeleton className="h-48 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!product) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
        >
          <div className="flex items-center gap-4">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => router.back()}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{product.name}</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm text-gray-500 dark:text-gray-400">SKU: {product.sku}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyId}
                  className="h-6 px-2"
                >
                  {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                </Button>
              </div>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleShare}>
              <Share2 className="h-4 w-4 mr-2" />
              Compartir
            </Button>
            <Button variant="outline" size="sm" onClick={handleEdit}>
              <Edit className="h-4 w-4 mr-2" />
              Editar
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setDeleteConfirmOpen(true)}
              className="text-red-600 hover:text-red-700"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Eliminar
            </Button>
          </div>
        </motion.div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Product Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Product Images */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
            >
              <Card className="border-0 shadow-sm dark:bg-gray-800 dark:border-gray-700">
                <CardContent className="p-6">
                  <div className="aspect-square bg-gray-100 dark:bg-gray-900 rounded-lg flex items-center justify-center mb-4 relative">
                    {productImages && productImages[selectedImageIndex]?.url ? (
                      <Image 
                        src={productImages[selectedImageIndex].url}
                        alt={product?.name || ''}
                        fill
                        className="object-cover rounded-lg"
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 600px"
                      />
                    ) : (
                      <div className="text-center">
                        <ImageIcon className="h-16 w-16 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-500 dark:text-gray-400">Sin imagen</p>
                      </div>
                    )}
                  </div>
                  
                  {/* Image thumbnails would go here */}
                  <div className="flex gap-2">
                    {productImages.map((image, index) => (
                      <button
                        key={image.id}
                        onClick={() => setSelectedImageIndex(index)}
                        className={`w-16 h-16 rounded-lg border-2 overflow-hidden ${
                          selectedImageIndex === index ? 'border-blue-500' : 'border-gray-200 dark:border-gray-700'
                        }`}
                      >
                        <Image 
                          src={image.url}
                          alt={image.alt}
                          width={64}
                          height={64}
                          className="object-cover"
                        />
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Product Information Tabs */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-4 dark:bg-gray-800">
                  <TabsTrigger value="overview">Resumen</TabsTrigger>
                  <TabsTrigger value="inventory">Inventario</TabsTrigger>
                  <TabsTrigger value="history">Historial</TabsTrigger>
                  <TabsTrigger value="analytics">Análisis</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-6">
                  <Card className="border-0 shadow-sm dark:bg-gray-800 dark:border-gray-700">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 dark:text-gray-100">
                        <Package className="h-5 w-5" />
                        Información del Producto
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Descripción</label>
                          <p className="text-gray-900 dark:text-gray-100">{product.description || 'Sin descripción'}</p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Marca</label>
                          <p className="text-gray-900 dark:text-gray-100">{product.brand || 'Sin marca'}</p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Categoría</label>
                          <p className="text-gray-900 dark:text-gray-100">{product.category?.name || 'Sin categoría'}</p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Proveedor</label>
                          <p className="text-gray-900 dark:text-gray-100">{product.supplier?.name || 'Sin proveedor'}</p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Código de Barras</label>
                          <p className="text-gray-900 dark:text-gray-100">{product.barcode || 'Sin código'}</p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Unidad de Medida</label>
                          <p className="text-gray-900 dark:text-gray-100">{product.unit_measure || 'unidad'}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="inventory" className="space-y-6">
                  <Card className="border-0 shadow-sm dark:bg-gray-800 dark:border-gray-700">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 dark:text-gray-100">
                        <BarChart3 className="h-5 w-5" />
                        Estado del Inventario
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                          <Package className="h-8 w-8 text-blue-600 dark:text-blue-400 mx-auto mb-2" />
                          <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">{product.stock_quantity}</p>
                          <p className="text-sm text-blue-600 dark:text-blue-300">Stock Actual</p>
                        </div>
                        <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                          <AlertTriangle className="h-8 w-8 text-yellow-600 dark:text-yellow-400 mx-auto mb-2" />
                          <p className="text-2xl font-bold text-yellow-900 dark:text-yellow-100">{product.min_stock}</p>
                          <p className="text-sm text-yellow-600 dark:text-yellow-300">Stock Mínimo</p>
                        </div>
                        <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                          <TrendingUp className="h-8 w-8 text-green-600 dark:text-green-400 mx-auto mb-2" />
                          <p className="text-2xl font-bold text-green-900 dark:text-green-100">{'N/A'}</p>
                          <p className="text-sm text-green-600 dark:text-green-300">Stock Máximo</p>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="dark:text-gray-300">Nivel de Stock</span>
                          <span className="dark:text-gray-300">{Math.round((product.stock_quantity / Math.max(product.min_stock || 1, 1)) * 100)}%</span>
                        </div>
                        <Progress 
                          value={(product.stock_quantity / Math.max(product.min_stock || 1, 1)) * 100} 
                          className="h-2"
                        />
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="history" className="space-y-6">
                  <Card className="border-0 shadow-sm dark:bg-gray-800 dark:border-gray-700">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 dark:text-gray-100">
                        <History className="h-5 w-5" />
                        Movimientos de Stock
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {stockMovements.map((movement) => (
                          <div key={movement.id} className="flex items-center justify-between p-4 border rounded-lg dark:border-gray-700">
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-full ${
                                movement.type === 'entrada' ? 'bg-green-100 dark:bg-green-900/20' :
                                movement.type === 'salida' ? 'bg-red-100 dark:bg-red-900/20' : 'bg-blue-100 dark:bg-blue-900/20'
                              }`}>
                                {movement.type === 'entrada' ? (
                                  <Upload className="h-4 w-4 text-green-600 dark:text-green-400" />
                                ) : movement.type === 'salida' ? (
                                  <Download className="h-4 w-4 text-red-600 dark:text-red-400" />
                                ) : (
                                  <Edit className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                )}
                              </div>
                              <div>
                                <p className="font-medium dark:text-gray-100">
                                  {movement.type === 'entrada' ? 'Entrada' :
                                   movement.type === 'salida' ? 'Salida' : 'Ajuste'} 
                                  de {Math.abs(movement.quantity)} unidades
                                </p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">{movement.reason}</p>
                                <p className="text-xs text-gray-400 dark:text-gray-500">
                                  {formatDate(movement.date)} • {movement.user}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                {movement.previousStock} → {movement.newStock}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-0 shadow-sm dark:bg-gray-800 dark:border-gray-700">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 dark:text-gray-100">
                        <DollarSign className="h-5 w-5" />
                        Historial de Precios
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {priceHistory.length === 0 ? (
                          <p className="text-sm text-gray-500 dark:text-gray-400">Sin cambios de precio registrados</p>
                        ) : (
                          priceHistory.map((ph) => (
                            <div key={ph.id} className="flex items-center justify-between p-4 border rounded-lg dark:border-gray-700">
                              <div>
                                <p className="font-medium dark:text-gray-100">
                                  {ph.type === 'purchase' ? 'Compra' : ph.type === 'sale' ? 'Venta' : 'Mayorista'}: {formatCurrency(ph.old_price)} → {formatCurrency(ph.new_price)}
                                </p>
                                {ph.change_reason && (
                                  <p className="text-sm text-gray-500 dark:text-gray-400">{ph.change_reason}</p>
                                )}
                                <p className="text-xs text-gray-400 dark:text-gray-500">{formatDate(ph.created_at)}</p>
                              </div>
                              <Badge variant="outline" className="text-xs dark:text-gray-300 dark:border-gray-600">
                                {ph.type}
                              </Badge>
                            </div>
                          ))
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="analytics" className="space-y-6">
                  <Card className="border-0 shadow-sm dark:bg-gray-800 dark:border-gray-700">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 dark:text-gray-100">
                        <BarChart3 className="h-5 w-5" />
                        Análisis de Rendimiento
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <h4 className="font-medium mb-3 dark:text-gray-200">Métricas Financieras</h4>
                          <div className="space-y-3">
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-500 dark:text-gray-400">Valor en Stock</span>
                              <span className="font-medium dark:text-gray-200">{formatCurrency(product.stock_quantity * product.sale_price)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-500 dark:text-gray-400">Margen por Unidad</span>
                              <span className="font-medium dark:text-gray-200">{formatCurrency(product.sale_price - (product.purchase_price || 0))}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-500 dark:text-gray-400">Margen %</span>
                              <span className="font-medium dark:text-gray-200">
                                {product.purchase_price ? 
                                  `${(((product.sale_price - product.purchase_price) / product.purchase_price) * 100).toFixed(1)}%` : 
                                  'N/A'
                                }
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        <div>
                          <h4 className="font-medium mb-3 dark:text-gray-200">Estado del Producto</h4>
                          <div className="space-y-3">
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-500 dark:text-gray-400">Estado</span>
                              <Badge className={getStockStatusColor(product.stock_status || '')}>
                                {getStockStatusLabel(product.stock_status || '')}
                              </Badge>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-500 dark:text-gray-400">Activo</span>
                              <Badge variant={product.is_active ? "default" : "secondary"}>
                                {product.is_active ? 'Sí' : 'No'}
                              </Badge>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-500 dark:text-gray-400">Destacado</span>
                              <Badge variant={product.featured ? "default" : "secondary"}>
                                {product.featured ? 'Sí' : 'No'}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </motion.div>
          </div>

          {/* Right Column - Quick Info & Actions */}
          <div className="space-y-6">
            {/* Price & Stock Info */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card className="border-0 shadow-sm dark:bg-gray-800 dark:border-gray-700">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 dark:text-gray-100">
                    <GSIcon className="h-5 w-5" />
                    Información de Precios
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Precio de Venta</label>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">{formatCurrency(product.sale_price)}</p>
                  </div>
                  {product.purchase_price != null && (
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Precio de Costo</label>
                    <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(product.purchase_price)}</p>
                  </div>
                  )}
                  <Separator className="dark:bg-gray-700" />
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Stock Status</span>
                    <Badge className={getStockStatusColor(product.stock_status || '')}>
                      {getStockStatusLabel(product.stock_status || '')}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Quick Actions */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card className="border-0 shadow-sm dark:bg-gray-800 dark:border-gray-700">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 dark:text-gray-100">
                    <Zap className="h-5 w-5" />
                    Acciones Rápidas
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button className="w-full" onClick={handleEdit}>
                    <Edit className="h-4 w-4 mr-2" />
                    Editar Producto
                  </Button>
                  <Button variant="outline" className="w-full">
                    <Package className="h-4 w-4 mr-2" />
                    Ajustar Stock
                  </Button>
                  <Button variant="outline" className="w-full">
                    <BarChart3 className="h-4 w-4 mr-2" />
                    Ver Reportes
                  </Button>
                  <Button variant="outline" className="w-full">
                    <Download className="h-4 w-4 mr-2" />
                    Exportar Datos
                  </Button>
                </CardContent>
              </Card>
            </motion.div>

            {/* Product Metadata */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card className="border-0 shadow-sm dark:bg-gray-800 dark:border-gray-700">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 dark:text-gray-100">
                    <Clock className="h-5 w-5" />
                    Información del Sistema
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Creado</label>
                    <p className="text-sm text-gray-900 dark:text-gray-100">{formatDate(product.created_at)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Última Actualización</label>
                    <p className="text-sm text-gray-900 dark:text-gray-100">{formatDate(product.updated_at)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">ID del Producto</label>
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-gray-500 font-mono dark:text-gray-400">{product.id}</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleCopyId}
                        className="h-6 px-2"
                      >
                        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>

        {/* Modals */}
        {editModalOpen && (
          <ProductModal
            isOpen={editModalOpen}
            onClose={() => setEditModalOpen(false)}
            product={product ? ({ ...product, images: product.images ?? [] } as unknown as import('@/types/products').Product) : null}
            categories={normalizedCategories}
            suppliers={normalizedSuppliers}
            onSave={async (data) => {
              try {
                // Convertir ProductFormData a formato compatible con Supabase
                const supabaseData: Database['public']['Tables']['products']['Update'] = {
                  ...data,
                  dimensions: data.dimensions as Json | null
                }
                await updateProduct(product.id, supabaseData)
                setEditModalOpen(false)
                toast({
                  title: "Producto actualizado",
                  description: "Los cambios han sido guardados exitosamente."
                })
              } catch (error) {
                toast({
                  title: "Error",
                  description: "No se pudo actualizar el producto.",
                  variant: "destructive"
                })
              }
            }}
          />
        )}

        {/* Delete Confirmation */}
        {deleteConfirmOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 shadow-lg border dark:border-gray-700"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-red-100 dark:bg-red-900/20 rounded-full">
                  <Trash2 className="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">Eliminar Producto</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Esta acción no se puede deshacer</p>
                </div>
              </div>
              <p className="text-gray-700 dark:text-gray-300 mb-6">
                ¿Estás seguro de que quieres eliminar &quot;{product.name}&quot;?
                Todos los datos relacionados se perderán permanentemente.
              </p>
              <div className="flex gap-3 justify-end">
                <Button 
                  variant="outline" 
                  onClick={() => setDeleteConfirmOpen(false)}
                  className="dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700 dark:hover:bg-gray-700"
                >
                  Cancelar
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={handleDelete}
                >
                  Eliminar
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  )
}
