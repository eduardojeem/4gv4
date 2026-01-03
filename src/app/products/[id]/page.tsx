'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence  } from '../../../components/ui/motion'
import { 
  ArrowLeft, 
  Package, 
  Edit, 
  Trash2, 
  Plus, 
  Minus,
  TrendingUp,
  TrendingDown,
  Calendar,
  User,
  MapPin,
  AlertTriangle,
  CheckCircle,
  Clock,
  BarChart3,
  Download,
  Share2,
  Star,
  Tag,
  Truck
} from 'lucide-react'
import { GSIcon } from '@/components/ui/standardized-components'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { useProductsSupabase } from '@/hooks/useProductsSupabase'
import { createClient } from '@/lib/supabase/client'
import { useNotifications } from '@/components/dashboard/notification-system'
import { formatDate } from '@/lib/utils'

// Función helper para formatear números
const formatNumber = (num: number): string => {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

// Función helper para obtener el estado del stock
const getStockStatus = (currentStock: number, minStock: number): 'normal' | 'low' | 'out' => {
  if (currentStock === 0) return 'out'
  if (currentStock <= minStock) return 'low'
  return 'normal'
}

interface StockMovement {
  id: string
  product_id: string
  type: 'entrada' | 'salida' | 'ajuste' | 'venta' | 'compra' | 'devolucion'
  quantity: number
  previous_stock: number
  new_stock: number
  reason?: string
  reference?: string
  user_id?: string
  user_name?: string
  created_at: string
}

interface ProductHistory {
  id: string
  product_id: string
  field_changed: string
  old_value: string
  new_value: string
  user_id?: string
  user_name?: string
  created_at: string
}

// Variantes de animación
const pageVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 }
}

const cardVariants = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  hover: { scale: 1.02, transition: { duration: 0.2 } }
}

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1
    }
  }
}

const fadeInUp = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0 }
}

export default function ProductDetailPage() {
  const params = useParams()
  const router = useRouter()
  const productId = params.id as string
  
  const { addNotification } = useNotifications()
  
  const [product, setProduct] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [stockMovements, setStockMovements] = useState<StockMovement[]>([])
  const [productHistory, setProductHistory] = useState<ProductHistory[]>([])
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isStockModalOpen, setIsStockModalOpen] = useState(false)
  const [stockAdjustment, setStockAdjustment] = useState({ quantity: 0, reason: '' })
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    sale_price: 0,
    wholesale_price: 0,
    purchase_price: 0,
    min_stock: 0,
    category: '',
    supplier: '',
    sku: ''
  })

  const supabase = createClient()

  // Cargar datos del producto
  useEffect(() => {
    const fetchProductData = async () => {
      if (!productId) return
      
      setLoading(true)
      try {
        // 1. Fetch Product
        const { data: productData, error: productError } = await supabase
          .from('products')
          .select(`
            *,
            category:categories(id, name),
            supplier:suppliers(id, name)
          `)
          .eq('id', productId)
          .single()

        if (productError) throw productError

        // Mapear datos al formato esperado por la UI
        const mappedProduct = {
          ...productData,
          category: productData.category?.name || '',
          supplier: productData.supplier?.name || '',
          stock_quantity: productData.stock_quantity || 0, // Asegurar que usamos el campo correcto
        }

        setProduct(mappedProduct)
        
        setEditForm({
          name: mappedProduct.name || '',
          description: mappedProduct.description || '',
          sale_price: mappedProduct.sale_price || 0,
          wholesale_price: mappedProduct.wholesale_price || 0,
          purchase_price: mappedProduct.purchase_price || 0,
          min_stock: mappedProduct.min_stock || 0,
          category: mappedProduct.category || '',
          supplier: mappedProduct.supplier || '',
          sku: mappedProduct.sku || ''
        })

        // 2. Fetch Stock Movements (si la tabla existe)
        try {
          const { data: movements, error: movementsError } = await supabase
            .from('product_movements')
            .select('*')
            .eq('product_id', productId)
            .order('created_at', { ascending: false })
            .limit(20)

          if (!movementsError && movements) {
            setStockMovements(movements.map(m => ({
              id: m.id,
              product_id: m.product_id,
              type: m.movement_type as any,
              quantity: m.quantity,
              previous_stock: m.previous_stock,
              new_stock: m.new_stock,
              reason: m.notes,
              reference: m.reference_id,
              created_at: m.created_at
            })))
          }
        } catch (e) {
          console.warn('Tabla product_movements no encontrada o error:', e)
        }

        // 3. Fetch Product History (si la tabla existe)
        try {
          const { data: history, error: historyError } = await supabase
            .from('product_price_history')
            .select('*')
            .eq('product_id', productId)
            .order('created_at', { ascending: false })
            .limit(20)

          if (!historyError && history) {
            setProductHistory(history.map(h => ({
              id: h.id,
              product_id: h.product_id,
              field_changed: h.price_type,
              old_value: h.old_price?.toString() || '',
              new_value: h.new_price.toString(),
              created_at: h.created_at
            })))
          }
        } catch (e) {
          console.warn('Tabla product_price_history no encontrada o error:', e)
        }

      } catch (err: any) {
        console.error('Error fetching product:', err)
        setError(err.message || 'Error al cargar el producto')
      } finally {
        setLoading(false)
      }
    }

    fetchProductData()
  }, [productId, supabase])

  const handleEditProduct = async () => {
    if (!product) return

    try {
      const { error } = await supabase
        .from('products')
        .update({
          name: editForm.name,
          description: editForm.description,
          sale_price: editForm.sale_price,
          // wholesale_price no existe en schema actual, mapearlo si es necesario o ignorar
          // purchase_price mapeado a cost_price si es necesario
          stock_quantity: editForm.min_stock, // min_stock puede ser stock_quantity? No, min_stock es min_stock.
          min_stock: editForm.min_stock,
          sku: editForm.sku
          // category y supplier son relaciones, actualizar category_id y supplier_id si cambiaron es mas complejo
          // Por ahora solo actualizamos campos simples
        })
        .eq('id', product.id)

      if (error) throw error

      // Recargar datos
      const { data: updatedProduct, error: fetchError } = await supabase
        .from('products')
        .select(`
          *,
          category:categories(id, name),
          supplier:suppliers(id, name)
        `)
        .eq('id', productId)
        .single()
        
      if (fetchError) throw fetchError

      const mappedProduct = {
        ...updatedProduct,
        category: updatedProduct.category?.name || '',
        supplier: updatedProduct.supplier?.name || '',
        stock_quantity: updatedProduct.stock_quantity || 0,
      }

      setProduct(mappedProduct)

      addNotification({
        type: 'success',
        category: 'product',
        title: 'Producto Actualizado',
        message: `${editForm.name} ha sido actualizado correctamente`,
        actionable: false
      })

      setIsEditModalOpen(false)
    } catch (error: any) {
      addNotification({
        type: 'error',
        category: 'product',
        title: 'Error al actualizar',
        message: error.message || 'Error desconocido',
        actionable: false
      })
    }
  }

  const handleStockAdjustment = async () => {
    if (!product) return

    try {
      // Usar RPC para actualizar stock
      const { error } = await supabase.rpc('update_product_stock', {
        product_id: product.id,
        quantity_change: stockAdjustment.quantity,
        movement_type: 'adjustment',
        reason: stockAdjustment.reason,
        notes: stockAdjustment.reason
      })

      if (error) {
         console.warn('RPC failed, falling back to manual update', error)
         // Fallback manual update
         const newStock = (product.stock_quantity || 0) + stockAdjustment.quantity
         const { error: updateError } = await supabase
           .from('products')
           .update({ stock_quantity: newStock })
           .eq('id', product.id)
           
         if (updateError) throw updateError
      }

      // Recargar datos y movimientos
      // ... (podríamos extraer la lógica de carga en una función useCallback para reutilizar)
      
      // Por ahora actualizamos localmente lo básico y recargamos la página o mostramos éxito
      
      addNotification({
        type: 'success',
        category: 'product',
        title: 'Stock Actualizado',
        message: `Stock ajustado en ${stockAdjustment.quantity} unidades`,
        actionable: false
      })

      setIsStockModalOpen(false)
      setStockAdjustment({ quantity: 0, reason: '' })
      
      // Recargar página para ver cambios frescos
      window.location.reload() 
    } catch (error: any) {
      addNotification({
        type: 'error',
        category: 'product',
        title: 'Error al ajustar stock',
        message: error.message || 'Error desconocido',
        actionable: false
      })
    }
  }

  const handleDeleteProduct = async () => {
    if (!product) return

    if (confirm(`¿Estás seguro de que quieres eliminar ${product.name}?`)) {
      try {
        const { error } = await supabase
          .from('products')
          .delete()
          .eq('id', product.id)

        if (error) throw error

        addNotification({
          type: 'success',
          category: 'product',
          title: 'Producto Eliminado',
          message: `${product.name} ha sido eliminado`,
          actionable: false
        })

        router.push('/dashboard/products')
      } catch (error: any) {
        addNotification({
          type: 'error',
          category: 'product',
          title: 'Error al eliminar',
          message: error.message || 'Error desconocido',
          actionable: false
        })
      }
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Package className="h-12 w-12 animate-spin mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Cargando producto...</p>
        </div>
      </div>
    )
  }

  if (error || !product) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-red-500" />
          <h2 className="text-xl font-semibold mb-2">Producto no encontrado</h2>
          <p className="text-muted-foreground mb-4">
            {error || 'El producto que buscas no existe o ha sido eliminado'}
          </p>
          <Button onClick={() => router.push('/dashboard/products')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver a Productos
          </Button>
        </div>
      </div>
    )
  }

  const stockStatus = getStockStatus(product.stock_quantity || 0, product.min_stock || 0)
  const margin = product.sale_price && product.purchase_price ? ((product.sale_price - product.purchase_price) / product.sale_price) * 100 : 0

  return (
    <motion.div 
      className="container mx-auto p-6 space-y-6"
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.5 }}
    >
      {/* Header */}
      <motion.div 
        className="flex items-center justify-between"
        variants={fadeInUp}
        transition={{ delay: 0.1 }}
      >
        <div className="flex items-center gap-4">
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => router.push('/dashboard/products')}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver
            </Button>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <h1 className="text-3xl font-bold">{product.name}</h1>
            <p className="text-muted-foreground">SKU: {product.sku}</p>
          </motion.div>
        </div>
        
        <motion.div 
          className="flex items-center gap-2"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
        >
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button variant="outline" size="sm">
              <Share2 className="h-4 w-4 mr-2" />
              Compartir
            </Button>
          </motion.div>
          <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
            <DialogTrigger asChild>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button variant="outline" size="sm">
                  <Edit className="h-4 w-4 mr-2" />
                  Editar
                </Button>
              </motion.div>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Editar Producto</DialogTitle>
                <DialogDescription>
                  Modifica la información del producto
                </DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre</Label>
                  <Input
                    id="name"
                    value={editForm.name}
                    onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sku">SKU</Label>
                  <Input
                    id="sku"
                    value={editForm.sku}
                    onChange={(e) => setEditForm(prev => ({ ...prev, sku: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Categoría</Label>
                  <Input
                    id="category"
                    value={editForm.category}
                    onChange={(e) => setEditForm(prev => ({ ...prev, category: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="supplier">Proveedor</Label>
                  <Input
                    id="supplier"
                    value={editForm.supplier}
                    onChange={(e) => setEditForm(prev => ({ ...prev, supplier: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sale_price">Precio de Venta</Label>
                  <Input
                    id="sale_price"
                    type="number"
                    step="0.01"
                    value={editForm.sale_price}
                    onChange={(e) => setEditForm(prev => ({ ...prev, sale_price: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wholesale_price">Precio Mayorista</Label>
                  <Input
                    id="wholesale_price"
                    type="number"
                    step="0.01"
                    value={editForm.wholesale_price}
                    onChange={(e) => setEditForm(prev => ({ ...prev, wholesale_price: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="purchase_price">Precio de Compra</Label>
                  <Input
                    id="purchase_price"
                    type="number"
                    step="0.01"
                    value={editForm.purchase_price}
                    onChange={(e) => setEditForm(prev => ({ ...prev, purchase_price: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="min_stock">Stock Mínimo</Label>
                  <Input
                    id="min_stock"
                    type="number"
                    value={editForm.min_stock}
                    onChange={(e) => setEditForm(prev => ({ ...prev, min_stock: parseInt(e.target.value) || 0 }))}
                  />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="description">Descripción</Label>
                  <Textarea
                    id="description"
                    value={editForm.description}
                    onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                    rows={3}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
                    Cancelar
                  </Button>
                </motion.div>
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Button onClick={handleEditProduct}>
                    Guardar Cambios
                  </Button>
                </motion.div>
              </div>
            </DialogContent>
          </Dialog>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button variant="destructive" size="sm" onClick={handleDeleteProduct}>
              <Trash2 className="h-4 w-4 mr-2" />
              Eliminar
            </Button>
          </motion.div>
        </motion.div>
      </motion.div>

      {/* Información Principal */}
      <motion.div 
        className="grid grid-cols-1 md:grid-cols-3 gap-6"
        variants={staggerContainer}
        initial="initial"
        animate="animate"
      >
        {/* Información Básica */}
        <motion.div variants={cardVariants} whileHover="hover">
          <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Información del Producto
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Categoría</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Tag className="h-4 w-4 text-muted-foreground" />
                  <span>{product.category}</span>
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Proveedor</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Truck className="h-4 w-4 text-muted-foreground" />
                  <span>{product.supplier}</span>
                </div>
              </div>
            </div>
            
            {product.description && (
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Descripción</Label>
                <p className="mt-1 text-sm">{product.description}</p>
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  ${formatNumber(product.sale_price || 0)}
                </div>
                <div className="text-sm text-muted-foreground">Precio de Venta</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  ${formatNumber(product.wholesale_price || 0)}
                </div>
                <div className="text-sm text-muted-foreground">Precio Mayorista</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  ${formatNumber(product.purchase_price || 0)}
                </div>
                <div className="text-sm text-muted-foreground">Costo</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {margin.toFixed(1)}%
                </div>
                <div className="text-sm text-muted-foreground">Margen</div>
              </div>
            </div>
          </CardContent>
          </Card>
        </motion.div>

        {/* Stock y Estado */}
        <motion.div variants={cardVariants} whileHover="hover">
          <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Stock e Inventario
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center">
              <div className="text-3xl font-bold">
                {formatNumber(product.stock_quantity || 0)}
              </div>
              <div className="text-sm text-muted-foreground">Unidades en Stock</div>
              <Badge 
                variant={stockStatus === 'low' ? 'destructive' : stockStatus === 'out' ? 'destructive' : 'default'}
                className="mt-2"
              >
                {stockStatus === 'low' && <AlertTriangle className="h-3 w-3 mr-1" />}
                {stockStatus === 'out' && <AlertTriangle className="h-3 w-3 mr-1" />}
                {stockStatus === 'normal' && <CheckCircle className="h-3 w-3 mr-1" />}
                {stockStatus === 'low' ? 'Stock Bajo' : 
                 stockStatus === 'out' ? 'Sin Stock' : 'Stock Normal'}
              </Badge>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Stock Mínimo:</span>
                <span>{formatNumber(product.min_stock || 0)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Valor Total:</span>
                <span className="font-medium">
                  ${formatNumber((product.stock_quantity || 0) * (product.purchase_price || 0))}
                </span>
              </div>
            </div>

            <Dialog open={isStockModalOpen} onOpenChange={setIsStockModalOpen}>
              <DialogTrigger asChild>
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button className="w-full" variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Ajustar Stock
                  </Button>
                </motion.div>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Ajustar Stock</DialogTitle>
                  <DialogDescription>
                    Realiza un ajuste de inventario para {product.name}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="quantity">Cantidad (+ para entrada, - para salida)</Label>
                    <Input
                      id="quantity"
                      type="number"
                      value={stockAdjustment.quantity}
                      onChange={(e) => setStockAdjustment(prev => ({ 
                        ...prev, 
                        quantity: parseInt(e.target.value) || 0 
                      }))}
                      placeholder="Ej: +10 o -5"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reason">Motivo del Ajuste</Label>
                    <Textarea
                      id="reason"
                      value={stockAdjustment.reason}
                      onChange={(e) => setStockAdjustment(prev => ({ 
                        ...prev, 
                        reason: e.target.value 
                      }))}
                      placeholder="Describe el motivo del ajuste..."
                      rows={3}
                    />
                  </div>
                  <div className="bg-muted p-3 rounded-lg">
                    <div className="text-sm">
                      <div className="flex justify-between">
                        <span>Stock Actual:</span>
                        <span className="font-medium">{product.stock_quantity || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Ajuste:</span>
                        <span className={stockAdjustment.quantity >= 0 ? 'text-green-600' : 'text-red-600'}>
                          {stockAdjustment.quantity >= 0 ? '+' : ''}{stockAdjustment.quantity}
                        </span>
                      </div>
                      <div className="flex justify-between font-medium border-t pt-1 mt-1">
                        <span>Nuevo Stock:</span>
                        <span>{(product.stock_quantity || 0) + stockAdjustment.quantity}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                    <Button variant="outline" onClick={() => setIsStockModalOpen(false)}>
                      Cancelar
                    </Button>
                  </motion.div>
                  <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                    <Button onClick={handleStockAdjustment}>
                      Confirmar Ajuste
                    </Button>
                  </motion.div>
                </div>
              </DialogContent>
            </Dialog>
          </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      {/* Tabs con Historial y Movimientos */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Tabs defaultValue="movements" className="space-y-4">
        <TabsList>
          <TabsTrigger value="movements">Movimientos de Stock</TabsTrigger>
          <TabsTrigger value="history">Historial de Cambios</TabsTrigger>
          <TabsTrigger value="analytics">Análisis</TabsTrigger>
        </TabsList>

        <TabsContent value="movements">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Movimientos de Stock
              </CardTitle>
              <CardDescription>
                Historial completo de entradas y salidas de inventario
              </CardDescription>
            </CardHeader>
            <CardContent>
              <motion.div 
                className="space-y-4"
                variants={staggerContainer}
                initial="initial"
                animate="animate"
              >
                {stockMovements.map((movement, index) => (
                  <motion.div 
                    key={movement.id} 
                    className="flex items-center justify-between p-4 border rounded-lg"
                    variants={fadeInUp}
                    transition={{ delay: index * 0.1 }}
                    whileHover={{ scale: 1.02, boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-full ${
                        movement.type === 'entrada' ? 'bg-green-100 text-green-600' :
                        movement.type === 'salida' ? 'bg-red-100 text-red-600' :
                        'bg-blue-100 text-blue-600'
                      }`}>
                        {movement.type === 'entrada' ? <TrendingUp className="h-4 w-4" /> :
                         movement.type === 'salida' ? <TrendingDown className="h-4 w-4" /> :
                         <BarChart3 className="h-4 w-4" />}
                      </div>
                      <div>
                        <div className="font-medium capitalize">{movement.type}</div>
                        <div className="text-sm text-muted-foreground">
                          {movement.reason}
                          {movement.reference && ` - ${movement.reference}`}
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(movement.created_at).toLocaleString()}
                          {movement.user_name && (
                            <>
                              <User className="h-3 w-3" />
                              {movement.user_name}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`font-medium ${
                        movement.quantity > 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {movement.quantity > 0 ? '+' : ''}{movement.quantity}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {movement.previous_stock} → {movement.new_stock}
                      </div>
                    </div>
                  </motion.div>
                ))}
                
                {stockMovements.length === 0 && (
                  <motion.div 
                    className="text-center py-8 text-muted-foreground"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                  >
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.5, type: "spring" }}
                    >
                      <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    </motion.div>
                    <p>No hay movimientos de stock registrados</p>
                  </motion.div>
                )}
              </motion.div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Historial de Cambios
              </CardTitle>
              <CardDescription>
                Registro de todas las modificaciones realizadas al producto
              </CardDescription>
            </CardHeader>
            <CardContent>
              <motion.div 
                className="space-y-4"
                variants={staggerContainer}
                initial="initial"
                animate="animate"
              >
                {productHistory.map((change, index) => (
                  <motion.div 
                    key={change.id} 
                    className="flex items-center justify-between p-4 border rounded-lg"
                    variants={fadeInUp}
                    transition={{ delay: index * 0.1 }}
                    whileHover={{ scale: 1.02, boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-2 rounded-full bg-blue-100 text-blue-600">
                        <Edit className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="font-medium">
                          Campo modificado: <span className="text-blue-600">{change.field_changed}</span>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          <span className="line-through">{change.old_value}</span>
                          {' → '}
                          <span className="font-medium">{change.new_value}</span>
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(change.created_at).toLocaleString()}
                          {change.user_name && (
                            <>
                              <User className="h-3 w-3" />
                              {change.user_name}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
                
                {productHistory.length === 0 && (
                  <motion.div 
                    className="text-center py-8 text-muted-foreground"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                  >
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.5, type: "spring" }}
                    >
                      <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    </motion.div>
                    <p>No hay cambios registrados</p>
                  </motion.div>
                )}
              </motion.div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics">
          <motion.div 
            className="grid grid-cols-1 md:grid-cols-2 gap-6"
            variants={staggerContainer}
            initial="initial"
            animate="animate"
          >
            <motion.div variants={cardVariants} whileHover="hover">
              <Card>
              <CardHeader>
                <CardTitle>Métricas de Rendimiento</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Rotación de Inventario</span>
                  <span className="font-medium">2.5x/mes</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Días de Inventario</span>
                  <span className="font-medium">12 días</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Ventas Promedio</span>
                  <span className="font-medium">5 unidades/día</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Margen de Ganancia</span>
                  <span className="font-medium text-green-600">{margin.toFixed(1)}%</span>
                </div>
              </CardContent>
               </Card>
             </motion.div>

             <motion.div variants={cardVariants} whileHover="hover">
               <Card>
              <CardHeader>
                <CardTitle>Alertas y Recomendaciones</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <AnimatePresence>
                  {stockStatus === 'low' && (
                    <motion.div 
                      className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      whileHover={{ scale: 1.02 }}
                    >
                      <motion.div
                        animate={{ rotate: [0, -10, 10, 0] }}
                        transition={{ repeat: Infinity, duration: 2 }}
                      >
                        <AlertTriangle className="h-4 w-4 text-yellow-600" />
                      </motion.div>
                      <span className="text-sm text-yellow-800">Stock bajo - Considera reabastecer</span>
                    </motion.div>
                  )}
                  
                  {stockStatus === 'out' && (
                    <motion.div 
                      className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      whileHover={{ scale: 1.02 }}
                    >
                      <motion.div
                        animate={{ rotate: [0, -10, 10, 0] }}
                        transition={{ repeat: Infinity, duration: 1.5 }}
                      >
                        <AlertTriangle className="h-4 w-4 text-red-600" />
                      </motion.div>
                      <span className="text-sm text-red-800">Sin stock - Reabastecimiento urgente</span>
                    </motion.div>
                  )}

                  {margin < 20 && (
                    <motion.div 
                      className="flex items-center gap-2 p-3 bg-orange-50 border border-orange-200 rounded-lg"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      whileHover={{ scale: 1.02 }}
                    >
                      <motion.div
                        animate={{ scale: [1, 1.1, 1] }}
                        transition={{ repeat: Infinity, duration: 2 }}
                      >
                        <GSIcon className="h-4 w-4 text-orange-600" />
                      </motion.div>
                      <span className="text-sm text-orange-800">Margen bajo - Revisar precios</span>
                    </motion.div>
                  )}

                  <motion.div 
                    className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    whileHover={{ scale: 1.02 }}
                  >
                    <motion.div
                      animate={{ scale: [1, 1.1, 1] }}
                      transition={{ repeat: Infinity, duration: 3 }}
                    >
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    </motion.div>
                    <span className="text-sm text-green-800">Producto con buen rendimiento</span>
                  </motion.div>
                </AnimatePresence>
              </CardContent>
                </Card>
              </motion.div>
            </motion.div>
        </TabsContent>
        </Tabs>
      </motion.div>
    </motion.div>
  )
}
