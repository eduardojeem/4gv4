'use client'

import { useState, useEffect, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence  } from '../../../../components/ui/motion'
import { useProductsSupabase } from '@/hooks/useProductsSupabase'
import { createClient } from '@/lib/supabase/client'
import { getPublicUrl } from '@/lib/supabase-storage'
import type { Database } from '@/lib/supabase/types'
type Json = Database['public']['Tables']['products']['Row']['dimensions']
import { ProductModal } from '@/components/dashboard/product-modal'
import { toast } from 'sonner'
import { ProductDetailHeader } from '@/components/dashboard/products/ProductDetailHeader'
import { ProductStatsCard } from '@/components/dashboard/products/ProductStatsCard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import Image from 'next/image'
import {
  Package,
  History,
  BarChart3,
  Settings,
  Upload,
  Download,
  Edit,
  ImageIcon,
  Plus,
  AlertTriangle
} from 'lucide-react'

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

export default function ProductDetailPageModern() {
  const params = useParams()
  const router = useRouter()
  const productId = params.id as string

  const {
    products,
    categories,
    suppliers,
    loading,
    updateProduct,
    deleteProduct,
  } = useProductsSupabase()

  const [editModalOpen, setEditModalOpen] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [isFavorite, setIsFavorite] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')

  const product = useMemo(() => {
    return products.find(p => p.id === productId)
  }, [products, productId])

  const supabaseClient = useMemo(() => createClient(), [])
  const resolveImageUrl = (url?: string | null) => {
    if (!url) return '/placeholder-product.jpg'
    if (url.startsWith('http')) return url
    try {
      const publicUrl = getPublicUrl('product-images', url)
      return publicUrl || '/placeholder-product.jpg'
    } catch (error) {
      console.warn('Error resolving product image URL:', error)
      return '/placeholder-product.jpg'
    }
  }
  const productImageUrl = resolveImageUrl((product?.images && product.images[0]) || undefined)

  const formatCurrency = (amount: number) => {
    const formatted = new Intl.NumberFormat('es-PY', { minimumFractionDigits: 0 }).format(amount)
    return `Gs. ${formatted}`
  }

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

  useEffect(() => {
    if (!loading && !product) {
      toast.error('Producto no encontrado')
      router.push('/dashboard/products')
    }
  }, [product, loading, router])

  useEffect(() => {
    const fetchMovements = async () => {
      if (!productId) return
      const supabase = createClient()
      try {
        type MovementRow = Database['public']['Tables']['product_movements']['Row']
        // Simplified type assertion to avoid "Type instantiation is excessively deep" error
        const result = await supabase
          .from('product_movements')
          .select('*')
          .eq('product_id', productId)
          .order('created_at', { ascending: false })

        const { data, error } = result as { data: MovementRow[] | null, error: unknown }

        if (error) throw error
        const mapped: StockMovement[] = ((data || []) as MovementRow[]).map((m) => ({
          id: m.id,
          type: m.movement_type === 'in' ? 'entrada' : m.movement_type === 'out' ? 'salida' : m.movement_type === 'adjustment' ? 'ajuste' : 'transferencia',
          quantity: m.quantity,
          previousStock: m.previous_stock,
          newStock: m.new_stock,
          reason: m.reason || '',
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
        const rows = (data || []) as PriceHistoryRow[]
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

  const handleDelete = async () => {
    if (!product) return

    try {
      await deleteProduct(product.id)
      toast.success('Producto eliminado exitosamente')
      router.push('/dashboard/products')
  } catch (e) {
    toast.error('No se pudo eliminar el producto')
  }
  }

  const handleShare = () => {
    const url = window.location.href
    navigator.clipboard.writeText(url)
    toast.success('Enlace copiado al portapapeles')
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50/50 p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <Skeleton className="h-16 w-full" />
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50/50">
      {/* Header */}
      <ProductDetailHeader
        product={product}
        onBack={() => router.back()}
        onEdit={() => setEditModalOpen(true)}
        onDelete={() => setDeleteConfirmOpen(true)}
        onShare={handleShare}
        isFavorite={isFavorite}
        onToggleFavorite={() => setIsFavorite(!isFavorite)}
      />

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Product Image */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card className="border-0 shadow-lg overflow-hidden">
                <CardContent className="p-0">
                  <div className="aspect-square bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center relative group">
                    {productImageUrl ? (
                      <>
                        <Image
                          src={productImageUrl}
                          alt={product?.name || ''}
                          fill
                          className="object-cover"
                          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 600px"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-200" />
                      </>
                    ) : (
                      <div className="text-center p-8">
                        <ImageIcon className="h-24 w-24 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-500 font-medium">Sin imagen</p>
                        <Button variant="outline" size="sm" className="mt-4">
                          <Plus className="h-4 w-4 mr-2" />
                          Agregar Imagen
                        </Button>
                      </div>
                    )}
                  </div>
                  {product?.images && product.images.length > 1 && (
                    <div className="flex gap-2 p-4">
                      {product.images.slice(0, 6).map((u, i) => (
                        <div key={`${u}-${i}`} className="w-14 h-14 rounded-md overflow-hidden border relative">
                          <Image src={resolveImageUrl(u)} alt={`${product?.name || ''} ${i + 1}`} fill className="object-cover" sizes="56px" />
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Tabs */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-4 h-12">
                  <TabsTrigger value="overview" className="gap-2">
                    <Package className="h-4 w-4" />
                    <span className="hidden sm:inline">Resumen</span>
                  </TabsTrigger>
                  <TabsTrigger value="inventory" className="gap-2">
                    <BarChart3 className="h-4 w-4" />
                    <span className="hidden sm:inline">Inventario</span>
                  </TabsTrigger>
                  <TabsTrigger value="history" className="gap-2">
                    <History className="h-4 w-4" />
                    <span className="hidden sm:inline">Historial</span>
                  </TabsTrigger>
                  <TabsTrigger value="settings" className="gap-2">
                    <Settings className="h-4 w-4" />
                    <span className="hidden sm:inline">Ajustes</span>
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="mt-6">
                  <Card className="border-0 shadow-lg">
                    <CardHeader>
                      <CardTitle>Información del Producto</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-sm font-semibold text-gray-600">Descripción</label>
                          <p className="text-gray-900">{product.description || 'Sin descripción'}</p>
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-semibold text-gray-600">Marca</label>
                          <p className="text-gray-900">{product.brand || 'Sin marca'}</p>
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-semibold text-gray-600">Categoría</label>
                          <Badge variant="outline" className="text-sm">
                            {product.category?.name || 'Sin categoría'}
                          </Badge>
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-semibold text-gray-600">Proveedor</label>
                          <Badge variant="outline" className="text-sm">
                            {product.supplier?.name || 'Sin proveedor'}
                          </Badge>
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-semibold text-gray-600">Código de Barras</label>
                          <code className="text-sm bg-gray-100 px-3 py-1.5 rounded-md block">
                            {product.barcode || 'Sin código'}
                          </code>
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-semibold text-gray-600">Unidad de Medida</label>
                          <p className="text-gray-900">{product.unit_measure || 'unidad'}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="inventory" className="mt-6">
                  <Card className="border-0 shadow-lg">
                    <CardHeader>
                      <CardTitle>Gestión de Inventario</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="text-center p-6 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl">
                          <Package className="h-10 w-10 text-blue-600 mx-auto mb-3" />
                          <p className="text-3xl font-bold text-blue-900">{product.stock_quantity}</p>
                          <p className="text-sm text-blue-600 mt-1">Stock Actual</p>
                        </div>
                        <div className="text-center p-6 bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl">
                          <AlertTriangle className="h-10 w-10 text-amber-600 mx-auto mb-3" />
                          <p className="text-3xl font-bold text-amber-900">{product.min_stock}</p>
                          <p className="text-sm text-amber-600 mt-1">Stock Mínimo</p>
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <Button className="flex-1">
                          <Plus className="h-4 w-4 mr-2" />
                          Agregar Stock
                        </Button>
                        <Button variant="outline" className="flex-1">
                          <Edit className="h-4 w-4 mr-2" />
                          Ajustar Stock
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="history" className="mt-6">
                  <Card className="border-0 shadow-lg">
                    <CardHeader>
                      <CardTitle>Historial de Movimientos</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {stockMovements.map((movement) => (
                          <div key={movement.id} className="flex items-center gap-4 p-4 border rounded-xl hover:bg-gray-50 transition-colors">
                            <div className={`p-3 rounded-xl ${movement.type === 'entrada' ? 'bg-green-100' :
                              movement.type === 'salida' ? 'bg-red-100' : 'bg-blue-100'
                              }`}>
                              {movement.type === 'entrada' ? (
                                <Upload className={`h-5 w-5 ${movement.type === 'entrada' ? 'text-green-600' : ''}`} />
                              ) : movement.type === 'salida' ? (
                                <Download className="h-5 w-5 text-red-600" />
                              ) : (
                                <Edit className="h-5 w-5 text-blue-600" />
                              )}
                            </div>
                            <div className="flex-1">
                              <p className="font-semibold text-gray-900">
                                {movement.type === 'entrada' ? 'Entrada' :
                                  movement.type === 'salida' ? 'Salida' : 'Ajuste'}
                                {' '}de {Math.abs(movement.quantity)} unidades
                              </p>
                              <p className="text-sm text-gray-600">{movement.reason}</p>
                              <p className="text-xs text-gray-400 mt-1">
                                {formatDate(movement.date)} • {movement.user}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-mono text-gray-600">
                                {movement.previousStock} → {movement.newStock}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-0 shadow-lg mt-6">
                    <CardHeader>
                      <CardTitle>Historial de Precios</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {priceHistory.length === 0 ? (
                          <p className="text-sm text-gray-500">Sin cambios de precio registrados</p>
                        ) : (
                          priceHistory.map((ph) => (
                            <div key={ph.id} className="flex items-center justify-between p-4 border rounded-xl hover:bg-gray-50 transition-colors">
                              <div>
                                <p className="font-semibold text-gray-900">
                                  {(ph.type === 'purchase' ? 'Compra' : ph.type === 'sale' ? 'Venta' : 'Mayorista')}: {formatCurrency(ph.old_price)} → {formatCurrency(ph.new_price)}
                                </p>
                                {ph.change_reason && (
                                  <p className="text-sm text-gray-600">{ph.change_reason}</p>
                                )}
                                <p className="text-xs text-gray-400 mt-1">{formatDate(ph.created_at)}</p>
                              </div>
                              <Badge variant="outline" className="text-xs">
                                {ph.type}
                              </Badge>
                            </div>
                          ))
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="settings" className="mt-6">
                  <Card className="border-0 shadow-lg">
                    <CardHeader>
                      <CardTitle>Configuración del Producto</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between p-4 border rounded-xl">
                        <div>
                          <p className="font-semibold">Estado del Producto</p>
                          <p className="text-sm text-gray-600">Activar o desactivar el producto</p>
                        </div>
                        <Badge variant={product.is_active ? "default" : "secondary"}>
                          {product.is_active ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between p-4 border rounded-xl">
                        <div>
                          <p className="font-semibold">Producto Destacado</p>
                          <p className="text-sm text-gray-600">Mostrar en la página principal</p>
                        </div>
                        <Badge variant={product.featured ? "default" : "secondary"}>
                          {product.featured ? 'Sí' : 'No'}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </motion.div>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Stats Card */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
            >
              <ProductStatsCard product={product} />
            </motion.div>

            {/* Quick Actions */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="text-lg">Acciones Rápidas</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button className="w-full justify-start" onClick={() => setEditModalOpen(true)}>
                    <Edit className="h-4 w-4 mr-2" />
                    Editar Producto
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    <Package className="h-4 w-4 mr-2" />
                    Ajustar Stock
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    <BarChart3 className="h-4 w-4 mr-2" />
                    Ver Reportes
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    <Download className="h-4 w-4 mr-2" />
                    Exportar Datos
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {editModalOpen && (
          <ProductModal
            isOpen={editModalOpen}
            onClose={() => setEditModalOpen(false)}
            product={product ?? null}
            categories={normalizedCategories}
            suppliers={normalizedSuppliers}
            onSave={async (data) => {
              try {
                // Transform dimensions to ensure compatibility
                // Convertir ProductFormData a formato compatible con Supabase
                const transformedData: Database['public']['Tables']['products']['Update'] = {
                  ...data,
                  dimensions: data.dimensions as Json | null
                }
                await updateProduct(product.id, transformedData)
                setEditModalOpen(false)
                toast.success('Producto actualizado exitosamente')
              } catch (_) {
                toast.error('No se pudo actualizar el producto')
              }
            }}
          />
        )}

        {deleteConfirmOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setDeleteConfirmOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-red-100 rounded-xl">
                  <AlertTriangle className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-gray-900">Eliminar Producto</h3>
                  <p className="text-sm text-gray-600">Esta acción no se puede deshacer</p>
                </div>
              </div>
              <p className="text-gray-700 mb-6">
                ¿Estás seguro de que quieres eliminar &quot;{product.name}&quot;?
                Todos los datos relacionados se perderán permanentemente.
              </p>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setDeleteConfirmOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={handleDelete}
                >
                  Eliminar
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
